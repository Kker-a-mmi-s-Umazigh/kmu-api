import { BaseModel } from "./BaseModel.js";
import { Annotation } from "./Annotation.js";
import { User } from "./User.js";
export class AnnotationComment extends BaseModel {
  static tableName = "annotationComments";
  static idColumn = "id";

  static relationMappings = () => ({
    annotation: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Annotation,
      join: { from: "annotationComments.annotationId", to: "annotations.id" },
    },
    author: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "annotationComments.userId", to: "users.id" },
    },
    parent: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: AnnotationComment,
      join: {
        from: "annotationComments.parentCommentId",
        to: "annotationComments.id",
      },
    },
    children: {
      relation: BaseModel.HasManyRelation,
      modelClass: AnnotationComment,
      join: {
        from: "annotationComments.id",
        to: "annotationComments.parentCommentId",
      },
    },
  });
}
