import { BaseModel } from "./BaseModel.js";
import { Song } from "./Song.js";
import { TranslationLine } from "./TranslationLine.js";
import { GlossaryTermLyricLine } from "./GlossaryTermLyricLine.js";
export class LyricLine extends BaseModel {
  static tableName = "lyricLines";
  static idColumn = "id";

  static relationMappings = () => ({
    song: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Song,
      join: { from: "lyricLines.songId", to: "songs.id" },
    },
    translationLines: {
      relation: BaseModel.HasManyRelation,
      modelClass: TranslationLine,
      join: { from: "lyricLines.id", to: "translationLines.lyricLineId" },
    },
    glossaryOccurrences: {
      relation: BaseModel.HasManyRelation,
      modelClass: GlossaryTermLyricLine,
      join: { from: "lyricLines.id", to: "glossaryTermLyricLines.lyricLineId" },
    },
  });
}
