import { Router } from "express";
import { GlossaryController } from "../controllers/GlossaryController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", GlossaryController.getAll);
router.get("/:id", GlossaryController.getById);
router.post("/", requireAuth, GlossaryController.create);
router.put("/:id", requireAuth, GlossaryController.update);
router.delete("/:id", requireAuth, GlossaryController.remove);

router.get("/:id/full", GlossaryController.getFullTerm);

export default router;
