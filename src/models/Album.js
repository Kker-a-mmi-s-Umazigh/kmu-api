import { BaseModel } from "./BaseModel.js";
import { Artist } from "./Artist.js";
import { AlbumTrack } from "./AlbumTrack.js";
import { Song } from "./Song.js";

export class Album extends BaseModel {
  static tableName = "albums";
  static idColumn = "id";

  static jsonSchema = {
    type: "object",
    required: ["title"],
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      releaseYear: { type: ["integer", "null"] },
      label: { type: ["string", "null"] },
      coverUrl: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
      primaryArtistId: { type: ["string", "null"], format: "uuid" },
    },
  };

  static relationMappings = () => ({
    primaryArtist: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Artist,
      join: { from: "albums.primaryArtistId", to: "artists.id" },
    },
    tracks: {
      relation: BaseModel.HasManyRelation,
      modelClass: AlbumTrack,
      join: { from: "albums.id", to: "albumTracks.albumId" },
    },
    songs: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: Song,
      join: {
        from: "albums.id",
        through: {
          from: "albumTracks.albumId",
          to: "albumTracks.songId",
          extra: ["discNumber", "trackNumber", "isBonus", "createdAt"],
        },
        to: "songs.id",
      },
    },
  });
}
