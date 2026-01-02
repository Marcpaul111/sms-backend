import { Router } from 'express';
import * as studentsController from '../controllers/studentsController';
import { verifyTokenMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(verifyTokenMiddleware);

// Get students - teachers see their assigned students, admins see all
router.get('/', authorize('admin', 'teacher'), studentsController.getStudents);

export default router;