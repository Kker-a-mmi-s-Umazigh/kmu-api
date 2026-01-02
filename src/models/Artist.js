import { BaseModel } from "./BaseModel.js";
import { Album } from "./Album.js";
import { Song } from "./Song.js";

export class Artist extends BaseModel {
  static tableName = "artists";
  static idColumn = "id";

  static jsonSchema = {
    type: "object",
    required: ["name"],
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      description: { type: "string" },
      photoUrl: { type: ["string", "null"] },
      origin: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
    },
  };

  static relationMappings = () => ({
    primaryAlbums: {
      relation: BaseModel.HasManyRelation,
      modelClass: Album,
      join: { from: "artists.id", to: "albums.primaryArtistId" },
    },
    songs: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: Song,
      join: {
        from: "artists.id",
        through: {
          from: "songArtists.artistId",
          to: "songArtists.songId",
          extra: ["role", "isPrimary"],
        },
        to: "songs.id",
      },
    },
  });
}
