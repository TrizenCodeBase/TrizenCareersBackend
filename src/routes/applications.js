import express from 'express';
import { body, validationResult } from 'express-validator';
import Application from '../models/Application.js';
import { protect } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Validation middleware
const validateApplication = [
  body('jobId').notEmpty().withMessage('Job ID is required'),
  body('fullName').notEmpty().withMessage('Full name is required').isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('portfolioUrl').notEmpty().withMessage('Portfolio/GitHub/Website URL is required').isURL().withMessage('Please enter a valid URL'),
  body('linkedinProfile').notEmpty().withMessage('LinkedIn Profile URL is required').isURL().withMessage('Please enter a valid LinkedIn URL'),
  body('educationStatus').notEmpty().withMessage('Current education status is required'),
  body('degreeDiscipline').notEmpty().withMessage('Degree/Discipline is required'),
  body('researchPapers').notEmpty().withMessage('Research papers information is required'),
  body('internshipExperience').notEmpty().withMessage('Internship experience information is required'),
  body('duration').notEmpty().withMessage('Duration in months is required'),
  body('aiMlProjects').notEmpty().withMessage('AI/ML projects information is required'),
  body('motivation').notEmpty().withMessage('Motivation to join is required')
];

// POST /api/v1/applications - Submit a new application
router.post('/', protect, validateApplication, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if user has already applied for this job
    const existingApplication = await Application.findOne({
      jobId: req.body.jobId,
      appliedBy: req.user._id
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        error: 'You have already applied for this position'
      });
    }

    // Create new application
    const application = await Application.create({
      ...req.body,
      appliedBy: req.user._id
    });

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
    logger.error('Error submitting application:', error);
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
      page = 1, 
      limit = 10, 
      status, 
      jobId,
      search,
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

    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { degreeDiscipline: { $regex: search, $options: 'i' } },
        { educationStatus: { $regex: search, $options: 'i' } }
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

    res.json({
      success: true,
      data: applications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalApplications: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
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
      data: applications,
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

// GET /api/v1/applications/:id - Get specific application
router.get('/:id', protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('appliedBy', 'username email firstName lastName role');

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Check if user can access this application
    if (req.user.role !== 'admin' && application.appliedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    logger.error('Error fetching application:', error);
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

    if (!['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('appliedBy', 'username email firstName lastName role');

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    logger.info(`Application status updated: ${application._id} to ${status}`);

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: application
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

    const statusCounts = {
      pending: 0,
      reviewed: 0,
      shortlisted: 0,
      rejected: 0,
      accepted: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: applications,
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

    const stats = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalApplications = await Application.countDocuments();
    const recentApplications = await Application.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const statusCounts = {
      pending: 0,
      reviewed: 0,
      shortlisted: 0,
      rejected: 0,
      accepted: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

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

export default router;
