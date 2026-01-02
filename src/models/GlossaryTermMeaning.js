import { BaseModel } from "./BaseModel.js"
import { GlossaryTerm } from "./GlossaryTerm.js"
export class GlossaryTermMeaning extends BaseModel {
  static tableName = "glossaryTermMeanings"
  static idColumn = "id"

  static relationMappings = () => ({
    term: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: GlossaryTerm,
      join: { from: "glossaryTermMeanings.termId", to: "glossaryTerms.id" },
    },
  })
}
