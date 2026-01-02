import { Router } from 'express';
import { createSignedUploadUrl } from '../services/storage';
import { verifyTokenMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(verifyTokenMiddleware);

// Get signed upload URL
router.post('/signed-url', async (req, res) => {
  const { bucket, path } = req.body;

  if (!bucket || !path) {
    return res.status(400).json({ success: false, message: 'Bucket and path are required' });
  }

  try {
    const { signedUrl } = await createSignedUploadUrl(bucket, path);
    res.json({ success: true, data: { signedUrl } });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    res.status(500).json({ success: false, message: 'Failed to create signed URL' });
  }
});

export default router;