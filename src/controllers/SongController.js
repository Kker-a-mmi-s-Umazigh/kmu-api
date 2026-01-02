import crypto from "node:crypto"
import { Song } from "../models/Song.js"
import { makeBaseController } from "./baseController.js"
import knex from "../config/knexClient.js"
import { moderationService } from "../services/moderationService.js"
import { normalizePagination, buildPagination } from "../utils/pagination.js"

const allowedCreateFields = [
  "title",
  "releaseYear",
  "isPublished",
  "description",
  "languageCode",
  "createdBy",
]

const allowedUpdateFields = [
  "title",
  "releaseYear",
  "isPublished",
  "description",
]

const normalizeArray = (value) => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

const normalizeTranslationInput = (value) => {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  return list.map((item) =>
    typeof item === "string" ? { languageCode: item } : item,
  )
}

const parseInteger = (value) => {
  if (value === undefined || value === null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const parseJsonValue = (value) => {
  if (!value) return null
  if (typeof value === "object") return value
  if (typeof value !== "string") return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const toCreatorObject = (id, username) => {
  if (!id) return null
  return { id, username: username ?? null }
}

const normalizeCreatedBy = (value, fallbackId) => {
  if (value && typeof value === "object") {
    const id = value.id ?? value.userId
    return id ?? fallbackId
  }
  if (typeof value === "string") return value
  return fallbackId
}

const withCreatorSelect = (query) =>
  query
    .select(
      "songs.*",
      "users.id as createdById",
      "users.username as createdByUsername",
    )
    .leftJoin("users", "songs.createdBy", "users.id")

const normalizeAlbumPayload = (album) => {
  if (!album) return album
  const data = album.toJSON ? album.toJSON() : { ...album }
  const artist = data.primaryArtist ?? null
  delete data.primaryArtist
  delete data.primaryArtistId
  return { ...data, artist }
}

const normalizeArtistPayload = (artist) => {
  if (!artist) return artist
  const data = artist.toJSON ? artist.toJSON() : { ...artist }
  if (data.country === undefined) {
    return { ...data, country: data.origin ?? null }
  }
  return data
}

const pickPrimaryArtist = (artists) =>
  artists.find((artist) => Boolean(artist?.isPrimary)) ?? artists[0] ?? null

const buildSongPayload = (row) => {
  if (!row) return row
  const data = row.toJSON ? row.toJSON() : { ...row }
  const createdById = data.createdById ?? data.createdBy
  const createdByUsername = data.createdByUsername
  delete data.createdById
  delete data.createdByUsername
  let albums
  if (data.inAlbums) {
    albums = data.inAlbums.map(normalizeAlbumPayload)
    delete data.inAlbums
  }
  let artist
  if (Array.isArray(data.artists) && data.artists.length > 0) {
    const normalizedArtists = data.artists.map(normalizeArtistPayload)
    data.artists = normalizedArtists
    artist = pickPrimaryArtist(normalizedArtists)
  }
  return {
    ...data,
    createdBy: toCreatorObject(createdById, createdByUsername),
    ...(artist ? { artist } : {}),
    ...(albums ? { albums } : {}),
  }
}

const attachSectionLines = (payload) => {
  if (!payload || typeof payload !== "object") return payload
  if (!Array.isArray(payload.lyricSections)) return payload
  if (!Array.isArray(payload.lyricLines)) return payload

  const sortedLines = [...payload.lyricLines].sort((a, b) => {
    const aIndex = parseInteger(a?.lineIndex) ?? 0
    const bIndex = parseInteger(b?.lineIndex) ?? 0
    return aIndex - bIndex
  })

  const sortedSections = [...payload.lyricSections].sort((a, b) => {
    const aStart = parseInteger(a?.startLine) ?? 0
    const bStart = parseInteger(b?.startLine) ?? 0
    if (aStart !== bStart) return aStart - bStart
    const aIndex = parseInteger(a?.sectionIndex) ?? 0
    const bIndex = parseInteger(b?.sectionIndex) ?? 0
    return aIndex - bIndex
  })

  const sectionsWithLines = sortedSections.map((section) => {
    const startLine = parseInteger(section?.startLine) ?? 0
    const endLine = parseInteger(section?.endLine) ?? startLine
    const lines = sortedLines.filter((line) => {
      const index = parseInteger(line?.lineIndex) ?? 0
      return index >= startLine && index <= endLine
    })
    return {
      ...(section?.toJSON ? section.toJSON() : section),
      lines,
    }
  })

  return {
    ...payload,
    lyricSections: sectionsWithLines,
  }
}

const pickFields = (source, allowed) => {
  const out = {}
  for (const key of allowed) {
    if (source[key] !== undefined) out[key] = source[key]
  }
  return out
}

export const SongController = {
  ...makeBaseController(Song, {
    allowedCreateFields,
    allowedUpdateFields,
  }),

  getAll: async (req, res) => {
    try {
      const { page, pageSize } = normalizePagination(req.query)
      const result = await withCreatorSelect(Song.query())
        .withGraphFetched("[inAlbums.[primaryArtist], artists]")
        .orderBy("songs.updatedAt", "desc")
        .page(page - 1, pageSize)
      const items = result.results.map(buildSongPayload)
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
      res.status(500).json({ error: "Internal error" })
    }
  },

  getLatestValidated: async (req, res) => {
    try {
      const latestChanges = await knex("moderationChanges as changes")
        .join(
          "moderationRequests as requests",
          "requests.id",
          "changes.requestId",
        )
        .select("changes.*")
        .where("requests.status", "applied")
        .whereIn("changes.targetTable", [
          "songs",
          "lyricLines",
          "lyricSections",
          "translations",
          "translationLines",
        ])
        .orderBy("requests.appliedAt", "desc")
        .orderBy("changes.createdAt", "desc")
        .limit(50)

      if (!latestChanges.length) {
        return res.status(404).json({ error: "Not found" })
      }

      const translationSongCache = new Map()
      const lyricLineSongCache = new Map()
      const lyricSectionSongCache = new Map()

      const getCachedSongId = async (table, id, cache) => {
        if (!id) return null
        if (cache.has(id)) return cache.get(id)
        const row = await knex(table).select("songId").where({ id }).first()
        const songId = row?.songId ?? null
        cache.set(id, songId)
        return songId
      }

      const getSongIdFromTranslation = async (id) =>
        getCachedSongId("translations", id, translationSongCache)

      const getSongIdFromLyricLine = async (id) =>
        getCachedSongId("lyricLines", id, lyricLineSongCache)

      const getSongIdFromLyricSection = async (id) =>
        getCachedSongId("lyricSections", id, lyricSectionSongCache)

      const resolveSongIdFromChange = async (change) => {
        const dataNew = parseJsonValue(change.dataNew)
        const dataOld = parseJsonValue(change.dataOld)
        const targetKey = parseJsonValue(change.targetKey)

        const songIdFromPayload = dataNew?.songId ?? dataOld?.songId
        const idFromTarget =
          targetKey?.id ?? dataNew?.id ?? dataOld?.id ?? null

        switch (change.targetTable) {
          case "songs":
            if (change.operation === "delete") return null
            return idFromTarget
          case "lyricLines":
            return (
              songIdFromPayload || (await getSongIdFromLyricLine(idFromTarget))
            )
          case "lyricSections":
            return (
              songIdFromPayload ||
              (await getSongIdFromLyricSection(idFromTarget))
            )
          case "translations":
            return (
              songIdFromPayload ||
              (await getSongIdFromTranslation(idFromTarget))
            )
          case "translationLines": {
            const translationId =
              dataNew?.translationId ?? dataOld?.translationId ?? null
            const lyricLineId =
              dataNew?.lyricLineId ?? dataOld?.lyricLineId ?? null

            if (translationId) {
              const songId = await getSongIdFromTranslation(translationId)
              if (songId) return songId
            }

            if (lyricLineId) {
              const songId = await getSongIdFromLyricLine(lyricLineId)
              if (songId) return songId
            }

            if (!idFromTarget) return null

            const lineRow = await knex("translationLines")
              .select("translationId", "lyricLineId")
              .where({ id: idFromTarget })
              .first()

            if (lineRow?.translationId) {
              const songId = await getSongIdFromTranslation(
                lineRow.translationId,
              )
              if (songId) return songId
            }

            if (lineRow?.lyricLineId) {
              const songId = await getSongIdFromLyricLine(lineRow.lyricLineId)
              if (songId) return songId
            }

            return null
          }
          default:
            return null
        }
      }

      for (const change of latestChanges) {
        const songId = await resolveSongIdFromChange(change)
        if (!songId) continue

        const row = await withCreatorSelect(Song.query())
          .findById(songId)
          .withGraphFetched(
            "[artists, inAlbums.[primaryArtist], lyricSections, lyricLines.[translationLines.[translation]]]",
          )

        if (row) {
          const history = await moderationService.getHistoryForTarget({
            tableName: Song.tableName,
            targetKey: { id: songId },
          })

          return res.json(
            attachSectionLines({
              ...buildSongPayload(row),
              moderationHistory: history,
            }),
          )
        }
      }

      return res.status(404).json({ error: "Not found" })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: "Internal error" })
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params
      const row = await withCreatorSelect(Song.query())
        .findById(id)
        .withGraphFetched(
          "[artists, inAlbums.[primaryArtist], lyricSections, lyricLines.[translationLines.[translation]]]",
        )
      if (!row) return res.status(404).json({ error: "Not found" })
      const history = await moderationService.getHistoryForTarget({
        tableName: Song.tableName,
        targetKey: { id },
      })
      res.json(
        attachSectionLines({
          ...buildSongPayload(row),
          moderationHistory: history,
        }),
      )
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      const existingSong = await Song.query().findById(id)
      if (!existingSong) return res.status(404).json({ error: "Not found" })

      const body = req.body ?? {}
      const songData = pickFields(body, allowedUpdateFields)
      const lyricLinesProvided = Object.prototype.hasOwnProperty.call(
        body,
        "lyricLines",
      )
      const translationsProvided = Object.prototype.hasOwnProperty.call(
        body,
        "translations",
      )
      const sectionsProvided =
        Object.prototype.hasOwnProperty.call(body, "sections") ||
        Object.prototype.hasOwnProperty.call(body, "lyricSections")

      if (
        !lyricLinesProvided &&
        !translationsProvided &&
        !sectionsProvided &&
        Object.keys(songData).length === 0
      ) {
        return res.status(400).json({ error: "No changes provided" })
      }

      let existingLyricLines = []
      const existingLyricLineIdByIndex = new Map()
      if (lyricLinesProvided || translationsProvided) {
        existingLyricLines = await knex("lyricLines")
          .where({ songId: id })
          .select("*")
        for (const row of existingLyricLines) {
          existingLyricLineIdByIndex.set(row.lineIndex, row.id)
        }
      }

      let existingTranslations = []
      if (translationsProvided) {
        existingTranslations = await knex("translations")
          .where({ songId: id })
          .select("*")
      }

      let existingSections = []
      if (sectionsProvided) {
        existingSections = await knex("lyricSections")
          .where({ songId: id })
          .select("*")
      }

      const lyricLineRows = []
      const lyricLineIdByIndex = new Map()
      if (lyricLinesProvided) {
        const lyricLineInputs = normalizeArray(body?.lyricLines)
        for (let index = 0; index < lyricLineInputs.length; index += 1) {
          const item = lyricLineInputs[index]
          const text = item?.text
          if (!text) {
            return res.status(400).json({
              error: "lyricLines[].text is required",
            })
          }

          const lineIndex = item?.lineIndex ?? index
          if (lyricLineIdByIndex.has(lineIndex)) {
            return res.status(400).json({
              error: "lyricLines[].lineIndex must be unique",
            })
          }

          const lineId = item?.id ?? crypto.randomUUID()
          lyricLineIdByIndex.set(lineIndex, lineId)
          lyricLineRows.push({
            id: lineId,
            songId: id,
            lineIndex,
            text,
            tStartMs: item?.tStartMs ?? null,
            tEndMs: item?.tEndMs ?? null,
          })
        }
      }

      const translationRows = []
      const translationLineRows = []
      const sectionRows = []

      if (translationsProvided) {
        const translationInputs = normalizeTranslationInput(body?.translations)
        for (const item of translationInputs) {
          const translationId = item?.id ?? crypto.randomUUID()
          const languageCode = item?.languageCode
          if (!languageCode) {
            return res.status(400).json({
              error: "translations[].languageCode is required",
            })
          }

          const createdBy = normalizeCreatedBy(item?.createdBy, userId)
          const titleTrans = item?.titleTrans ?? item?.title ?? null
          const notes = item?.notes ?? null
          const isMachine = Boolean(item?.isMachine)

          translationRows.push({
            id: translationId,
            songId: id,
            languageCode,
            createdBy,
            titleTrans,
            notes,
            isMachine,
          })

          const lineInputs = normalizeArray(
            item?.lines ?? item?.translationLines,
          )
          for (let index = 0; index < lineInputs.length; index += 1) {
            const line = lineInputs[index]
            const text = line?.text
            if (!text) {
              return res.status(400).json({
                error: "translations[].lines[].text is required",
              })
            }
            const lineIndex = line?.lineIndex ?? index
            const resolvedLyricLineId =
              line?.lyricLineId ??
              (lyricLinesProvided
                ? lyricLineIdByIndex.get(lineIndex)
                : existingLyricLineIdByIndex.get(lineIndex))

            if (!resolvedLyricLineId) {
              return res.status(400).json({
                error:
                  "translations[].lines[].lyricLineId is required (or provide lyricLines with matching lineIndex)",
              })
            }

            translationLineRows.push({
              id: line?.id ?? crypto.randomUUID(),
              translationId,
              lineIndex,
              text,
              lyricLineId: resolvedLyricLineId,
            })
          }
        }
      }

      if (sectionsProvided) {
        const sectionInputs = normalizeArray(
          body?.sections ?? body?.lyricSections,
        )
        for (const item of sectionInputs) {
          const type = item?.type ?? item?.sectionType
          if (!type) {
            return res.status(400).json({
              error: "sections[].type is required",
            })
          }

          const startLine = parseInteger(item?.startLine)
          const endLine = parseInteger(item?.endLine)
          if (startLine === null || endLine === null) {
            return res.status(400).json({
              error: "sections[].startLine and sections[].endLine are required",
            })
          }
          if (startLine < 0 || endLine < startLine) {
            return res.status(400).json({
              error: "sections[] line ranges are invalid",
            })
          }

          const sectionIndex =
            parseInteger(item?.sectionIndex ?? item?.index) ?? 1

          sectionRows.push({
            id: item?.id ?? crypto.randomUUID(),
            songId: id,
            type,
            sectionIndex,
            startLine,
            endLine,
            title: item?.title ?? null,
          })
        }
      }

      const changes = []
      if (Object.keys(songData).length > 0) {
        changes.push({
          tableName: "songs",
          operation: "update",
          targetKey: { id },
          dataNew: songData,
          dataOld: existingSong?.toJSON ? existingSong.toJSON() : existingSong,
        })
      }

      if (lyricLinesProvided) {
        for (const row of existingLyricLines) {
          changes.push({
            tableName: "lyricLines",
            operation: "delete",
            targetKey: { id: row.id },
            dataNew: null,
            dataOld: row,
          })
        }

        for (const row of lyricLineRows) {
          changes.push({
            tableName: "lyricLines",
            operation: "insert",
            targetKey: { id: row.id },
            dataNew: row,
            dataOld: null,
          })
        }
      }

      if (translationsProvided) {
        for (const row of existingTranslations) {
          changes.push({
            tableName: "translations",
            operation: "delete",
            targetKey: { id: row.id },
            dataNew: null,
            dataOld: row,
          })
        }

        for (const row of translationRows) {
          changes.push({
            tableName: "translations",
            operation: "insert",
            targetKey: { id: row.id },
            dataNew: row,
            dataOld: null,
          })
        }

        for (const row of translationLineRows) {
          changes.push({
            tableName: "translationLines",
            operation: "insert",
            targetKey: { id: row.id },
            dataNew: row,
            dataOld: null,
          })
        }
      }

      if (sectionsProvided) {
        for (const row of existingSections) {
          changes.push({
            tableName: "lyricSections",
            operation: "delete",
            targetKey: { id: row.id },
            dataNew: null,
            dataOld: row,
          })
        }

        for (const row of sectionRows) {
          changes.push({
            tableName: "lyricSections",
            operation: "insert",
            targetKey: { id: row.id },
            dataNew: row,
            dataOld: null,
          })
        }
      }

      if (changes.length === 0) {
        return res.status(400).json({ error: "No changes provided" })
      }

      const isModerator = await moderationService.isModerator(userId)
      if (!isModerator) {
        const moderation = await moderationService.submitChanges({
          userId,
          changes,
        })

        return res.status(202).json({
          status: "pending",
          request: moderation.request,
          changes: moderation.changes,
        })
      }

      const updated = await knex.transaction(async (trx) => {
        if (Object.keys(songData).length > 0) {
          await Song.query(trx).patch(songData).where({ id })
        }

        if (translationsProvided) {
          await trx("translations").where({ songId: id }).delete()
        }

        if (lyricLinesProvided) {
          await trx("lyricLines").where({ songId: id }).delete()
        }

        if (sectionsProvided) {
          await trx("lyricSections").where({ songId: id }).delete()
        }

        if (lyricLineRows.length > 0) {
          await trx("lyricLines").insert(lyricLineRows)
        }

        if (translationRows.length > 0) {
          await trx("translations").insert(translationRows)
        }

        if (translationLineRows.length > 0) {
          await trx("translationLines").insert(translationLineRows)
        }

        if (sectionRows.length > 0) {
          await trx("lyricSections").insert(sectionRows)
        }

        await moderationService.logAppliedChanges({
          userId,
          changes,
          trx,
        })

        return withCreatorSelect(Song.query(trx))
          .findById(id)
          .withGraphFetched("inAlbums.[primaryArtist]")
      })

      res.json(buildSongPayload(updated))
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: "Invalid data", details: err.message })
    }
  },

  create: async (req, res) => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      const songData = pickFields(req.body ?? {}, allowedCreateFields)
      if (!songData.title || !songData.languageCode) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["title", "languageCode"],
        })
      }

      songData.createdBy = normalizeCreatedBy(songData.createdBy, userId)

      if (!songData.id) {
        songData.id = crypto.randomUUID()
      }

      const songId = songData.id
      const artistInputs = normalizeArray(req.body?.artists)
      const sourceInputs = normalizeArray(req.body?.sources)
      const albumTracksInputs = normalizeArray(
        req.body?.albumTracks ?? req.body?.albumTrack,
      )
      const lyricLineInputs = normalizeArray(req.body?.lyricLines)
      const translationInputs = normalizeTranslationInput(req.body?.translations)
      const sectionInputs = normalizeArray(
        req.body?.sections ?? req.body?.lyricSections,
      )

      const artistRows = artistInputs.map((item) => {
        if (typeof item === "string") {
          return {
            artistId: item,
            songId,
            role: "artist",
            isPrimary: false,
          }
        }
        return {
          artistId: item?.artistId,
          songId,
          role: item?.role ?? "artist",
          isPrimary: Boolean(item?.isPrimary),
        }
      })

      for (const row of artistRows) {
        if (!row.artistId) {
          return res
            .status(400)
            .json({ error: "artists[].artistId is required" })
        }
      }

      const sourceRows = sourceInputs.map((item) => ({
        id: item?.id ?? crypto.randomUUID(),
        songId,
        kind: item?.kind,
        url: item?.url,
        note: item?.note,
      }))

      for (const row of sourceRows) {
        if (!row.kind || !row.url) {
          return res
            .status(400)
            .json({ error: "sources[].kind and sources[].url are required" })
        }
      }

      const albumTrackRows = albumTracksInputs.map((item) => ({
        id: item?.id ?? crypto.randomUUID(),
        albumId: item?.albumId,
        songId,
        discNumber: item?.discNumber ?? 1,
        trackNumber: item?.trackNumber,
        isBonus: Boolean(item?.isBonus),
      }))

      for (const row of albumTrackRows) {
        if (!row.albumId || row.trackNumber === undefined) {
          return res.status(400).json({
            error: "albumTracks[].albumId and albumTracks[].trackNumber required",
          })
        }
      }

      const lyricLineRows = []
      const lyricLineIdByIndex = new Map()

      for (let index = 0; index < lyricLineInputs.length; index += 1) {
        const item = lyricLineInputs[index]
        const text = item?.text
        if (!text) {
          return res.status(400).json({
            error: "lyricLines[].text is required",
          })
        }

        const lineIndex = item?.lineIndex ?? index
        if (lyricLineIdByIndex.has(lineIndex)) {
          return res.status(400).json({
            error: "lyricLines[].lineIndex must be unique",
          })
        }

        const id = item?.id ?? crypto.randomUUID()
        lyricLineIdByIndex.set(lineIndex, id)
        lyricLineRows.push({
          id,
          songId,
          lineIndex,
          text,
          tStartMs: item?.tStartMs ?? null,
          tEndMs: item?.tEndMs ?? null,
        })
      }

      const translationRows = []
      const translationLineRows = []
      const sectionRows = []

      for (const item of translationInputs) {
        const translationId = item?.id ?? crypto.randomUUID()
        const languageCode = item?.languageCode
        if (!languageCode) {
          return res.status(400).json({
            error: "translations[].languageCode is required",
          })
        }

        const createdBy = normalizeCreatedBy(item?.createdBy, userId)
        const titleTrans = item?.titleTrans ?? item?.title ?? null
        const notes = item?.notes ?? null
        const isMachine = Boolean(item?.isMachine)

        translationRows.push({
          id: translationId,
          songId,
          languageCode,
          createdBy,
          titleTrans,
          notes,
          isMachine,
        })

        const lineInputs = normalizeArray(
          item?.lines ?? item?.translationLines,
        )
        for (let index = 0; index < lineInputs.length; index += 1) {
          const line = lineInputs[index]
          const text = line?.text
          if (!text) {
            return res.status(400).json({
              error: "translations[].lines[].text is required",
            })
          }
          const lineIndex = line?.lineIndex ?? index
          const resolvedLyricLineId =
            line?.lyricLineId ?? lyricLineIdByIndex.get(lineIndex)
          if (!resolvedLyricLineId) {
            return res.status(400).json({
              error:
                "translations[].lines[].lyricLineId is required (or provide lyricLines with matching lineIndex)",
            })
          }
          translationLineRows.push({
            id: line?.id ?? crypto.randomUUID(),
            translationId,
            lineIndex,
            text,
            lyricLineId: resolvedLyricLineId,
          })
        }
      }

      for (const item of sectionInputs) {
        const type = item?.type ?? item?.sectionType
        if (!type) {
          return res.status(400).json({
            error: "sections[].type is required",
          })
        }

        const startLine = parseInteger(item?.startLine)
        const endLine = parseInteger(item?.endLine)
        if (startLine === null || endLine === null) {
          return res.status(400).json({
            error: "sections[].startLine and sections[].endLine are required",
          })
        }
        if (startLine < 0 || endLine < startLine) {
          return res.status(400).json({
            error: "sections[] line ranges are invalid",
          })
        }

        const sectionIndex = parseInteger(item?.sectionIndex ?? item?.index) ?? 1

        sectionRows.push({
          id: item?.id ?? crypto.randomUUID(),
          songId,
          type,
          sectionIndex,
          startLine,
          endLine,
          title: item?.title ?? null,
        })
      }

      const changes = [
        {
          tableName: "songs",
          operation: "insert",
          targetKey: { id: songId },
          dataNew: songData,
          dataOld: null,
        },
      ]

      for (const row of artistRows) {
        changes.push({
          tableName: "songArtists",
          operation: "insert",
          targetKey: { artistId: row.artistId, songId: row.songId },
          dataNew: row,
          dataOld: null,
        })
      }

      for (const row of sourceRows) {
        changes.push({
          tableName: "songSources",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        })
      }

      for (const row of albumTrackRows) {
        changes.push({
          tableName: "albumTracks",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        })
      }

      for (const row of lyricLineRows) {
        changes.push({
          tableName: "lyricLines",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        })
      }

      for (const row of translationRows) {
        changes.push({
          tableName: "translations",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        })
      }

      for (const row of translationLineRows) {
        changes.push({
          tableName: "translationLines",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        })
      }

      for (const row of sectionRows) {
        changes.push({
          tableName: "lyricSections",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        })
      }

      const isModerator = await moderationService.isModerator(userId)
      if (!isModerator) {
        const moderation = await moderationService.submitChanges({
          userId,
          changes,
        })

        return res.status(202).json({
          status: "pending",
          request: moderation.request,
          changes: moderation.changes,
        })
      }

      const created = await knex.transaction(async (trx) => {
        await Song.query(trx).insert(songData).returning("*")

        if (artistRows.length > 0) {
          await trx("songArtists").insert(artistRows)
        }

        if (sourceRows.length > 0) {
          await trx("songSources").insert(sourceRows)
        }

        if (albumTrackRows.length > 0) {
          await trx("albumTracks").insert(albumTrackRows)
        }

        if (lyricLineRows.length > 0) {
          await trx("lyricLines").insert(lyricLineRows)
        }

        if (translationRows.length > 0) {
          await trx("translations").insert(translationRows)
        }

        if (translationLineRows.length > 0) {
          await trx("translationLines").insert(translationLineRows)
        }

        if (sectionRows.length > 0) {
          await trx("lyricSections").insert(sectionRows)
        }

        await moderationService.logAppliedChanges({
          userId,
          changes,
          trx,
        })

        return withCreatorSelect(Song.query(trx)).findById(songId)
      })

      return res.status(201).json(buildSongPayload(created))
    } catch (err) {
      console.error(err)
      return res.status(400).json({ error: "Invalid data", details: err.message })
    }
  },

  getFullSong: async (req, res) => {
    try {
      const { id } = req.params

      const song = await withCreatorSelect(Song.query())
        .findById(id)
        .withGraphFetched(
          `
          [
            language,
            creator(selectUsername),
            artists.[primaryAlbums, songs],
            sources,
            lyricLines.[translationLines.[translation]],
            lyricSections,
            translations.[language, author(selectUsername), lines.[lyricLine]],
            annotations.[author(selectUsername), comments.[author(selectUsername)]],
            inAlbums.[primaryArtist]
          ]
        `,
        )
        .modifiers({
          selectUsername(builder) {
            builder.select("id", "username")
          },
        })

      if (!song) return res.status(404).json({ error: "Not found" })

      res.json(attachSectionLines(buildSongPayload(song)))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },
}
