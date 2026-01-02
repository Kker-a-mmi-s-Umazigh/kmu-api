import { BaseModel } from "./BaseModel.js"
import { Album } from "./Album.js"
import { Song } from "./Song.js"
export class AlbumTrack extends BaseModel {
  static tableName = "albumTracks"
  static idColumn = "id"

  static relationMappings = () => ({
    album: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Album,
      join: { from: "albumTracks.albumId", to: "albums.id" },
    },
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "albumTracks.songId", to: "songs.id" },
    },
  })
}
