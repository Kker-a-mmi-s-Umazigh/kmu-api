import crypto from 'node:crypto'
import { moderationService } from '../services/moderationService.js'
import knex from '../config/knexClient.js'
import { normalizePagination, buildPagination } from '../utils/pagination.js'

export const makeBaseController = (
  Model,
  {
    idColumns = Model.idColumn,
    allowedCreateFields = null,
    allowedUpdateFields = null,
    skipModeration = false,
    getByIdGraph = null,
    getByIdModifiers = null,
    serializeGetById = null,
    getAllGraph = null,
    serializeGetAll = null,
    transformCreateData = null,
    transformUpdateData = null,
  } = {},
) => {
  const resolveDefaultOrder = () => {
    const hasUpdatedAt = Boolean(Model?.jsonSchema?.properties?.updatedAt)
    if (hasUpdatedAt) {
      return [{ column: 'updatedAt', order: 'desc' }]
    }
    const hasCreatedAt = Boolean(Model?.jsonSchema?.properties?.createdAt)
    if (hasCreatedAt) {
      return [{ column: 'createdAt', order: 'desc' }]
    }
    if (Array.isArray(idColumns)) {
      return idColumns.map((column) => ({ column, order: 'desc' }))
    }
    if (typeof idColumns === 'string') {
      return [{ column: idColumns, order: 'desc' }]
    }
    return []
  }

  function extractId(req) {
    if (Array.isArray(idColumns)) {
      const idObj = {}
      for (const col of idColumns) {
        if (!(col in req.params)) {
          throw new Error(`Missing route param ${col}`)
        }
        idObj[col] = req.params[col]
      }
      return idObj
    } else {
      return { [idColumns]: req.params[idColumns] }
    }
  }

  function filterBody(body, allowed) {
    if (!allowed) return body
    const out = {}
    for (const k of allowed) {
      if (body[k] !== undefined) out[k] = body[k]
    }
    return out
  }

  const isPlainObject = (value) =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

  const ensureBodyObject = (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Invalid payload' })
      return false
    }
    return true
  }

  const applyTransform = (data, transform) =>
    transform ? transform(data) : data

  function buildTargetKeyFromData(data) {
    if (Array.isArray(idColumns)) {
      const targetKey = {}
      for (const col of idColumns) {
        if (data[col] === undefined) return null
        targetKey[col] = data[col]
      }
      return targetKey
    }

    if (typeof idColumns === 'string') {
      if (data[idColumns] === undefined) return null
      return { [idColumns]: data[idColumns] }
    }

    return null
  }

  async function shouldModerate(req, isModeratorOverride) {
    if (skipModeration) return false
    const userId = req.user?.userId
    if (!userId) return false
    if (typeof isModeratorOverride === 'boolean') {
      return !isModeratorOverride
    }
    return !(await moderationService.isModerator(userId))
  }

  const applySerializer = (row, serializer) =>
    serializer ? serializer(row) : row

  return {
    getAll: async (req, res) => {
      try {
        let query = Model.query()
        if (getAllGraph) {
          query = query.withGraphFetched(getAllGraph)
        }
        const defaultOrder = resolveDefaultOrder()
        if (defaultOrder.length > 0) {
          query = query.orderBy(defaultOrder)
        }
        const { page, pageSize } = normalizePagination(req.query)
        const result = await query.page(page - 1, pageSize)
        const items = result.results.map((row) =>
          applySerializer(row, serializeGetAll),
        )
        res.json({
          items,
          pagination: buildPagination({
            page,
            pageSize,
            total: result.total,
          }),
        })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal error' })
      }
    },

    getById: async (req, res) => {
      try {
        const whereObj = extractId(req)

        let query = Model.query().findOne(whereObj)

        if (getByIdGraph) {
          query = query.withGraphFetched(getByIdGraph)
        }
        
        if (getByIdModifiers) {
          query = query.modifiers(getByIdModifiers)
        }
        const row = await query

        if (!row) return res.status(404).json({ error: 'Not found' })

        const payload = applySerializer(row, serializeGetById)
        const data = payload?.toJSON ? payload.toJSON() : payload
        const history = await moderationService.getHistoryForTarget({
          tableName: Model.tableName,
          targetKey: whereObj,
        })

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return res.json(data)
        }

        res.json({
          ...data,
          moderationHistory: history,
        })
      } catch (err) {
        console.error(err)

        res.status(500).json({ error: 'Internal error' })
      }
    },

    create: async (req, res) => {
      try {
        if (!ensureBodyObject(req, res)) return

        const data = applyTransform(
          filterBody(req.body, allowedCreateFields),
          transformCreateData,
        )
        const userId = req.user?.userId
        const isModerator = userId
          ? await moderationService.isModerator(userId)
          : false

        if (
          typeof idColumns === 'string' &&
          idColumns === 'id' &&
          data.id === undefined
        ) {
          data.id = crypto.randomUUID()
        }

        if (await shouldModerate(req, isModerator)) {
          const dataForInsert = { ...data }
          if (
            typeof idColumns === 'string' &&
            idColumns === 'id' &&
            dataForInsert.id === undefined
          ) {
            dataForInsert.id = crypto.randomUUID()
          }

          const targetKey = buildTargetKeyFromData(dataForInsert)
          const moderation = await moderationService.submitChange({
            userId,
            tableName: Model.tableName,
            operation: 'insert',
            targetKey,
            dataNew: dataForInsert,
            dataOld: null,
          })

          return res.status(202).json({
            status: 'pending',
            request: moderation.request,
            change: moderation.change,
          })
        }

        if (isModerator && userId) {
          const created = await knex.transaction(async (trx) => {
            const createdRow = await Model.query(trx)
              .insert(data)
              .returning('*')

            const targetKey = buildTargetKeyFromData(
              createdRow?.toJSON ? createdRow.toJSON() : createdRow,
            )

            if (targetKey) {
              await moderationService.logAppliedChanges({
                userId,
                changes: [
                  {
                    tableName: Model.tableName,
                    operation: 'insert',
                    targetKey,
                    dataNew: createdRow?.toJSON
                      ? createdRow.toJSON()
                      : createdRow,
                    dataOld: null,
                  },
                ],
                trx,
              })
            }

            return createdRow
          })

          return res.status(201).json(created)
        }

        const created = await Model.query().insert(data).returning('*')
        return res.status(201).json(created)
      } catch (err) {
        console.error(err)
        res.status(400).json({ error: 'Invalid data', details: err.message })
      }
    },

    update: async (req, res) => {
      try {
        if (!ensureBodyObject(req, res)) return

        const whereObj = extractId(req)
        const data = applyTransform(
          filterBody(req.body, allowedUpdateFields),
          transformUpdateData,
        )
        const userId = req.user?.userId
        const isModerator = userId
          ? await moderationService.isModerator(userId)
          : false

        if (await shouldModerate(req, isModerator)) {
          const existing = await Model.query().findOne(whereObj)
          if (!existing) {
            return res.status(404).json({ error: 'Not found' })
          }

          const moderation = await moderationService.submitChange({
            userId,
            tableName: Model.tableName,
            operation: 'update',
            targetKey: whereObj,
            dataNew: data,
            dataOld: existing?.toJSON ? existing.toJSON() : existing,
          })

          return res.status(202).json({
            status: 'pending',
            request: moderation.request,
            change: moderation.change,
          })
        }

        if (isModerator && userId) {
          const updated = await knex.transaction(async (trx) => {
            const existing = await Model.query(trx).findOne(whereObj)
            if (!existing) return null

            const updatedRows = await Model.query(trx)
              .patch(data)
              .where(whereObj)
              .returning('*')

            const updatedRow = updatedRows?.[0] ?? updatedRows

            await moderationService.logAppliedChanges({
              userId,
              changes: [
                {
                  tableName: Model.tableName,
                  operation: 'update',
                  targetKey: whereObj,
                  dataNew: data,
                  dataOld: existing?.toJSON ? existing.toJSON() : existing,
                },
              ],
              trx,
            })

            return updatedRow
          })

          if (!updated) {
            return res.status(404).json({ error: 'Not found' })
          }

          return res.json(updated)
        }

        const updated = await Model.query()
          .patch(data)
          .where(whereObj)
          .returning('*')

        if (!updated || (Array.isArray(updated) && updated.length === 0)) {
          return res.status(404).json({ error: 'Not found' })
        }

        res.json(updated[0] ?? updated)
      } catch (err) {
        console.error(err)
        res.status(400).json({ error: 'Invalid data', details: err.message })
      }
    },

    remove: async (req, res) => {
      try {
        const whereObj = extractId(req)
        const userId = req.user?.userId
        const isModerator = userId
          ? await moderationService.isModerator(userId)
          : false

        if (await shouldModerate(req, isModerator)) {
          const existing = await Model.query().findOne(whereObj)
          if (!existing) {
            return res.status(404).json({ error: 'Not found' })
          }

          const moderation = await moderationService.submitChange({
            userId,
            tableName: Model.tableName,
            operation: 'delete',
            targetKey: whereObj,
            dataNew: null,
            dataOld: existing?.toJSON ? existing.toJSON() : existing,
          })

          return res.status(202).json({
            status: 'pending',
            request: moderation.request,
            change: moderation.change,
          })
        }

        if (isModerator && userId) {
          const deleted = await knex.transaction(async (trx) => {
            const existing = await Model.query(trx).findOne(whereObj)
            if (!existing) return null

            await Model.query(trx).delete().where(whereObj)

            await moderationService.logAppliedChanges({
              userId,
              changes: [
                {
                  tableName: Model.tableName,
                  operation: 'delete',
                  targetKey: whereObj,
                  dataNew: null,
                  dataOld: existing?.toJSON ? existing.toJSON() : existing,
                },
              ],
              trx,
            })

            return true
          })

          if (!deleted) {
            return res.status(404).json({ error: 'Not found' })
          }
          return res.status(204).send()
        }

        const deletedCount = await Model.query().delete().where(whereObj)

        if (!deletedCount) {
          return res.status(404).json({ error: 'Not found' })
        }
        res.status(204).send()
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal error' })
      }
    },
  }
}
