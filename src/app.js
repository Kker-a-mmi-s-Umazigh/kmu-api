import express from "express";
import cors from "cors";
import helmet from "helmet";

import cookieParser from "cookie-parser";
import apiRouter from "./routes/index.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const rawCorsOrigins = process.env.CORS_ORIGINS || "";
const allowedCorsOrigins = rawCorsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllCors =
  (!isProduction && allowedCorsOrigins.length === 0) ||
  allowedCorsOrigins.includes("*");

const enforceCorsOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowAllCors) return next();
  if (allowedCorsOrigins.includes(origin)) return next();
  return res.status(403).json({ error: "CORS origin denied" });
};

app.use(express.json());
app.use(enforceCorsOrigin);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllCors) return callback(null, true);
      return callback(null, allowedCorsOrigins.includes(origin));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") {
  app.use(requestLogger);
}

app.use("/api", apiRouter);

app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  res.status(err.status || 500).json({ error: err.message });
});

export default app;
