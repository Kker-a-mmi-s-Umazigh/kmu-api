import { BaseModel } from "./BaseModel.js"
import { User } from "./User.js"

export class RefreshToken extends BaseModel {
  static tableName = "refreshTokens"
  static idColumn = "id"

  static jsonSchema = {
    type: "object",
    required: ["token", "expAt", "userId"],
    properties: {
      id: { type: "string", format: "uuid" },
      token: { type: "string" },
      expAt: { type: "string", format: "date-time" },
      revoked: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      userId: { type: "string", format: "uuid" },
    },
  }

  static relationMappings = () => ({
    user: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "refreshTokens.userId", to: "users.id" },
    },
  })
}
