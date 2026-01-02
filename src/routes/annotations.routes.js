import { Router } from "express";
import { AnnotationController } from "../controllers/AnnotationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", AnnotationController.getAll);
router.get("/:id", AnnotationController.getById);
router.post("/", requireAuth, AnnotationController.create);
router.put("/:id", requireAuth, AnnotationController.update);
router.delete("/:id", requireAuth, AnnotationController.remove);

router.get("/:id/full", AnnotationController.getFullAnnotation);

export default router;
