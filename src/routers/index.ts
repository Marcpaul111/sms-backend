import { Router } from 'express';
import authRoutes from './authRoutes.ts';

const router = Router();

// Auth routes
router.use('/api/auth', authRoutes);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'Server is healthy' 
  });
});

export default router;