import { Router } from "express";
import { ReportController } from "../controllers/ReportController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireModerator } from "../middleware/requireModerator.js";

const router = Router();

router.get("/", requireAuth, requireModerator, ReportController.getAll);
router.get("/:id", requireAuth, requireModerator, ReportController.getById);
router.post("/", requireAuth, ReportController.create);

export default router;
