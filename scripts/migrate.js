import knex from "../src/config/knexClient.js";

try {
  await knex.migrate.latest({ directory: "./migrations" });
} finally {
  await knex.destroy();
}
