import { BaseModel } from "./BaseModel.js"
import { ModerationChange } from "./ModerationChange.js"
import { User } from "./User.js"

export class ModerationRequest extends BaseModel {
  static tableName = "moderationRequests"
  static idColumn = "id"

  static relationMappings = () => ({
    changes: {
      relation: BaseModel.HasManyRelation,
      modelClass: ModerationChange,
      join: { from: "moderationRequests.id", to: "moderationChanges.requestId" },
    },
    creator: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "moderationRequests.createdBy", to: "users.id" },
    },
    reviewer: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "moderationRequests.reviewedBy", to: "users.id" },
    },
  })
}
