import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userRoutes from './routes/users.js';
import applicationRoutes from './routes/applications.js';
import supportRoutes from './routes/support.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Connect to MongoDB (retry so CapRover/env timing does not leave us permanently disconnected)
const connectDB = async (attempt = 1) => {
  const maxAttempts = 10;
  const delayMs = Math.min(30000, 2000 * attempt);

  if (!process.env.MONGODB_URI) {
    logger.error('MONGODB_URI environment variable is not set — API routes that need the DB will return 500/503');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error(`MongoDB connection error (attempt ${attempt}/${maxAttempts}):`, error.message || error);
    if (attempt < maxAttempts) {
      logger.info(`Retrying MongoDB connection in ${delayMs}ms...`);
      setTimeout(() => connectDB(attempt + 1), delayMs);
    } else {
      logger.error('MongoDB connection failed after max retries. Check MONGODB_URI and network access from the container.');
    }
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',  // Careers Admin Frontend
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',  // Vite default port
  'http://localhost:5174',
  'http://localhost:8080',
  'http://192.168.1.8:3001', // LAN access (e.g. Careers Admin from another device)
  'https://careers.trizenventures.com',
  'https://careersadminfrontend.llp.trizenventures.com',
  'https://www.trizenventures.com',
  'https://trizenventures.com'
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? [...process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()), ...defaultOrigins]
  : defaultOrigins;

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

// In development, allow any origin from private IP ranges (192.168.x.x, 10.x.x.x)
const isDev = process.env.NODE_ENV !== 'production';
const lanOriginRegex = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

logger.info('Allowed CORS origins:', uniqueOrigins);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      logger.info('CORS: Allowing request with no origin');
      return callback(null, true);
    }
    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (isDev && lanOriginRegex.test(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS: Blocked origin: ${origin}`);
    logger.warn(`CORS: Allowed origins are: ${uniqueOrigins.join(', ')}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Rate limiting
// TEMPORARILY DISABLED
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     error: 'Too many requests from this IP, please try again later.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Compression middleware
app.use(compression());

// Serve uploaded resume files (public read for application review)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/support', supportRoutes);

// Health check endpoint (process liveness). mongodb field is the real readiness signal.
app.get('/api/health', (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    success: true,
    message: mongoConnected ? 'Server is running' : 'Server is running but MongoDB is disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    mongodbUriConfigured: Boolean(process.env.MONGODB_URI)
  });
});

// Fail fast with a clear error when DB-backed routes are hit without Mongo
app.use('/api/v1', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  // Routes that do not need Mongo (e.g. supported-jobs list is static)
  if (req.path === '/applications/supported-jobs') return next();
  return res.status(503).json({
    success: false,
    error: 'Database unavailable',
    details: process.env.MONGODB_URI
      ? 'MongoDB is disconnected. Check MONGODB_URI and that the database is reachable from this container.'
      : 'MONGODB_URI is not set in the CapRover app environment variables.'
  });
});

// Simple root endpoint for testing
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Trizen Careers Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/v1/users/register': 'Register a new user',
        'POST /api/v1/users/login': 'Login user',
        'GET /api/v1/users/profile': 'Get user profile (protected)',
        'PUT /api/v1/users/profile': 'Update user profile (protected)',
        'PUT /api/v1/users/change-password': 'Change password (protected)',
        'GET /api/v1/users': 'Get all users (admin only)'
      },
      applications: {
        'POST /api/v1/applications': 'Submit job application (protected)',
        'POST /api/v1/applications/upload-resume': 'Upload resume file (protected, multipart/form-data)',
        'GET /api/v1/applications': 'Get all applications (admin only)',
        'GET /api/v1/applications/my': 'Get user\'s applications (protected)',
        'GET /api/v1/applications/:id': 'Get specific application (protected)',
        'PUT /api/v1/applications/:id/status': 'Update application status (admin only)',
        'GET /api/v1/applications/stats/overview': 'Get application statistics (admin only)'
      }
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;
