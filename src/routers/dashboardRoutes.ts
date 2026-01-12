import { Router } from 'express';
import { getDashboardMetrics, getTeacherClasses, getTeacherSections, getTeacherAssignments, getStudentClasses, getStudentAssignments, getStudentResults, getStudentModules } from '../controllers/dashboardController';
import { verifyTokenMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all dashboard routes
router.use(verifyTokenMiddleware);

// Get dashboard metrics
router.get('/metrics', getDashboardMetrics);

// Teacher-specific routes
router.get('/teacher/classes', getTeacherClasses);
router.get('/teacher/sections/:classId', getTeacherSections);
router.get('/teacher/assignments', getTeacherAssignments);

// Student-specific routes
router.get('/student/classes', getStudentClasses);
router.get('/student/assignments', getStudentAssignments);
router.get('/student/results', getStudentResults);
router.get('/student/modules', getStudentModules);

export default router;