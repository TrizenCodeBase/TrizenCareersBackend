import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: [true, 'Job ID is required'],
    trim: true
  },
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
  portfolioUrl: {
    type: String,
    required: [true, 'Portfolio/GitHub/Website URL is required'],
    trim: true
  },
  linkedinProfile: {
    type: String,
    required: [true, 'LinkedIn Profile URL is required'],
    trim: true
  },
  educationStatus: {
    type: String,
    required: [true, 'Current education status is required'],
    trim: true
  },
  degreeDiscipline: {
    type: String,
    required: [true, 'Degree/Discipline is required'],
    trim: true
  },
  researchPapers: {
    type: String,
    required: [true, 'Research papers information is required'],
    trim: true
  },
  internshipExperience: {
    type: String,
    required: [true, 'Internship experience information is required'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration in months is required'],
    trim: true
  },
  aiMlProjects: {
    type: String,
    required: [true, 'AI/ML projects information is required'],
    trim: true
  },
  motivation: {
    type: String,
    required: [true, 'Motivation to join is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending'
  },
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Index for better query performance
applicationSchema.index({ jobId: 1, appliedBy: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ createdAt: -1 });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
