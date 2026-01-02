/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable("lyricSections", (t) => {
    t.uuid("id").primary()
    t.uuid("songId").notNullable().references("songs.id").onDelete("CASCADE")
    t.text("type").notNullable()
    t.integer("sectionIndex").notNullable().defaultTo(1)
    t.integer("startLine").notNullable()
    t.integer("endLine").notNullable()
    t.text("title")
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.index(["songId"])
  })

  await knex.raw(`
    ALTER TABLE "lyricSections"
    ADD CONSTRAINT "chk_lyricSections_ranges"
    CHECK ("startLine" >= 0 AND "endLine" >= "startLine");
  `)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE "lyricSections"
    DROP CONSTRAINT IF EXISTS "chk_lyricSections_ranges";
  `)
  await knex.schema.dropTableIfExists("lyricSections")
}
