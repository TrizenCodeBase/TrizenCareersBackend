/**
 * MinIO service for resume file storage.
 *
 * Environment variables:
 *   MINIO_ENDPOINT   - MinIO server hostname or URL (e.g. minio.example.com or https://minio.example.com; protocol is stripped)
 *   MINIO_PORT       - Port (default: 9000)
 *   MINIO_USE_SSL    - 'true' or 'false' (default: false)
 *   MINIO_ACCESS_KEY - Access key
 *   MINIO_SECRET_KEY - Secret key
 *   MINIO_BUCKET     - Bucket name for resumes (e.g. careers-resumes)
 *   MINIO_PUBLIC_URL - Optional. Base URL for public object access (e.g. https://minio.example.com/careers-resumes).
 *                      If not set, URL is built from endpoint/port/bucket.
 *                      For resume links to open in browser, ensure the bucket allows GetObject (e.g. bucket policy or public read).
 */

import * as Minio from 'minio';
import { logger } from '../utils/logger.js';

let client = null;

function normalizeEndpoint(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  const match = s.match(/^(?:https?:\/\/)?([^/:#]+)(?::(\d+))?/);
  const host = match ? match[1] : s.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  return host;
}

function getClient() {
  if (client) return client;
  const rawEndpoint = process.env.MINIO_ENDPOINT;
  const endPoint = normalizeEndpoint(rawEndpoint);
  const port = parseInt(process.env.MINIO_PORT || '9000', 10);
  const useSSL = process.env.MINIO_USE_SSL === 'true' || (rawEndpoint && rawEndpoint.trim().toLowerCase().startsWith('https://'));
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (!endPoint || !accessKey || !secretKey) {
    return null;
  }

  client = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey
  });
  return client;
}

export function isMinioConfigured() {
  return !!(process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY);
}

const DEFAULT_BUCKET = 'careers-resumes';

async function ensureBucket(minioClient, bucket) {
  try {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      logger.info('MinIO bucket created', { bucket });
    }
  } catch (err) {
    logger.warn('MinIO bucket check/create failed (may need manual creation):', err.message);
  }
}

/**
 * Upload resume buffer to MinIO and return the public URL.
 * @param {Buffer} buffer - File buffer
 * @param {string} objectName - Object key (e.g. resumes/123-filename.pdf)
 * @param {string} contentType - MIME type
 * @returns {Promise<{ url: string, key: string }>}
 */
export async function uploadResume(buffer, objectName, contentType) {
  if (!buffer || typeof buffer.length !== 'number') {
    throw new Error('Invalid file buffer: buffer is required for MinIO upload.');
  }

  const bucket = process.env.MINIO_BUCKET || DEFAULT_BUCKET;
  const minioClient = getClient();

  if (!minioClient) {
    throw new Error('MinIO is not configured. Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY.');
  }

  await ensureBucket(minioClient, bucket);

  const metaData = {
    'Content-Type': contentType
  };

  await minioClient.putObject(bucket, objectName, buffer, buffer.length, metaData);
  logger.info('Resume uploaded to MinIO', { bucket, objectName });

  const publicBase = process.env.MINIO_PUBLIC_URL;
  let url;
  if (publicBase) {
    url = publicBase.replace(/\/$/, '') + '/' + objectName;
  } else {
    const host = normalizeEndpoint(process.env.MINIO_ENDPOINT);
    const port = process.env.MINIO_PORT || '9000';
    const rawEndpoint = (process.env.MINIO_ENDPOINT || '').trim();
    const useSSL = process.env.MINIO_USE_SSL === 'true' || rawEndpoint.toLowerCase().startsWith('https://');
    const protocol = useSSL ? 'https' : 'http';
    const portPart = (useSSL && port === '443') || (!useSSL && port === '80') ? '' : `:${port}`;
    url = `${protocol}://${host}${portPart}/${bucket}/${objectName}`;
  }

  return { url, key: objectName };
}

export default {
  getClient,
  isMinioConfigured,
  uploadResume
};
