import { BaseModel } from "./BaseModel.js";
import { Song } from "./Song.js";
import { User } from "./User.js";
import { AnnotationComment } from "./AnnotationComment.js";
export class Annotation extends BaseModel {
  static tableName = "annotations";
  static idColumn = "id";

  static relationMappings = () => ({
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "annotations.songId", to: "songs.id" },
    },
    author: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "annotations.createdBy", to: "users.id" },
    },
    comments: {
      relation: BaseModel.HasManyRelation,
      modelClass: AnnotationComment,
      join: { from: "annotations.id", to: "annotationComments.annotationId" },
    },
    voters: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: User,
      join: {
        from: "annotations.id",
        through: {
          from: "annotationVotes.annotationId",
          to: "annotationVotes.userId",
        },
        to: "users.id",
      },
    },
  });
}
