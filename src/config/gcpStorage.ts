import { Storage } from '@google-cloud/storage';

const projectId = process.env.GCP_PROJECT_ID;
const keyFilename = process.env.GCP_KEY_FILE || '/app/service-account-key.json'; // For Cloud Run, mount the key

export const storage = projectId ? new Storage({
  projectId,
  keyFilename: keyFilename
}) : null;

export const createGCPSignedUploadUrl = async (bucketName: string, fileName: string) => {
  if (!storage) {
    throw new Error('GCP Storage not configured');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  const options = {
    version: 'v4' as const,
    action: 'write' as const,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    contentType: 'application/octet-stream', // Allow any type, validation done elsewhere
  };

  const [url] = await file.getSignedUrl(options);
  return url;
};