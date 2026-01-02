import knex from "../config/knexClient.js"

const normalizeArtistIds = (artistIds) => {
  if (!Array.isArray(artistIds) || artistIds.length === 0) {
    return []
  }

  return [...new Set(artistIds.filter(Boolean))]
}

const buildAlbumMap = (rows) => {
  const byArtist = new Map()

  for (const row of rows) {
    const artistId = row.artistId
    if (!artistId) continue
    const { artistId: _ignored, ...album } = row

    let albumsForArtist = byArtist.get(artistId)
    if (!albumsForArtist) {
      albumsForArtist = new Map()
      byArtist.set(artistId, albumsForArtist)
    }

    if (!albumsForArtist.has(album.id)) {
      albumsForArtist.set(album.id, album)
    }
  }

  const result = {}
  for (const [artistId, albumMap] of byArtist.entries()) {
    result[artistId] = Array.from(albumMap.values())
  }

  return result
}

export const fetchAlbumsByArtistIds = async (artistIds) => {
  const ids = normalizeArtistIds(artistIds)
  if (ids.length === 0) return []

  return knex("albums")
    .select("albums.*")
    .distinct()
    .leftJoin("albumTracks", "albums.id", "albumTracks.albumId")
    .leftJoin("songArtists", "albumTracks.songId", "songArtists.songId")
    .whereIn("albums.primaryArtistId", ids)
    .orWhereIn("songArtists.artistId", ids)
}

export const fetchAlbumsByArtistIdsMap = async (artistIds) => {
  const ids = normalizeArtistIds(artistIds)
  if (ids.length === 0) return {}

  const primaryRows = await knex("albums")
    .select("albums.*", "albums.primaryArtistId as artistId")
    .whereIn("albums.primaryArtistId", ids)

  const trackRows = await knex("albums")
    .select("albums.*", "songArtists.artistId as artistId")
    .distinct()
    .join("albumTracks", "albums.id", "albumTracks.albumId")
    .join("songArtists", "albumTracks.songId", "songArtists.songId")
    .whereIn("songArtists.artistId", ids)

  return buildAlbumMap([...primaryRows, ...trackRows])
}
