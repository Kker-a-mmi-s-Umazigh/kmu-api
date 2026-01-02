import { Router } from "express"
import { ModerationController } from "../controllers/ModerationController.js"
import { requireAuth } from "../middleware/requireAuth.js"
import { requireModerator } from "../middleware/requireModerator.js"

const router = Router()

router.use(requireAuth, requireModerator)

router.get("/requests", ModerationController.listRequests)
router.get("/requests/:id", ModerationController.getRequest)
router.post("/requests/:id/approve", ModerationController.approveRequest)
router.post("/requests/:id/reject", ModerationController.rejectRequest)

export default router
