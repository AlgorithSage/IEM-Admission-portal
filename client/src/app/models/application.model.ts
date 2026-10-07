import { CompetitiveExamCode, DepartmentCode } from './admission-rules';

// Mirrors server/config/status.rules.js
export type ApplicationStatus =
  | 'Payment Pending'
  | 'Submitted'
  | 'Review'
  | 'On Hold'
  | 'Correction Requested'
  | 'Selected'
  | 'Rejected';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Payment Pending',
  'Submitted',
  'Review',
  'On Hold',
  'Correction Requested',
  'Selected',
  'Rejected'
];

export type DepartmentType = DepartmentCode;
export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected';

export interface DocumentReference {
  fileName: string;
  originalName: string;
  filePath?: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

/** A document as returned by the API, with its scrutiny state */
export interface ApplicationDocument {
  key: string;
  label: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  verification: { status: VerificationStatus; remarks: string; verifiedAt?: string };
  /** Single-application responses only: false when the stored file no longer exists */
  available?: boolean;
}

export interface ParentDetails {
  fatherName: string;
  fatherPhone?: string;
  fatherOccupation?: string;
  motherName: string;
  motherPhone?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
}

export interface AcademicRecord {
  board: string;
  school: string;
  stream?: string;
  passingYear: number;
  percentage: number;
  pcmPercentage?: number;
  mathOrComputer?: boolean;
}

export interface GraduationRecord {
  degree: string;
  university: string;
  passingYear: number;
  percentage: number;
}

export interface CompetitiveExamEntry {
  exam: CompetitiveExamCode;
  rollNumber: string;
  year: number;
  rank?: number;
  score: number;
}

export interface PaymentSummary {
  status: 'Pending' | 'Paid' | 'Failed';
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  method: string;
  paidAt?: string;
}

export interface StatusHistoryEntry {
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedBy?: string;
  changedAt: string;
  remarks?: string;
}

export interface Application {
  _id: string;
  __v: number;
  applicationId?: string;
  applicant: string | { _id: string; name: string; email: string };
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  alternatePhone?: string;
  category?: string;
  nationality?: string;
  city?: string;
  state?: string;
  pincode?: string;
  parents?: ParentDetails;
  classX?: AcademicRecord;
  classXII?: AcademicRecord;
  graduation?: GraduationRecord;
  competitiveExams?: CompetitiveExamEntry[];
  declarationAccepted?: boolean;
  program?: string;
  streamPreferences?: string[];
  department: DepartmentType;
  qualifyingExam: string;
  passingYear: number;
  percentage: number;
  documents: ApplicationDocument[];
  payment?: PaymentSummary;
  submittedAt?: string;
  status: ApplicationStatus;
  adminRemarks?: string;
  statusHistory?: StatusHistoryEntry[];
  /** Admin responses only: statuses the admin may move this application to */
  allowedTransitions?: ApplicationStatus[];
  createdAt: string;
  updatedAt: string;
}

/** Row in the admin list (subset of fields) */
export type ApplicationListItem = Pick<
  Application,
  '_id' | 'applicationId' | 'fullName' | 'email' | 'phone' | 'program' | 'department' | 'streamPreferences' | 'percentage' | 'status' | 'payment' | 'submittedAt' | 'createdAt'
>;

export interface AdminStats {
  total: number;
  byStatus: { _id: ApplicationStatus; count: number }[];
  byDepartment: { _id: DepartmentType; count: number }[];
  feesCollected: number;
  paidCount: number;
}

export interface AdminOverview {
  year: number;
  /** Applications started per month (Jan..Dec) */
  monthly: number[];
  recent: ApplicationListItem[];
  years: number[];
}

export interface PaymentRecord {
  orderId: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  paymentId: string;
  method: string;
  failureReason: string;
  attempts: number;
  paidAt?: string;
  createdAt: string;
}

export interface NotificationRecord {
  _id: string;
  type: string;
  to: string;
  subject: string;
  status: 'Pending' | 'Sent' | 'Failed';
  attempts: number;
  lastError: string;
  transport: string;
  attachments: { filename: string; size: number }[];
  createdAt: string;
}

export interface AuditEntry {
  _id: string;
  application?: { _id: string; applicationId?: string; fullName: string } | null;
  actorRole: 'applicant' | 'admin' | 'system';
  action: string;
  fromStatus?: string;
  toStatus?: string;
  details: string;
  createdAt: string;
}

export interface ApplicationDetail {
  application: Application;
  payments: PaymentRecord[];
  notifications: NotificationRecord[];
  auditLog: AuditEntry[];
}

export interface PaymentOrder {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  mode: 'mock' | 'live';
}

export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
