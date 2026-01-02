import { Router } from 'express'
import { UserController } from '../controllers/UserController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireModerator } from '../middleware/requireModerator.js'

const router = Router()

router.get('/', UserController.getAll)
router.get('/:id', UserController.getById)
router.post('/', requireAuth, requireModerator, UserController.create)
router.put('/:id', requireAuth, UserController.update)
router.delete('/:id', requireAuth, UserController.remove)

router.get('/:id/full', UserController.getFullProfile)

export default router
