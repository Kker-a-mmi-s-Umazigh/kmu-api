import { BaseModel } from "./BaseModel.js";
import { Song } from "./Song.js";
import { Artist } from "./Artist.js";
export class SongArtist extends BaseModel {
  static tableName = "songArtists";
  static idColumn = ["artistId", "songId"]; // PK composite

  static relationMappings = () => ({
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "songArtists.songId", to: "songs.id" },
    },
    artist: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Artist,
      join: { from: "songArtists.artistId", to: "artists.id" },
    },
  });
}
