import crypto from 'node:crypto'
import fs from 'node:fs/promises'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value)

const resolveId = (rawId, map) => {
  if (rawId && isUuid(rawId)) {
    if (!map.has(rawId)) map.set(rawId, rawId)
    return rawId
  }
  if (!rawId) return crypto.randomUUID()
  if (map.has(rawId)) return map.get(rawId)
  const id = crypto.randomUUID()
  map.set(rawId, id)
  return id
}

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  // Reset tables (avoid FK issues). Only truncate tables that exist.
  const candidateTables = [
    'moderationChanges',
    'moderationRequests',
    'reports',
    'annotationComments',
    'annotations',
    'translationLines',
    'translations',
    'lyricLines',
    'lyricSections',
    'songSources',
    'albumTracks',
    'songArtists',
    'favoriteSongs',
    'annotationVotes',
    'notifications',
    'glossaryTermLyricLines',
    'glossaryTermMeanings',
    'glossaryTerms',
    'albums',
    'songs',
    'artists',
    'refreshTokens',
    'users',
    'roles',
    'languages',
  ]

  const existingTables = await knex('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public' })
    .whereIn('table_name', candidateTables)

  if (existingTables.length > 0) {
    const tableList = existingTables
      .map((row) => `"${row.table_name}"`)
      .join(', ')
    await knex.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
  }

  // === ROLES ===
  const roles = [
    { id: crypto.randomUUID(), name: 'Membre' },
    { id: crypto.randomUUID(), name: 'Moderateur' },
    { id: crypto.randomUUID(), name: 'Administrateur' },
  ]

  await knex('roles').insert(roles)

  const adminRole = await knex('roles')
    .select('id')
    .where('name', 'Administrateur')
    .first()

  // === LANGUES ===
  const languages = [
    { code: 'fr', name: 'Francais' },
    { code: 'en', name: 'Anglais' },
    { code: 'kab', name: 'Kabyle' },
  ]
  await knex('languages').insert(languages)

  // === UTILISATEUR ADMIN ===
  const { hashPassword } = await import('../src/middleware/hashPassword.js')
  const password = 'admin123'
  const [hashedPassword, passwordSalt] = hashPassword(password)

  const adminUserId = crypto.randomUUID()

  await knex('users').insert({
    id: adminUserId,
    username: 'admin',
    email: 'admin@kabmusic.com',
    passwordHash: hashedPassword,
    passwordSalt,
    createdAt: knex.fn.now(),
    roleId: adminRole.id,
  })

  // === DATA FILE ===
  const dataPath = new URL('./seed-data.json', import.meta.url)
  const raw = await fs.readFile(dataPath, 'utf8')
  const seedData = JSON.parse(raw)

  const artistsInput = Array.isArray(seedData.artists) ? seedData.artists : []
  const albumsInput = Array.isArray(seedData.albums) ? seedData.albums : []
  const songsInput = Array.isArray(seedData.songs) ? seedData.songs : []
  const tracksInput = Array.isArray(seedData.albumTracks)
    ? seedData.albumTracks
    : []

  const artistIdMap = new Map()
  const albumIdMap = new Map()
  const songIdMap = new Map()

  const now = new Date()

  const artists = artistsInput
    .map((artist) => {
      if (!artist?.name) return null
      const id = resolveId(artist.id, artistIdMap)
      const origin = normalizeOptionalString(
        artist.origin ?? artist.country ?? null,
      )
      return {
        id,
        name: artist.name,
        origin,
        description: normalizeOptionalString(artist.description ?? null),
        photoUrl: normalizeOptionalString(artist.photoUrl ?? null),
        createdAt: now,
      }
    })
    .filter(Boolean)

  if (artists.length > 0) {
    await knex('artists').insert(artists)
  }

  const artistIdSet = new Set(artists.map((artist) => artist.id))

  const albums = albumsInput
    .map((album) => {
      if (!album?.title) return null
      const id = resolveId(album.id, albumIdMap)
      const rawPrimary = album.primaryArtistId
      const primaryArtistId = resolveId(rawPrimary, artistIdMap)
      if (!artistIdSet.has(primaryArtistId)) {
        throw new Error(
          `Album references unknown artist: ${rawPrimary ?? 'null'}`,
        )
      }
      return {
        id,
        title: album.title,
        releaseYear: album.releaseYear ?? null,
        label: normalizeOptionalString(album.label ?? null),
        coverUrl: normalizeOptionalString(album.coverUrl ?? null),
        createdAt: now,
        primaryArtistId,
      }
    })
    .filter(Boolean)

  if (albums.length > 0) {
    await knex('albums').insert(albums)
  }

  const albumIdSet = new Set(albums.map((album) => album.id))

  const songs = songsInput
    .map((song) => {
      if (!song?.title || !song?.languageCode) return null
      const id = resolveId(song.id, songIdMap)
      const createdBy = isUuid(song.createdBy)
        ? song.createdBy
        : adminUserId
      return {
        id,
        title: song.title,
        releaseYear: song.releaseYear ?? null,
        isPublished: song.isPublished ?? true,
        createdAt: now,
        updatedAt: now,
        description: normalizeOptionalString(song.description ?? null),
        languageCode: song.languageCode,
        createdBy,
      }
    })
    .filter(Boolean)

  if (songs.length > 0) {
    await knex('songs').insert(songs)
  }

  const songIdSet = new Set(songs.map((song) => song.id))

  const albumTracks = tracksInput
    .map((track) => {
      if (!track?.albumId || !track?.songId) return null
      const id = resolveId(track.id, new Map())
      const albumId = resolveId(track.albumId, albumIdMap)
      const songId = resolveId(track.songId, songIdMap)
      if (!albumIdSet.has(albumId)) {
        throw new Error(`Track references unknown album: ${track.albumId}`)
      }
      if (!songIdSet.has(songId)) {
        throw new Error(`Track references unknown song: ${track.songId}`)
      }
      return {
        id,
        albumId,
        songId,
        discNumber: track.discNumber ?? 1,
        trackNumber: track.trackNumber ?? 1,
        isBonus: track.isBonus ?? false,
        createdAt: now,
      }
    })
    .filter(Boolean)

  if (albumTracks.length > 0) {
    await knex('albumTracks').insert(albumTracks)
  }

  const albumById = new Map(albums.map((album) => [album.id, album]))
  const songArtistRows = []
  const songArtistKey = new Set()

  for (const track of albumTracks) {
    const album = albumById.get(track.albumId)
    const artistId = album?.primaryArtistId
    if (!artistId) continue

    const key = `${artistId}:${track.songId}`
    if (songArtistKey.has(key)) continue
    songArtistKey.add(key)

    songArtistRows.push({
      artistId,
      songId: track.songId,
      role: 'artist',
      isPrimary: true,
    })
  }

  if (songArtistRows.length > 0) {
    await knex('songArtists').insert(songArtistRows)
  }

  console.log(
    `Seed completed: ${artists.length} artists, ${albums.length} albums, ${songs.length} songs, ${albumTracks.length} tracks.`,
  )
}
