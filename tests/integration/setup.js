import { jest } from "@jest/globals";
import knex from "../../src/config/knexClient.js";
import { seed } from "../../seeds/seed.js";

jest.setTimeout(30000);

beforeAll(async () => {
  await knex.migrate.latest({ directory: "./migrations" });
});

beforeEach(async () => {
  await seed(knex);
});

afterAll(async () => {
  await knex.destroy();
});
