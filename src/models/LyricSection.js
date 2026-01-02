import { BaseModel } from "./BaseModel.js"
import { Song } from "./Song.js"

export class LyricSection extends BaseModel {
  static tableName = "lyricSections"
  static idColumn = "id"

  static relationMappings = () => ({
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "lyricSections.songId", to: "songs.id" },
    },
  })
}
