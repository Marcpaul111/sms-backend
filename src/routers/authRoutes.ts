import { Router } from 'express';
import * as authController from '../controllers/authController.ts';
import { verifyTokenMiddleware } from '../middleware/auth.ts';  // ← Fix this path

const router = Router();

// Public routes
router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmailHandler);
router.post('/login', authController.login);
router.post('/forgot-password', authController.requestPasswordResetHandler);
router.post('/verify-otp', authController.verifyOTPHandler);
router.post('/reset-password', authController.resetPasswordHandler);
router.post('/refresh', authController.refreshAccessToken);

// Protected routes
router.post('/logout', verifyTokenMiddleware, authController.logout);
router.get('/me', verifyTokenMiddleware, authController.getCurrentUser);

export default router;