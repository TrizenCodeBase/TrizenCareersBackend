import express from 'express';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import { protect, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { registerDynamicJob } from '../config/jobRegistry.js';

const router = express.Router();

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateJobId(category = 'ENG', title = 'ROLE') {
  const catCode = (category.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'ENG').toUpperCase();
  const words = title.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const titleCode = words.map(w => w[0]).join('').slice(0, 4).toUpperCase() || 'JOB';
  const year = new Date().getFullYear();
  const randomNum = String(Math.floor(100 + Math.random() * 900));
  return `TV-${catCode}-${titleCode}-${year}-${randomNum}`;
}

const JOB_ID_PATTERN = /^TV-[A-Z]+-[A-Z]+-\d{4}-\d{3}$/;

function normalizeJobId(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (JOB_ID_PATTERN.test(trimmed)) return trimmed;
  const parts = trimmed.split('-');
  if (parts.length >= 5) {
    const candidate = parts.slice(0, 5).join('-');
    if (JOB_ID_PATTERN.test(candidate)) return candidate;
  }
  return trimmed;
}

// GET /api/v1/jobs - Fetch list of jobs
router.get('/', async (req, res) => {
  try {
    const { status, category, type, search, sort = 'createdAt', order = 'desc' } = req.query;

    const query = { isArchived: { $ne: true } };

    // Status filtering:
    // If status is explicitly provided, filter by it (unless 'all')
    if (status && status !== 'all') {
      query.status = status;
    } else if (!status) {
      // By default for public queries, return published and closed (hide drafts)
      // If the caller passed ?all=true or an admin token, show drafts too
      const isAdminRequest = req.headers.authorization && req.query.includeDrafts === 'true';
      if (!isAdminRequest && req.query.all !== 'true') {
        query.status = { $in: ['published', 'closed'] };
      }
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { title: searchRegex },
        { shortDescription: searchRegex },
        { description: searchRegex },
        { id: searchRegex },
        { tags: searchRegex },
        { location: searchRegex },
      ];
    }

    const sortOptions = {};
    sortOptions[sort] = order === 'asc' ? 1 : -1;

    const jobs = await Job.find(query).sort(sortOptions).lean().exec();

    // Register job titles in registry cache
    jobs.forEach(j => registerDynamicJob(j.id, j.title));

    res.json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs',
      details: error.message,
    });
  }
});

