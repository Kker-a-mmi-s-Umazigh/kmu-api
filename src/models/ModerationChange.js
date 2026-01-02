import { BaseModel } from "./BaseModel.js"
import { ModerationRequest } from "./ModerationRequest.js"

export class ModerationChange extends BaseModel {
  static tableName = "moderationChanges"
  static idColumn = "id"

  static relationMappings = () => ({
    request: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: ModerationRequest,
      join: { from: "moderationChanges.requestId", to: "moderationRequests.id" },
    },
  })
}
