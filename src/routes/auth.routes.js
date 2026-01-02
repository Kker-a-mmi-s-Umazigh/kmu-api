// src/routes/auth.routes.js
import { Router } from "express";
import { AuthController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authLimiter, refreshLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// inscription / connexion
router.post("/signup", authLimiter, AuthController.signup);
router.post("/login", authLimiter, AuthController.login);

// refresh accessToken par refreshToken httpOnly
router.post("/refresh", refreshLimiter, AuthController.handleRefreshToken);

// infos utilisateur courant (besoin accessToken valide)
router.get("/me", requireAuth, AuthController.getMe);

// changer le mot de passe (auth requis)
router.post("/change-password", requireAuth, AuthController.changePassword);

// logout = révoque le refreshToken courant
router.post("/logout", requireAuth, refreshLimiter, AuthController.logout);

export default router;
