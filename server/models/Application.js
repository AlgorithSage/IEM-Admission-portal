const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: ['Submitted', 'Review', 'Selected', 'Rejected'],
      required: true
    },
    toStatus: {
      type: String,
      enum: ['Submitted', 'Review', 'Selected', 'Rejected'],
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.Mixed
    },
    remarks: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Applicant email is required'],
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    dob: {
      type: String,
      default: ''
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Male'
    },
    address: {
      type: String,
      default: ''
    },
    department: {
      type: String,
      enum: ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'BBA'],
      required: [true, 'Program / Department is required'],
      index: true
    },
    qualifyingExam: {
      type: String,
      required: [true, 'Qualifying exam is required']
    },
    passingYear: {
      type: Number,
      required: [true, 'Passing year is required']
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage / CGPA is required']
    },
    // Document Upload Metadata (File bytes stored on disk via Multer; only references in Mongo)
    document: {
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    },
    // MongoDB Schema Versioning Pattern (for schema evolution & migrations)
    schemaVersion: {
      type: Number,
      default: 1,
      immutable: true
    },
    // Document Revision Counter (increments on resubmission/edit)
    submissionVersion: {
      type: Number,
      default: 1
    },
    // Status State Machine: Submitted -> Review -> Selected / Rejected
    status: {
      type: String,
      enum: ['Submitted', 'Review', 'Selected', 'Rejected'],
      default: 'Submitted',
      index: true
    },
    adminRemarks: {
      type: String,
      default: 'Application received and queued for review.'
    },
    statusHistory: [statusHistorySchema]
  },
  {
    timestamps: true,
    versionKey: '__v' // Explicit Optimistic Concurrency Version Key
  }
);

module.exports = mongoose.model('Application', applicationSchema);
