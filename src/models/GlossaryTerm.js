import { BaseModel } from "./BaseModel.js"
import { Language } from "./Language.js"
import { GlossaryTermMeaning } from "./GlossaryTermMeaning.js"
import { GlossaryTermLyricLine } from "./GlossaryTermLyricLine.js"
export class GlossaryTerm extends BaseModel {
  static tableName = "glossaryTerms"
  static idColumn = "id"

  static relationMappings = () => ({
    language: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Language,
      join: { from: "glossaryTerms.languageCode", to: "languages.code" },
    },
    meanings: {
      relation: BaseModel.HasManyRelation,
      modelClass: GlossaryTermMeaning,
      join: { from: "glossaryTerms.id", to: "glossaryTermMeanings.termId" },
    },
    occurrences: {
      relation: BaseModel.HasManyRelation,
      modelClass: GlossaryTermLyricLine,
      join: { from: "glossaryTerms.id", to: "glossaryTermLyricLines.termId" },
    },
  })
}
