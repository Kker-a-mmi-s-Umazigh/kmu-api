import { BaseModel } from "./BaseModel.js";

export class AppVersion extends BaseModel {
  static tableName = "appVersions";
  static idColumn = "id";

  static jsonSchema = {
    type: "object",
    required: ["version"],
    properties: {
      id: { type: "string", format: "uuid" },
      version: { type: "string" },
      notes: { type: ["string", "null"] },
      isRequired: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  };
}
