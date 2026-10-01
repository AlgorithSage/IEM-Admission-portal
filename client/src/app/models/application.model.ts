export type ApplicationStatus = 'Submitted' | 'Review' | 'Selected' | 'Rejected';
export type DepartmentType = 'B.Tech' | 'M.Tech' | 'MBA' | 'MCA' | 'BBA';

export interface DocumentReference {
  fileName: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
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
  applicant: string | { _id: string; name: string; email: string };
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  department: DepartmentType;
  qualifyingExam: string;
  passingYear: number;
  percentage: number;
  document: DocumentReference;
  schemaVersion?: number;
  submissionVersion?: number;
  status: ApplicationStatus;
  adminRemarks?: string;
  statusHistory?: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  total: number;
  byStatus: { _id: ApplicationStatus; count: number }[];
  byDepartment: { _id: DepartmentType; count: number }[];
}
