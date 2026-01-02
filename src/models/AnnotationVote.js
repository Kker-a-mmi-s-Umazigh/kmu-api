import { BaseModel } from "./BaseModel.js"
import { User } from "./User.js"
import { Annotation } from "./Annotation.js"
export class AnnotationVote extends BaseModel {
  static tableName = "annotationVotes"
  static idColumn = ["userId", "annotationId"]

  static relationMappings = () => ({
    user: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "annotationVotes.userId", to: "users.id" },
    },
    annotation: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Annotation,
      join: { from: "annotationVotes.annotationId", to: "annotations.id" },
    },
  })
}
