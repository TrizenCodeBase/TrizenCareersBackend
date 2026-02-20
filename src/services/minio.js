/**
 * MinIO / S3-compatible storage for resume uploads.
 *
 * IMPORTANT: MinIO has two ports — API (9000) for S3 operations, Console (9001) for web UI.
 * "S3 API Requests must be made to API port" means you are hitting the Console. Set
 * MINIO_ENDPOINT to the API URL (e.g. https://host:9000) or use MINIO_API_PORT=9000 with
 * your host URL so the client uses port 9000.
 *
 * Environment variables:
 *   MINIO_ENDPOINT   - Full URL to MinIO API (e.g. https://host:9000). Must be the API, not the Console.
 *   MINIO_API_PORT   - Optional. If set (e.g. 9000), use this port when MINIO_ENDPOINT has no port.
 *   MINIO_ACCESS_KEY or MINIO_ROOT_USER
 *   MINIO_SECRET_KEY or MINIO_ROOT_PASSWORD
 *   MINIO_BUCKET     - Bucket name (default: careers-resumes)
 *   MINIO_PUBLIC_URL - Optional base URL for resume links (else presigned or endpoint URL)
 *   MINIO_REGION     - Optional (default: us-east-1)
 */

import { createRequire } from 'module';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const AWS = require('aws-sdk');

const DEFAULT_BUCKET = 'careers-resumes';
const DEFAULT_REGION = 'us-east-1';
const PRESIGNED_EXPIRY_SECONDS = 31536000; // 1 year

let s3Client = null;

/**
 * Build S3 endpoint string from MINIO_ENDPOINT.
 * MINIO_API_PORT: when set, use it when the URL has no port (so we hit MinIO API on 9000, not Console on 443).
 */
function buildEndpoint(rawEndpoint, rawPort, apiPort, useSSL) {
  let protocol = useSSL ? 'https' : 'http';
  let host = 'localhost';
  let port = rawPort || '9000';

  if (rawEndpoint && typeof rawEndpoint === 'string') {
    const raw = rawEndpoint.trim();
    try {
      if (raw.includes('://')) {
        const url = new URL(raw);
        host = url.hostname || host;
        protocol = url.protocol.replace(':', '') || protocol;
        if (url.port) {
          port = url.port;
        } else if (apiPort !== undefined && apiPort !== null && apiPort !== '') {
          port = String(apiPort).trim();
        } else {
          port = '';
        }
      } else {
        host = raw;
        port = rawPort || (apiPort !== undefined && apiPort !== null && apiPort !== '' ? String(apiPort).trim() : '9000');
      }
    } catch (e) {
      logger.warn('Could not parse MINIO_ENDPOINT, using defaults', { rawEndpoint: raw, error: e.message });
    }
  }

  return `${protocol}://${host}${port ? `:${port}` : ''}`;
}

function getS3Client() {
  if (s3Client) return s3Client;

  const rawEndpoint = (process.env.MINIO_ENDPOINT || '').trim();
  const rawPort = process.env.MINIO_PORT || '';
  const apiPort = process.env.MINIO_API_PORT || '';
  const useSSL = (process.env.MINIO_USE_SSL || '').toLowerCase() === 'true';

  const endpoint = buildEndpoint(rawEndpoint, rawPort, apiPort, useSSL);
  const accessKeyId = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '';
  const secretAccessKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '';
  const region = process.env.MINIO_REGION || process.env.MINIO_REGION_NAME || DEFAULT_REGION;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  s3Client = new AWS.S3({
    endpoint,
    accessKeyId,
    secretAccessKey,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region,
  });

  return s3Client;
}

export function isMinioConfigured() {
  const endpoint = (process.env.MINIO_ENDPOINT || '').trim();
  const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER;
  const secretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;
  return !!(endpoint && accessKey && secretKey);
}

/**
 * Create bucket if it doesn't exist. Avoids headBucket which can return 400 behind some proxies.
 */
