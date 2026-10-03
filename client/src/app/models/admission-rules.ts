// Admission form boundary values (BVA).
// Programs, streams and exams come from program-catalogue.json, shared with the server
// (server/config/program-catalogue.json). Edit the server copy, then run `npm run sync:catalogue`.
import catalogue from './program-catalogue.json';

export type CompetitiveExamCode = 'IEMJEE' | 'JEE_MAIN' | 'WBJEE' | 'IEMCET' | 'CAT' | 'MAT';

export interface Range {
  min: number;
  max: number;
}

export interface CompetitiveExamRule {
  code: CompetitiveExamCode;
  label: string;
  conductedBy: string;
  /** null when the exam publishes no rank (CAT, MAT) */
  rank: Range | null;
  /** Marks, percentile or composite score; may be negative where negative marking applies */
  score: Range & { label: string };
}

export const COMPETITIVE_EXAMS: CompetitiveExamRule[] = Object.entries(catalogue.exams).map(([code, rule]) => ({
  code: code as CompetitiveExamCode,
  ...(rule as Omit<CompetitiveExamRule, 'code'>)
}));

export const CATEGORIES = ['General', 'EWS', 'OBC-A', 'OBC-B', 'SC', 'ST'] as const;

export const CLASS_XII_STREAMS = [
  'Science (PCM)',
  'Science (PCMB)',
  'Science (PCB)',
  'Commerce',
  'Arts / Humanities'
] as const;

export type DepartmentCode = 'B.Tech' | 'M.Tech' | 'MBA' | 'MCA' | 'BBA' | 'BCA' | 'BHM' | 'BBA LLB';

export interface StreamEligibility {
  classX: number;
  classXII: number;
  pcm?: number;
  graduation?: number;
  maxGapYears?: number;
  classXIISubject?: boolean;
}

export interface StreamOption {
  name: string;
  department: DepartmentCode;
  durationYears: number;
  entrance: string;
  eligibility: StreamEligibility;
  fees: { firstSemester: number; laterSemester: number; total: number; booking?: string };
}

export interface ProgramRule {
  name: string;
  maxPreferences: number;
  exams: CompetitiveExamCode[];
  requiresPcmStream?: boolean;
  streams: StreamOption[];
}

export const ADMISSION_YEAR: number = catalogue.admissionYear;
export const PCM_STREAMS: string[] = catalogue.pcmStreams;
export const DEPARTMENTS = catalogue.departments as DepartmentCode[];
export const PROGRAMS = catalogue.programs as unknown as ProgramRule[];

export const streamRequiresGraduation = (stream: StreamOption): boolean => stream.eligibility.graduation !== undefined;

export interface ApplicantScores {
  classXIIStream?: string;
  classXPercentage?: number;
  classXIIPercentage?: number;
  pcmPercentage?: number;
  classXIIYear?: number;
  classXIIMathOrComputer?: boolean;
  graduationPercentage?: number;
}

/**
 * Reasons an applicant is not eligible for a stream (empty = eligible).
 * Mirrors checkStreamEligibility in server/config/admission.rules.js.
 */
export function checkStreamEligibility(program: ProgramRule, stream: StreamOption, a: ApplicantScores): string[] {
  const e = stream.eligibility;
  const reasons: string[] = [];
  if (program.requiresPcmStream && !PCM_STREAMS.includes(a.classXIIStream || '')) {
    reasons.push(`Class XII in ${PCM_STREAMS.join(' or ')}`);
  }
  if (a.classXPercentage !== undefined && a.classXPercentage < e.classX) reasons.push(`Class X ${e.classX}%`);
  if (a.classXIIPercentage !== undefined && a.classXIIPercentage < e.classXII) reasons.push(`Class XII ${e.classXII}%`);
  if (e.pcm !== undefined && !((a.pcmPercentage ?? -1) >= e.pcm)) reasons.push(`PCM ${e.pcm}%`);
  if (e.graduation !== undefined && !((a.graduationPercentage ?? -1) >= e.graduation)) reasons.push(`Graduation ${e.graduation}%`);
  if (e.maxGapYears !== undefined && a.classXIIYear !== undefined && ADMISSION_YEAR - a.classXIIYear > e.maxGapYears) {
    reasons.push(`Class XII passed in ${ADMISSION_YEAR - e.maxGapYears} or later (max ${e.maxGapYears}-year gap)`);
  }
  if (e.classXIISubject && !a.classXIIMathOrComputer) {
    reasons.push('Maths / Business Maths / Computer Application / Computer Science in Class XII');
  }
  return reasons;
}

export const BOARDS =['CBSE', 'CISCE (ICSE / ISC)', 'WBBSE', 'WBCHSE', 'NIOS', 'Other State Board'] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Lakshadweep'
] as const;

export const ACADEMIC_RULES = {
  classX: { percentage: { min: 33, max: 100 }, year: { min: 2013, max: 2024 } },
  classXII: { percentage: { min: 45, max: 100 }, year: { min: 2018, max: 2026 } },
  graduation: { percentage: { min: 0, max: 100 }, year: { min: 2018, max: 2026 } },
  examYear: { min: 2018, max: 2026 },
  minYearGap: 2,
  minGraduationGap: 3
};
