import { Router } from 'express';
import multer from 'multer';
import * as usersController from '../controllers/usersController';
import { verifyTokenMiddleware } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  },
});

// User profile routes
router.get('/me', verifyTokenMiddleware, usersController.getMyProfileHandler);
router.put('/me', verifyTokenMiddleware, usersController.updateProfileHandler);
router.post('/me/password', verifyTokenMiddleware, usersController.changePasswordHandler);
router.post('/me/picture', verifyTokenMiddleware, upload.single('file'), usersController.uploadProfilePictureHandler);

export default router;