async function createBucketIfNeeded(bucket) {
  const s3 = getS3Client();
  if (!s3) throw new Error('MinIO is not configured.');

  try {
    await s3.createBucket({ Bucket: bucket }).promise();
    logger.info('MinIO bucket created', { bucket });
  } catch (createErr) {
    if (
      createErr.code === 'BucketAlreadyOwnedByYou' ||
      createErr.code === 'BucketAlreadyExists' ||
      (createErr.message && createErr.message.includes('already own'))
    ) {
      return;
    }
    logger.warn('MinIO createBucket failed (bucket may already exist)', { bucket, code: createErr.code });
    throw createErr;
  }
}

/**
 * Get URL for an object: MINIO_PUBLIC_URL, or presigned URL, or endpoint-style URL.
 */
function getObjectUrl(bucket, key) {
  const publicBase = (process.env.MINIO_PUBLIC_URL || '').replace(/\/$/, '');
  if (publicBase) {
    return `${publicBase}/${key}`;
  }

  const s3 = getS3Client();
  if (!s3) return '';

  try {
    return s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: PRESIGNED_EXPIRY_SECONDS,
    });
  } catch (err) {
    logger.warn('Could not generate presigned URL', { error: err.message });
    const rawEndpoint = (process.env.MINIO_ENDPOINT || '').trim();
    const rawPort = process.env.MINIO_PORT || '';
    const apiPort = process.env.MINIO_API_PORT || '';
    const useSSL = (process.env.MINIO_USE_SSL || '').toLowerCase() === 'true';
    const endpoint = buildEndpoint(rawEndpoint, rawPort, apiPort, useSSL);
    return `${endpoint}/${bucket}/${key}`;
  }
}

/**
 * Upload resume buffer to MinIO (S3-compatible) and return the URL and key.
 */
export async function uploadResume(buffer, objectName, contentType) {
  if (!buffer || typeof buffer.length !== 'number') {
    throw new Error('Invalid file buffer: buffer is required for upload.');
  }

  // MinIO requires lowercase bucket names
  const bucket = (process.env.MINIO_BUCKET || DEFAULT_BUCKET).toLowerCase();
  const s3 = getS3Client();

  if (!s3) {
    throw new Error('MinIO is not configured. Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY.');
  }

  const params = {
    Bucket: bucket,
    Key: objectName,
    Body: buffer,
    ContentType: contentType,
  };

  try {
    await s3.putObject(params).promise();
  } catch (putErr) {
    const code = putErr.code || putErr.statusCode;
    const msg = putErr.message || '';

    if (code === 'NotFound' || code === 404 || (msg && (msg.includes('NoSuchBucket') || msg.includes('no such bucket')))) {
      try {
        await createBucketIfNeeded(bucket);
        await s3.putObject(params).promise();
      } catch (retryErr) {
        logger.error('MinIO putObject failed after createBucket', {
          code: retryErr.code,
          message: retryErr.message,
          bucket,
          key: objectName,
        });
        throw retryErr;
      }
    } else if (code === 'XMLParserError') {
      // MinIO sometimes returns XML the AWS SDK v2 parser rejects. Upload may have succeeded.
      try {
        await s3.headObject({ Bucket: bucket, Key: objectName }).promise();
        logger.info('Resume uploaded to MinIO (verified after XML parse error)', { bucket, objectName });
        const url = getObjectUrl(bucket, objectName);
        return { url, key: objectName };
      } catch (headErr) {
        logger.error('MinIO putObject returned unparseable response; object not found on verify', {
          bucket,
          key: objectName,
          putErr: msg,
        });
        throw new Error('Upload may have failed due to storage response format. Please try again.');
      }
    } else {
      logger.error('MinIO putObject failed', {
        code,
        message: msg,
        bucket,
        key: objectName,
      });
      throw putErr;
    }
  }

  logger.info('Resume uploaded to MinIO', { bucket, objectName });

  const url = getObjectUrl(bucket, objectName);

  return { url, key: objectName };
}

export default {
  getS3Client: getS3Client,
  isMinioConfigured,
  uploadResume,
};
