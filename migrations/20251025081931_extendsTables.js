/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // refreshTokens
  await knex.schema.createTable("refreshTokens", (t) => {
    t.uuid("id").primary();
    t.timestamp("expAt", { useTz: true }).notNullable();
    t.boolean("revoked").notNullable().defaultTo(false);
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.text("token").notNullable();
    t.uuid("userId").notNullable().references("users.id");
    t.index(["userId"]);
    t.index(["expAt"]);
  });

  // songSources
  await knex.schema.createTable("songSources", (t) => {
    t.uuid("id").primary();
    t.text("kind").notNullable();
    t.text("url").notNullable();
    t.text("note");
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    t.index(["songId"]);
  });

  // lyricLines
  await knex.schema.createTable("lyricLines", (t) => {
    t.uuid("id").primary();
    t.integer("lineIndex").notNullable();
    t.text("text").notNullable();
    t.integer("tStartMs");
    t.integer("tEndMs");
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    t.unique(["songId", "lineIndex"]);
    t.index(["songId"]);
  });

  // translations
  await knex.schema.createTable("translations", (t) => {
    t.uuid("id").primary();
    t.text("titleTrans");
    t.text("notes");
    t.boolean("isMachine").notNullable().defaultTo(false);
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.string("languageCode", 10).notNullable().references("languages.code");
    t.uuid("createdBy").references("users.id");
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    t.index(["songId"]);
    t.index(["languageCode"]);
  });

  // translationLines
  await knex.schema.createTable("translationLines", (t) => {
    t.uuid("id").primary();
    t.integer("lineIndex").notNullable();
    t.text("text").notNullable();
    t.uuid("translationId")
      .notNullable()
      .references("translations.id")
      .onDelete("CASCADE");
    t.uuid("lyricLineId").references("lyricLines.id").onDelete("CASCADE");
    t.unique(["translationId", "lyricLineId"]);
    t.index(["lyricLineId"]);
  });

  // albumTracks
  await knex.schema.createTable("albumTracks", (t) => {
    t.uuid("id").primary();
    t.integer("discNumber").notNullable().defaultTo(1);
    t.integer("trackNumber").notNullable();
    t.boolean("isBonus").notNullable().defaultTo(false);
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    t.uuid("albumId").notNullable().references("albums.id").onDelete("CASCADE");
    t.unique(["albumId", "discNumber", "trackNumber"], {
      indexName: "ux_albumTracks_album_disc_track",
    });
    t.index(["albumId"]);
    t.index(["songId"]);
  });

  // songArtists
  await knex.schema.createTable("songArtists", (t) => {
    t.uuid("artistId")
      .notNullable()
      .references("artists.id")
      .onDelete("CASCADE");
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    t.string("role", 50).notNullable();
    t.boolean("isPrimary").notNullable().defaultTo(false);
    t.primary(["artistId", "songId"]);
  });

  // annotations
  await knex.schema.createTable("annotations", (t) => {
    t.uuid("id").primary();
    t.integer("startLine").notNullable();
    t.integer("endLine").notNullable();
    t.integer("startChar");
    t.integer("endChar");
    t.text("bodyMd").notNullable();
    t.text("status").notNullable().defaultTo("pending");
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.uuid("createdBy").references("users.id");
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    // can't add checkConstraint here with this Knex version
    t.index(["songId"]);
    t.index(["createdBy"]);
  });

  // add CHECK constraint for annotations via raw SQL
  await knex.raw(`
    ALTER TABLE "annotations"
    ADD CONSTRAINT "chk_annotations_ranges"
    CHECK ("startLine" >= 0 AND "endLine" >= "startLine");
  `);

  // annotationComments
  await knex.schema.createTable("annotationComments", (t) => {
    t.uuid("id").primary();
    t.uuid("annotationId")
      .notNullable()
      .references("annotations.id")
      .onDelete("CASCADE");
    t.uuid("userId").notNullable().references("users.id").onDelete("CASCADE");
    t.uuid("parentCommentId")
      .references("annotationComments.id")
      .onDelete("CASCADE");
    t.text("body").notNullable();
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("updatedAt", { useTz: true });
    t.index(["annotationId"]);
    t.index(["userId"]);
    t.index(["parentCommentId"]);
  });

  // glossaryTerms
  await knex.schema.createTable("glossaryTerms", (t) => {
    t.uuid("id").primary();
    t.text("lemma").notNullable();
    t.string("languageCode", 10)
      .notNullable()
      .references("languages.code")
      .onDelete("RESTRICT");
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("updatedAt", { useTz: true });
    t.unique(["lemma", "languageCode"], {
      indexName: "ux_glossaryTerms_lemma_lang",
    });
    t.index(["lemma"]);
  });

  // glossaryTermMeanings
  await knex.schema.createTable("glossaryTermMeanings", (t) => {
    t.uuid("id").primary();
    t.smallint("senseOrder").notNullable().defaultTo(1);
    t.text("title");
    t.text("definition").notNullable();
    t.text("examples");
    t.text("notes");
    t.text("partOfSpeech");
    t.specificType("synonyms", "text[]");
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("updatedAt", { useTz: true });
    t.uuid("termId")
      .notNullable()
      .references("glossaryTerms.id")
      .onDelete("CASCADE");
    t.unique(["termId", "senseOrder"], { indexName: "ux_termMeanings_order" });
    t.index(["termId"]);
  });

  // glossaryTermLyricLines
  await knex.schema.createTable("glossaryTermLyricLines", (t) => {
    t.uuid("id").primary();
    t.integer("startChar");
    t.integer("endChar");
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.uuid("lyricLineId")
      .notNullable()
      .references("lyricLines.id")
      .onDelete("CASCADE");
    t.uuid("meaningId")
      .references("glossaryTermMeanings.id")
      .onDelete("SET NULL");
    t.uuid("termId")
      .notNullable()
      .references("glossaryTerms.id")
      .onDelete("CASCADE");
    t.unique(["termId", "lyricLineId", "startChar", "endChar"], {
      indexName: "ux_termLine_span",
    });
    t.index(["lyricLineId"]);
    t.index(["termId"]);
    t.index(["meaningId"]);
  });

  // notifications
  await knex.schema.createTable("notifications", (t) => {
    t.uuid("id").primary();
    t.text("type").notNullable();
    t.jsonb("payload").notNullable();
    t.boolean("isRead").notNullable().defaultTo(false);
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.uuid("userId").notNullable().references("users.id").onDelete("CASCADE");
    t.index(["userId"]);
  });

  // reports
  await knex.schema.createTable("reports", (t) => {
    t.uuid("id").primary();
    t.text("targetType").notNullable();
    t.uuid("targetId").notNullable();
    t.text("reason").notNullable();
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("resolvedAt", { useTz: true });
    t.text("resolution");
    t.uuid("resolvedBy").references("users.id");
    t.uuid("reporterId").references("users.id");
    // can't add checkConstraint inline here either
    t.index(["targetType", "targetId"], "idx_reports_target");
  });

  // add CHECK constraint for reports via raw SQL
  await knex.raw(`
    ALTER TABLE "reports"
    ADD CONSTRAINT "chk_reports_targetType"
    CHECK ("targetType" IN (
      'annotation',
      'annotationComment',
      'song',
      'translation',
      'artist',
      'album'
    ));
  `);

  // votes
  await knex.schema.createTable("annotationVotes", (t) => {
    t.uuid("userId").notNullable().references("users.id").onDelete("CASCADE");
    t.uuid("annotationId")
      .notNullable()
      .references("annotations.id")
      .onDelete("CASCADE");
    t.primary(["userId", "annotationId"]);
  });

  // favoris
  await knex.schema.createTable("favoriteSongs", (t) => {
    t.uuid("userId").notNullable().references("users.id").onDelete("CASCADE");
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE");
    t.primary(["userId", "songId"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // drop in reverse order of deps
  await knex.schema
    .dropTableIfExists("favoriteSongs")
    .dropTableIfExists("annotationVotes");

  // drop constraints before dropping the tables that had raw constraints
  await knex.raw(`
    ALTER TABLE "reports"
    DROP CONSTRAINT IF EXISTS "chk_reports_targetType";
  `);
  await knex.raw(`
    ALTER TABLE "annotations"
    DROP CONSTRAINT IF EXISTS "chk_annotations_ranges";
  `);

  await knex.schema
    .dropTableIfExists("reports")
    .dropTableIfExists("notifications")
    .dropTableIfExists("glossaryTermLyricLines")
    .dropTableIfExists("glossaryTermMeanings")
    .dropTableIfExists("glossaryTerms")
    .dropTableIfExists("annotationComments")
    .dropTableIfExists("annotations")
    .dropTableIfExists("songArtists")
    .dropTableIfExists("albumTracks")
    .dropTableIfExists("translationLines")
    .dropTableIfExists("translations")
    .dropTableIfExists("lyricLines")
    .dropTableIfExists("songSources")
    .dropTableIfExists("refreshTokens");
};
