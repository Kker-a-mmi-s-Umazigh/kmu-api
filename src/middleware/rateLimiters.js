import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    skip: () => isTest,
  });

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many auth attempts, please try again later." },
});

export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many refresh attempts, please try again later." },
});
