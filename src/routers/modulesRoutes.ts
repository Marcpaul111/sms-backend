import { Router } from 'express';
import * as modulesController from '../controllers/modulesController';
import { verifyTokenMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(verifyTokenMiddleware);

// Get teacher's modules
router.get('/me', modulesController.getTeacherModules);

// Create a new module
router.post('/create', modulesController.createModule);

// Delete a module
router.delete('/:id', modulesController.deleteModule);

export default router;
