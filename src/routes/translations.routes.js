import { Router } from "express";
import { TranslationController } from "../controllers/TranslationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", TranslationController.getAll);
router.get("/:id", TranslationController.getById);
router.post("/", requireAuth, TranslationController.create);
router.put("/:id", requireAuth, TranslationController.update);
router.delete("/:id", requireAuth, TranslationController.remove);

router.get("/:id/full", TranslationController.getFullTranslation);

export default router;
