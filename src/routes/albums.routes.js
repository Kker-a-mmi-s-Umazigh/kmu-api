import { Router } from "express";
import { AlbumController } from "../controllers/AlbumController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", AlbumController.getAll);
router.get("/:id", AlbumController.getById);
router.post("/", requireAuth, AlbumController.create);
router.put("/:id", requireAuth, AlbumController.update);
router.delete("/:id", requireAuth, AlbumController.remove);

router.get("/:id/tracks", AlbumController.getWithTracks);

export default router;