// GET /api/v1/jobs/:id - Get a single job by id, slug, or _id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const normalized = normalizeJobId(id);

    const conditions = [
      { id: id },
      { id: normalized },
      { slug: id.toLowerCase() },
    ];

    if (mongoose.Types.ObjectId.isValid(id)) {
      conditions.push({ _id: id });
    }

    const job = await Job.findOne({ $or: conditions }).lean().exec();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    registerDynamicJob(job.id, job.title);

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    logger.error(`Error fetching job ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job',
      details: error.message,
    });
  }
});

// POST /api/v1/jobs - Create a new job role (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      title,
      category,
      type,
      location,
      shortDescription,
      description,
      applicationPrompt,
      tags,
      requirements,
      responsibilities,
      benefits,
      selectionProcess,
      preferredExperience,
      kpis,
      idealCandidate,
      duration,
      startDate,
      applicationDeadline,
      postedDate,
      status = 'published',
    } = req.body;

    if (!title || !shortDescription || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title, short description, and description are required',
      });
    }

    let customId = req.body.id ? String(req.body.id).trim().toUpperCase() : '';
    if (!customId) {
      customId = generateJobId(category, title);
    }

    // Check if ID is unique
    const existingId = await Job.findOne({ id: customId });
    if (existingId) {
      return res.status(400).json({
        success: false,
        error: `Job with ID '${customId}' already exists. Please choose a different ID.`,
      });
    }

    let slug = req.body.slug ? slugify(req.body.slug) : slugify(title);
    if (!slug) {
      slug = slugify(customId);
    }

    // Ensure slug uniqueness
    let slugCandidate = slug;
    let slugIndex = 1;
    while (await Job.findOne({ slug: slugCandidate })) {
      slugCandidate = `${slug}-${slugIndex}`;
      slugIndex += 1;
    }
    slug = slugCandidate;

    const normalizeList = (val) => {
      if (Array.isArray(val)) return val.map(item => String(item).trim()).filter(Boolean);
      if (typeof val === 'string') {
        return val.split('\n').map(item => item.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
      }
      return [];
    };

    const newJob = new Job({
      id: customId,
      title: title.trim(),
      slug,
      location: (location || 'Remote / Hybrid').trim(),
      type: (type || 'Full-Time').trim(),
      category: (category || 'Engineering').trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      applicationPrompt: (applicationPrompt || '').trim(),
      tags: normalizeList(tags),
      requirements: normalizeList(requirements),
      responsibilities: normalizeList(responsibilities),
      benefits: normalizeList(benefits),
      selectionProcess: normalizeList(selectionProcess),
      preferredExperience: normalizeList(preferredExperience),
      kpis: normalizeList(kpis),
      idealCandidate: (idealCandidate || '').trim(),
      duration: (duration || type || 'Full-Time').trim(),
      startDate: (startDate || 'Immediate').trim(),
      applicationDeadline: (applicationDeadline || 'Rolling basis').trim(),
      postedDate: postedDate || new Date().toISOString().split('T')[0],
      status: ['published', 'draft', 'closed'].includes(status) ? status : 'published',
      closedDate: status === 'closed' ? new Date().toISOString().split('T')[0] : null,
      createdBy: req.user?._id || null,
    });

    await newJob.save();

    registerDynamicJob(newJob.id, newJob.title);

    logger.info(`Admin created new job: ${newJob.id} - ${newJob.title}`);

    res.status(201).json({
      success: true,
      message: 'Job role created successfully',
      data: newJob,
    });
  } catch (error) {
    logger.error('Error creating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create job',
      details: error.message,
    });
  }
});

// PUT /api/v1/jobs/:id - Update an existing job (Admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const normalized = normalizeJobId(id);

    const conditions = [
      { id: id },
      { id: normalized },
    ];
    if (mongoose.Types.ObjectId.isValid(id)) {
      conditions.push({ _id: id });
    }

    const job = await Job.findOne({ $or: conditions });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    const normalizeList = (val) => {
      if (Array.isArray(val)) return val.map(item => String(item).trim()).filter(Boolean);
      if (typeof val === 'string') {
        return val.split('\n').map(item => item.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
      }
      return [];
    };

    const updatableFields = [
      'title',
      'location',
      'type',
      'category',
      'shortDescription',
      'description',
      'applicationPrompt',
      'idealCandidate',
      'duration',
      'startDate',
      'applicationDeadline',
      'postedDate',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        job[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    if (req.body.tags !== undefined) job.tags = normalizeList(req.body.tags);
    if (req.body.requirements !== undefined) job.requirements = normalizeList(req.body.requirements);
    if (req.body.responsibilities !== undefined) job.responsibilities = normalizeList(req.body.responsibilities);
    if (req.body.benefits !== undefined) job.benefits = normalizeList(req.body.benefits);
    if (req.body.selectionProcess !== undefined) job.selectionProcess = normalizeList(req.body.selectionProcess);
    if (req.body.preferredExperience !== undefined) job.preferredExperience = normalizeList(req.body.preferredExperience);
    if (req.body.kpis !== undefined) job.kpis = normalizeList(req.body.kpis);

    if (req.body.status && ['published', 'draft', 'closed'].includes(req.body.status)) {
      const prevStatus = job.status;
      job.status = req.body.status;
      if (req.body.status === 'closed' && prevStatus !== 'closed') {
        job.closedDate = req.body.closedDate || new Date().toISOString().split('T')[0];
      } else if (req.body.status !== 'closed') {
        job.closedDate = null;
      }
    }

    if (req.body.slug) {
      const newSlug = slugify(req.body.slug);
      if (newSlug !== job.slug) {
        const slugExists = await Job.findOne({ slug: newSlug, _id: { $ne: job._id } });
        if (!slugExists) {
          job.slug = newSlug;
        }
      }
    }

    await job.save();

    registerDynamicJob(job.id, job.title);

    logger.info(`Admin updated job: ${job.id} - ${job.title}`);

    res.json({
      success: true,
      message: 'Job updated successfully',
      data: job,
    });
  } catch (error) {
    logger.error(`Error updating job ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job',
      details: error.message,
    });
  }
});

// PATCH /api/v1/jobs/:id/status - Update job status (published/draft/closed)
router.patch('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['published', 'draft', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'published', 'draft', or 'closed'",
      });
    }

    const normalized = normalizeJobId(id);
    const conditions = [{ id: id }, { id: normalized }];
    if (mongoose.Types.ObjectId.isValid(id)) conditions.push({ _id: id });

    const job = await Job.findOne({ $or: conditions });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    job.status = status;
    if (status === 'closed') {
      job.closedDate = req.body.closedDate || new Date().toISOString().split('T')[0];
    } else {
      job.closedDate = null;
    }

    await job.save();

    logger.info(`Admin changed status of job ${job.id} to ${status}`);

    res.json({
      success: true,
      message: `Job status updated to ${status}`,
      data: job,
    });
  } catch (error) {
    logger.error(`Error updating job status for ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job status',
      details: error.message,
    });
  }
});

// DELETE /api/v1/jobs/:id - Delete a job (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const normalized = normalizeJobId(id);
    const conditions = [{ id: id }, { id: normalized }];
    if (mongoose.Types.ObjectId.isValid(id)) conditions.push({ _id: id });

    const job = await Job.findOneAndDelete({ $or: conditions });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    logger.info(`Admin deleted job: ${job.id}`);

    res.json({
      success: true,
      message: 'Job deleted successfully',
      data: { id: job.id, title: job.title },
    });
  } catch (error) {
    logger.error(`Error deleting job ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job',
      details: error.message,
    });
  }
});

export default router;
