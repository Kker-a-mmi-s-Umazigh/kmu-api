import { BaseModel } from "./BaseModel.js"
import { User } from "./User.js"
import { Song } from "./Song.js"
export class FavoriteSong extends BaseModel {
  static tableName = "favoriteSongs"
  static idColumn = ["userId", "songId"]

  static relationMappings = () => ({
    user: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "favoriteSongs.userId", to: "users.id" },
    },
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "favoriteSongs.songId", to: "songs.id" },
    },
  })
}
