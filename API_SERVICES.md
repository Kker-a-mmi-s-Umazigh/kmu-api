# API Services (Front AI)

Base URL: `/api`

General notes:

- Auth header: `Authorization: Bearer <accessToken>` for protected routes.
- Moderation: for non-moderators, `POST/PUT/DELETE` on moderated resources returns `202` with a moderation request, no direct write.
- Comments are not moderated (direct write), but can be reported.
- Moderator role is detected if role name contains `moderateur`, `moderator`, or `admin` (case-insensitive).
- `GET /:id` responses include `moderationHistory` (requests + changes that target the element).
- List endpoints are paginated: `page` (1-based), `pageSize` (max 200). Aliases: `limit`, `perPage`. Response is `{ items, pagination }`.

Response pattern for moderated writes (202):

```json
{
  "status": "pending",
  "request": { "...": "moderationRequests row" },
  "change": { "...": "moderationChanges row" },
  "changes": [{ "...": "moderationChanges row" }]
}
```

`change` is returned for single-change requests. `changes` is returned for multi-change requests (ex: song + artists + sources).

## Auth

- POST `/auth/signup`
  - Body: `email`, `username`, `password`
  - Response includes `csrfToken` to be sent as `x-csrf-token` for refresh/logout.
  - Password policy: 8-128 chars, uppercase, lowercase, number, special char.
- POST `/auth/login`
  - Body: `identifier` (email or username), `password`
  - Response includes `csrfToken` to be sent as `x-csrf-token` for refresh/logout.
- POST `/auth/refresh`
  - Cookie: `refreshToken` (httpOnly)
  - Header: `x-csrf-token` must match `csrfToken` cookie.
  - Response includes a new `csrfToken`.
- GET `/auth/me`
  - Auth required
- POST `/auth/change-password`
  - Auth required
  - Body: `currentPassword`, `newPassword`
  - Applies immediately for the current user (no moderation).
  - Password policy: 8-128 chars, uppercase, lowercase, number, special char.
- POST `/auth/logout`
  - Auth required
  - Cookie: `refreshToken`
  - Header: `x-csrf-token` must match `csrfToken` cookie.

## Users

- GET `/users`
  - Response includes `activities` counts: `favorites`, `annotations`, `translations`.
  - `activities.moderation` includes counts by status. `pending` is shown only for the current user (token).
- GET `/users/:id`
  - Response includes `activities` counts: `favorites`, `annotations`, `translations`.
  - `activities.moderation` includes counts by status. `pending` is shown only for the current user (token).
- GET `/users/:id/full`
- POST `/users`
  - Auth + moderator required
  - Body (create): `username`, `displayName`, `email`, `avatarUrl`, `bio`, `badges`, `passwordHash`, `passwordSalt`, `roleId`
- PUT `/users/:id`
  - Auth required
  - Body (update): `username`, `email`, `displayName`, `avatarUrl`, `bio`, `badges`, `passwordHash`, `passwordSalt`, `roleId`
- DELETE `/users/:id`
  - Auth required

## Songs

- GET `/songs`
  - Response includes `artist` (primary artist when available) and `albums`.
- GET `/songs/latest`
  - Returns the most recent song that received an applied moderation action (song, lyrics, or translations).
- GET `/songs/:id`
- `lyricSections` includes `lines` (from `lyricLines`), each line includes `translationLines` with `translation`.
- GET `/songs/:id/full`
  - Response includes `albums` (albums the song appears on) with `artist` object.
  - `createdBy` is an object `{ id, username }`.
  - Response includes `lyricSections` (sections like verse/chorus).
    - Fields: `id`, `songId`, `type`, `sectionIndex`, `startLine`, `endLine`, `title`, `createdAt`
- POST `/songs`
  - Auth required
  - Body (create): `title`, `releaseYear`, `isPublished`, `description`, `languageCode`, `createdBy`
  - Optional: `artists`, `albumTracks` (or `albumTrack`), `sources`, `lyricLines`, `translations`
  - Optional: `sections` (or `lyricSections`)
    - `sections`: array of `{ type, sectionIndex | index, startLine, endLine, title }`
    - `artists`: array of `{ artistId, role, isPrimary }` (or string IDs)
    - `albumTracks`: array of `{ albumId, trackNumber, discNumber, isBonus }`
    - `sources`: array of `{ kind, url, note }`
    - `lyricLines`: array of `{ lineIndex, text, tStartMs, tEndMs }`
    - `translations`: array of `{ languageCode, titleTrans, title, notes, isMachine, createdBy, lines }`
      - `lines`: array of `{ lineIndex, text, lyricLineId }`
      - Each `translation` line must reference a `lyricLineId` or a matching `lyricLines[].lineIndex`.
  - `createdBy` accepts an id or `{ id, username }` (backend stores the id).
