import { BaseModel } from "./BaseModel.js"
import { User } from "./User.js"
export class Report extends BaseModel {
  static tableName = "reports"
  static idColumn = "id"

  static relationMappings = () => ({
    reporter: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "reports.reporterId", to: "users.id" },
    },
    resolver: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "reports.resolvedBy", to: "users.id" },
    },
  })
}
