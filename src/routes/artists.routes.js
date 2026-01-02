import { Router } from "express"
import { ArtistController } from "../controllers/ArtistController.js"
import { requireAuth } from "../middleware/requireAuth.js"

const router = Router()

router.get("/", ArtistController.getAll)
router.get("/:id", ArtistController.getById)
router.post("/", requireAuth, ArtistController.create)
router.put("/:id", requireAuth, ArtistController.update)
router.delete("/:id", requireAuth, ArtistController.remove)

router.get("/:id/albums", ArtistController.getAlbums)
router.get("/:id/full", ArtistController.getFullArtist)

export default router
