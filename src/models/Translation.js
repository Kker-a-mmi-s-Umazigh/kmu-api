import { BaseModel } from "./BaseModel.js"
import { Song } from "./Song.js"
import { Language } from "./Language.js"
import { User } from "./User.js"
import { TranslationLine } from "./TranslationLine.js"

export class Translation extends BaseModel {
  static tableName = "translations"
  static idColumn = "id"

  static relationMappings = () => ({
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "translations.songId", to: "songs.id" },
    },
    language: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Language,
      join: { from: "translations.languageCode", to: "languages.code" },
    },
    author: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: User,
      join: { from: "translations.createdBy", to: "users.id" },
    },
    lines: {
      relation: BaseModel.HasManyRelation,
      modelClass: TranslationLine,
      join: { from: "translations.id", to: "translationLines.translationId" },
    },
  })
}
