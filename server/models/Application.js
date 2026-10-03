const mongoose = require('mongoose');
const {
  COMPETITIVE_EXAMS,
  EXAM_CODES,
  CATEGORIES,
  CLASS_XII_STREAMS,
  DEPARTMENTS,
  PROGRAMS
} = require('../config/admission.rules');
const { STATUSES } = require('../config/status.rules');

// File bytes live on disk via Multer; Mongo stores only the reference
const documentRefSchema = new mongoose.Schema(
  {
    // local: fileName is the file on server disk. blob: fileName is the pathname, filePath the private blob URL
    storage: { type: String, enum: ['local', 'blob'], default: 'local' },
    fileName: { type: String, default: '' },
    originalName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    // Scrutiny outcome recorded by an administrator
    verification: {
      status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
      remarks: { type: String, default: '' },
      verifiedBy: { type: mongoose.Schema.Types.Mixed },
      verifiedAt: { type: Date }
    }
  },
  { _id: false }
);

// Summary of the successful (or latest) payment; full attempts live in the Payment collection
const paymentSummarySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
    amount: { type: Number, default: 0 }, // in rupees
    currency: { type: String, default: 'INR' },
    orderId: { type: String, default: '' },
    paymentId: { type: String, default: '' },
    method: { type: String, default: '' },
    paidAt: { type: Date }
  },
  { _id: false }
);

const academicRecordSchema = new mongoose.Schema(
  {
    board: { type: String, trim: true, required: true },
    school: { type: String, trim: true, required: true },
    stream: { type: String, enum: [...CLASS_XII_STREAMS, ''], default: '' },
    passingYear: { type: Number, required: true },
    percentage: { type: Number, min: 0, max: 100, required: true },
    pcmPercentage: { type: Number, min: 0, max: 100 },
    mathOrComputer: { type: Boolean },
    marksheet: documentRefSchema
  },
  { _id: false }
);

const graduationSchema = new mongoose.Schema(
  {
    degree: { type: String, trim: true, required: true },
    university: { type: String, trim: true, required: true },
    passingYear: { type: Number, required: true },
    percentage: { type: Number, min: 0, max: 100, required: true },
    marksheet: documentRefSchema
  },
  { _id: false }
);

const competitiveExamSchema = new mongoose.Schema(
  {
    exam: { type: String, enum: EXAM_CODES, required: true },
    rollNumber: { type: String, trim: true, required: true },
    year: { type: Number, required: true },
    // Absent for exams that publish no rank (CAT, MAT)
    rank: {
      type: Number,
      min: 1,
      validate: {
        validator(v) {
          const rules = COMPETITIVE_EXAMS[this.exam];
          return !rules || !rules.rank || (Number.isInteger(v) && v <= rules.rank.max);
        },
        message: (props) => `Rank ${props.value} is outside the allowed range for this exam.`
      }
    },
    // Marks / percentile / composite score depending on the exam; negative where negative marking applies
    score: {
      type: Number,
      required: true,
      validate: {
        validator(v) {
          const rules = COMPETITIVE_EXAMS[this.exam];
          return !rules || (v >= rules.score.min && v <= rules.score.max);
        },
        message: (props) => `Score ${props.value} is outside the allowed range for this exam.`
      }
    },
    scorecard: documentRefSchema
  },
  { _id: false }
);

const parentsSchema = new mongoose.Schema(
  {
    fatherName: { type: String, trim: true, required: true },
    fatherPhone: { type: String, trim: true, default: '' },
    fatherOccupation: { type: String, trim: true, default: '' },
    motherName: { type: String, trim: true, required: true },
    motherPhone: { type: String, trim: true, default: '' },
    motherOccupation: { type: String, trim: true, default: '' },
    guardianName: { type: String, trim: true, default: '' },
    guardianRelation: { type: String, trim: true, default: '' },
    guardianPhone: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: STATUSES,
      required: true
    },
    toStatus: {
      type: String,
      enum: STATUSES,
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
    alternatePhone: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: [...CATEGORIES, ''],
      default: '',
      index: true
    },
    nationality: {
      type: String,
      trim: true,
      default: 'Indian'
    },
    address: {
      type: String,
      default: ''
    },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    parents: parentsSchema,
    classX: academicRecordSchema,
    classXII: academicRecordSchema,
    graduation: graduationSchema,
    competitiveExams: {
      type: [competitiveExamSchema],
      default: undefined
    },
    declarationAccepted: {
      type: Boolean,
      default: false
    },
    department: {
      type: String,
      enum: DEPARTMENTS,
      required: [true, 'Program / Department is required'],
      index: true
    },
    // "Applying For" program and ranked stream choices (v2)
    program: {
      type: String,
      enum: [...Object.keys(PROGRAMS), ''],
      default: ''
    },
    streamPreferences: {
      type: [String],
      default: undefined
    },
    // v1 summary fields — derived from Class XII for v2 submissions so existing
    // admin views, filters and aggregations keep working
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
    // Primary document (Class XII marksheet for v2 submissions)
    document: documentRefSchema,
    // MongoDB Schema Versioning Pattern (for schema evolution & migrations)
    // 1 = legacy single-section form, 2 = full form with Class X/XII, parents and competitive exams
    schemaVersion: {
      type: Number,
      default: 2,
      immutable: true
    },
    // Document Revision Counter (increments on resubmission/edit)
    submissionVersion: {
      type: Number,
      default: 1
    },
    // Human-readable ID issued once payment is verified, e.g. IEM-2026-BT-000042
    applicationId: {
      type: String,
      unique: true,
      sparse: true
    },
    payment: {
      type: paymentSummarySchema,
      default: () => ({})
    },
    submittedAt: { type: Date },
    // Lifecycle state machine, see config/status.rules.js
    status: {
      type: String,
      enum: STATUSES,
      default: 'Payment Pending',
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
    versionKey: '__v',
    // Concurrent edits (e.g. two admins) fail with a VersionError instead of silently overwriting
    optimisticConcurrency: true
  }
);

module.exports = mongoose.model('Application', applicationSchema);
