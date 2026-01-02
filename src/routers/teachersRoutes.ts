import { Router } from 'express';
import * as teachersController from '../controllers/teachersController';
import { verifyTokenMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(verifyTokenMiddleware);

// Get teachers - only admins can see all teachers
router.get('/', authorize('admin'), teachersController.getTeachers);

export default router;