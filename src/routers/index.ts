import { Router } from 'express';
import authRoutes from './authRoutes.ts';
import classesRoutes from './classesRoutes.ts';
import studentsRoutes from './studentsRoutes.ts';
import teachersRoutes from './teachersRoutes.ts';

const router = Router();

// Auth routes
router.use('/api/auth', authRoutes);

// Classes routes
router.use('/api/classes', classesRoutes);

// Students routes
router.use('/api/students', studentsRoutes);

// Teachers routes
router.use('/api/teachers', teachersRoutes);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy'
  });
});

export default router;