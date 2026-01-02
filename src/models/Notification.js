import { BaseModel } from "./BaseModel.js"
import { User } from "./User.js"
export class Notification extends BaseModel {
  static tableName = "notifications"
  static idColumn = "id"

  static relationMappings = () => ({
    user: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "notifications.userId", to: "users.id" },
    },
  })
}
