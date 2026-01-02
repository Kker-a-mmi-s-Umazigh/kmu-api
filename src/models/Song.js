import { BaseModel } from "./BaseModel.js";
import { Language } from "./Language.js";
import { User } from "./User.js";
import { SongSource } from "./SongSource.js";
import { LyricLine } from "./LyricLine.js";
import { LyricSection } from "./LyricSection.js";
import { Translation } from "./Translation.js";
import { Annotation } from "./Annotation.js";
import { Artist } from "./Artist.js";
import { Album } from "./Album.js";

export class Song extends BaseModel {
  static tableName = "songs";
  static idColumn = "id";

  static jsonSchema = {
    type: "object",
    required: ["title", "languageCode"],
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      releaseYear: { type: ["integer", "null"] },
      isPublished: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      description: { type: ["string", "null"] },
      languageCode: { type: "string" },
      createdBy: { type: ["string", "null"], format: "uuid" },
    },
  };

  static relationMappings = () => ({
    language: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Language,
      join: { from: "songs.languageCode", to: "languages.code" },
    },
    creator: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "songs.createdBy", to: "users.id" },
    },
    sources: {
      relation: BaseModel.HasManyRelation,
      modelClass: SongSource,
      join: { from: "songs.id", to: "songSources.songId" },
    },
    lyricLines: {
      relation: BaseModel.HasManyRelation,
      modelClass: LyricLine,
      join: { from: "songs.id", to: "lyricLines.songId" },
    },
    lyricSections: {
      relation: BaseModel.HasManyRelation,
      modelClass: LyricSection,
      join: { from: "songs.id", to: "lyricSections.songId" },
    },
    translations: {
      relation: BaseModel.HasManyRelation,
      modelClass: Translation,
      join: { from: "songs.id", to: "translations.songId" },
    },
    annotations: {
      relation: BaseModel.HasManyRelation,
      modelClass: Annotation,
      join: { from: "songs.id", to: "annotations.songId" },
    },
    artists: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: Artist,
      join: {
        from: "songs.id",
        through: {
          from: "songArtists.songId",
          to: "songArtists.artistId",
          extra: ["role", "isPrimary"],
        },
        to: "artists.id",
      },
    },
    inAlbums: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: Album,
      join: {
        from: "songs.id",
        through: {
          from: "albumTracks.songId",
          to: "albumTracks.albumId",
          extra: ["discNumber", "trackNumber", "isBonus", "createdAt"],
        },
        to: "albums.id",
      },
    },
    favoredBy: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: User,
      join: {
        from: "songs.id",
        through: {
          from: "favoriteSongs.songId",
          to: "favoriteSongs.userId",
        },
        to: "users.id",
      },
    },
  });
}
