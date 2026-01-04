/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable("appVersions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("version").notNullable();
    t.text("notes");
    t.boolean("isRequired").notNullable().defaultTo(false);
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("updatedAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.unique(["version"]);
    t.index(["createdAt"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists("appVersions");
};
