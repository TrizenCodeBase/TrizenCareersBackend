import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Validation middleware
const validateSignup = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Helper to call external mailer API
async function sendOtpViaSupportService({ email, otp, firstName, expiryMins = 10 }) {
  try {
    const resp = await fetch('https://trizensupportemailservice.llp.trizenventures.com/api/support/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.MAILER_API_KEY || ''
      },
      body: JSON.stringify({
        email,
        otp,
        firstName,
        expiryMins
      })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Mailer service returned ${resp.status}: ${text}`);
    }

    // parse response if needed by caller
    return await resp.json().catch(() => ({}));
  } catch (err) {
    logger.error('Mailer service error:', err);
    throw err;
  }
}

// @desc    Register user
// @route   POST /api/v1/users/register
// @access  Public
router.post('/register', validateSignup, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this username or email already exists'
      });
    }

    // Create user (password will be hashed via pre-save hook)
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName
    });

    // Generate email verification code and save
    const verificationCode = user.generateEmailVerificationCode();
    await user.save();

    // Send verification code email via support service (will log if fails)
    try {
      await sendOtpViaSupportService({
        email: user.email,
        otp: verificationCode,
        firstName: user.firstName,
        expiryMins: 10
      });
    } catch (mailErr) {
      logger.error('Failed to send verification email via support service:', mailErr);
      // Do not fail registration if email send fails; inform client
    }

    // Generate token
    const token = generateToken(user._id);

    logger.info(`New user registered: ${username}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. A verification code has been sent to the provided email.',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Login user
// @route   POST /api/v1/users/login
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { email, password } = req.body;

    // TEMPORARY: Hardcoded admin credentials for testing
    const HARDCODED_ADMIN = {
      email: 'admin@trizenventures.com',
      password: 'Test@123'
    };

    // Check hardcoded credentials first
    if (email.toLowerCase() === HARDCODED_ADMIN.email.toLowerCase() && password === HARDCODED_ADMIN.password) {
      // Create or find admin user in database
      let adminUser = await User.findOne({ email: HARDCODED_ADMIN.email });
      
      if (!adminUser) {
        // Create admin user if doesn't exist
        adminUser = await User.create({
          username: 'admin',
          email: HARDCODED_ADMIN.email,
          password: HARDCODED_ADMIN.password,
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true
        });
      } else {
        // Ensure user is admin and active
        if (adminUser.role !== 'admin') {
          adminUser.role = 'admin';
        }
        if (!adminUser.isActive) {
          adminUser.isActive = true;
        }
        adminUser.lastLogin = new Date();
        await adminUser.save();
      }

      // Generate token
      const token = generateToken(adminUser._id);

      logger.info(`Admin logged in (hardcoded): ${email}`);

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: adminUser.toJSON(),
          token
        }
      });
    }

    // Regular database authentication for other users
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get current user profile
// @route   GET /api/v1/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
router.put('/profile', protect, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { firstName, lastName, email } = req.body;

    // Load user and update fields, handle email change specially
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;

    if (email && (!user.isEmailVerified || email !== user.email)) {
      // Ensure no other user has this email
      const emailTaken = await User.findOne({ email });
      if (emailTaken) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use by another account'
        });
      }

      user.email = email;
      // Generate verification code for the new email
      const verificationCode = user.generateEmailVerificationCode();

      // Attempt to send verification email via support service; log if fails
      try {
        await sendOtpViaSupportService({
          email: user.email,
          otp: verificationCode,
          firstName: user.firstName,
          expiryMins: 10
        });
      } catch (mailErr) {
        logger.error('Failed to send verification email via support service on profile update:', mailErr);
      }
    }

    await user.save();

    logger.info(`Profile updated for user: ${user.username}`);

    res.json({
      success: true,
      message: email ? 'Profile updated. A verification code has been sent to the new email.' : 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Change password
// @route   PUT /api/v1/users/change-password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get all users (Admin only)
// @route   GET /api/v1/users
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    let query = {};

    // Search functionality
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      },
      data: users
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Verify email
// @route   POST /api/v1/users/verify-email
// @access  Public
router.post('/verify-email', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }))
      });
    }

    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found. Please request a new one.'
      });
    }

    if (user.emailVerificationExpires.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    if (user.emailVerificationCode !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info(`Email verified for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

export default router;
