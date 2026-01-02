import dotenv from "dotenv";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const buildConnection = () => {
  const sslEnabled =
    process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
  const sslConfig = sslEnabled ? { rejectUnauthorized: false } : undefined;
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: sslConfig,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(sslConfig ? { ssl: sslConfig } : {}),
  };
};

const config = {
  development: {
    client: "pg",
    connection: buildConnection(),
    migrations: {
      tableName: "knex_migrations",
      directory: "./migrations",
      debug: true,
    },
    rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://localhost",
    seeds: {
      directory: "./seeds",
    },
  },

  test: {
    client: "pg",
    connection: buildConnection(),
    migrations: {
      tableName: "knex_migrations",
      directory: "./migrations",
    },
    rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://localhost",
    seeds: {
      directory: "./seeds",
    },
  },
  production: {
    client: "pg",
    connection: buildConnection(),
    migrations: {
      tableName: "knex_migrations",
      directory: "./migrations",
    },
    rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://localhost",
  },
  security: {
    pepper: process.env.PEPPER,
    keylen: Number.parseInt(process.env.KEYLEN, 10),
    iterations: Number.parseInt(process.env.ITERATIONS, 10),
    digest: process.env.DIGEST,
    jwtSecret: process.env.JWT_SECRET,
    refreshJwtSecret: process.env.REFRESH_JWT_SECRET,
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRATION || "15m",
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRATION || "7d",
  },
};

export default config;
