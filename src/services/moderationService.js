import knex from "../config/knexClient.js"
import { ModerationRequest } from "../models/ModerationRequest.js"
import { ModerationChange } from "../models/ModerationChange.js"
import { normalizeAnnotationPayload } from "../utils/annotationPayload.js"

const ALLOWED_TABLES = new Set([
  "roles",
  "users",
  "languages",
  "artists",
  "albums",
  "songs",
  "refreshTokens",
  "songSources",
  "lyricLines",
  "lyricSections",
  "translations",
  "translationLines",
  "albumTracks",
  "songArtists",
  "annotations",
  "annotationComments",
  "glossaryTerms",
  "glossaryTermMeanings",
  "glossaryTermLyricLines",
  "notifications",
  "reports",
  "annotationVotes",
  "favoriteSongs",
])

const MODERATOR_ROLE_KEYWORDS = ["moderateur", "moderator", "admin"]

const normalizeRoleName = (name) => {
  if (!name) return ""
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const isModeratorRole = (roleName) => {
  const normalized = normalizeRoleName(roleName)
  return MODERATOR_ROLE_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

const ensureAllowedTable = (tableName) => {
  if (!ALLOWED_TABLES.has(tableName)) {
    const error = new Error("Target table not allowed for moderation")
    error.code = "TABLE_NOT_ALLOWED"
    throw error
  }
}

const cleanJson = (value) => {
  if (value === undefined) return null
  if (value === null) return null
  if (typeof value !== "object") return value
  return JSON.parse(JSON.stringify(value))
}

const getRoleName = async (userId, trx) => {
  const db = trx ?? knex
  const row = await db("users")
    .leftJoin("roles", "users.roleId", "roles.id")
    .select("roles.name as roleName")
    .where("users.id", userId)
    .first()
  return row?.roleName ?? null
}

const applyChange = async (change, trx) => {
  ensureAllowedTable(change.targetTable)

  const targetKey = change.targetKey ?? {}
  const operation = change.operation

  if (operation === "insert") {
    if (!change.dataNew) {
      throw new Error("Missing data for insert operation")
    }
    const dataNew =
      change.targetTable === "annotations"
        ? normalizeAnnotationPayload(change.dataNew, { applyDefaults: true })
        : change.dataNew
    await trx(change.targetTable).insert(dataNew)
    return
  }

  if (!targetKey || Object.keys(targetKey).length === 0) {
    throw new Error("Missing target key for update/delete operation")
  }

  if (operation === "update") {
    const updateData =
      change.targetTable === "annotations"
        ? normalizeAnnotationPayload(change.dataNew || {}, {
            applyDefaults: false,
          })
        : { ...(change.dataNew || {}) }
    for (const key of Object.keys(targetKey)) {
      delete updateData[key]
    }
    if (Object.keys(updateData).length === 0) {
      return
    }
    await trx(change.targetTable).where(targetKey).update(updateData)
    return
  }

  if (operation === "delete") {
    await trx(change.targetTable).where(targetKey).delete()
    return
  }

  throw new Error(`Unsupported moderation operation: ${operation}`)
}

const orderChangesQuery = (query) =>
  query.orderBy([
    { column: "sequence", order: "asc" },
    { column: "createdAt", order: "asc" },
  ])

const mapChangesByRequestId = (changes) => {
  const byRequest = new Map()
  for (const change of changes) {
    const requestId = change.requestId
    if (!byRequest.has(requestId)) {
      byRequest.set(requestId, [])
    }
    byRequest.get(requestId).push(change)
  }
  return byRequest
}

const attachChanges = (requests, changesMap) =>
  requests.map((request) => {
    const data = request?.toJSON ? request.toJSON() : request
    return {
      ...data,
      changes: changesMap.get(request.id) ?? [],
    }
  })

const fetchChangesForRequests = async (requestIds, trx) => {
  if (!requestIds || requestIds.length === 0) return []
  const query = ModerationChange.query(trx).whereIn("requestId", requestIds)
  return orderChangesQuery(query)
}

const fetchChangesForTarget = async (tableName, targetKey, trx) => {
  if (!tableName || !targetKey) return []
  if (Object.keys(targetKey).length === 0) return []

  const query = ModerationChange.query(trx)
    .where("targetTable", tableName)
    .whereRaw('"targetKey" @> ?::jsonb', [JSON.stringify(targetKey)])

  return orderChangesQuery(query)
}

export const moderationService = {
  async isModerator(userId, trx) {
    if (!userId) return false
    const roleName = await getRoleName(userId, trx)
    return isModeratorRole(roleName)
  },

  async submitChanges({ userId, changes }) {
    if (!userId) {
      const error = new Error("Missing userId for moderation request")
      error.code = "MISSING_USER"
      throw error
    }

    if (!Array.isArray(changes) || changes.length === 0) {
      const error = new Error("Missing changes for moderation request")
      error.code = "MISSING_CHANGES"
      throw error
    }

    changes.forEach((change) => ensureAllowedTable(change.tableName))

    return knex.transaction(async (trx) => {
      const request = await ModerationRequest.query(trx)
        .insert({
          status: "pending",
          createdBy: userId,
          createdAt: knex.fn.now(),
        })
        .returning("*")

      const insertedChanges = []
      for (let index = 0; index < changes.length; index += 1) {
        const change = changes[index]
        const created = await ModerationChange.query(trx)
          .insert({
            requestId: request.id,
            targetTable: change.tableName,
            operation: change.operation,
            sequence: index,
            targetKey: cleanJson(change.targetKey),
            dataNew: cleanJson(change.dataNew),
            dataOld: cleanJson(change.dataOld),
            createdAt: knex.fn.now(),
          })
          .returning("*")
        insertedChanges.push(created)
      }

      return { request, changes: insertedChanges }
    })
  },

  async logAppliedChanges({ userId, changes, trx }) {
    if (!userId) {
      const error = new Error("Missing userId for moderation log")
      error.code = "MISSING_USER"
      throw error
    }

    if (!Array.isArray(changes) || changes.length === 0) {
      const error = new Error("Missing changes for moderation log")
      error.code = "MISSING_CHANGES"
      throw error
    }

    changes.forEach((change) => ensureAllowedTable(change.tableName))

    const db = trx ?? knex
    const request = await ModerationRequest.query(db)
      .insert({
        status: "applied",
        createdBy: userId,
        createdAt: knex.fn.now(),
        reviewedAt: knex.fn.now(),
        reviewedBy: userId,
        appliedAt: knex.fn.now(),
      })
      .returning("*")

    const insertedChanges = []
    for (let index = 0; index < changes.length; index += 1) {
      const change = changes[index]
      const created = await ModerationChange.query(db)
        .insert({
          requestId: request.id,
          targetTable: change.tableName,
          operation: change.operation,
          sequence: index,
          targetKey: cleanJson(change.targetKey),
          dataNew: cleanJson(change.dataNew),
          dataOld: cleanJson(change.dataOld),
          createdAt: knex.fn.now(),
        })
        .returning("*")
      insertedChanges.push(created)
    }

    return { request, changes: insertedChanges }
  },

  async submitChange({
    userId,
    tableName,
    operation,
    targetKey,
    dataNew,
    dataOld,
  }) {
    const result = await moderationService.submitChanges({
      userId,
      changes: [
        {
          tableName,
          operation,
          targetKey,
          dataNew,
          dataOld,
        },
      ],
    })

    return { request: result.request, change: result.changes[0] }
  },

  async listRequests({ status } = {}) {
    const query = ModerationRequest.query()

    if (status) {
      query.where("status", status)
    }

    const requests = await query.orderBy("createdAt", "desc")

    if (!requests.length) 
      return []

    const requestIds = requests.map((request) => request.id)
    const changes = await fetchChangesForRequests(requestIds)
    const changesMap = mapChangesByRequestId(changes)
    
    return attachChanges(requests, changesMap)
  },

  async getRequest(requestId) {
    const request = await ModerationRequest.query().findById(requestId)
    if (!request) return null

    const changes = await fetchChangesForRequests([requestId])
    const changesMap = mapChangesByRequestId(changes)
    return attachChanges([request], changesMap)[0]
  },

  async getHistoryForTarget({ tableName, targetKey }) {
    if (!tableName || !targetKey) return []

    const changes = await fetchChangesForTarget(tableName, targetKey)
    if (!changes.length) return []

    const requestIds = [...new Set(changes.map((change) => change.requestId))]
    const requests = await ModerationRequest.query()
      .whereIn("id", requestIds)
      .orderBy("createdAt", "desc")

    const changesMap = mapChangesByRequestId(changes)
    return attachChanges(requests, changesMap)
  },

  async approveRequest({ requestId, reviewerId, decisionNote }) {
    return knex.transaction(async (trx) => {
      const request = await ModerationRequest.query(trx)
        .findById(requestId)
        .forUpdate()

      if (!request) {
        const error = new Error("Moderation request not found")
        error.code = "REQUEST_NOT_FOUND"
        throw error
      }

      if (request.status !== "pending") {
        const error = new Error("Moderation request is not pending")
        error.code = "REQUEST_NOT_PENDING"
        throw error
      }

      await ModerationRequest.query(trx)
        .patch({
          status: "approved",
          reviewedAt: knex.fn.now(),
          reviewedBy: reviewerId,
          decisionNote: decisionNote ?? null,
        })
        .where({ id: requestId })

      const changes = await fetchChangesForRequests([requestId], trx)

      for (const change of changes) {
        await applyChange(change, trx)
      }

      await ModerationRequest.query(trx)
        .patch({
          status: "applied",
          appliedAt: knex.fn.now(),
        })
        .where({ id: requestId })

      const updatedRequest = await ModerationRequest.query(trx).findById(
        requestId,
      )
      const changesMap = mapChangesByRequestId(changes)
      return attachChanges([updatedRequest], changesMap)[0]
    })
  },

  async rejectRequest({ requestId, reviewerId, decisionNote }) {
    return knex.transaction(async (trx) => {
      const request = await ModerationRequest.query(trx)
        .findById(requestId)
        .forUpdate()

      if (!request) {
        const error = new Error("Moderation request not found")
        error.code = "REQUEST_NOT_FOUND"
        throw error
      }

      if (request.status !== "pending") {
        const error = new Error("Moderation request is not pending")
        error.code = "REQUEST_NOT_PENDING"
        throw error
      }

      await ModerationRequest.query(trx)
        .patch({
          status: "rejected",
          reviewedAt: knex.fn.now(),
          reviewedBy: reviewerId,
          decisionNote: decisionNote ?? null,
        })
        .where({ id: requestId })

      const updatedRequest = await ModerationRequest.query(trx).findById(
        requestId,
      )
      const changes = await fetchChangesForRequests([requestId], trx)
      const changesMap = mapChangesByRequestId(changes)
      return attachChanges([updatedRequest], changesMap)[0]
    })
  },
}
