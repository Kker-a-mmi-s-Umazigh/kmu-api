import Knex from "knex";
import { Model } from "objection";
import config from "../config/db.js";

const environment = process.env.NODE_ENV || "development";
const knex = Knex(config[environment]);

Model.knex(knex);

export default knex;
