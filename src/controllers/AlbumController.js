import crypto from "node:crypto";
import { Album } from "../models/Album.js";
import { makeBaseController } from "./baseController.js";
import { fetchAlbumsByArtistIds } from "../utils/albumQueries.js";
import { normalizeOptionalUrl } from "../utils/urlValidation.js";
import knex from "../config/knexClient.js";
import { moderationService } from "../services/moderationService.js";
import validator from "validator";

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

const allowedSongCreateFields = [
  "title",
  "releaseYear",
  "isPublished",
  "description",
  "languageCode",
  "createdBy",
];

const applyUrlValidation = (data, fieldName) => {
  if (!data || typeof data !== "object") return data;
  if (!Object.prototype.hasOwnProperty.call(data, fieldName)) return data;
  return {
    ...data,
    [fieldName]: normalizeOptionalUrl(data[fieldName], fieldName),
  };
};

const pickFields = (body, fields) => {
  const data = {};
  if (!body || typeof body !== "object") return data;
  for (const key of fields) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  return data;
};

const normalizeCreatedBy = (value, fallbackId) => {
  if (value && typeof value === "object") {
    const id = value.id ?? value.userId;
    return id ?? fallbackId;
  }
  if (typeof value === "string") return value;
  return fallbackId;
};

const normalizeSongDefaults = (body, albumDefaults) => ({
  releaseYear: albumDefaults?.releaseYear ?? null,
  primaryArtistId: albumDefaults?.primaryArtistId ?? null,
  languageCode:
    body?.languageCode ??
    body?.songLanguageCode ??
    body?.defaultSongLanguageCode ??
    null,
});

const serializeAlbum = (album) => {
  if (!album) return album;
  const data = album.toJSON ? album.toJSON() : { ...album };
  const artist = data.primaryArtist ?? null;
  delete data.primaryArtist;
  delete data.primaryArtistId;
  return { ...data, artist };
};

const normalizeTracksInput = (body) => {
  if (!body || typeof body !== "object") {
    return { provided: false, items: [] };
  }

  const hasTracks =
    Object.prototype.hasOwnProperty.call(body, "tracks") ||
    Object.prototype.hasOwnProperty.call(body, "albumTracks") ||
    Object.prototype.hasOwnProperty.call(body, "albumTrack");

  if (!hasTracks) {
    return { provided: false, items: [] };
  }

  const raw = body.tracks ?? body.albumTracks ?? body.albumTrack ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return { provided: true, items };
};

const buildSongData = (payload, songId, userId, defaults) => {
  if (!payload || typeof payload !== "object") {
    return { error: "tracks[].song is required to create new songs" };
  }

  const data = pickFields(payload, allowedSongCreateFields);
  data.id = songId;
  data.createdBy = normalizeCreatedBy(payload.createdBy, userId);
  data.languageCode = data.languageCode ?? defaults?.languageCode ?? null;
  data.releaseYear = data.releaseYear ?? defaults?.releaseYear ?? null;

  if (!data.title) {
    return { error: "tracks[].title or tracks[].song.title is required" };
  }

  if (!data.languageCode) {
    return {
      error:
        "tracks[].song.languageCode is required (or provide album languageCode)",
    };
  }

  if (data.releaseYear === undefined || data.releaseYear === null) {
    return {
      error:
        "tracks[].song.releaseYear is required (or provide album releaseYear)",
    };
  }

  return { data };
};

