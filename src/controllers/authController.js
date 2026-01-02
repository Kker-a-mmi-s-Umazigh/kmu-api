// src/controllers/AuthController.js
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
import dotenv from "dotenv";
import knex from "../config/knexClient.js";
import { User } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import hashPassword from "../middleware/hashPassword.js";
import config from "../config/db.js";
import validator from "validator";

dotenv.config();

const security = config.security;
const isProduction = process.env.NODE_ENV === "production";
const cookieSameSite = (process.env.COOKIE_SAMESITE || "").trim();
const cookieSecureRaw = (process.env.COOKIE_SECURE || "").trim();
const parsedCookieSecure =
  cookieSecureRaw === "true" || cookieSecureRaw === "1";
const resolvedSameSite = cookieSameSite || (isProduction ? "Strict" : "Lax");
const resolvedSecure =
  resolvedSameSite.toLowerCase() === "none" ? true : parsedCookieSecure;
const finalSecure = resolvedSecure || isProduction;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: finalSecure,
  sameSite: resolvedSameSite,
};
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: finalSecure,
  sameSite: resolvedSameSite,
};
const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrfToken";

const REFRESH_TOKEN_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;

const getRefreshExpiryMs = () => {
  const value = security.refreshExpiresIn;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
    if (match) {
      const amount = Number(match[1]);
      const unit = match[2].toLowerCase();
      const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      };
      return amount * multipliers[unit];
    }
  }

  return REFRESH_TOKEN_FALLBACK_MS;
};

const issueCsrfToken = () => crypto.randomUUID();

const setAuthCookies = (res, refreshToken, refreshExpMs, csrfToken) => {
  res.cookie("refreshToken", refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: refreshExpMs,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...CSRF_COOKIE_OPTIONS,
    maxAge: refreshExpMs,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie("refreshToken", COOKIE_OPTIONS);
  res.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);
};

const requireCsrfToken = (req, res) => {
  const headerToken = req.get(CSRF_HEADER);
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return false;
  }

  return true;
};

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const passwordIssues = (password) => {
  const issues = [];
  if (typeof password !== "string") {
    issues.push("type");
    return issues;
  }
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("minLength");
  if (password.length > PASSWORD_MAX_LENGTH) issues.push("maxLength");
  if (!/[A-Z]/.test(password)) issues.push("uppercase");
  if (!/[a-z]/.test(password)) issues.push("lowercase");
  if (!/[0-9]/.test(password)) issues.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("special");
  return issues;
};

const ensurePasswordStrength = (password, res) => {
  const issues = passwordIssues(password);
  if (issues.length === 0) return true;
  res.status(400).json({
    error: "Mot de passe trop faible",
    requirements: [
      `minLength:${PASSWORD_MIN_LENGTH}`,
      `maxLength:${PASSWORD_MAX_LENGTH}`,
      "uppercase",
      "lowercase",
      "number",
      "special",
    ],
  });
  return false;
};

