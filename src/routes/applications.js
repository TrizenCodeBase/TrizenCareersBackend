import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { getApplicationModel, isSupportedJobId, getAllApplicationModels } from '../models/ApplicationFactory.js';
import {
  ALL_SUPPORTED_JOB_IDS,
  LEGACY_SMM_JOB_IDS,
  CONTENT_SOCIAL_MEDIA_JOB_IDS,
  GROWTH_MARKETING_JOB_IDS,
  MERN_INTERN_JOB_IDS,
  MERN_FULLTIME_JOB_IDS,
  GENAI_JOB_IDS,
  isMarketingApplicationJob,
  isGenAiJob,
  isEngineeringFullTimeJob,
  isEngineeringInternJob,
  isMernFullTimeJob,
  requiresYearOfPassingOut,
  getJobTitle
} from '../config/jobRegistry.js';
import {
  APPLICATION_STATUSES,
  INTERVIEW_STATUSES,
  emptyStatusBreakdown,
  pipelineFieldsForStatus
} from '../config/applicationStatus.js';
import { protect } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { isMinioConfigured, uploadResume as uploadResumeToMinio, extractKeyFromResumeLink, getResumeStream } from '../services/minio.js';

const RESUME_BUCKET = (process.env.MINIO_BUCKET || 'careers-resumes').toLowerCase();

