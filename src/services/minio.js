/**
 * MinIO / S3-compatible storage for resume uploads.
 *
 * Resume links are returned as presigned URLs so the Careers Admin Frontend can use them directly.
 * Set MINIO_PUBLIC_ENDPOINT to the MinIO API URL reachable from the browser (e.g. https://minio.example.com:9000).
 *
 * Environment variables:
 *   MINIO_ENDPOINT           - S3/MinIO API URL for backend operations (e.g. http://srv-captain--trizencareer:9000).
 *   MINIO_PUBLIC_ENDPOINT    - Same but reachable from browser; used for presigned URLs (e.g. https://trizencareer.llp.trizenventures.com:9000).
 *   MINIO_API_PORT           - Optional. Used when MINIO_ENDPOINT has no port (default 9000).
 *   MINIO_ACCESS_KEY or MINIO_ROOT_USER
 *   MINIO_SECRET_KEY or MINIO_ROOT_PASSWORD
 *   MINIO_BUCKET             - Bucket name (default: careers-resumes)
 *   MINIO_BUCKET_PUBLIC      - If "true", return raw public URL (bucket must be public in MinIO). Else return presigned URL.
 *   MINIO_REGION             - Optional (default: us-east-1)
 */

import { createRequire } from 'module';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const AWS = require('aws-sdk');

const DEFAULT_BUCKET = 'careers-resumes';
const DEFAULT_REGION = 'us-east-1';
const PRESIGNED_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days (SigV4 max)

let s3Client = null;
let presignClient = null;

/**
 * Build S3 endpoint string from MINIO_ENDPOINT.
 * When the URL has no port, default to 9000 (MinIO API). 443 is usually the Console and returns "S3 API Requests must be made to API port."
 * Set MINIO_API_PORT to override (e.g. 9000). Set MINIO_ENDPOINT to include port (e.g. https://host:9000) to skip default.
 */
/**
 * Parse MINIO_ENDPOINT into { protocol, host, port } components.
 * Returns an object so callers can create an AWS.Endpoint with correct values.
 */
function normalizePort(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  // Common misconfiguration: using 900 instead of MinIO API 9000.
  if (trimmed === '900') {
    logger.warn('MINIO_API_PORT is set to 900, auto-correcting to 9000.');
    return '9000';
  }

  if (!/^\d+$/.test(trimmed)) return '';
  const asNumber = Number(trimmed);
  if (asNumber < 1 || asNumber > 65535) return '';
  return String(asNumber);
}

function parseEndpoint(rawEndpoint, rawPort, apiPort, useSSL) {
  let protocol = useSSL ? 'https' : 'http';
  let host = 'localhost';
  let port = normalizePort(rawPort) || normalizePort(apiPort) || '9000';

  if (rawEndpoint && typeof rawEndpoint === 'string') {
    const raw = rawEndpoint.trim();
    try {
      if (raw.includes('://')) {
        const url = new URL(raw);
        host = url.hostname || host;
        protocol = url.protocol.replace(':', '') || protocol;
        // url.port is '' when the URL uses the default port for that protocol
        if (url.port) {
          port = url.port;
        } else if (apiPort) {
          port = String(apiPort).trim();
        } else {
          port = '9000';
        }
      } else {
        // Handles "host" and "host:port" formats.
        const hostPortMatch = raw.match(/^([^/:]+)(?::(\d+))?$/);
        if (hostPortMatch) {
          host = hostPortMatch[1] || host;
          port = normalizePort(hostPortMatch[2]) || normalizePort(rawPort) || normalizePort(apiPort) || '9000';
        } else {
          host = raw;
          port = normalizePort(rawPort) || normalizePort(apiPort) || '9000';
        }
      }
    } catch (e) {
      logger.warn('Could not parse MINIO_ENDPOINT, using defaults', { rawEndpoint: raw, error: e.message });
    }
  }

  return { protocol, host, port };
}

function getS3Client() {
  if (s3Client) return s3Client;

  const rawEndpoint = (process.env.MINIO_ENDPOINT || '').trim();
  const rawPort = process.env.MINIO_PORT || '';
  const apiPort = process.env.MINIO_API_PORT || '';
  const useSSL = (process.env.MINIO_USE_SSL || '').toLowerCase() === 'true';

  const { protocol, host, port } = parseEndpoint(rawEndpoint, rawPort, apiPort, useSSL);
  // Build canonical endpoint string and wrap in AWS.Endpoint so SDK correctly
  // extracts host + port even for non-standard Docker service hostnames.
  const endpointStr = `${protocol}://${host}:${port}`;
  const awsEndpoint = new AWS.Endpoint(endpointStr);

  const accessKeyId = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '';
  const secretAccessKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '';
  const region = process.env.MINIO_REGION || process.env.MINIO_REGION_NAME || DEFAULT_REGION;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  logger.info('MinIO/S3 storage configured', {
    endpoint: endpointStr,
    host: awsEndpoint.host,
    port: awsEndpoint.port,
    bucket: (process.env.MINIO_BUCKET || DEFAULT_BUCKET).toLowerCase(),
  });

  s3Client = new AWS.S3({
    endpoint: awsEndpoint,
    accessKeyId,
    secretAccessKey,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region,
    sslEnabled: protocol === 'https',
  });

  return s3Client;
}

