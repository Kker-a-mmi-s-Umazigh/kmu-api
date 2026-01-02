/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable("moderationRequests", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"))
    t.text("status").notNullable().defaultTo("pending")
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.uuid("createdBy").notNullable().references("users.id").onDelete("CASCADE")
    t.timestamp("reviewedAt", { useTz: true })
    t.uuid("reviewedBy").references("users.id").onDelete("SET NULL")
    t.text("decisionNote")
    t.timestamp("appliedAt", { useTz: true })
    t.index(["status"])
    t.index(["createdBy"])
  })

  await knex.schema.createTable("moderationChanges", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"))
    t.uuid("requestId")
      .notNullable()
      .references("moderationRequests.id")
      .onDelete("CASCADE")
    t.text("targetTable").notNullable()
    t.text("operation").notNullable()
    t.integer("sequence").notNullable().defaultTo(0)
    t.jsonb("targetKey")
    t.jsonb("dataNew")
    t.jsonb("dataOld")
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.index(["requestId"])
    t.index(["targetTable"])
  })

  await knex.raw(`
    ALTER TABLE "moderationRequests"
    ADD CONSTRAINT "chk_moderationRequests_status"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'applied'));
  `)

  await knex.raw(`
    ALTER TABLE "moderationChanges"
    ADD CONSTRAINT "chk_moderationChanges_operation"
    CHECK ("operation" IN ('insert', 'update', 'delete'));
  `)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE "moderationChanges"
    DROP CONSTRAINT IF EXISTS "chk_moderationChanges_operation";
  `)

  await knex.raw(`
    ALTER TABLE "moderationRequests"
    DROP CONSTRAINT IF EXISTS "chk_moderationRequests_status";
  `)

  await knex.schema.dropTableIfExists("moderationChanges")
  await knex.schema.dropTableIfExists("moderationRequests")
}
