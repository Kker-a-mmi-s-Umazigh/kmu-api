import { Artist } from "../models/Artist.js"
import { makeBaseController } from "./baseController.js"
import {
  fetchAlbumsByArtistIds,
  fetchAlbumsByArtistIdsMap,
} from "../utils/albumQueries.js"
import { moderationService } from "../services/moderationService.js"
import { normalizePagination, buildPagination } from "../utils/pagination.js"

const allowedCreateFields = ["name", "origin", "photoUrl"]
const allowedUpdateFields = ["name", "origin", "photoUrl"]

const normalizeArtistPayload = (body) => {
  if (!body || typeof body !== "object") return body
  const data = { ...body }
  if (data.country !== undefined && data.origin === undefined) {
    data.origin = data.country
  }
  delete data.country
  return data
}

const withCountryAlias = (data) => ({
  ...data,
  country: data.origin ?? null,
})

const baseController = makeBaseController(Artist, {
  allowedCreateFields,
  allowedUpdateFields,
})

export const ArtistController = {
  ...baseController,

  getAll: async (req, res) => {
    try {
      const { page, pageSize } = normalizePagination(req.query)
      const result = await Artist.query()
        .orderBy("createdAt", "desc")
        .page(page - 1, pageSize)
      const rows = result.results
      const artistIds = rows.map((artist) => artist.id).filter(Boolean)
      const albumsByArtist = await fetchAlbumsByArtistIdsMap(artistIds)

      const payload = rows.map((artist) => {
        const data = artist.toJSON ? artist.toJSON() : artist
        return {
          ...withCountryAlias(data),
          albums: albumsByArtist[data.id] ?? [],
        }
      })

      res.json({
        items: payload,
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

  getById: async (req, res) => {
    try {
      const { id } = req.params
      const artist = await Artist.query().findById(id)
      if (!artist) return res.status(404).json({ error: "Not found" })

      const albumsByArtist = await fetchAlbumsByArtistIdsMap([id])
      const data = artist.toJSON ? artist.toJSON() : artist
      const history = await moderationService.getHistoryForTarget({
        tableName: Artist.tableName,
        targetKey: { id },
      })

      res.json({
        ...withCountryAlias(data),
        albums: albumsByArtist[id] ?? [],
        moderationHistory: history,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },

  getFullArtist: async (req, res) => {
    try {
      const { id } = req.params

      const artist = await Artist.query().findById(id).withGraphFetched(`
          [
            primaryAlbums.[tracks.song],
            songs.[inAlbums, language]
          ]
        `)

      if (!artist) return res.status(404).json({ error: "Not found" })

      res.json(artist)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },

  getAlbums: async (req, res) => {
    try {
      const { id } = req.params
      const albums = await fetchAlbumsByArtistIds([id])
      res.json(albums)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },

  create: async (req, res) => {
    req.body = normalizeArtistPayload(req.body)
    return baseController.create(req, res)
  },

  update: async (req, res) => {
    req.body = normalizeArtistPayload(req.body)
    return baseController.update(req, res)
  },
}