const resolveAlbumTracks = async ({ items, albumId, userId, defaults }) => {
  if (!items || items.length === 0) {
    return { trackRows: [], songsToCreate: [], songArtistRows: [] };
  }

  const trackRows = [];
  const songIds = new Set();
  const songPayloadById = new Map();
  const seenTracks = new Set();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { error: "tracks[] must be objects" };
    }

    const trackNumber = item.trackNumber;
    const discNumber = item.discNumber ?? 1;
    const songPayload = item.song ?? null;
    let songId = item.songId ?? songPayload?.id ?? null;

    if (!songId && !songPayload) {
      if (!item.title && !item.songTitle) {
        return {
          error:
            "tracks[].songId or tracks[].song or tracks[].title is required",
        };
      }
    }

    if (!songId) {
      songId = crypto.randomUUID();
    }

    if (!validator.isUUID(String(songId))) {
      return { error: "tracks[].songId must be a valid UUID" };
    }

    if (songPayload && typeof songPayload !== "object") {
      return { error: "tracks[].song must be an object" };
    }

    if (trackNumber === undefined || trackNumber === null) {
      return { error: "tracks[].trackNumber is required" };
    }

    const key = `${discNumber}:${trackNumber}`;
    if (seenTracks.has(key)) {
      return { error: "tracks[] has duplicate discNumber/trackNumber" };
    }
    seenTracks.add(key);

    songIds.add(songId);
    const payload = songPayload ? { ...songPayload } : {};
    if (!payload.title && (item.title || item.songTitle)) {
      payload.title = item.title ?? item.songTitle;
    }
    if (!payload.languageCode && item.languageCode) {
      payload.languageCode = item.languageCode;
    }
    if (
      (payload.releaseYear === undefined || payload.releaseYear === null) &&
      item.releaseYear !== undefined
    ) {
      payload.releaseYear = item.releaseYear;
    }
    if (payload.isPublished === undefined && item.isPublished !== undefined) {
      payload.isPublished = item.isPublished;
    }
    if (payload.description === undefined && item.description !== undefined) {
      payload.description = item.description;
    }
    if (payload.createdBy === undefined && item.createdBy !== undefined) {
      payload.createdBy = item.createdBy;
    }
    if (Object.keys(payload).length > 0) {
      songPayloadById.set(songId, payload);
    }

    trackRows.push({
      id: item.id ?? crypto.randomUUID(),
      albumId,
      songId,
      discNumber,
      trackNumber,
      isBonus: Boolean(item.isBonus),
    });
  }

  const ids = Array.from(songIds);
  const existingRows =
    ids.length > 0 ? await knex("songs").select("id").whereIn("id", ids) : [];
  const existingSet = new Set(existingRows.map((row) => row.id));

  const songsToCreate = [];
  for (const songId of ids) {
    if (existingSet.has(songId)) {
      continue;
    }

    const payload = songPayloadById.get(songId);
    if (!payload) {
      return {
        error:
          "tracks[].songId does not exist; provide tracks[].song or tracks[].title",
      };
    }

    const { data, error } = buildSongData(payload, songId, userId, defaults);
    if (error) {
      return { error };
    }
    songsToCreate.push(data);
  }

  const songArtistRows = [];
  if (defaults?.primaryArtistId) {
    for (const song of songsToCreate) {
      songArtistRows.push({
        artistId: defaults.primaryArtistId,
        songId: song.id,
        role: "artist",
        isPrimary: true,
      });
    }
  }

  return { trackRows, songsToCreate, songArtistRows };
};

const fetchAlbumWithTracks = async (albumId, trx) => {
  const query = Album.query(trx)
    .findById(albumId)
    .withGraphFetched(
      `
        [
          primaryArtist,
          tracks.[song.[artists, language]]
        ]
      `,
    );
  const album = await query;
  return serializeAlbum(album);
};

const baseController = makeBaseController(Album, {
  allowedCreateFields,
  allowedUpdateFields,
  transformCreateData: (data) => applyUrlValidation(data, "coverUrl"),
  transformUpdateData: (data) => applyUrlValidation(data, "coverUrl"),
  getByIdGraph: "primaryArtist",
  serializeGetById: serializeAlbum,
});