export const AuthController = {
  signup: async (req, res) => {
    try {
      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }

      if (!ensurePasswordStrength(password, res)) {
        return;
      }

      // Validation du format d'e-mail
      if (!validator.isEmail(email)) {
        return res.status(400).json({ message: "Format d’email invalide" });
      }

      // Normalisation (supprime espaces, met en minuscule, etc.)
      const normalizedEmail = validator.normalizeEmail(email);

      await knex.transaction(async (trx) => {
        // 1. vérifier si user existe déjà
        const existingUser = await User.query(trx)
          // .skipUndefined()
          .where("email", normalizedEmail)
          .orWhere("username", username)
          .first();

        if (existingUser) {
          throw new Error("USER_EXISTS");
        }

        // 2. hash mdp
        const [passwordHash, passwordSalt] = hashPassword(password);

        const memberRole = await knex("roles")
          .select("*")
          .where("name", "Membre")
          .first();

        // 3. insérer user
        const newUser = await User.query(trx)
          .insert({
            email: normalizedEmail,
            username,
            passwordHash,
            passwordSalt,
            reputation: 0,
            roleId: memberRole.id,
            createdAt: knex.fn.now(),
          })
          .returning("*");

        // 4. générer tokens
        const accessToken = jwt.sign(
          { userId: newUser.id, email: newUser.email, role: memberRole.name },
          security.jwtSecret,
          { expiresIn: security.accessExpiresIn || "15m" },
        );

        const refreshToken = jwt.sign(
          { userId: newUser.id, email: newUser.email, role: memberRole.name },
          security.refreshJwtSecret,
          { expiresIn: security.refreshExpiresIn || "7d" },
        );

        const refreshExpMs = getRefreshExpiryMs();
        const expDate = new Date(Date.now() + refreshExpMs).toISOString();
        const csrfToken = issueCsrfToken();

        await RefreshToken.query(trx).insert({
          id: crypto.randomUUID(),
          userId: newUser.id,
          token: refreshToken,
          expAt: expDate,
          revoked: false,
          createdAt: new Date().toISOString(),
        });

        // 6. cookie httpOnly pour le refreshToken
        setAuthCookies(res, refreshToken, refreshExpMs, csrfToken);

        const publicUser = {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
        };
        return res.status(201).json({
          message: "Utilisateur créé",
          user: publicUser,
          accessToken,
          csrfToken,
        });
      });
    } catch (error) {
      if (error.message === "USER_EXISTS") {
        return res.status(409).json({ message: "Utilisateur déjà existant" });
      }

      console.error("[SIGNUP] Erreur serveur :", error);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  },

  login: async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const trimmedIdentifier =
        typeof identifier === "string" ? identifier.trim() : "";

      if (!password || !trimmedIdentifier) {
        return res.status(400).json({
          error: "Identifiant (email ou username) et mot de passe requis",
        });
      }

      const isEmail = validator.isEmail(trimmedIdentifier);
      const email = isEmail
        ? validator.normalizeEmail(trimmedIdentifier)
        : undefined;
      const username = isEmail ? undefined : trimmedIdentifier;

      await knex.transaction(async (trx) => {
        // 1. récupérer l'utilisateur
        const user = await User.query(trx)
          .skipUndefined()
          .where("email", email)
          .orWhere("username", username)
          .first();

        if (!user) {
          throw new Error("BAD_CREDENTIALS");
        }

        // 2. vérifier mot de passe
        const [hashedPassword] = hashPassword(password, user.passwordSalt);
        if (hashedPassword !== user.passwordHash) {
          throw new Error("BAD_CREDENTIALS");
        }

        // 3. vérifier s'il existe déjà un refreshToken actif pour ce user / device
        // Ici on va simplifier (pas de notion d'userAgent/ip unique). On peut réutiliser un token valide si pas révoqué et pas expiré.
        let activeSession = await RefreshToken.query(trx)
          .where({ userId: user.id, revoked: false })
          .andWhere("expAt", ">", knex.raw("NOW()"))
          .first();

        const refreshExpMs = getRefreshExpiryMs();
        const expDate = new Date(Date.now() + refreshExpMs).toISOString();
        const refreshToken = jwt.sign(
          { userId: user.id, email: user.email },
          security.refreshJwtSecret,
          { expiresIn: security.refreshExpiresIn || "7d" },
        );
        const csrfToken = issueCsrfToken();
        if (activeSession) {
          await RefreshToken.query(trx)
            .patch({
              token: refreshToken,
              expAt: expDate,
              revoked: false,
            })
            .where({ id: activeSession.id });
        } else {
          // sinon créer une nouvelle session refresh
          await RefreshToken.query(trx).insert({
            id: crypto.randomUUID(),
            userId: user.id,
            token: refreshToken,
            expAt: expDate,
            revoked: false,
            createdAt: new Date().toISOString(),
          });
        }

        // 4. accessToken court
        const accessToken = jwt.sign(
          { userId: user.id, email: user.email },
          security.jwtSecret,
          { expiresIn: security.accessExpiresIn || "15m" },
        );

        // 5. renvoyer refreshToken en cookie httpOnly sécurisé
        setAuthCookies(res, refreshToken, refreshExpMs, csrfToken);

        const publicUser = {
          id: user.id,
          username: user.username,
          email: user.email,
        };

        return res.json({
          accessToken,
          user: publicUser,
          csrfToken,
        });
      });
    } catch (error) {
      if (error.message === "BAD_CREDENTIALS") {
        return res.status(400).json({
          message: "Identifiant ou mot de passe incorrect.",
        });
      }

      console.error("[LOGIN] Erreur serveur :", error);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  },

  handleRefreshToken: async (req, res) => {
    const tokenFromCookie = req.cookies?.refreshToken;
    if (!tokenFromCookie) {
      return res.status(401).json({ error: "Refresh token manquant" });
    }
    if (!requireCsrfToken(req, res)) {
      return;
    }

    try {
      // 1. vérifier JWT refresh
      const decoded = jwt.verify(tokenFromCookie, security.refreshJwtSecret);

      // 2. vérifier en base que ce refreshToken est encore valide, pas révoqué
      const stored = await RefreshToken.query()
        .where({ token: tokenFromCookie, revoked: false })
        .andWhere("expAt", ">", knex.raw("NOW()"))
        .first();

      if (!stored) {
        // invalide: on flush le cookie
        clearAuthCookies(res);
        return res.status(403).json({ error: "Session invalide ou expirée" });
      }

      const user = await User.query()
        .findById(decoded.userId)
        .select("id", "username", "email");

      if (!user) {
        clearAuthCookies(res);
        return res.status(403).json({ error: "Utilisateur introuvable" });
      }

      // 3. générer un nouvel accessToken
      const accessToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        security.jwtSecret,
        { expiresIn: security.accessExpiresIn || "15m" },
      );

      // 4. rotation du refresh token
      const refreshExpMs = getRefreshExpiryMs();
      const expDate = new Date(Date.now() + refreshExpMs).toISOString();

      const newRefreshToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        security.refreshJwtSecret,
        { expiresIn: security.refreshExpiresIn || "7d" },
      );

      await RefreshToken.query()
        .patch({
          token: newRefreshToken,
          expAt: expDate,
          revoked: false,
        })
        .where({ id: stored.id });

      const csrfToken = issueCsrfToken();
      setAuthCookies(res, newRefreshToken, refreshExpMs, csrfToken);

      return res.json({ accessToken, user, csrfToken });
    } catch (err) {
      // token cassé / expiré / forgé
      clearAuthCookies(res);
      return res
        .status(403)
        .json({ error: "Refresh token invalide – reconnectez-vous" });
    }
  },

  logout: async (req, res) => {
    const tokenFromCookie = req.cookies?.refreshToken;
    if (!tokenFromCookie) {
      return res.status(400).json({ error: "Refresh token manquant" });
    }
    if (!requireCsrfToken(req, res)) {
      return;
    }

    try {
      // supprime la session (soft delete = revoke)
      await RefreshToken.query()
        .where({ token: tokenFromCookie })
        .patch({ revoked: true });

      // effacer le cookie client
      clearAuthCookies(res);

      return res.status(200).json({ message: "Déconnexion réussie" });
    } catch (err) {
      console.error("[LOGOUT] Erreur serveur :", err);
      return res
        .status(500)
        .json({ error: "Erreur serveur lors de la déconnexion" });
    }
  },

  getMe: async (req, res) => {
    // requireAuth doit déjà avoir décodé l'accessToken et mis req.user.userId
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    try {
      const user = await User.query()
        .findById(req.user.userId)
        .select(
          "users.id",
          "users.email",
          "users.username",
          "users.createdAt",
          "users.reputation",
          "users.isBanned",
          "users.roleId",
          "roles.name as roleName",
        )
        .leftJoin("roles", "users.roleId", "roles.id");

      if (!user) {
        return res.status(404).json({ error: "Utilisateur introuvable" });
      }

      const payload = {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        reputation: user.reputation,
        isBanned: user.isBanned,
        roleId: user.roleId,
        role: user.roleName ? { id: user.roleId, name: user.roleName } : null,
      };

      res.json(payload);
    } catch (error) {
      console.error("[GET_ME] Erreur serveur :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
  changePassword: async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!req.user?.userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ error: "Le nouveau mot de passe doit etre different" });
    }
    if (!ensurePasswordStrength(newPassword, res)) {
      return;
    }

    try {
      await knex.transaction(async (trx) => {
        const user = await User.query(trx).findById(req.user.userId);

        if (!user) {
          return res.status(404).json({ error: "Utilisateur non trouve" });
        }

        const [hashedCurrent] = hashPassword(
          currentPassword,
          user.passwordSalt,
        );
        if (hashedCurrent !== user.passwordHash) {
          return res
            .status(401)
            .json({ error: "Mot de passe actuel incorrect" });
        }

        const [newHash, newSalt] = hashPassword(newPassword);

        await User.query(trx).findById(user.id).patch({
          passwordHash: newHash,
          passwordSalt: newSalt,
        });

        await RefreshToken.query(trx)
          .where({ userId: user.id })
          .patch({ revoked: true });

        clearAuthCookies(res);
        res.status(200).json({ message: "Mot de passe mis a jour" });
      });
    } catch (error) {
      console.error("[CHANGE_PASSWORD] Erreur serveur :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
};
