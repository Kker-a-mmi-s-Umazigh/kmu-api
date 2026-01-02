import { Album } from "../models/Album.js";
import { makeBaseController } from "./baseController.js";
import { fetchAlbumsByArtistIds } from "../utils/albumQueries.js";

const allowedCreateFields = [
  "title",
  "releaseYear",
  "label",
  "coverUrl",
  "primaryArtistId",
];

const allowedUpdateFields = [
  "title",
  "releaseYear",
  "label",
  "coverUrl",
  "primaryArtistId",
];

export const AlbumController = {
  ...makeBaseController(Album, {
    allowedCreateFields,
    allowedUpdateFields,
    getByIdGraph: "primaryArtist",
    serializeGetById: (row) => {
      if (!row) return row;
      const data = row.toJSON ? row.toJSON() : { ...row };
      const artist = data.primaryArtist ?? null;
      delete data.primaryArtist;
      delete data.primaryArtistId;
      return { ...data, artist };
    },
  }),

  getAll: async (req, res) => {
    try {
      const { artistIds } = req.query;

      const parsedArtistIds = Array.isArray(artistIds)
        ? artistIds
        : String(artistIds || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);

      if (parsedArtistIds.length > 0) {
        const albums = await fetchAlbumsByArtistIds(parsedArtistIds);
        const albumIds = albums.map((album) => album.id).filter(Boolean);
        if (albumIds.length === 0) {
          return res.json([]);
        }
        const rows = await Album.query()
          .whereIn("albums.id", albumIds)
          .withGraphFetched("primaryArtist");
        const payload = rows.map((album) => {
          const data = album.toJSON ? album.toJSON() : { ...album };
          const artist = data.primaryArtist ?? null;
          delete data.primaryArtist;
          delete data.primaryArtistId;
          return { ...data, artist };
        });
        return res.json(payload);
      }

      const rows = await Album.query().withGraphFetched("primaryArtist");
      const payload = rows.map((album) => {
        const data = album.toJSON ? album.toJSON() : { ...album };
        const artist = data.primaryArtist ?? null;
        delete data.primaryArtist;
        delete data.primaryArtistId;
        return { ...data, artist };
      });
      return res.json(payload);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal error" });
    }
  },

  getWithTracks: async (req, res) => {
    try {
      const { id } = req.params;

      const album = await Album.query().findById(id).withGraphFetched(`
          [
            primaryArtist,
            tracks.[song.[artists, language]]
          ]
        `);

      if (!album) return res.status(404).json({ error: "Not found" });

      const data = album.toJSON ? album.toJSON() : { ...album };
      const artist = data.primaryArtist ?? null;
      delete data.primaryArtist;
      delete data.primaryArtistId;
      res.json({ ...data, artist });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },
};
