import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Job ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      default: 'Remote / Hybrid',
    },
    type: {
      type: String,
      required: [true, 'Employment type is required'],
      trim: true,
      default: 'Full-Time',
    },
    category: {
      type: String,
      required: [true, 'Job category is required'],
      trim: true,
      default: 'Engineering',
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Detailed job description is required'],
      trim: true,
    },
    applicationPrompt: {
      type: String,
      trim: true,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    selectionProcess: {
      type: [String],
      default: [],
    },
    preferredExperience: {
      type: [String],
      default: [],
    },
    kpis: {
      type: [String],
      default: [],
    },
    idealCandidate: {
      type: String,
      trim: true,
      default: '',
    },
    duration: {
      type: String,
      trim: true,
      default: 'Full-Time',
    },
    startDate: {
      type: String,
      trim: true,
      default: 'Immediate',
    },
    applicationDeadline: {
      type: String,
      trim: true,
      default: 'Rolling basis',
    },
    postedDate: {
      type: String,
      trim: true,
      default: () => new Date().toISOString().split('T')[0],
    },
    status: {
      type: String,
      enum: ['published', 'draft', 'closed'],
      default: 'published',
    },
    closedDate: {
      type: String,
      trim: true,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ status: 1 });
jobSchema.index({ category: 1 });

const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);

export default Job;
