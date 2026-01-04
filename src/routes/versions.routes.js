import { Router } from "express";
import { AppVersionController } from "../controllers/AppVersionController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.get("/", AppVersionController.getAll);
router.get("/latest", AppVersionController.getLatest);
router.get("/:id", AppVersionController.getById);
router.post("/", requireAuth, requireAdmin, AppVersionController.create);
router.put("/:id", requireAuth, requireAdmin, AppVersionController.update);
router.delete("/:id", requireAuth, requireAdmin, AppVersionController.remove);

export default router;