export const AlbumController = {
  ...baseController,

  create: async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const albumData = applyUrlValidation(
        pickFields(req.body ?? {}, allowedCreateFields),
        "coverUrl",
      );

      if (!albumData.title) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["title"],
        });
      }

      const albumId = crypto.randomUUID();
      albumData.id = albumId;

      const { provided: tracksProvided, items: trackItems } =
        normalizeTracksInput(req.body);
      const songDefaults = normalizeSongDefaults(req.body, albumData);
      const {
        trackRows,
        songsToCreate,
        songArtistRows,
        error: trackError,
      } = tracksProvided
        ? await resolveAlbumTracks({
            items: trackItems,
            albumId,
            userId,
            defaults: songDefaults,
          })
        : { trackRows: [], songsToCreate: [], songArtistRows: [] };

      if (trackError) {
        return res.status(400).json({ error: trackError });
      }

      const changes = [];

      for (const song of songsToCreate) {
        changes.push({
          tableName: "songs",
          operation: "insert",
          targetKey: { id: song.id },
          dataNew: song,
          dataOld: null,
        });
      }

      for (const row of songArtistRows) {
        changes.push({
          tableName: "songArtists",
          operation: "insert",
          targetKey: { artistId: row.artistId, songId: row.songId },
          dataNew: row,
          dataOld: null,
        });
      }

      changes.push({
        tableName: "albums",
        operation: "insert",
        targetKey: { id: albumId },
        dataNew: albumData,
        dataOld: null,
      });

      for (const row of trackRows) {
        changes.push({
          tableName: "albumTracks",
          operation: "insert",
          targetKey: { id: row.id },
          dataNew: row,
          dataOld: null,
        });
      }

      const isModerator = await moderationService.isModerator(userId);
      if (!isModerator) {
        const moderation = await moderationService.submitChanges({
          userId,
          changes,
        });

        return res.status(202).json({
          status: "pending",
          request: moderation.request,
          changes: moderation.changes,
        });
      }

      const created = await knex.transaction(async (trx) => {
        if (songsToCreate.length > 0) {
          await trx("songs").insert(songsToCreate);
        }

        if (songArtistRows.length > 0) {
          await trx("songArtists").insert(songArtistRows);
        }

        await Album.query(trx).insert(albumData).returning("*");

        if (trackRows.length > 0) {
          await trx("albumTracks").insert(trackRows);
        }

        await moderationService.logAppliedChanges({
          userId,
          changes,
          trx,
        });

        return fetchAlbumWithTracks(albumId, trx);
      });

      return res.status(201).json(created);
    } catch (err) {
      console.error(err);
      return res
        .status(400)
        .json({ error: "Invalid data", details: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const existingAlbum = await Album.query().findById(id);
      if (!existingAlbum) return res.status(404).json({ error: "Not found" });

      const albumData = applyUrlValidation(
        pickFields(req.body ?? {}, allowedUpdateFields),
        "coverUrl",
      );

      const { provided: tracksProvided, items: trackItems } =
        normalizeTracksInput(req.body);
      const songDefaults = normalizeSongDefaults(req.body, {
        releaseYear: albumData.releaseYear ?? existingAlbum.releaseYear ?? null,
        primaryArtistId:
          albumData.primaryArtistId ?? existingAlbum.primaryArtistId ?? null,
      });
      const {
        trackRows,
        songsToCreate,
        songArtistRows,
        error: trackError,
      } = tracksProvided
        ? await resolveAlbumTracks({
            items: trackItems,
            albumId: id,
            userId,
            defaults: songDefaults,
          })
        : { trackRows: [], songsToCreate: [], songArtistRows: [] };
      const existingTracks = tracksProvided
        ? await knex("albumTracks").where({ albumId: id })
        : [];

      if (trackError) {
        return res.status(400).json({ error: trackError });
      }

      if (!tracksProvided && Object.keys(albumData).length === 0) {
        return res.status(400).json({ error: "No changes provided" });
      }

      const isModerator = await moderationService.isModerator(userId);
      if (!isModerator) {
        const changes = [];

        for (const song of songsToCreate) {
          changes.push({
            tableName: "songs",
            operation: "insert",
            targetKey: { id: song.id },
            dataNew: song,
            dataOld: null,
          });
        }

        for (const row of songArtistRows) {
          changes.push({
            tableName: "songArtists",
            operation: "insert",
            targetKey: { artistId: row.artistId, songId: row.songId },
            dataNew: row,
            dataOld: null,
          });
        }

        if (Object.keys(albumData).length > 0) {
          changes.push({
            tableName: "albums",
            operation: "update",
            targetKey: { id },
            dataNew: albumData,
            dataOld: existingAlbum.toJSON
              ? existingAlbum.toJSON()
              : existingAlbum,
          });
        }

        if (tracksProvided) {
          for (const row of existingTracks) {
            changes.push({
              tableName: "albumTracks",
              operation: "delete",
              targetKey: { id: row.id },
              dataNew: null,
              dataOld: row,
            });
          }

          for (const row of trackRows) {
            changes.push({
              tableName: "albumTracks",
              operation: "insert",
              targetKey: { id: row.id },
              dataNew: row,
              dataOld: null,
            });
          }
        }

        if (changes.length === 0) {
          return res.status(400).json({ error: "No changes provided" });
        }

        const moderation = await moderationService.submitChanges({
          userId,
          changes,
        });

        return res.status(202).json({
          status: "pending",
          request: moderation.request,
          changes: moderation.changes,
        });
      }

      const updated = await knex.transaction(async (trx) => {
        if (songsToCreate.length > 0) {
          await trx("songs").insert(songsToCreate);
        }

        if (songArtistRows.length > 0) {
          await trx("songArtists").insert(songArtistRows);
        }

        if (Object.keys(albumData).length > 0) {
          await Album.query(trx).patch(albumData).where({ id });
        }

        if (tracksProvided) {
          await trx("albumTracks").where({ albumId: id }).delete();
          if (trackRows.length > 0) {
            await trx("albumTracks").insert(trackRows);
          }
        }

        const changes = [];

        for (const song of songsToCreate) {
          changes.push({
            tableName: "songs",
            operation: "insert",
            targetKey: { id: song.id },
            dataNew: song,
            dataOld: null,
          });
        }

        for (const row of songArtistRows) {
          changes.push({
            tableName: "songArtists",
            operation: "insert",
            targetKey: { artistId: row.artistId, songId: row.songId },
            dataNew: row,
            dataOld: null,
          });
        }

        if (Object.keys(albumData).length > 0) {
          changes.push({
            tableName: "albums",
            operation: "update",
            targetKey: { id },
            dataNew: albumData,
            dataOld: existingAlbum.toJSON
              ? existingAlbum.toJSON()
              : existingAlbum,
          });
        }

        if (tracksProvided) {
          for (const row of existingTracks) {
            changes.push({
              tableName: "albumTracks",
              operation: "delete",
              targetKey: { id: row.id },
              dataNew: null,
              dataOld: row,
            });
          }

          for (const row of trackRows) {
            changes.push({
              tableName: "albumTracks",
              operation: "insert",
              targetKey: { id: row.id },
              dataNew: row,
              dataOld: null,
            });
          }
        }

        if (changes.length > 0) {
          await moderationService.logAppliedChanges({
            userId,
            changes,
            trx,
          });
        }

        return fetchAlbumWithTracks(id, trx);
      });

      return res.json(updated);
    } catch (err) {
      console.error(err);
      return res
        .status(400)
        .json({ error: "Invalid data", details: err.message });
    }
  },

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
