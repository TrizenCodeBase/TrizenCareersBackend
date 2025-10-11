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
    trim: true
  },
  linkedinProfile: {
    type: String,
    required: [true, 'LinkedIn Profile URL is required'],
    trim: true
  },
  resumeLink: {
    type: String,
    trim: true
  },
  educationStatus: {
    type: String,
    trim: true
  },
  degreeDiscipline: {
    type: String,
    trim: true
  },
  researchPapers: {
    type: String,
    trim: true
  },
  internshipExperience: {
    type: String,
    required: [true, 'Internship experience information is required'],
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  aiMlProjects: {
    type: String,
    trim: true
  },
  motivation: {
    type: String,
    required: [true, 'Motivation to join is required'],
    trim: true
  },
  // Social Media Management Intern specific fields
  currentQualification: {
    type: String,
    trim: true
  },
  collegeUniversity: {
    type: String,
    trim: true
  },
  relevantCourses: {
    type: String,
    trim: true
  },
  socialMediaPlatforms: [{
    type: String,
    trim: true
  }],
  contentCreationSkills: [{
    type: String,
    trim: true
  }],
  portfolioWorkSamples: {
    type: String,
    trim: true
  },
  preferredStartDate: {
    type: Date
  },
  hoursPerWeek: {
    type: String,
    trim: true
  },
  workPreference: {
    type: String,
    enum: ['Hybrid', 'Remote', 'Office'],
    trim: true
  },
  expectations: {
    type: String,
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
