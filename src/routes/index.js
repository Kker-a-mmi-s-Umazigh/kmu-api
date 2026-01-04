import { Router } from "express";

import usersRoutes from "./users.routes.js";
import songsRoutes from "./songs.routes.js";
import artistsRoutes from "./artists.routes.js";
import albumsRoutes from "./albums.routes.js";
import translationsRoutes from "./translations.routes.js";
import annotationsRoutes from "./annotations.routes.js";
import glossaryRoutes from "./glossary.routes.js";
import authRoutes from "./auth.routes.js";
import moderationRoutes from "./moderation.routes.js";
import annotationCommentsRoutes from "./annotationComments.routes.js";
import reportsRoutes from "./reports.routes.js";
import versionsRoutes from "./versions.routes.js";

const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({ status: "ok", service: "kmu-api", scope: "api" });
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/users", usersRoutes);
router.use("/auth", authRoutes);
router.use("/songs", songsRoutes);
router.use("/artists", artistsRoutes);
router.use("/albums", albumsRoutes);
router.use("/translations", translationsRoutes);
router.use("/annotations", annotationsRoutes);
router.use("/annotation-comments", annotationCommentsRoutes);
router.use("/glossary", glossaryRoutes);
router.use("/reports", reportsRoutes);
router.use("/moderation", moderationRoutes);
router.use("/versions", versionsRoutes);

export default router;
