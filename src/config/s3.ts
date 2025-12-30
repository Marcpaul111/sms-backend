import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.SUPABASE_URL_STORAGE_ENDPOINT;
const accessKeyId = process.env.SUPABASE_URL_KEY_ID;
const secretAccessKey = process.env.SUPABASE_ACCESS_KEY;

export const s3Client = endpoint && accessKeyId && secretAccessKey
  ? new S3Client({
      region: 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey }
    })
  : null;

export const createS3PresignedPutUrl = async (bucket: string, key: string) => {
  if (!s3Client) {
    throw new Error('S3 client not configured');
  }
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 60 * 10 });
  return url;
};

