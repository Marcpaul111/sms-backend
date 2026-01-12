import { Storage } from '@google-cloud/storage';

const projectId = process.env.GCP_PROJECT_ID;
const keyFilename = process.env.GCP_KEY_FILE || '/app/service-account-key.json'; // For Cloud Run, mount the key

console.log('GCP_PROJECT_ID:', projectId);
console.log('GCP_KEY_FILE:', keyFilename);

export const storage = projectId ? new Storage({
  projectId,
  keyFilename: keyFilename
}) : null;

export const createGCPSignedUrl = async (bucketName: string, fileName: string, action: 'read' | 'write' = 'write') => {
  if (!storage) {
    throw new Error('GCP Storage not configured');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  const options = {
    version: 'v4' as const,
    action,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  const [url] = await file.getSignedUrl(options);
  return url;
};

export const deleteGCPFile = async (bucketName: string, fileName: string) => {
  if (!storage) {
    throw new Error('GCP Storage not configured');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.delete();
};

export const deleteGCPFolder = async (bucketName: string, folderPrefix: string) => {
  if (!storage) {
    throw new Error('GCP Storage not configured');
  }

  const bucket = storage.bucket(bucketName);
  const options = {
    prefix: folderPrefix,
  };

  // List all files in the folder
  const [files] = await bucket.getFiles(options);

  // Delete each file
  for (const file of files) {
    await file.delete().catch(err => {
      console.error('Error deleting file:', file.name, err.message);
    });
  }
};

export const uploadFileToGCP = async (bucketName: string, fileName: string, buffer: Buffer) => {
  if (!storage) {
    throw new Error('GCP Storage not configured');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(buffer, {
    contentType: 'application/octet-stream',
  });

  return fileName;
};

// Delete empty parent folders recursively (up to a limit)
export const deleteEmptyParentFolders = async (bucketName: string, filePath: string, maxLevels = 5) => {
  if (!storage) {
    throw new Error('GCP Storage not configured');
  }

  const bucket = storage.bucket(bucketName);
  const pathParts = filePath.split('/');
  
  // Start from the parent of the file and go up
  for (let i = pathParts.length - 1; i > 0 && i >= pathParts.length - maxLevels; i--) {
    const parentPath = pathParts.slice(0, i).join('/');
    
    // Check if folder is empty
    const [files] = await bucket.getFiles({ prefix: parentPath + '/' });
    
    if (files.length === 0) {
      // Folder is empty, delete it (GCP doesn't have real folders, so we just stop)
      console.log(`Folder ${parentPath} is empty, but GCP doesn't require explicit folder deletion`);
    } else {
      // Folder has files, stop cleaning up
      break;
    }
  }
};