/**
 * S3 client used only for generating presigned URLs. Uses MINIO_PUBLIC_ENDPOINT when set
 * so presigned URLs point to a host reachable from the browser.
 */
function getPresignClient() {
  const publicEndpointRaw = (process.env.MINIO_PUBLIC_ENDPOINT || '').trim().replace(/\/$/, '');
  if (publicEndpointRaw) {
    if (!presignClient) {
      const accessKeyId = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '';
      const secretAccessKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '';
      const region = process.env.MINIO_REGION || process.env.MINIO_REGION_NAME || DEFAULT_REGION;
      if (accessKeyId && secretAccessKey) {
        // Wrap public endpoint in AWS.Endpoint for correct port resolution
        const awsPublicEndpoint = new AWS.Endpoint(publicEndpointRaw);
        const sslEnabled = publicEndpointRaw.startsWith('https');
        presignClient = new AWS.S3({
          endpoint: awsPublicEndpoint,
          accessKeyId,
          secretAccessKey,
          s3ForcePathStyle: true,
          signatureVersion: 'v4',
          region,
          sslEnabled,
        });
      }
    }
    return presignClient || getS3Client();
  }
  return getS3Client();
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
    
    // Fallback to public endpoint if internal DNS fails
    if (createErr.code === 'UnknownEndpoint' || createErr.code === 'NetworkingError' || createErr.code === 'ENOTFOUND') {
      const fallbackS3 = getPresignClient();
      if (fallbackS3 && fallbackS3 !== s3) {
        try {
          await fallbackS3.createBucket({ Bucket: bucket }).promise();
          logger.info('MinIO bucket created via fallback public endpoint', { bucket });
          return;
        } catch (fallbackErr) {
          if (
            fallbackErr.code === 'BucketAlreadyOwnedByYou' ||
            fallbackErr.code === 'BucketAlreadyExists' ||
            (fallbackErr.message && fallbackErr.message.includes('already own'))
          ) {
            return;
          }
          logger.warn('MinIO createBucket fallback failed', { bucket, code: fallbackErr.code });
        }
      }
    }

    logger.warn('MinIO createBucket failed (bucket may already exist)', { bucket, code: createErr.code });
    throw createErr;
  }
}

/**
 * Return URL for the object. If MINIO_BUCKET_PUBLIC=true, return raw public URL (bucket must be public in MinIO).
 * Otherwise return presigned URL so it works for private buckets.
 */
function getObjectUrl(bucket, key) {
  const publicEndpoint = (process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || '').trim().replace(/\/$/, '');
  const bucketPublic = (process.env.MINIO_BUCKET_PUBLIC || '').toLowerCase() === 'true';

  if (bucketPublic && publicEndpoint) {
    return `${publicEndpoint}/${bucket}/${key}`;
  }

  const s3 = getPresignClient();
  if (!s3) return publicEndpoint ? `${publicEndpoint}/${bucket}/${key}` : '';
  try {
    return s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: PRESIGNED_EXPIRY_SECONDS,
    });
  } catch (err) {
    logger.warn('Could not generate presigned URL', { error: err.message });
    const fallback = getS3Client();
    if (fallback) {
      try {
        return fallback.getSignedUrl('getObject', {
          Bucket: bucket,
          Key: key,
          Expires: PRESIGNED_EXPIRY_SECONDS,
        });
      } catch (e) {
        logger.warn('Presign fallback failed', { error: e.message });
      }
    }
    return publicEndpoint ? `${publicEndpoint}/${bucket}/${key}` : '';
  }
}

/**
 * Get presigned URL for a resume key. Exported for use when resolving resumeLink in API responses.
 */
export function getResumeObjectUrl(bucket, key) {
  return getObjectUrl(bucket, key);
}

/**
 * Extract object key from a stored resume URL (proxy, internal, or presigned).
 */
export function extractKeyFromResumeLink(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const keyParam = u.searchParams.get('key');
    if (keyParam) return decodeURIComponent(keyParam);
    const path = u.pathname || '';
    const match = path.match(/\/resumes\/(.+)$/);
    if (match) return `resumes/${match[1]}`;
  } catch (_) {
    const i = url.indexOf('/resumes/');
    if (i !== -1) return url.substring(i + 1);
  }
  return null;
}

/**
 * Stream a resume from MinIO for the backend proxy route. Returns { stream, contentType, contentLength } or null.
 */
