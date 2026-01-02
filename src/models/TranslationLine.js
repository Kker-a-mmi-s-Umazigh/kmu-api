import { BaseModel } from "./BaseModel.js"
import { Translation } from "./Translation.js"
import { LyricLine } from "./LyricLine.js"
export class TranslationLine extends BaseModel {
  static tableName = "translationLines"
  static idColumn = "id"

  static relationMappings = () => ({
    translation: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Translation,
      join: { from: "translationLines.translationId", to: "translations.id" },
    },
    lyricLine: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: LyricLine,
      join: { from: "translationLines.lyricLineId", to: "lyricLines.id" },
    },
  })
}
