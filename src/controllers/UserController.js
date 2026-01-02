import { User } from '../models/User.js'
import { FavoriteSong } from '../models/FavoriteSong.js'
import { Annotation } from '../models/Annotation.js'
import { Translation } from '../models/Translation.js'
import { ModerationRequest } from '../models/ModerationRequest.js'
import { makeBaseController } from './baseController.js'
import { moderationService } from '../services/moderationService.js'
import { normalizePagination, buildPagination } from '../utils/pagination.js'

const allowedCreateFields = [
  'username',
  'displayName',
  'email',
  'avatarUrl',
  'bio',
  'badges',
  'passwordHash',
  'passwordSalt',
  'roleId',
]

const allowedUpdateFields = [
  'username',
  'email',
  'displayName',
  'avatarUrl',
  'bio',
  'badges',
  'passwordHash',
  'passwordSalt',
  'roleId',
]

const parseCount = (value) => {
  const asNumber = Number(value)
  return Number.isNaN(asNumber) ? 0 : asNumber
}

const baseModerationCounts = () => ({
  pending: 0,
  approved: 0,
  rejected: 0,
  applied: 0,
})

const buildCountMap = (rows) => {
  const map = new Map()
  for (const row of rows) {
    map.set(row.userId, parseCount(row.count))
  }
  return map
}

const buildModerationMap = (rows) => {
  const map = new Map()
  for (const row of rows) {
    const userId = row.userId
    const status = row.status
    const count = parseCount(row.count)
    if (!map.has(userId)) {
      map.set(userId, baseModerationCounts())
    }
    if (status && Object.prototype.hasOwnProperty.call(map.get(userId), status)) {
      map.get(userId)[status] = count
    }
  }
  return map
}

const buildModerationActivity = (counts, includePending) => {
  const merged = { ...baseModerationCounts(), ...(counts ?? {}) }
  if (!includePending) {
    merged.pending = 0
  }
  return {
    ...merged,
    total: merged.pending + merged.approved + merged.rejected + merged.applied,
  }
}

const buildActivities = (userId, maps) => ({
  favorites: maps.favorites.get(userId) ?? 0,
  annotations: maps.annotations.get(userId) ?? 0,
  translations: maps.translations.get(userId) ?? 0,
})

const countRows = async (query) => {
  const row = await query.count({ count: '*' }).first()
  return parseCount(row?.count)
}

const baseController = makeBaseController(User, {
  allowedCreateFields,
  allowedUpdateFields,
})

