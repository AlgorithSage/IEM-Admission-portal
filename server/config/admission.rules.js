// Single source of truth for admission form boundary values (BVA).
// Programs, streams and exams live in program-catalogue.json (copied to the client via npm run sync:catalogue).

const CATALOGUE = require('./program-catalogue.json');

// Entrance exams: rank range (null when the exam publishes no rank, e.g. CAT/MAT) and score range.
// Scores may be negative where negative marking applies. Each program lists the exams it accepts.
const COMPETITIVE_EXAMS = CATALOGUE.exams;

const EXAM_CODES = Object.keys(COMPETITIVE_EXAMS);

const CATEGORIES = ['General', 'EWS', 'OBC-A', 'OBC-B', 'SC', 'ST'];
const GENDERS = ['Male', 'Female', 'Other'];

// Department = reporting bucket used by admin filters and aggregation stats
const DEPARTMENTS = CATALOGUE.departments;
const ADMISSION_YEAR = CATALOGUE.admissionYear;
// Application fee in rupees, charged once before an application ID is issued
const APPLICATION_FEE = CATALOGUE.applicationFee;
const CLASS_XII_STREAMS = ['Science (PCM)', 'Science (PCMB)', 'Science (PCB)', 'Commerce', 'Arts / Humanities'];
const PCM_STREAMS = CATALOGUE.pcmStreams;

// "Institute / Applying For" programs keyed by name; each stream carries its own
// department, entrance route, fees and minimum eligibility (from IEM admission criteria)
const PROGRAMS = Object.fromEntries(CATALOGUE.programs.map((p) => [p.name, p]));

const streamRequiresGraduation = (stream) => stream.eligibility.graduation !== undefined;

/**
 * Returns the reasons an applicant is not eligible for a stream (empty array = eligible).
 * Mirrored on the client in admission-rules.ts (checkStreamEligibility).
 */
const checkStreamEligibility = (program, stream, a) => {
  const e = stream.eligibility;
  const reasons = [];
  if (program.requiresPcmStream && !PCM_STREAMS.includes(a.classXIIStream)) {
    reasons.push(`Class XII in ${PCM_STREAMS.join(' or ')}`);
  }
  if (a.classXPercentage !== undefined && a.classXPercentage < e.classX) reasons.push(`Class X ${e.classX}%`);
  if (a.classXIIPercentage !== undefined && a.classXIIPercentage < e.classXII) reasons.push(`Class XII ${e.classXII}%`);
  if (e.pcm !== undefined && !(a.pcmPercentage >= e.pcm)) reasons.push(`PCM ${e.pcm}%`);
  if (e.graduation !== undefined && !(a.graduationPercentage >= e.graduation)) reasons.push(`Graduation ${e.graduation}%`);
  if (e.maxGapYears !== undefined && a.classXIIYear !== undefined && ADMISSION_YEAR - a.classXIIYear > e.maxGapYears) {
    reasons.push(`Class XII passed in ${ADMISSION_YEAR - e.maxGapYears} or later (max ${e.maxGapYears}-year gap)`);
  }
  if (e.classXIISubject && !a.classXIIMathOrComputer) {
    reasons.push('Maths / Business Maths / Computer Application / Computer Science in Class XII');
  }
  return reasons;
};

const ACADEMIC = {
  classX: { percentage: { min: 33, max: 100 }, year: { min: 2013, max: 2024 } },
  graduation: { percentage: { min: 0, max: 100 }, year: { min: 2018, max: 2026 } },
  // A graduation degree takes at least three years after Class XII
  minGraduationGap: 3,
  classXII: { percentage: { min: 45, max: 100 }, year: { min: 2018, max: 2026 } },
  // Class X must precede Class XII by at least two years
  minYearGap: 2
};


module.exports = {
  COMPETITIVE_EXAMS,
  EXAM_CODES,
  CATEGORIES,
  GENDERS,
  DEPARTMENTS,
  ADMISSION_YEAR,
  APPLICATION_FEE,
  PROGRAMS,
  PCM_STREAMS,
  CLASS_XII_STREAMS,
  streamRequiresGraduation,
  checkStreamEligibility,
  ACADEMIC,
};
