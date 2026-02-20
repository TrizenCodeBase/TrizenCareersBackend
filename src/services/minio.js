/**
 * MinIO service for resume file storage.
 *
 * Environment variables:
 *   MINIO_ENDPOINT   - Full URL or hostname (e.g. https://minio.example.com or https://minio.example.com:443).
 *                      Port and SSL are derived from the URL only (MINIO_PORT and MINIO_USE_SSL are ignored).
 *   MINIO_ACCESS_KEY - Access key
 *   MINIO_SECRET_KEY - Secret key
 *   MINIO_BUCKET     - Bucket name for resumes (e.g. careers-resumes)
 *   MINIO_PUBLIC_URL - Optional. Base URL for public object access.
 */

import * as Minio from 'minio';
import { logger } from '../utils/logger.js';

let client = null;

/**
 * Parse MINIO_ENDPOINT URL. Derive host, port and useSSL only from the URL (no env port/ssl).
 */
function parseEndpointUrl(raw) {
  if (!raw || typeof raw !== 'string') return { host: '', port: 9000, useSSL: false };
  const s = raw.trim();
  const lower = s.toLowerCase();
  const hasHttps = lower.startsWith('https://');
  const hasHttp = lower.startsWith('http://');
  const withoutProtocol = s.replace(/^https?:\/\//i, '').split('/')[0];
  const [host, portStr] = withoutProtocol.split(':');
  const port = portStr ? parseInt(portStr, 10) : (hasHttps ? 443 : hasHttp ? 80 : 9000);
  const useSSL = hasHttps;
  return { host: host || '', port: Number.isFinite(port) ? port : 9000, useSSL };
}

function getClient() {
  if (client) return client;
  const rawEndpoint = (process.env.MINIO_ENDPOINT || '').trim();
  const { host, port, useSSL } = parseEndpointUrl(rawEndpoint);
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (!host || !accessKey || !secretKey) {
    return null;
  }

  client = new Minio.Client({
    endPoint: host,
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
    const raw = (process.env.MINIO_ENDPOINT || '').trim();
    const { host: h, port: p, useSSL: ssl } = parseEndpointUrl(raw);
    const protocol = ssl ? 'https' : 'http';
    const portPart = (ssl && p === 443) || (!ssl && p === 80) ? '' : `:${p}`;
    url = `${protocol}://${h}${portPart}/${bucket}/${objectName}`;
  }

  return { url, key: objectName };
}

export default {
  getClient,
  isMinioConfigured,
  uploadResume
};
