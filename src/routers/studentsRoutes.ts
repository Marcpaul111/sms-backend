import { Router } from 'express';
import * as studentsController from '../controllers/studentsController';
import { verifyTokenMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(verifyTokenMiddleware);

// Get students - teachers see their assigned students, admins see all
router.get('/', authorize('admin', 'teacher'), studentsController.getStudents);

// Update student status - only admins
router.put('/:id/status', authorize('admin'), studentsController.updateStudentStatus);

// Update student info - teachers can update their students, admins can update all
router.put('/:id', authorize('admin', 'teacher'), studentsController.updateStudent);

// Delete/deactivate student - only admins
router.delete('/:id', authorize('admin'), studentsController.deleteStudent);

export default router;