import { supabase } from '../config/supabase';
import { createS3PresignedPutUrl } from '../config/s3';

export const createSignedUploadUrl = async (bucket: string, path: string) => {
  if (supabase) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
  const signedUrl = await createS3PresignedPutUrl(bucket, path);
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
