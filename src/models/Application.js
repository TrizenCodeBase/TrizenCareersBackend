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
  expectedStipend: {
    type: String,
    required: [true, 'Expected stipend amount is required'],
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
  hoursPerWeek: {
    type: String,
    trim: true
  },
  workPreference: {
    type: String,
    enum: ['Hybrid', 'Remote', 'Office'],
    trim: true
  },
  preferredStartDate: {
    type: String,
    trim: true
  },
  expectations: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: [
      'pending',
      'reviewed',
      'shortlisted',
      'assignment_sent',
      'assignment_received',
      'interview_link_sent',
      'interview_scheduled',
      'rejected',
      'accepted'
    ],
    default: 'pending'
  },
  source: {
    type: String,
    default: '',
    trim: true
  },
  githubPortfolio: {
    type: String,
    default: '',
    trim: true
  },
  assignmentSent: { type: Boolean, default: false },
  assignmentSentAt: { type: Date, default: null },
  assignmentReceived: { type: Boolean, default: false },
  assignmentReceivedAt: { type: Date, default: null },
  interviewLinkSent: { type: Boolean, default: false },
  interviewLinkSentAt: { type: Date, default: null },
  interviewScheduledDate: { type: Date, default: null },
  interviewStatus: {
    type: String,
    enum: [
      'not_scheduled',
      'scheduled',
      'completed',
      'no_show',
      'cancelled',
      'selected',
      'rejected'
    ],
    default: 'not_scheduled'
  },
  interviewRecordingLink: {
    type: String,
    default: '',
    trim: true
  },
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  }
}, { timestamps: true });

// Index for better query performance
applicationSchema.index({ jobId: 1, appliedBy: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ createdAt: -1 });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