function buildResumeProxyUrl(key, req) {
  if (!key) return '';
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/v1/applications/resume?key=${encodeURIComponent(key)}`;
}

function rewriteResumeLinks(appOrList, req) {
  const rewrite = (doc) => {
    if (!doc || !doc.resumeLink) return doc;
    const key = extractKeyFromResumeLink(doc.resumeLink);
    if (key && isMinioConfigured() && req) {
      doc.resumeLink = buildResumeProxyUrl(key, req);
    }
    return doc;
  };
  return Array.isArray(appOrList) ? appOrList.map(rewrite) : rewrite(appOrList);
}

/** Attach all roles each candidate applied to (by email) for list/detail UX. */
async function enrichApplicationsWithAppliedRoles(applications) {
  if (!Array.isArray(applications) || applications.length === 0) return applications;

  const emails = [
    ...new Set(
      applications
        .map((app) => String(app.email || '').trim().toLowerCase())
        .filter(Boolean)
    )
  ];
  if (emails.length === 0) return applications;

  const allModels = getAllApplicationModels();
  const rolesByEmail = new Map();

  for (const { defaultJobId, model } of allModels) {
    const docs = await model
      .find({ email: { $in: emails } })
      .select('_id email jobId status createdAt')
      .lean()
      .exec();

    for (const doc of docs) {
      const email = String(doc.email || '').trim().toLowerCase();
      if (!email) continue;
      if (!rolesByEmail.has(email)) rolesByEmail.set(email, []);
      rolesByEmail.get(email).push({
        _id: String(doc._id),
        jobId: doc.jobId || defaultJobId,
        status: doc.status,
        createdAt: doc.createdAt
      });
    }
  }

  for (const [, roles] of rolesByEmail) {
    // Dedupe by application id, keep newest first
    const seen = new Set();
    const unique = [];
    roles
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((role) => {
        if (seen.has(role._id)) return;
        seen.add(role._id);
        unique.push(role);
      });
    roles.length = 0;
    roles.push(...unique);
  }

  return applications.map((app) => {
    const email = String(app.email || '').trim().toLowerCase();
    const appliedRoles = rolesByEmail.get(email) || [
      {
        _id: String(app._id),
        jobId: app.jobId,
        status: app.status,
        createdAt: app.createdAt
      }
    ];
    const otherRoles = appliedRoles.filter((role) => String(role._id) !== String(app._id));
    return {
      ...app,
      appliedRoles,
      roleCount: appliedRoles.length,
      otherRoles
    };
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists (used when MinIO is not configured)
const uploadsDir = path.join(__dirname, '../../uploads/resumes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads/resumes directory');
}

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const JOB_ID_PATTERN = /^TV-[A-Z]+-[A-Z]+-\d{4}-\d{3}$/;

const normalizeJobId = (rawJobId) => {
  if (!rawJobId || typeof rawJobId !== 'string') return rawJobId;
  const trimmed = rawJobId.trim();
  if (JOB_ID_PATTERN.test(trimmed)) return trimmed;
  const parts = trimmed.split('-');
  if (parts.length >= 5) {
    const candidate = parts.slice(0, 5).join('-');
    if (JOB_ID_PATTERN.test(candidate)) return candidate;
  }
  return trimmed;
};

/** Remove empty optional fields so Mongoose enum validators do not reject "". */
function sanitizeApplicationPayload(jobId, body) {
  const payload = { ...body };

  const stripIfEmpty = (field) => {
    const value = payload[field];
    if (typeof value === 'string' && value.trim() === '') {
      delete payload[field];
    }
  };

  if (isEngineeringFullTimeJob(jobId) && !isMernFullTimeJob(jobId)) {
    stripIfEmpty('yearOfPassingOut');
    stripIfEmpty('duration');
  } else if (isMernFullTimeJob(jobId)) {
    stripIfEmpty('duration');
  }

  return payload;
}

const missingStringFields = (body, fields) =>
  fields.filter((field) => !body[field] || (typeof body[field] === 'string' && body[field].trim() === ''));

const missingArrayFields = (body, fields) =>
  fields.filter((field) => !body[field] || !Array.isArray(body[field]) || body[field].length === 0);

const validateUrlFields = (res, body, fields) => {
  for (const field of fields) {
    const value = body[field];
    if (!value || typeof value !== 'string' || !value.trim()) continue;
    try {
      new URL(value);
    } catch {
      return res.status(400).json({
        success: false,
        error: `Invalid URL format for ${field}`
      });
    }
  }
  return null;
};

const validationFailed = (res, missingFields) =>
  res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: missingFields.map((field) => ({
      field,
      message: `${field} is required`
    }))
  });

function makeResumeObjectName(originalName) {
  const ext = path.extname(originalName) || '.pdf';
  const base = path.basename(originalName, ext).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  return `resumes/${Date.now()}-${base}${ext}`;
}

const resumeDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, path.basename(makeResumeObjectName(file.originalname)))
});

const resumeMemoryStorage = multer.memoryStorage();

const storage = isMinioConfigured() ? resumeMemoryStorage : resumeDiskStorage;

const uploadResume = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG, WEBP.'), false);
    }
    cb(null, true);
  }
});

// Base validation middleware
const validateApplication = [
  body('jobId').notEmpty().withMessage('Job ID is required'),
  body('fullName').notEmpty().withMessage('Full name is required').isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('linkedinProfile').notEmpty().withMessage('LinkedIn Profile URL is required').isURL().withMessage('Please enter a valid LinkedIn URL'),
  // Contract roles capture a monthly rate and an optional cover note instead of motivation/stipend.
  body('motivation').custom((value, { req }) => {
    if (isGenAiJob(normalizeJobId(req.body.jobId))) return true;
    if (!value || String(value).trim() === '') throw new Error('Motivation to join is required');
    return true;
  }),
  body('expectedStipend').custom((value, { req }) => {
    if (isGenAiJob(normalizeJobId(req.body.jobId))) return true;
    if (!value || String(value).trim() === '') throw new Error('Expected stipend amount is required');
    return true;
  })
];

// Conditional validation middleware
const validateApplicationConditional = (req, res, next) => {
  req.body.jobId = normalizeJobId(req.body.jobId);
  const { jobId } = req.body;

  if (LEGACY_SMM_JOB_IDS.includes(jobId)) {
    const missingFields = [
      ...missingStringFields(req.body, [
        'currentQualification', 'collegeUniversity', 'portfolioWorkSamples', 'resumeLink',
        'preferredStartDate', 'workPreference', 'internshipExperience', 'expectedStipend'
      ]),
      ...missingArrayFields(req.body, ['socialMediaPlatforms', 'contentCreationSkills'])
    ];

    if (missingFields.length > 0) {
      return validationFailed(res, missingFields);
    }

    if (!['Hybrid', 'Remote', 'Office'].includes(req.body.workPreference)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid work preference. Must be Hybrid, Remote, or Office'
      });
    }

    const urlError = validateUrlFields(res, req.body, ['portfolioWorkSamples', 'resumeLink']);
    if (urlError) return urlError;
    return next();
  }

  if (CONTENT_SOCIAL_MEDIA_JOB_IDS.includes(jobId)) {
    const isIntern = jobId === 'TV-MKT-CSMI-2026-006' || jobId === 'TV-MKT-SDMH-2026-011';
    const missingFields = [
      ...missingStringFields(req.body, [
        'socialMediaPageUrl', 'portfolioWorkSamples', 'resumeLink', 'contentCreated',
        'proudContentOrCampaign', 'preferredStartDate', 'workPreference', 'expectedStipend', 'motivation'
      ]),
      ...missingArrayFields(req.body, ['socialMediaPlatforms', 'contentCreationSkills'])
    ];

    if (!isIntern) {
      missingFields.push(...missingStringFields(req.body, ['managedPages']));
    } else {
      missingFields.push(...missingStringFields(req.body, ['currentQualification', 'collegeUniversity']));
    }

    if (missingFields.length > 0) {
      return validationFailed(res, missingFields);
    }

    if (!['Hybrid', 'Remote', 'Office'].includes(req.body.workPreference)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid work preference. Must be Hybrid, Remote, or Office'
      });
    }

    const urlError = validateUrlFields(res, req.body, [
      'socialMediaPageUrl', 'portfolioWorkSamples', 'resumeLink', 'contentSamplesLink'
    ]);
    if (urlError) return urlError;
    return next();
  }

  if (GROWTH_MARKETING_JOB_IDS.includes(jobId)) {
    const isIntern = jobId === 'TV-MKT-GMI-2026-005';
    const requiredFields = isIntern
      ? [
          'marketingToolsUsed', 'projectsOrActivities', 'growthMarketingInterest',
          'campaignOrEventOrganized', 'resumeLink', 'preferredStartDate', 'workPreference',
          'expectedStipend', 'motivation'
        ]
      : [
          'campaignsWorkedOn', 'marketingToolsUsed', 'resultsAchieved', 'resumeLink',
          'preferredStartDate', 'workPreference', 'expectedStipend', 'motivation'
        ];

    const missingFields = missingStringFields(req.body, requiredFields);
    if (missingFields.length > 0) {
      return validationFailed(res, missingFields);
    }

    if (!['Hybrid', 'Remote', 'Office'].includes(req.body.workPreference)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid work preference. Must be Hybrid, Remote, or Office'
      });
    }

    const urlError = validateUrlFields(res, req.body, [
      'resumeLink', 'portfolioUrl', 'portfolioWorkSamples'
    ]);
    if (urlError) return urlError;
    return next();
  }

  if (GENAI_JOB_IDS.includes(jobId)) {
    const missingFields = [
      ...missingStringFields(req.body, [
        'portfolioUrl', 'resumeLink', 'totalAiExperience', 'agenticExperience', 'currentTitle',
        'highestDegree', 'availabilityToStart', 'cloudPlatform', 'devopsProficiency',
        'systemExperience', 'timezone', 'contractCommitment', 'expectedMonthlyRate'
      ]),
      ...missingArrayFields(req.body, ['agentFrameworks', 'llmPlatforms'])
    ];

    if (missingFields.length > 0) {
      return validationFailed(res, missingFields);
    }

    if (!/^\d+$/.test(String(req.body.expectedMonthlyRate).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [{
          field: 'expectedMonthlyRate',
          message: 'Expected rate per month must be a number in rupees (digits only)'
        }]
      });
    }

    const urlError = validateUrlFields(res, req.body, ['portfolioUrl', 'resumeLink']);
    if (urlError) return urlError;
    return next();
  }

  if (!isMarketingApplicationJob(jobId)) {
    const engineeringFullTime = isEngineeringFullTimeJob(jobId);
    const engineeringIntern = isEngineeringInternJob(jobId);
    const mernFullTime = isMernFullTimeJob(jobId);
    const engineeringBaseFields = [
      'portfolioUrl', 'resumeLink', 'educationStatus', 'degreeDiscipline',
      'internshipExperience', 'aiMlProjects', 'preferredStartDate', 'expectedStipend'
    ];
    const requiredFields = engineeringFullTime && !mernFullTime
      ? engineeringBaseFields
      : engineeringIntern
        ? [...engineeringBaseFields.slice(0, 4), 'yearOfPassingOut', ...engineeringBaseFields.slice(4), 'duration']
        : mernFullTime
          ? [...engineeringBaseFields.slice(0, 4), 'yearOfPassingOut', ...engineeringBaseFields.slice(4)]
          : [
              'portfolioUrl', 'resumeLink', 'educationStatus', 'degreeDiscipline',
              'yearOfPassingOut', 'internshipExperience', 'duration', 'aiMlProjects',
              'preferredStartDate', 'expectedStipend'
            ];

    const missingFields = requiredFields.filter(field =>
      !req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: missingFields.map(field => ({
          field,
          message: `${field} is required`
        }))
      });
    }

    if (requiresYearOfPassingOut(jobId)) {
      if (!['2024', '2025', '2026'].includes((req.body.yearOfPassingOut || '').trim())) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: [{ field: 'yearOfPassingOut', message: 'Year of passing out must be 2024, 2025, or 2026' }]
        });
      }
    }

    // Validate URLs
    const urlFields = ['portfolioUrl', 'resumeLink'];
    for (const field of urlFields) {
      try {
        new URL(req.body[field]);
      } catch {
        return res.status(400).json({
          success: false,
          error: `Invalid URL format for ${field}`
        });
      }
    }
  }

  next();
};

// GET /api/v1/applications/supported-jobs - List job IDs accepted by the API
router.get('/supported-jobs', (req, res) => {
  res.json({
    success: true,
    message: 'Supported application job IDs',
    data: ALL_SUPPORTED_JOB_IDS.map((id) => ({
      id,
      title: getJobTitle(id)
    }))
  });
});

// POST /api/v1/applications/upload-resume - Upload resume file
router.post('/upload-resume', (req, res, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Resume file must be 5MB or smaller.' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Invalid file.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No resume file uploaded.' });
    }

    // MinIO path: use only when configured AND we have a buffer (memory storage)
    if (isMinioConfigured() && req.file.buffer && typeof req.file.buffer.length === 'number') {
      try {
        // Log current MinIO config for debugging
        logger.error('[DEBUG] MinIO config', {
          MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
          MINIO_PUBLIC_ENDPOINT: process.env.MINIO_PUBLIC_ENDPOINT,
          MINIO_API_PORT: process.env.MINIO_API_PORT,
          MINIO_USE_SSL: process.env.MINIO_USE_SSL,
          MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
          MINIO_BUCKET: process.env.MINIO_BUCKET,
        });
        const objectName = makeResumeObjectName(req.file.originalname);
        await uploadResumeToMinio(req.file.buffer, objectName, req.file.mimetype);
        const url = buildResumeProxyUrl(objectName, req);
        logger.info('Resume uploaded to MinIO:', { objectName, user: req.user?._id });
        return res.status(200).json({
          success: true,
          data: { url, filename: path.basename(objectName) }
        });
      } catch (minioErr) {
        // Fallback to local disk when MinIO is temporarily unreachable.
        const fallbackFilename = path.basename(makeResumeObjectName(req.file.originalname));
        const fallbackFilePath = path.join(uploadsDir, fallbackFilename);
        try {
          fs.writeFileSync(fallbackFilePath, req.file.buffer);
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const fallbackUrl = `${baseUrl}/uploads/resumes/${fallbackFilename}`;
          logger.warn('[WARN] MinIO unavailable, stored resume on local disk', {
            filename: fallbackFilename,
            user: req.user?._id,
            minioError: minioErr.message,
          });
          return res.status(200).json({
            success: true,
            data: { url: fallbackUrl, filename: fallbackFilename, storage: 'disk-fallback' }
          });
        } catch (diskFallbackErr) {
          logger.error('[ERROR] Disk fallback after MinIO failure also failed', {
            minioError: minioErr.message,
            diskError: diskFallbackErr.message,
          });
        }

        logger.error('[ERROR] MinIO upload failed', {
          error: minioErr.message,
          stack: minioErr.stack,
          MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
          MINIO_PUBLIC_ENDPOINT: process.env.MINIO_PUBLIC_ENDPOINT,
          MINIO_API_PORT: process.env.MINIO_API_PORT,
          MINIO_USE_SSL: process.env.MINIO_USE_SSL,
          MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
          MINIO_BUCKET: process.env.MINIO_BUCKET,
        });
        return res.status(500).json({ success: false, error: 'MinIO upload failed: ' + minioErr.message });
      }
    }

    // Disk path: req.file.filename is set by disk storage
    if (!req.file.filename) {
      logger.error('Resume upload: MinIO configured but file buffer missing. Restart server with MinIO env vars set so memory storage is used.');
      return res.status(500).json({
        success: false,
        error: 'Server upload configuration error. Please try again or contact support.'
      });
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/resumes/${req.file.filename}`;
    logger.info('Resume uploaded (disk):', { filename: req.file.filename, user: req.user?._id });
    res.status(200).json({
      success: true,
      data: { url: fileUrl, filename: req.file.filename }
    });
  } catch (error) {
    const code = error.code || error.statusCode;
    const message = error.message || 'Failed to process upload.';
    logger.error('Resume upload error:', { code, message, stack: error.stack });
    const bodyMsg = (error.body && (error.body.Message || error.body.message)) || (error.response && error.response.body && (error.response.body.Message || error.response.body.message));
    const clientMessage =
      code === 'BadRequest' || code === 400
        ? (bodyMsg || message || 'Storage rejected the upload. Check bucket name and permissions.')
        : message;
    res.status(500).json({ success: false, error: clientMessage });
  }
});

