import { Router } from "express";
import { AnnotationCommentController } from "../controllers/AnnotationCommentController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", AnnotationCommentController.getAll);
router.get("/:id", AnnotationCommentController.getById);
router.post("/", requireAuth, AnnotationCommentController.create);
router.put("/:id", requireAuth, AnnotationCommentController.update);
router.delete("/:id", requireAuth, AnnotationCommentController.remove);

export default router;
