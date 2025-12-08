import mongoose from 'mongoose';

// Base schema with common fields
const baseApplicationSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  linkedinProfile: {
    type: String,
    required: [true, 'LinkedIn Profile URL is required'],
    trim: true
  },
  motivation: {
    type: String,
    required: [true, 'Motivation to join is required'],
    trim: true
  },
  expectedStipend: {
    type: String,
    required: [true, 'Expected stipend amount is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending'
  },
  // Email tracking fields
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  emailType: {
    type: String,
    enum: ['acceptance', 'rejection', null],
    default: null
  },
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// AIML Intern specific schema
const aimlApplicationSchema = new mongoose.Schema({
  ...baseApplicationSchema.obj,
  portfolioUrl: {
    type: String,
    required: [true, 'Portfolio URL is required'],
    trim: true
  },
  resumeLink: {
    type: String,
    required: [true, 'Resume link is required'],
    trim: true
  },
  educationStatus: {
    type: String,
    required: [true, 'Education status is required'],
    trim: true
  },
  degreeDiscipline: {
    type: String,
    required: [true, 'Degree discipline is required'],
    trim: true
  },
  researchPapers: {
    type: String,
    required: [true, 'Research papers information is required'],
    trim: true
  },
  internshipExperience: {
    type: String,
    required: [true, 'Internship experience is required'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true
  },
  aiMlProjects: {
    type: String,
    required: [true, 'AI/ML projects information is required'],
    trim: true
  },
  preferredStartDate: {
    type: String,
    required: [true, 'Preferred start date is required'],
    trim: true
  }
}, { timestamps: true });

// MERN Stack Developer Intern specific schema
const mernApplicationSchema = new mongoose.Schema({
  ...baseApplicationSchema.obj,
  portfolioUrl: {
    type: String,
    required: [true, 'Portfolio URL is required'],
    trim: true
  },
  resumeLink: {
    type: String,
    required: [true, 'Resume link is required'],
    trim: true
  },
  educationStatus: {
    type: String,
    required: [true, 'Education status is required'],
    trim: true
  },
  degreeDiscipline: {
    type: String,
    required: [true, 'Degree discipline is required'],
    trim: true
  },
  researchPapers: {
    type: String,
    required: [true, 'Research papers information is required'],
    trim: true
  },
  internshipExperience: {
    type: String,
    required: [true, 'Internship experience is required'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true
  },
  aiMlProjects: {
    type: String,
    required: [true, 'AI/ML projects information is required'],
    trim: true
  },
  preferredStartDate: {
    type: String,
    required: [true, 'Preferred start date is required'],
    trim: true
  }
}, { timestamps: true });

// Social Media Management Intern specific schema
const socialMediaApplicationSchema = new mongoose.Schema({
  ...baseApplicationSchema.obj,
  currentQualification: {
    type: String,
    required: [true, 'Current qualification is required'],
    trim: true
  },
  collegeUniversity: {
    type: String,
    required: [true, 'College/University is required'],
    trim: true
  },
  relevantCourses: {
    type: String,
    trim: true
  },
  socialMediaPlatforms: [{
    type: String,
    required: [true, 'At least one social media platform is required'],
    trim: true
  }],
  contentCreationSkills: [{
    type: String,
    required: [true, 'At least one content creation skill is required'],
    trim: true
  }],
  portfolioWorkSamples: {
    type: String,
    required: [true, 'Portfolio/work samples link is required'],
    trim: true
  },
  resumeLink: {
    type: String,
    required: [true, 'Resume link is required'],
    trim: true
  },
  preferredStartDate: {
    type: String,
    required: [true, 'Preferred start date is required'],
    trim: true
  },
  workPreference: {
    type: String,
    enum: ['Hybrid', 'Remote', 'Office'],
    required: [true, 'Work preference is required'],
    trim: true
  },
  internshipExperience: {
    type: String,
    required: [true, 'Internship experience is required'],
    trim: true
  },
  hoursPerWeek: {
    type: String,
    trim: true
  },
  expectations: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Collection mapping
const COLLECTION_MAPPING = {
  'TV-AIML-INT-2025-001': 'aiml_applications',
  'TV-WEB-MERN-2025-005': 'mern_applications',
  'TV-MKT-SMM-2025-003': 'social_media_applications'
};

// Schema mapping
const SCHEMA_MAPPING = {
  'TV-AIML-INT-2025-001': aimlApplicationSchema,
  'TV-WEB-MERN-2025-005': mernApplicationSchema,
  'TV-MKT-SMM-2025-003': socialMediaApplicationSchema
};

// Factory function to get the appropriate model
export const getApplicationModel = (jobId) => {
  const collectionName = COLLECTION_MAPPING[jobId];
  const schema = SCHEMA_MAPPING[jobId];
  
  if (!collectionName || !schema) {
    throw new Error(`No collection mapping found for jobId: ${jobId}`);
  }
  
  // Create model with dynamic collection name
  return mongoose.model(collectionName, schema, collectionName);
};

// Helper function to get all application models
export const getAllApplicationModels = () => {
  return Object.entries(COLLECTION_MAPPING).map(([jobId, collectionName]) => ({
    jobId,
    collectionName,
    model: getApplicationModel(jobId)
  }));
};

// Helper function to check if jobId is supported
export const isSupportedJobId = (jobId) => {
  return COLLECTION_MAPPING.hasOwnProperty(jobId);
};

export default {
  getApplicationModel,
  getAllApplicationModels,
  isSupportedJobId,
  COLLECTION_MAPPING,
  SCHEMA_MAPPING
};

