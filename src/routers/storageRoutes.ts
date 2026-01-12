import { Router } from 'express';
import multer from 'multer';
import { createSignedUploadUrl, createAssignmentAttachmentUrl, createSubmissionUrl, recordAssignmentAttachment, recordSubmissionAttachment, getAssignmentAttachmentUrl, deleteAssignmentAttachment, uploadModuleFile, recordModuleAttachment, deleteModuleAttachment, getModuleAttachmentUrl } from '../services/storage';
import { uploadFileToGCP } from '../config/gcpStorage';
import { verifyTokenMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit for module/video uploads
  },
});

// Upload file directly to GCP (before auth middleware since we need file parsing first)
router.post('/upload', upload.single('file'), verifyTokenMiddleware, async (req, res) => {
  try {
    const { subjectId, classId, sectionId, assignmentId, moduleId, context } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!subjectId || !classId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: subjectId, classId' });
    }

    let path: string;
    
    // Determine the target ID and context
    const targetId = moduleId || assignmentId;
    
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Missing module ID or assignment ID' });
    }

    // Generate path based on context
    if (context === 'module' && moduleId) {
      // Module files go to modules/{moduleId}/
      path = `modules/${moduleId}/${Date.now()}-${req.file.originalname}`;
    } else if (context === 'submission' && assignmentId) {
      // Submission files go to submissions/{studentId}/{assignmentId}/
      const studentId = req.user?.id;
      if (!studentId) {
        return res.status(401).json({ success: false, message: 'Student authentication required' });
      }
      path = `submissions/${studentId}/${assignmentId}/${Date.now()}-${req.file.originalname}`;
    } else if (context === 'assignment' && assignmentId) {
      // Assignment files go to assignments/{assignmentId}/
      path = `assignments/${assignmentId}/${Date.now()}-${req.file.originalname}`;
    } else {
      // Default to module path if moduleId is provided
      if (moduleId) {
        path = `modules/${moduleId}/${Date.now()}-${req.file.originalname}`;
      } else {
        return res.status(400).json({ success: false, message: 'Unable to determine upload path' });
      }
    }

    await uploadFileToGCP('teachers-sms', path, req.file.buffer);

    res.json({ success: true, path });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, message: 'Failed to upload file' });
  }
});

// All other routes require authentication
router.use(verifyTokenMiddleware);

// Get signed upload URL (legacy)
router.post('/signed-url', async (req, res) => {
  const { bucket, path } = req.body;

  if (!bucket || !path) {
    return res.status(400).json({ success: false, message: 'Bucket and path are required' });
  }

  try {
    const { signedUrl, path: uploadPath } = await createSignedUploadUrl(bucket, path);
    res.json({ success: true, data: { signedUrl, path: uploadPath } });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    res.status(500).json({ success: false, message: 'Failed to create signed URL' });
  }
});

// Get signed URL for assignment attachment (teachers only)
router.post('/assignment-attachment', authorize('teacher'), async (req, res) => {
  const { assignmentId, filename } = req.body;

  if (!assignmentId || !filename) {
    return res.status(400).json({ success: false, message: 'Assignment ID and filename are required' });
  }

  try {
    const { signedUrl, path } = await createAssignmentAttachmentUrl(assignmentId, filename);
    res.json({ success: true, data: { signedUrl, path } });
  } catch (error) {
    console.error('Error creating assignment attachment URL:', error);
    res.status(500).json({ success: false, message: 'Failed to create upload URL' });
  }
});

// Record uploaded assignment attachment
router.post('/assignment-attachment/:assignmentId/record', authorize('teacher'), async (req, res) => {
  const { assignmentId } = req.params;
  const { path } = req.body;

  if (!path) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    await recordAssignmentAttachment(assignmentId, path);
    res.json({ success: true, message: 'Attachment recorded successfully' });
  } catch (error) {
    console.error('Error recording attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to record attachment' });
  }
});

// Delete uploaded assignment attachment
router.post('/assignment-attachment/:assignmentId/delete', authorize('teacher'), async (req, res) => {
  const { assignmentId } = req.params;
  const { path } = req.body;

  if (!path) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    await deleteAssignmentAttachment(assignmentId, path);
    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment' });
  }
});

// Get signed URL for assignment attachment download
router.post('/assignment-attachment/download', async (req, res) => {
  const { assignmentId, filename } = req.body;

  if (!assignmentId || !filename) {
    return res.status(400).json({ success: false, message: 'Assignment ID and filename are required' });
  }

  try {
    const { signedUrl, path } = await getAssignmentAttachmentUrl(assignmentId, filename);
    res.json({ success: true, data: { signedUrl, path } });
  } catch (error) {
    console.error('Error creating download URL:', error);
    res.status(500).json({ success: false, message: 'Failed to create download URL' });
  }
});

// Get signed URL for student submission
router.post('/submission', authorize('student'), async (req, res) => {
  const { assignmentId, filename } = req.body;
  const studentId = req.user?.id;

  if (!assignmentId || !filename) {
    return res.status(400).json({ success: false, message: 'Assignment ID and filename are required' });
  }

  if (!studentId) {
    return res.status(401).json({ success: false, message: 'Student authentication required' });
  }

  try {
    const { signedUrl, path } = await createSubmissionUrl(assignmentId, studentId, filename);
    res.json({ success: true, data: { signedUrl, path } });
  } catch (error) {
    console.error('Error creating submission URL:', error);
    res.status(500).json({ success: false, message: 'Failed to create upload URL' });
  }
});

// Record uploaded submission attachment
router.post('/submission/:assignmentId/record', authorize('student'), async (req, res) => {
  const { assignmentId } = req.params;
  const { path } = req.body;
  const studentId = req.user?.id;

  if (!path) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  if (!studentId) {
    return res.status(401).json({ success: false, message: 'Student authentication required' });
  }

  try {
    await recordSubmissionAttachment(studentId, assignmentId, path);
    res.json({ success: true, message: 'Submission recorded successfully' });
  } catch (error) {
    console.error('Error recording submission:', error);
    res.status(500).json({ success: false, message: 'Failed to record submission' });
  }
});

// Get signed URL for module attachment download
router.post('/module-attachment/download', verifyTokenMiddleware, async (req, res) => {
  const { moduleId, filename } = req.body;

  if (!moduleId || !filename) {
    return res.status(400).json({ success: false, message: 'Module ID and filename are required' });
  }

  try {
    const { signedUrl, path } = await getModuleAttachmentUrl(moduleId, filename);
    res.json({ success: true, data: { signedUrl, path } });
  } catch (error) {
    console.error('Error creating module attachment URL:', error);
    res.status(500).json({ success: false, message: 'Failed to create download URL' });
  }
});

// Record uploaded module attachment
router.post('/module-attachment/:moduleId/record', verifyTokenMiddleware, async (req, res) => {
  const { moduleId } = req.params;
  const { path } = req.body;

  if (!path) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    await recordModuleAttachment(moduleId, path);
    res.json({ success: true, message: 'Attachment recorded successfully' });
  } catch (error) {
    console.error('Error recording module attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to record attachment' });
  }
});

// Delete uploaded module attachment
router.post('/module-attachment/:moduleId/delete', verifyTokenMiddleware, async (req, res) => {
  const { moduleId } = req.params;
  const { path } = req.body;

  if (!path) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  try {
    await deleteModuleAttachment(moduleId, path);
    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting module attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment' });
  }
});

export default router;