/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.alterTable("favoriteSongs", (t) => {
    t.timestamp("createdAt", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.alterTable("favoriteSongs", (t) => {
    t.dropColumn("createdAt");
  });
};