- PUT `/songs/:id`
  - Auth required
  - Body (update): `title`, `releaseYear`, `isPublished`, `description`
  - Optional: `lyricLines`, `translations`, `sections` (same shape as POST)
- DELETE `/songs/:id`
  - Auth required
  - Responses include `createdBy` as `{ id, username }`.

## Artists

- GET `/artists`
  - Each artist includes `albums` (primary or via tracks).
- GET `/artists/:id`
  - Includes `albums` (primary or via tracks).
- GET `/artists/:id/albums`
  - Returns albums where artist is primary or appears on album tracks.
- GET `/artists/:id/full`
- POST `/artists`
  - Auth required
  - Body (create): `name`, `country`, `photoUrl` (stored as `origin`)
- PUT `/artists/:id`
  - Auth required
  - Body (update): `name`, `country`, `photoUrl` (stored as `origin`)
- DELETE `/artists/:id`
  - Auth required

## Albums

- GET `/albums`
  - Query (optional): `artistIds` (comma-separated or repeated). Returns albums where artist is primary or appears on album tracks.
  - Response includes `artist` object (instead of `primaryArtistId`) from the primary artist relation.
- GET `/albums/:id`
  - Response includes `artist` object (instead of `primaryArtistId`) from the primary artist relation.
- GET `/albums/:id/tracks`
  - Response includes `artist` object (instead of `primaryArtistId`) from the primary artist relation.
- POST `/albums`
  - Auth required
  - Body (create): `title`, `releaseYear`, `label`, `coverUrl`, `primaryArtistId`
- PUT `/albums/:id`
  - Auth required
  - Body (update): `title`, `releaseYear`, `label`, `coverUrl`, `primaryArtistId`
- DELETE `/albums/:id`
  - Auth required

## Translations

- GET `/translations`
- GET `/translations/:id`
- GET `/translations/:id/full`
- POST `/translations`
  - Auth required
  - Body (create): `songId`, `languageCode`, `createdBy`, `isApproved`, `notes`
- PUT `/translations/:id`
  - Auth required
  - Body (update): `isApproved`, `notes`
- DELETE `/translations/:id`
  - Auth required

## Annotations

- GET `/annotations`
- GET `/annotations/:id`
- GET `/annotations/:id/full`
- POST `/annotations`
  - Auth required
  - Body (create): `songId`, `createdBy`, `text` (stored as `bodyMd`), `startCharIndex`, `endCharIndex`
  - Optional: `startLine`, `endLine`, `startChar`, `endChar`, `bodyMd`
- PUT `/annotations/:id`
  - Auth required
  - Body (update): `text`, `startCharIndex`, `endCharIndex`, `startLine`, `endLine`
- DELETE `/annotations/:id`
  - Auth required

## Annotation Comments

- GET `/annotation-comments`
- GET `/annotation-comments/:id`
- POST `/annotation-comments`
  - Auth required
  - Body (create): `annotationId`, `userId`, `parentCommentId`, `body`
- PUT `/annotation-comments/:id`
  - Auth required
  - Body (update): `body`
- DELETE `/annotation-comments/:id`
  - Auth required

## Glossary

- GET `/glossary`
- GET `/glossary/:id`
- GET `/glossary/:id/full`
- POST `/glossary`
  - Auth required
  - Body (create): `term`, `languageCode`, `notes`, `createdAt`
- PUT `/glossary/:id`
  - Auth required
  - Body (update): `term`, `notes`
- DELETE `/glossary/:id`
  - Auth required

## App Versions

- GET `/versions`
- GET `/versions/latest`
- GET `/versions/:id`
- POST `/versions`
  - Auth + admin required
  - Body (create): `version`, `notes`, `isRequired`
- PUT `/versions/:id`
  - Auth + admin required
  - Body (update): `version`, `notes`, `isRequired`
- DELETE `/versions/:id`
  - Auth + admin required

## Reports

- GET `/reports`
  - Auth + moderator required
  - Query (optional): `targetType`
- GET `/reports/:id`
  - Auth + moderator required
- POST `/reports`
  - Auth required
  - Body: `targetType`, `targetId`, `reason`
  - Allowed targetType: `annotation`, `annotationComment`, `song`, `translation`, `artist`, `album`

## Moderation (moderator only)

- GET `/moderation/requests`
  - Auth + moderator required
  - Query: `status` (default: `pending`)
- GET `/moderation/requests/:id`
  - Auth + moderator required
- POST `/moderation/requests/:id/approve`
  - Auth + moderator required
  - Body: `decisionNote` (optional)
- POST `/moderation/requests/:id/reject`
  - Auth + moderator required
  - Body: `decisionNote` (optional)

## Notes / checks to confirm

- Artists: API accepts `country`, stored as `origin` (responses include `country` alias).
- Glossary: controller uses `term` but DB column is `lemma`.
- Translations: controller uses `isApproved` but DB column is `isMachine`.