// GET /api/v1/applications/resume?key=... - Stream resume from MinIO (avoids redirect/CORS when opening presigned URL in browser)
router.get('/resume', async (req, res) => {
  const key = (req.query.key || '').trim();
  if (!key || !key.startsWith('resumes/')) {
    return res.status(400).json({ success: false, error: 'Invalid or missing key.' });
  }
  if (!isMinioConfigured()) {
    return res.status(503).json({ success: false, error: 'Resume storage not configured.' });
  }
  let result;
  try {
    result = await getResumeStream(RESUME_BUCKET, key);
  } catch (err) {
    logger.error('Resume proxy error', { key, error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load resume.' });
  }
  if (!result) {
    return res.status(404).json({ success: false, error: 'Resume not found.' });
  }
  const filename = path.basename(key);
  const disposition = String(req.query.disposition || '').toLowerCase() === 'inline'
    ? 'inline'
    : 'attachment';
  res.set('Content-Type', result.contentType);
  res.set('Content-Disposition', `${disposition}; filename="${filename.replace(/"/g, '\\"')}"`);
  res.set('X-Content-Type-Options', 'nosniff');
  if (result.contentLength != null && result.contentLength > 0) {
    res.set('Content-Length', String(result.contentLength));
  }
  const stream = result.stream;
  res.on('close', () => {
    if (stream && !stream.destroyed) stream.destroy();
  });
  stream.on('error', (err) => {
    logger.warn('Resume stream error', { key, error: err.message });
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to stream resume.' });
    else if (!res.writableEnded) res.end();
  });
  stream.pipe(res);
});

// POST /api/v1/applications - Submit a new application
router.post('/', validateApplication, validateApplicationConditional, async (req, res) => {
  try {
    // Debug logging
    logger.info('Application submission request received:', {
      body: req.body,
      user: req.user?._id || null
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    req.body.jobId = normalizeJobId(req.body.jobId);
    const { jobId } = req.body;

    // Check if jobId is supported
    if (!isSupportedJobId(jobId)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported job ID: ${jobId}`
      });
    }

    // Get the appropriate model for this job
    const ApplicationModel = getApplicationModel(jobId);

    // Check if user has already applied for this specific job
    // Duplicate prevention for authenticated users only.
    if (req.user?._id) {
      const existingApplication = await ApplicationModel.findOne({
        appliedBy: req.user._id,
        jobId
      });

      if (existingApplication) {
        return res.status(400).json({
          success: false,
          error: 'You have already applied for this position'
        });
      }
    }

    // Create new application
    logger.info('Creating application with data:', {
      jobId: req.body.jobId,
      fullName: req.body.fullName,
      email: req.body.email,
      appliedBy: req.user?._id || null
    });

    const payload = sanitizeApplicationPayload(jobId, {
      ...req.body,
      jobId
    });

    if (req.user?._id) {
      payload.appliedBy = req.user._id;
    }

    const application = await ApplicationModel.create(payload);

    logger.info('Application created successfully:', application._id);

    // Populate user details
    await application.populate('appliedBy', 'username email firstName lastName role');

    logger.info(`New application submitted: ${application.fullName} for job ${req.body.jobId}`);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        id: application._id,
        status: application.status,
        appliedAt: application.createdAt
      }
    });
  } catch (error) {
    logger.error('Error submitting application:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      body: req.body
    });
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/v1/applications/lookup-emails - Validate which emails exist (admin bulk check)
router.post('/lookup-emails', async (req, res) => {
  try {
    const rawEmails = Array.isArray(req.body?.emails)
      ? req.body.emails
      : String(req.body?.emails || '')
          .split(/[,;\n\r\t ]+/)
          .map((e) => e.trim());

    const requested = [
      ...new Set(
        rawEmails
          .map((e) => String(e || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )
    ];

    if (requested.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least one email to look up'
      });
    }

    if (requested.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 500 emails per lookup'
      });
    }

    const { status, jobId } = req.body || {};
    const query = {
      email: { $in: requested }
    };

    if (status) query.status = status;

    let applications = [];

    if (jobId) {
      if (!isSupportedJobId(jobId)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported job ID: ${jobId}`
        });
      }
      const ApplicationModel = getApplicationModel(jobId);
      applications = await ApplicationModel.find({ ...query, jobId })
        .populate('appliedBy', 'username email firstName lastName role')
        .sort({ createdAt: -1 })
        .lean()
        .exec();
    } else {
      const allModels = getAllApplicationModels();
      for (const { defaultJobId, model } of allModels) {
        const docs = await model.find(query)
          .populate('appliedBy', 'username email firstName lastName role')
          .sort({ createdAt: -1 })
          .lean()
          .exec();
        applications = applications.concat(
          docs.map((app) => ({ ...app, jobId: app.jobId || defaultJobId }))
        );
      }
      applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const foundSet = new Set(
      applications.map((app) => String(app.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const found = requested.filter((email) => foundSet.has(email));
    const missing = requested.filter((email) => !foundSet.has(email));
    const requestedSet = new Set(requested);

    // Emails present in DB for the same filters, but not in the pasted list
    const scopeQuery = {};
    if (status) scopeQuery.status = status;

    const scopedEmails = new Set();
    if (jobId) {
      const ApplicationModel = getApplicationModel(jobId);
      const docs = await ApplicationModel.find({ ...scopeQuery, jobId })
        .select('email')
        .lean()
        .exec();
      docs.forEach((doc) => {
        const email = String(doc.email || '').trim().toLowerCase();
        if (email) scopedEmails.add(email);
      });
    } else {
      const allModels = getAllApplicationModels();
      for (const { model } of allModels) {
        const docs = await model.find(scopeQuery).select('email').lean().exec();
        docs.forEach((doc) => {
          const email = String(doc.email || '').trim().toLowerCase();
          if (email) scopedEmails.add(email);
        });
      }
    }

    const notInList = [...scopedEmails]
      .filter((email) => !requestedSet.has(email))
      .sort();

    const enriched = await enrichApplicationsWithAppliedRoles(rewriteResumeLinks(applications, req));

    res.json({
      success: true,
      data: enriched,
      lookup: {
        requested,
        found,
        missing,
        notInList,
        foundCount: found.length,
        missingCount: missing.length,
        notInListCount: notInList.length,
        applicationCount: applications.length
      }
    });
  } catch (error) {
    logger.error('Error looking up emails:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// GET /api/v1/applications - Get all applications (public - no auth required)
router.get('/', async (req, res) => {
  try {

    const { 
      status, 
      jobId,
      search,
      emails,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Bulk email list (comma-separated) — exact match for validation
    const emailList = String(emails || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    if (emailList.length > 0) {
      query.email = { $in: emailList };
    } else if (search) {
      // Escape regex special chars for safe partial search
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } },
        { degreeDiscipline: { $regex: escaped, $options: 'i' } },
        { educationStatus: { $regex: escaped, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // If specific jobId is requested, get only applications for that jobId
    if (jobId) {
      if (!isSupportedJobId(jobId)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported job ID: ${jobId}`
        });
      }

      const ApplicationModel = getApplicationModel(jobId);
      const jobQuery = { ...query, jobId };
      const applications = await ApplicationModel.find(jobQuery)
        .populate('appliedBy', 'username email firstName lastName role')
        .sort(sortOptions)
        .limit(limit)
        .skip((page - 1) * limit)
        .lean()
        .exec();

      const total = await ApplicationModel.countDocuments(jobQuery);
      const enriched = await enrichApplicationsWithAppliedRoles(rewriteResumeLinks(applications, req));

      return res.json({
        success: true,
        data: enriched,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          totalApplications: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      });
    } else {
      // Get from all collections, then sort + paginate in memory
      const allModels = getAllApplicationModels();
      
      let allApplications = [];
      let totalApplications = 0;

      for (const { defaultJobId, model } of allModels) {
        const applications = await model.find(query)
          .populate('appliedBy', 'username email firstName lastName role')
          .sort(sortOptions)
          .lean()
          .exec();

        // Ensure legacy documents without jobId still have a sensible jobId
        const applicationsWithJobId = applications.map(app => ({
          ...app,
          jobId: app.jobId || defaultJobId
        }));

        allApplications = allApplications.concat(applicationsWithJobId);
        totalApplications += await model.countDocuments(query);
      }

      // Sort all applications (handle dates correctly)
      allApplications.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        const aTime = aValue instanceof Date || (typeof aValue === 'string' && !Number.isNaN(Date.parse(aValue)))
          ? new Date(aValue).getTime()
          : aValue;
        const bTime = bValue instanceof Date || (typeof bValue === 'string' && !Number.isNaN(Date.parse(bValue)))
          ? new Date(bValue).getTime()
          : bValue;

        if (aTime === bTime) return 0;
        if (sortOrder === 'desc') {
          return aTime > bTime ? -1 : 1;
        }
        return aTime > bTime ? 1 : -1;
      });

      // Apply pagination with numeric indexes (page/limit must be numbers — string concat broke this)
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedApplications = allApplications.slice(startIndex, endIndex);
      const enriched = await enrichApplicationsWithAppliedRoles(rewriteResumeLinks(paginatedApplications, req));

      return res.json({
        success: true,
        data: enriched,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalApplications / limit)),
          totalApplications,
          hasNextPage: page * limit < totalApplications,
          hasPrevPage: page > 1
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// GET /api/v1/applications/my - Get user's own applications
router.get('/my', protect, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      status
    } = req.query;

    const query = { appliedBy: req.user._id };

    if (status) {
      query.status = status;
    }

    const applications = await Application.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Application.countDocuments(query);

    res.json({
      success: true,
      data: rewriteResumeLinks(applications, req),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalApplications: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching user applications:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Helper function to find application by ID across all collections
const findApplicationById = async (applicationId) => {
  const allModels = getAllApplicationModels();

  for (const { defaultJobId, model } of allModels) {
    try {
      const application = await model.findById(applicationId)
        .populate('appliedBy', 'username email firstName lastName role')
        .lean();

      if (application) {
        return {
          ...application,
          jobId: application.jobId || defaultJobId
        };
      }
    } catch (error) {
      // Continue searching in other collections if this one fails
      continue;
    }
  }

  return null;
};

const findApplicationsByEmail = async (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];

  const allModels = getAllApplicationModels();
  let applications = [];

  for (const { defaultJobId, model } of allModels) {
    const docs = await model.find({ email: normalized })
      .select('_id jobId status createdAt updatedAt fullName email adminRemarks adminRecordings')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    applications = applications.concat(
      docs.map((app) => ({
        ...app,
        jobId: app.jobId || defaultJobId
      }))
    );
  }

  applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return applications;
};

// GET /api/v1/applications/:id - Get specific application
router.get('/:id', protect, async (req, res) => {
  try {
    const application = await findApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Check if user can access this application
    if (req.user.role !== 'admin' && application.appliedBy?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const relatedApplications =
      req.user.role === 'admin'
        ? await findApplicationsByEmail(application.email)
        : [];

    res.json({
      success: true,
      data: rewriteResumeLinks(application, req),
      relatedApplications: relatedApplications.map((app) => ({
        _id: app._id,
        jobId: app.jobId,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        fullName: app.fullName,
        email: app.email,
        hasRemarks: Boolean(app.adminRemarks && String(app.adminRemarks).trim()),
        recordingsCount: Array.isArray(app.adminRecordings) ? app.adminRecordings.length : 0
      }))
    });
  } catch (error) {
    logger.error('Error fetching application:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// PUT /api/v1/applications/:id/admin-notes - Update remarks + recordings (admin only)
router.put('/:id/admin-notes', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const application = await findApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const ApplicationModel = getApplicationModel(application.jobId);
    const updateData = {};

    if (typeof req.body.adminRemarks === 'string') {
      updateData.adminRemarks = req.body.adminRemarks;
    }

    if (typeof req.body.source === 'string') {
      updateData.source = req.body.source.trim();
    }

    if (typeof req.body.githubPortfolio === 'string') {
      updateData.githubPortfolio = req.body.githubPortfolio.trim();
    }

    if (typeof req.body.interviewRecordingLink === 'string') {
      updateData.interviewRecordingLink = req.body.interviewRecordingLink.trim();
    }

    if (typeof req.body.assignmentSent === 'boolean') {
      updateData.assignmentSent = req.body.assignmentSent;
      updateData.assignmentSentAt = req.body.assignmentSent
        ? (req.body.assignmentSentAt ? new Date(req.body.assignmentSentAt) : new Date())
        : null;
    }

    if (typeof req.body.assignmentReceived === 'boolean') {
      updateData.assignmentReceived = req.body.assignmentReceived;
      updateData.assignmentReceivedAt = req.body.assignmentReceived
        ? (req.body.assignmentReceivedAt ? new Date(req.body.assignmentReceivedAt) : new Date())
        : null;
    }

    if (typeof req.body.interviewLinkSent === 'boolean') {
      updateData.interviewLinkSent = req.body.interviewLinkSent;
      updateData.interviewLinkSentAt = req.body.interviewLinkSent
        ? (req.body.interviewLinkSentAt ? new Date(req.body.interviewLinkSentAt) : new Date())
        : null;
    }

    if (req.body.interviewScheduledDate !== undefined) {
      if (req.body.interviewScheduledDate === null || req.body.interviewScheduledDate === '') {
        updateData.interviewScheduledDate = null;
      } else {
        const parsed = new Date(req.body.interviewScheduledDate);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid interviewScheduledDate'
          });
        }
        updateData.interviewScheduledDate = parsed;
      }
    }

    if (typeof req.body.interviewStatus === 'string') {
      if (!INTERVIEW_STATUSES.includes(req.body.interviewStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid interviewStatus. Allowed: ${INTERVIEW_STATUSES.join(', ')}`
        });
      }
      updateData.interviewStatus = req.body.interviewStatus;
    }

    if (Array.isArray(req.body.adminRecordings)) {
      updateData.adminRecordings = req.body.adminRecordings
        .filter((item) => item && typeof item.url === 'string' && item.url.trim())
        .map((item) => ({
          url: String(item.url).trim(),
          label: typeof item.label === 'string' ? item.label.trim() : '',
          note: typeof item.note === 'string' ? item.note.trim() : '',
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          createdBy: item.createdBy || req.user._id || null
        }));
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide hiring tracker fields and/or adminRemarks / adminRecordings'
      });
    }

    const updatedApplication = await ApplicationModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('appliedBy', 'username email firstName lastName role');

    logger.info(`Admin notes updated for application ${req.params.id}`);

    res.json({
      success: true,
      message: 'Admin notes updated successfully',
      data: rewriteResumeLinks(updatedApplication.toObject ? updatedApplication.toObject() : updatedApplication, req)
    });
  } catch (error) {
    logger.error('Error updating admin notes:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// PUT /api/v1/applications/:id/status - Update application status (admin only)
router.put('/:id/status', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const { status } = req.body;

    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Allowed: ${APPLICATION_STATUSES.join(', ')}`
      });
    }

    // Find the application first to determine which collection it's in
    const application = await findApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Get the correct model for this jobId
    const ApplicationModel = getApplicationModel(application.jobId);
    
    // Store old status to check if we need to reset email tracking
    const oldStatus = application.status;
    
    // Prepare update object
    const updateData = {
      status,
      ...pipelineFieldsForStatus(status, application)
    };
    
    // If status is changing, reset email tracking so fresh emails can be sent
    if (oldStatus !== status) {
      updateData.emailSent = false;
      updateData.emailSentAt = null;
      updateData.emailType = null;
      logger.info(`Status changed from ${oldStatus} to ${status}, resetting email tracking`);
    }
    
    // Update the application
    const updatedApplication = await ApplicationModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('appliedBy', 'username email firstName lastName role');

    if (!updatedApplication) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    logger.info(`Application status updated: ${updatedApplication._id} from ${oldStatus} to ${status}`);

    const relatedApplications = await findApplicationsByEmail(updatedApplication.email);

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: updatedApplication,
      relatedApplications: relatedApplications.map((app) => ({
        _id: app._id,
        jobId: app.jobId,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        fullName: app.fullName,
        email: app.email,
        hasRemarks: Boolean(app.adminRemarks && String(app.adminRemarks).trim()),
        recordingsCount: Array.isArray(app.adminRecordings) ? app.adminRecordings.length : 0
      }))
    });
  } catch (error) {
    logger.error('Error updating application status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// GET /api/v1/applications/candidates - Get all candidates with detailed information (public)
router.get('/candidates', protect, async (req, res) => {
  try {

    const { 
      page = 1, 
      limit = 20, 
      status, 
      jobId,
      search,
      educationStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by job ID
    if (jobId) {
      query.jobId = jobId;
    }

    // Filter by education status
    if (educationStatus) {
      query.educationStatus = educationStatus;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { degreeDiscipline: { $regex: search, $options: 'i' } },
        { educationStatus: { $regex: search, $options: 'i' } },
        { aiMlProjects: { $regex: search, $options: 'i' } },
        { researchPapers: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const applications = await Application.find(query)
      .populate('appliedBy', 'username email firstName lastName role')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Application.countDocuments(query);

    // Get statistics for the current query
    const stats = await Application.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = emptyStatusBreakdown();

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: rewriteResumeLinks(applications, req),
      statistics: {
        totalCandidates: total,
        statusBreakdown: statusCounts
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalApplications: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      },
      filters: {
        appliedStatus: status || 'all',
        appliedJobId: jobId || 'all',
        appliedEducationStatus: educationStatus || 'all',
        appliedSearch: search || ''
      }
    });
  } catch (error) {
    logger.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// GET /api/v1/applications/stats - Get application statistics (public)
router.get('/stats/overview', protect, async (req, res) => {
  try {
    // Get all application models
    const allModels = getAllApplicationModels();
    
    let totalApplications = 0;
    let recentApplications = 0;
    const statusCounts = emptyStatusBreakdown();

    // Aggregate stats across all job application collections
    for (const { model } of allModels) {
      const stats = await model.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await model.countDocuments();
      const recent = await model.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      totalApplications += total;
      recentApplications += recent;

      stats.forEach(stat => {
        if (statusCounts[stat._id] !== undefined) {
          statusCounts[stat._id] += stat.count;
        } else {
          statusCounts[stat._id] = stat.count;
        }
      });
    }

    res.json({
      success: true,  
      data: {
        totalApplications,
        recentApplications,
        statusBreakdown: statusCounts
      }
    });
  } catch (error) {
    logger.error('Error fetching application stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Email Service Configuration
const EMAIL_SERVICE_CONFIG = {
  baseUrl: process.env.EMAIL_SERVICE_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://trizensupportemailservice.llp.trizenventures.com'
    : 'http://localhost:3002'),
  apiKey: process.env.EMAIL_SERVICE_API_KEY || 'trizen-support-email-2024-secure-key-xyz789'
};

// POST /api/v1/applications/send-confirmation-email - Send job application confirmation email
router.post('/send-confirmation-email', protect, async (req, res) => {
  try {
    const { applicantName, applicantEmail, jobTitle, jobId, companyName } = req.body;

    // Validate required fields
    if (!applicantName || !applicantEmail || !jobTitle || !jobId || !companyName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: applicantName, applicantEmail, jobTitle, jobId, companyName'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicantEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const subject = `Application Confirmation - ${jobTitle} at ${companyName}`;

    // Send email via email service using the new application confirmation endpoint
    const emailResponse = await fetch(`${EMAIL_SERVICE_CONFIG.baseUrl}/api/support/send-application-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVICE_CONFIG.apiKey,
      },
      body: JSON.stringify({
        applicantEmail: applicantEmail,
        applicantName: applicantName,
        jobTitle: jobTitle,
        jobId: jobId,
        appliedDate: new Date().toLocaleDateString()
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      logger.error('Email service error:', emailResult);
      return res.status(500).json({
        success: false,
        error: 'Failed to send confirmation email',
        details: emailResult.message || 'Email service error'
      });
    }

    logger.info(`Confirmation email sent successfully to ${applicantEmail} for job ${jobId}`);

    res.json({
      success: true,
      message: 'Confirmation email sent successfully',
      data: emailResult.data
    });

  } catch (error) {
    logger.error('Error sending confirmation email:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while sending email'
    });
  }
});

// POST /api/v1/applications/:id/send-acceptance-email - Send acceptance email (admin only)
router.post('/:id/send-acceptance-email', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Find the application
    const application = await findApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Check if application is accepted
    if (application.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Application status must be "accepted" to send acceptance email'
      });
    }

    // Send acceptance email
    logger.info(`Sending acceptance email to: ${application.email}`);
    logger.info(`Email service base URL: ${EMAIL_SERVICE_CONFIG.baseUrl}`);
    logger.info(`API Key (first 10 chars): ${EMAIL_SERVICE_CONFIG.apiKey ? EMAIL_SERVICE_CONFIG.apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
    
    const emailResponse = await fetch(`${EMAIL_SERVICE_CONFIG.baseUrl}/api/support/send-application-acceptance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVICE_CONFIG.apiKey,
      },
      body: JSON.stringify({
        applicantEmail: application.email,
        applicantName: application.fullName,
        jobTitle: getJobTitle(application.jobId),
        jobId: application.jobId
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      logger.error('Failed to send acceptance email:', emailResult);
      logger.error('Email service URL:', EMAIL_SERVICE_CONFIG.baseUrl);
      logger.error('API Key used:', EMAIL_SERVICE_CONFIG.apiKey ? 'Set' : 'Not set');
      return res.status(500).json({
        success: false,
        error: 'Failed to send acceptance email',
        details: emailResult.error || emailResult.message || 'Email service error'
      });
    }

    logger.info(`Acceptance email sent successfully to ${application.email} for application ${application._id}`);

    // Update application to mark email as sent
    const ApplicationModel = getApplicationModel(application.jobId);
    await ApplicationModel.findByIdAndUpdate(
      application._id,
      {
        emailSent: true,
        emailSentAt: new Date(),
        emailType: 'acceptance'
      }
    );

    res.json({
      success: true,
      message: 'Acceptance email sent successfully',
      data: emailResult.data
    });

  } catch (error) {
    logger.error('Error sending acceptance email:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while sending email',
      details: error.message
    });
  }
});

// POST /api/v1/applications/:id/send-rejection-email - Send rejection email (admin only)
router.post('/:id/send-rejection-email', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Find the application
    const application = await findApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Check if application is rejected
    if (application.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Application status must be "rejected" to send rejection email'
      });
    }

    // Send rejection email
    const emailResponse = await fetch(`${EMAIL_SERVICE_CONFIG.baseUrl}/api/support/send-application-rejection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVICE_CONFIG.apiKey,
      },
      body: JSON.stringify({
        applicantEmail: application.email,
        applicantName: application.fullName,
        jobTitle: getJobTitle(application.jobId),
        jobId: application.jobId
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      logger.error('Failed to send rejection email:', emailResult);
      return res.status(500).json({
        success: false,
        error: 'Failed to send rejection email',
        details: emailResult.message || 'Email service error'
      });
    }

    logger.info(`Rejection email sent successfully to ${application.email} for application ${application._id}`);

    // Update application to mark email as sent
    const ApplicationModel = getApplicationModel(application.jobId);
    await ApplicationModel.findByIdAndUpdate(
      application._id,
      {
        emailSent: true,
        emailSentAt: new Date(),
        emailType: 'rejection'
      }
    );

    res.json({
      success: true,
      message: 'Rejection email sent successfully',
      data: emailResult.data
    });

  } catch (error) {
    logger.error('Error sending rejection email:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while sending email'
    });
  }
});

export default router;
