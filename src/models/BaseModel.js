import { Model, AjvValidator } from "objection"
import addFormats from "ajv-formats"
import knex from "../config/knexClient.js"

Model.knex(knex)

export class BaseModel extends Model {
  // Ajv commun si tu veux valider avec formats (email, url, etc.)
  static createValidator() {
    return new AjvValidator({
      onCreateAjv: (ajv) => {
        addFormats(ajv)
      },
      options: {
        allErrors: true,
        removeAdditional: true,
      },
    })
  }

  $beforeInsert() {
    if (this.constructor.jsonSchema?.properties?.createdAt && !this.createdAt) {
      this.createdAt = new Date().toISOString()
    }
  }
}