export async function getResumeStream(bucket, key) {
  let s3 = getS3Client();
  if (!s3) return null;
  try {
    const head = await s3.headObject({ Bucket: bucket, Key: key }).promise();
    const contentType = head.ContentType || 'application/octet-stream';
    const contentLength = head.ContentLength;
    const stream = s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
    return { stream, contentType, contentLength };
  } catch (err) {
    if (err.code === 'UnknownEndpoint' || err.code === 'NetworkingError' || err.code === 'ENOTFOUND') {
      const fallbackS3 = getPresignClient();
      if (fallbackS3 && fallbackS3 !== s3) {
        try {
          const head = await fallbackS3.headObject({ Bucket: bucket, Key: key }).promise();
          const contentType = head.ContentType || 'application/octet-stream';
          const contentLength = head.ContentLength;
          const stream = fallbackS3.getObject({ Bucket: bucket, Key: key }).createReadStream();
          return { stream, contentType, contentLength };
        } catch (fallbackErr) {
          logger.warn('MinIO getResumeStream fallback failed', { bucket, key, error: fallbackErr.message });
          return null;
        }
      }
    }
    logger.warn('MinIO getResumeStream failed', { bucket, key, error: err.message });
    return null;
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

    const bucketMissing =
      code === 'NoSuchBucket' ||
      code === 'NotFound' ||
      code === 404 ||
      (msg && (msg.includes('NoSuchBucket') || msg.includes('no such bucket') || msg.includes('does not exist')));
    if (bucketMissing) {
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
    } else if (code === 'XMLParserError' || (msg && (msg.includes('XMLParserError') || msg.includes('Unquoted attribute value')))) {
      // MinIO sometimes returns XML the AWS SDK v2 parser rejects. Upload may have succeeded.
      try {
        await s3.headObject({ Bucket: bucket, Key: objectName }).promise();
        logger.info('Resume uploaded to MinIO (verified after XML parse error)', { bucket, objectName });
        const url = getObjectUrl(bucket, objectName);
        return { url, key: objectName };
      } catch (headErr) {
        const headCode = headErr.code || headErr.statusCode;
        const headMsg = headErr.message || '';
        const headAlsoXmlError = headCode === 'XMLParserError' || (headMsg && (headMsg.includes('XMLParserError') || headMsg.includes('Unquoted attribute value')));
        if (headAlsoXmlError) {
          // Verification also got bad XML; assume upload succeeded (MinIO often saves but returns malformed XML)
          logger.warn('MinIO returned unparseable XML for putObject and headObject; assuming upload succeeded', { bucket, key: objectName });
          const url = getObjectUrl(bucket, objectName);
          return { url, key: objectName };
        }
        logger.error('MinIO putObject returned unparseable response; object not found on verify', {
          bucket,
          key: objectName,
          putErr: msg,
        });
        throw new Error('Upload may have failed due to storage response format. Please try again.');
      }
    } else if (code === 'UnknownEndpoint' || code === 'NetworkingError' || code === 'ENOTFOUND' || (msg && msg.includes('Inaccessible host'))) {
      logger.warn('MinIO internal endpoint unreachable. Retrying with public endpoint.', { bucket, key: objectName });
      const fallbackS3 = getPresignClient();
      if (fallbackS3 && fallbackS3 !== s3) {
        try {
          await fallbackS3.putObject(params).promise();
          logger.info('Resume uploaded to MinIO via fallback public endpoint', { bucket, objectName });
          const url = getObjectUrl(bucket, objectName);
          return { url, key: objectName };
        } catch (fallbackErr) {
          const fallbackCode = fallbackErr.code || fallbackErr.statusCode;
          const fallbackMsg = fallbackErr.message || '';

          if (
            fallbackCode === 'XMLParserError' ||
            (fallbackMsg && (fallbackMsg.includes('XMLParserError') || fallbackMsg.includes('Unquoted attribute value')))
          ) {
            // Same parser issue on fallback endpoint: verify object existence before failing.
            try {
              await fallbackS3.headObject({ Bucket: bucket, Key: objectName }).promise();
              logger.info('Resume uploaded to MinIO via fallback endpoint (verified after XML parse error)', { bucket, objectName });
              const url = getObjectUrl(bucket, objectName);
              return { url, key: objectName };
            } catch (_) {
              // Let normal error logging/throw happen below.
            }
          }

          logger.error('MinIO fallback upload failed', {
            code: fallbackCode,
            message: fallbackMsg,
            bucket,
            key: objectName,
          });
          throw fallbackErr;
        }
      } else {
        logger.error('MinIO putObject failed (no fallback available)', {
          code,
          message: msg,
          bucket,
          key: objectName,
        });
        throw putErr;
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
  getResumeObjectUrl,
  extractKeyFromResumeLink,
};
