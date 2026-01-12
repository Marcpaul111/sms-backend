import { Router } from 'express';
import multer from 'multer';
import * as authController from '../controllers/authController';
import { verifyTokenMiddleware } from '../middleware/auth';  // ← Fix this path
import { authorize } from '../middleware/rbac';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit for module/video uploads
  },
});

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
router.get('/teachers', verifyTokenMiddleware, authorize('admin'), authController.getAllTeachersHandler);
router.post('/teachers/:userId/approve', verifyTokenMiddleware, authorize('admin'), authController.approveTeacherHandler);
router.post('/teachers/:userId/reject', verifyTokenMiddleware, authorize('admin'), authController.rejectTeacherHandler);
router.post('/teachers/:userId/toggle-status', verifyTokenMiddleware, authorize('admin'), authController.toggleTeacherStatusHandler);
router.post('/invite-student', verifyTokenMiddleware, authorize('teacher'), authController.inviteStudentHandler);
router.post('/invite-teacher', verifyTokenMiddleware, authorize('admin'), authController.inviteTeacherHandler);
router.get('/teacher-assignments', verifyTokenMiddleware, authorize('admin'), authController.getAllAssignmentsHandler);
router.post('/teacher-assignments', verifyTokenMiddleware, authorize('admin'), authController.assignTeacherHandler);
router.put('/teacher-assignments/:id', verifyTokenMiddleware, authorize('admin'), authController.updateAssignmentHandler);
router.put('/teacher-assignments/:id/schedule', verifyTokenMiddleware, authorize('admin'), authController.updateAssignmentScheduleHandler);
router.delete('/teacher-assignments/:id', verifyTokenMiddleware, authorize('admin'), authController.deleteAssignmentHandler);
router.get('/assignments/me', verifyTokenMiddleware, authorize('teacher'), authController.myAssignmentsHandler);
router.post('/assignments/create', verifyTokenMiddleware, authorize('teacher'), authController.createAssignmentHandler);
router.put('/assignments/:id', verifyTokenMiddleware, authorize('admin', 'teacher'), authController.updateIndividualAssignmentHandler);
router.delete('/assignments/:id', verifyTokenMiddleware, authorize('admin', 'teacher'), authController.deleteIndividualAssignmentHandler);
router.post('/storage/upload', verifyTokenMiddleware, authorize('teacher', 'student'), upload.single('file'), authController.uploadFileHandler);
router.post('/storage/signed-upload', verifyTokenMiddleware, authorize('teacher', 'student'), authController.createSignedUploadUrlHandler);

// Student routes
router.get('/my-classes', verifyTokenMiddleware, authorize('student'), authController.myClassesHandler);
router.get('/my-assignments', verifyTokenMiddleware, authorize('student'), authController.myStudentAssignmentsHandler);
router.get('/my-results', verifyTokenMiddleware, authorize('student'), authController.myResultsHandler);

export default router;
