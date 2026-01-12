import { Router } from 'express';
import authRoutes from './authRoutes.ts';
import usersRoutes from './usersRoutes.ts';
import classesRoutes from './classesRoutes.ts';
import subjectsRoutes from './subjectsRoutes.ts';
import studentsRoutes from './studentsRoutes.ts';
import teachersRoutes from './teachersRoutes.ts';
import modulesRoutes from './modulesRoutes.ts';
import storageRoutes from './storageRoutes.ts';
import dashboardRoutes from './dashboardRoutes.ts';

const router = Router();

// Auth routes
router.use('/api/auth', authRoutes);

// User routes (profile, password, picture)
router.use('/api/users', usersRoutes);

// Classes routes
router.use('/api/classes', classesRoutes);

// Subjects routes
router.use('/api/subjects', subjectsRoutes);

// Students routes
router.use('/api/students', studentsRoutes);

// Teachers routes
router.use('/api/teachers', teachersRoutes);

// Modules routes
router.use('/api/auth/modules', modulesRoutes);

// Storage routes
router.use('/api/storage', storageRoutes);

// Dashboard routes
router.use('/api/dashboard', dashboardRoutes);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy'
  });
});

export default router;