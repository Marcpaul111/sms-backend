import { createGCPSignedUrl, deleteGCPFile, uploadFileToGCP, deleteGCPFolder, deleteEmptyParentFolders } from '../config/gcpStorage';

export const createSignedUploadUrl = async (bucket: string, path: string) => {
  const signedUrl = await createGCPSignedUrl(bucket, path, 'write');
  return { signedUrl, path };
};

export const createSignedDownloadUrl = async (bucket: string, path: string) => {
  const signedUrl = await createGCPSignedUrl(bucket, path, 'read');
  return { signedUrl, path };
};

export const deleteAssignmentAttachment = async (assignmentId: string, attachmentPath: string) => {
  const db = (await import('../config/db')).default;
  
  // Delete from storage
  try {
    await deleteGCPFile('teachers-sms', attachmentPath);
    // Clean up empty parent folders
    await deleteEmptyParentFolders('teachers-sms', attachmentPath, 5);
  } catch (error) {
    console.error('Error deleting file from storage:', error);
  }
  
  // Remove from database
  await db.query(
    `UPDATE assignments
     SET attachments = attachments - $2
     WHERE id = $1`,
    [assignmentId, attachmentPath]
  );
};

export const recordAssignmentAttachment = async (
  assignmentId: string,
  attachmentPath: string
) => {
  const db = (await import('../config/db')).default;
  await db.query(
    `UPDATE assignments
     SET attachments = COALESCE(attachments, '[]'::jsonb) || to_jsonb($2::text)
     WHERE id = $1`,
    [assignmentId, attachmentPath]
  );
};

// Generate signed URL for assignment attachment upload
export const createAssignmentAttachmentUrl = async (assignmentId: string, filename: string) => {
  const path = `assignments/${assignmentId}/${Date.now()}-${filename}`;
  return createSignedUploadUrl('teachers-sms', path);
};

// Generate signed URL for student submission upload - simplified path
export const createSubmissionUrl = async (assignmentId: string, studentId: string, filename: string) => {
  const path = `submissions/${studentId}/${assignmentId}/${Date.now()}-${filename}`;
  return createSignedUploadUrl('teachers-sms', path);
};

export const getAssignmentAttachmentUrl = async (assignmentId: string, filename: string) => {
  const db = (await import('../config/db')).default;
  const result = await db.query(
    `SELECT attachments FROM assignments WHERE id = $1`,
    [assignmentId]
  );
  if (result.rows.length === 0) {
    throw new Error('Assignment not found');
  }
  const attachments = result.rows[0].attachments || [];
  const attachmentPath = attachments.find((path: string) => path.includes(filename));
  if (!attachmentPath) {
    throw new Error('Attachment not found');
  }
  return createSignedDownloadUrl('teachers-sms', attachmentPath);
};

// Record student submission attachment
export const recordSubmissionAttachment = async (
  studentId: string,
  assignmentId: string,
  attachmentPath: string
) => {
  const db = (await import('../config/db')).default;

  // First, try to update existing submission
  const updateResult = await db.query(
    `UPDATE submissions
     SET attachments = COALESCE(attachments, '[]'::jsonb) || to_jsonb($3::text)
     WHERE student_id = $1 AND assignment_id = $2
     RETURNING id`,
    [studentId, assignmentId, attachmentPath]
  );

  // If no existing submission, create one
  if (updateResult.rows.length === 0) {
    await db.query(
      `INSERT INTO submissions (student_id, assignment_id, attachments)
       VALUES ($1, $2, to_jsonb(ARRAY[$3::text]))`,
      [studentId, assignmentId, attachmentPath]
    );

    // Notify about new submission
    await db.query(`NOTIFY user_events, $1`, [
      JSON.stringify({
        type: 'submission_created',
        studentId,
        assignmentId,
        timestamp: new Date().toISOString()
      })
    ]);
  }
};

// Upload file directly to GCP (for module attachments) - simplified path
export const uploadModuleFile = async (
  file: Buffer,
  filename: string,
  subjectId: string,
  classId: string,
  sectionId: string,
  moduleId: string
) => {
  const path = `modules/${moduleId}/${Date.now()}-${filename}`;
  await uploadFileToGCP('teachers-sms', path, file);
  return path;
};

// Record module attachment
export const recordModuleAttachment = async (
  moduleId: string,
  attachmentPath: string
) => {
  const db = (await import('../config/db')).default;
  await db.query(
    `UPDATE modules
     SET files = COALESCE(files, '[]'::jsonb) || to_jsonb($2::text)
     WHERE id = $1`,
    [moduleId, attachmentPath]
  );
};

// Delete module attachment
export const deleteModuleAttachment = async (moduleId: string, attachmentPath: string) => {
  const db = (await import('../config/db')).default;
  
  // Delete from storage
  try {
    await deleteGCPFile('teachers-sms', attachmentPath);
    // Clean up empty parent folders
    await deleteEmptyParentFolders('teachers-sms', attachmentPath, 5);
  } catch (error) {
    console.error('Error deleting file from storage:', error);
  }
  
  // Remove from database
  await db.query(
    `UPDATE modules
     SET files = files - $2
     WHERE id = $1`,
    [moduleId, attachmentPath]
  );
};

// Get module attachment URL
export const getModuleAttachmentUrl = async (moduleId: string, filename: string) => {
  const db = (await import('../config/db')).default;
  const result = await db.query(
    `SELECT files FROM modules WHERE id = $1`,
    [moduleId]
  );
  if (result.rows.length === 0) {
    throw new Error('Module not found');
  }
  const files = result.rows[0].files || [];
  const filePath = files.find((path: string) => path.includes(filename));
  if (!filePath) {
    throw new Error('File not found');
  }
  return createSignedDownloadUrl('teachers-sms', filePath);
};

// Delete all module files from storage (including the module folder)
export const deleteAllModuleFiles = async (moduleId: string) => {
  const folderPath = `modules/${moduleId}`;
  
  try {
    // Delete the entire module folder
    await deleteGCPFolder('teachers-sms', folderPath);
    console.log(`Successfully deleted folder: ${folderPath}`);
  } catch (error) {
    console.error('Error deleting module folder from storage:', error);
    throw error; // Re-throw to let the caller know it failed
  }
};
