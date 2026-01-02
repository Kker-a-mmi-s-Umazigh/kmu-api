import { BaseModel } from "./BaseModel.js"
import { Song } from "./Song.js"
import { Translation } from "./Translation.js"
import { GlossaryTerm } from "./GlossaryTerm.js"

export class Language extends BaseModel {
  static tableName = "languages"
  static idColumn = "code"

  static jsonSchema = {
    type: "object",
    required: ["code", "name"],
    properties: {
      code: { type: "string", maxLength: 10 },
      name: { type: "string" },
      nativeName: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
    },
  }

  static relationMappings = () => ({
    songs: {
      relation: BaseModel.HasManyRelation,
      modelClass: Song,
      join: { from: "languages.code", to: "songs.languageCode" },
    },
    translations: {
      relation: BaseModel.HasManyRelation,
      modelClass: Translation,
      join: { from: "languages.code", to: "translations.languageCode" },
    },
    glossaryTerms: {
      relation: BaseModel.HasManyRelation,
      modelClass: GlossaryTerm,
      join: { from: "languages.code", to: "glossaryTerms.languageCode" },
    },
  })
}