export const UserController = {
  ...baseController,

  getAll: async (req, res) => {
    try {
      const { page, pageSize } = normalizePagination(req.query)
      const result = await User.query()
        .orderBy('createdAt', 'desc')
        .page(page - 1, pageSize)
      const rows = result.results
      const userIds = rows.map((row) => row.id).filter(Boolean)
      const currentUserId = req.user?.userId ?? null

      const emptyMaps = {
        favorites: new Map(),
        annotations: new Map(),
        translations: new Map(),
        moderation: new Map(),
      }

      let maps = emptyMaps
      if (userIds.length > 0) {
        const [favoritesRows, annotationsRows, translationsRows, moderationRows] =
          await Promise.all([
            FavoriteSong.query()
              .select('userId')
              .count({ count: '*' })
              .whereIn('userId', userIds)
              .groupBy('userId'),
            Annotation.query()
              .select({ userId: 'createdBy' })
              .count({ count: '*' })
              .whereIn('createdBy', userIds)
              .groupBy('createdBy'),
            Translation.query()
              .select({ userId: 'createdBy' })
              .count({ count: '*' })
              .whereIn('createdBy', userIds)
              .groupBy('createdBy'),
            ModerationRequest.query()
              .select({ userId: 'createdBy', status: 'status' })
              .count({ count: '*' })
              .whereIn('createdBy', userIds)
              .groupBy('createdBy', 'status'),
          ])

        maps = {
          favorites: buildCountMap(favoritesRows),
          annotations: buildCountMap(annotationsRows),
          translations: buildCountMap(translationsRows),
          moderation: buildModerationMap(moderationRows),
        }
      }

      const items = rows.map((row) => {
        const data = row.toJSON ? row.toJSON() : row
        const includePending = currentUserId && currentUserId === data.id
        return {
          ...data,
          activities: {
            ...buildActivities(data.id, maps),
            moderation: buildModerationActivity(
              maps.moderation.get(data.id),
              includePending,
            ),
          },
        }
      })

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
      const { id } = req.params
      const user = await User.query().findById(id)
      if (!user) return res.status(404).json({ error: 'Not found' })

      const currentUserId = req.user?.userId ?? null
      const includePending = currentUserId && currentUserId === id

      const [
        favoritesCount,
        annotationsCount,
        translationsCount,
        moderationRows,
        history,
      ] =
        await Promise.all([
          countRows(FavoriteSong.query().where('userId', id)),
          countRows(Annotation.query().where('createdBy', id)),
          countRows(Translation.query().where('createdBy', id)),
          ModerationRequest.query()
            .select({ userId: 'createdBy', status: 'status' })
            .count({ count: '*' })
            .where('createdBy', id)
            .groupBy('createdBy', 'status'),
          moderationService.getHistoryForTarget({
            tableName: User.tableName,
            targetKey: { id },
          }),
        ])

      const moderationCounts =
        moderationRows.length > 0
          ? buildModerationMap(moderationRows).get(id)
          : baseModerationCounts()

      const data = user.toJSON ? user.toJSON() : user
      res.json({
        ...data,
        activities: {
          favorites: favoritesCount,
          annotations: annotationsCount,
          translations: translationsCount,
          moderation: buildModerationActivity(moderationCounts, includePending),
        },
        moderationHistory: history,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal error' })
    }
  },

  getFullProfile: async (req, res) => {
    try {
      const { id } = req.params
      const user = await User.query()
        .findById(id)
        .select(
          'users.id',
          'users.username',
          'users.displayName',
          'users.email',
          'users.avatarUrl',
          'users.bio',
          'users.reputation',
          'users.isBanned',
          'users.createdAt',
          'roles.name as roleName',
        )
        .leftJoin('roles', 'users.roleId', 'roles.id')

      if (!user) return res.status(404).json({ error: 'Not found' })

      const currentUserId = req.user?.userId ?? null
      const includePending = currentUserId && currentUserId === id

      const [
        favoritesCount,
        annotationsCount,
        translationsCount,
        moderationRows,
      ] =
        await Promise.all([
          countRows(FavoriteSong.query().where('userId', id)),
          countRows(Annotation.query().where('createdBy', id)),
          countRows(Translation.query().where('createdBy', id)),
          ModerationRequest.query()
            .select({ userId: 'createdBy', status: 'status' })
            .count({ count: '*' })
            .where('createdBy', id)
            .groupBy('createdBy', 'status'),
        ])

      const moderationCounts =
        moderationRows.length > 0
          ? buildModerationMap(moderationRows).get(id)
          : baseModerationCounts()

      const profile = {
        id: user.id,
        username: user.username,
        displayName: user.displayName ?? user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        reputation: user.reputation,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        role: user.roleName ?? null,
        stats: {
          favorites: favoritesCount,
          annotations: annotationsCount,
          translations: translationsCount,
        },
        activities: {
          favorites: favoritesCount,
          annotations: annotationsCount,
          translations: translationsCount,
          moderation: buildModerationActivity(moderationCounts, includePending),
        },
      }

      res.json(profile)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal error' })
    }
  },

  update: async (req, res) => {
    const requestedId = req.params?.id
    const currentUserId = req.user?.userId

    if (currentUserId && requestedId && currentUserId === requestedId) {
      const allowedSelfFields = [
        'username',
        'email',
        'displayName',
        'avatarUrl',
        'bio',
        'badges',
      ]
      const data = {}
      for (const key of allowedSelfFields) {
        if (req.body?.[key] !== undefined) {
          data[key] = req.body[key]
        }
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No changes provided' })
      }

      try {
        const updated = await User.query()
          .patch(data)
          .where({ id: requestedId })
          .returning('*')

        if (!updated || (Array.isArray(updated) && updated.length === 0)) {
          return res.status(404).json({ error: 'Not found' })
        }

        return res.json(updated[0] ?? updated)
      } catch (err) {
        console.error(err)
        return res
          .status(400)
          .json({ error: 'Invalid data', details: err.message })
      }
    }

    return baseController.update(req, res)
  },
}
