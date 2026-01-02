import { BaseModel } from "./BaseModel.js"
import { User } from "./User.js"

export class Role extends BaseModel {
  static tableName = "roles"
  static idColumn = "id"

  static jsonSchema = {
    type: "object",
    required: ["name"],
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
    },
  }

  static relationMappings = () => ({
    users: {
      relation: BaseModel.HasManyRelation,
      modelClass: User,
      join: { from: "roles.id", to: "users.roleId" },
    },
  })
}
