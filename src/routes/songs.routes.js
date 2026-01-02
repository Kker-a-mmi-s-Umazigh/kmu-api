import { Router } from "express"
import { SongController } from "../controllers/SongController.js"
import { requireAuth } from "../middleware/requireAuth.js"

const router = Router()

router.get("/", SongController.getAll)
router.get("/latest", SongController.getLatestValidated)
router.get("/:id", SongController.getById)
router.post("/", requireAuth, SongController.create)
router.put("/:id", requireAuth, SongController.update)
router.delete("/:id", requireAuth, SongController.remove)

router.get("/:id/full", SongController.getFullSong)

export default router
