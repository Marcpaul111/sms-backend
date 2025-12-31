import { Router } from 'express';
import * as authController from '../controllers/authController';
import { verifyTokenMiddleware } from '../middleware/auth';  // ← Fix this path
import { authorize } from '../middleware/rbac';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmailHandler);
router.post('/login', authController.login);
router.post('/forgot-password', authController.requestPasswordResetHandler);
router.post('/verify-otp', authController.verifyOTPHandler);
router.post('/reset-password', authController.resetPasswordHandler);
router.post('/refresh', authController.refreshAccessToken);
router.post('/complete-setup', authController.completeSetupHandler);

// Protected routes
router.post('/logout', verifyTokenMiddleware, authController.logout);
router.get('/me', verifyTokenMiddleware, authController.getCurrentUser);
router.get('/teachers/pending', verifyTokenMiddleware, authorize('admin'), authController.getPendingTeachersHandler);
router.post('/teachers/:userId/approve', verifyTokenMiddleware, authorize('admin'), authController.approveTeacherHandler);
router.post('/invite-student', verifyTokenMiddleware, authorize('teacher'), authController.inviteStudentHandler);
router.post('/assignments', verifyTokenMiddleware, authorize('admin'), authController.assignTeacherHandler);
router.get('/assignments/me', verifyTokenMiddleware, authorize('teacher'), authController.myAssignmentsHandler);
router.post('/assignments/create', verifyTokenMiddleware, authorize('teacher'), authController.createAssignmentHandler);
router.post('/storage/signed-upload', verifyTokenMiddleware, authorize('teacher', 'student'), authController.createSignedUploadUrlHandler);

export default router;
