import { BaseModel } from "./BaseModel.js";
import { Song } from "./Song.js";
export class SongSource extends BaseModel {
  static tableName = "songSources";
  static idColumn = "id";

  static relationMappings = () => ({
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "songSources.songId", to: "songs.id" },
    },
  });
}
