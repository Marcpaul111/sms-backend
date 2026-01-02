import { createGCPSignedUploadUrl } from '../config/gcpStorage';

export const createSignedUploadUrl = async (bucket: string, path: string) => {
  const signedUrl = await createGCPSignedUploadUrl(bucket, path);
  return { signedUrl };
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
