import { BaseModel } from "./BaseModel.js"
import { GlossaryTerm } from "./GlossaryTerm.js"
import { GlossaryTermMeaning } from "./GlossaryTermMeaning.js"
import { LyricLine } from "./LyricLine.js"
export class GlossaryTermLyricLine extends BaseModel {
  static tableName = "glossaryTermLyricLines"
  static idColumn = "id"

  static relationMappings = () => ({
    term: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: GlossaryTerm,
      join: { from: "glossaryTermLyricLines.termId", to: "glossaryTerms.id" },
    },
    meaning: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: GlossaryTermMeaning,
      join: {
        from: "glossaryTermLyricLines.meaningId",
        to: "glossaryTermMeanings.id",
      },
    },
    lyricLine: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: LyricLine,
      join: { from: "glossaryTermLyricLines.lyricLineId", to: "lyricLines.id" },
    },
  })
}
