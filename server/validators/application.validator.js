const {
  COMPETITIVE_EXAMS,
  EXAM_CODES,
  CATEGORIES,
  GENDERS,
  DEPARTMENTS,
  PROGRAMS,
  CLASS_XII_STREAMS,
  streamRequiresGraduation,
  checkStreamEligibility,
  ACADEMIC
} = require('../config/admission.rules');

// Nested sections arrive as JSON strings inside multipart/form-data
const parseJsonField = (raw, fallback) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const str = (v) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim());

const NAME_RE = /^[a-zA-Z][a-zA-Z\s.'-]{1,59}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PIN_RE = /^[1-9]\d{5}$/;
const DECIMAL_2DP_RE = /^-?\d+(\.\d{1,2})?$/;

const normalizePhone = (v) => str(v).replace(/^(\+91|91)/, '').replace(/[\s-]/g, '');

const ageOn = (dob, today = new Date()) => {
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

const checkRange = (errors, label, raw, { min, max }, { integer = false, decimal2 = false } = {}) => {
  const s = str(raw);
  if (s === '') {
    errors.push(`${label} is required.`);
    return undefined;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    errors.push(`${label} must be a number.`);
    return undefined;
  }
  if (integer && !Number.isInteger(n)) {
    errors.push(`${label} must be a whole number.`);
    return undefined;
  }
  if (decimal2 && !DECIMAL_2DP_RE.test(s)) {
    errors.push(`${label} allows at most 2 decimal places.`);
    return undefined;
  }
  if (n < min || n > max) {
    errors.push(`${label} must be between ${min} and ${max} (got ${n}).`);
    return undefined;
  }
  return n;
};

/**
 * Validates and normalizes an admission application payload.
 * @returns {{ errors: string[], data: object }}
 */
const validateApplication = (body) => {
  const errors = [];

  // ---- Personal ----
  const fullName = str(body.fullName);
  if (!NAME_RE.test(fullName) || fullName.split(/\s+/).length < 2) {
    errors.push('Full name must contain first name and surname (letters only, max 60 characters).');
  }

  const email = str(body.email).toLowerCase();
  if (!EMAIL_RE.test(email)) errors.push('A valid email address is required.');

  const phone = normalizePhone(body.phone);
  if (!PHONE_RE.test(phone)) errors.push('Mobile number must be 10 digits starting with 6-9.');

  const alternatePhone = normalizePhone(body.alternatePhone);
  if (alternatePhone && !PHONE_RE.test(alternatePhone)) {
    errors.push('Alternate mobile number must be 10 digits starting with 6-9.');
  } else if (alternatePhone && alternatePhone === phone) {
    errors.push('Alternate mobile number must be different from the mobile number.');
  }

  const dob = str(body.dob);
  const dobDate = new Date(dob);
  if (!dob || Number.isNaN(dobDate.getTime())) {
    errors.push('A valid date of birth is required.');
  } else {
    const age = ageOn(dobDate);
    if (age < 16 || age > 35) errors.push(`Applicant age must be between 16 and 35 (currently ${age}).`);
  }

  const gender = str(body.gender);
  if (!GENDERS.includes(gender)) errors.push('Gender selection is invalid.');

  const category = str(body.category);
  if (!CATEGORIES.includes(category)) errors.push('Reservation category selection is invalid.');

  const nationality = str(body.nationality) || 'Indian';
  if (nationality.length > 40) errors.push('Nationality cannot exceed 40 characters.');

  // ---- Address ----
  const address = str(body.address);
  if (address.length < 10 || address.length > 200) errors.push('Address must be 10-200 characters.');
  const city = str(body.city);
  if (city.length < 2 || city.length > 50) errors.push('City is required.');
  const state = str(body.state);
  if (state.length < 2 || state.length > 50) errors.push('State is required.');
  const pincode = str(body.pincode);
  if (!PIN_RE.test(pincode)) errors.push('PIN code must be a valid 6-digit number.');

  // ---- Parents / Guardian ----
  const parentsRaw = parseJsonField(body.parents, {});
  if (parentsRaw === undefined) errors.push('Parent details payload is malformed.');
  const p = parentsRaw || {};
  const parents = {
    fatherName: str(p.fatherName),
    fatherPhone: normalizePhone(p.fatherPhone),
    fatherOccupation: str(p.fatherOccupation),
    motherName: str(p.motherName),
    motherPhone: normalizePhone(p.motherPhone),
    motherOccupation: str(p.motherOccupation),
    guardianName: str(p.guardianName),
    guardianRelation: str(p.guardianRelation),
    guardianPhone: normalizePhone(p.guardianPhone)
  };
  if (!NAME_RE.test(parents.fatherName)) errors.push("Father's name is required (letters only).");
  if (!NAME_RE.test(parents.motherName)) errors.push("Mother's name is required (letters only).");
  if (!PHONE_RE.test(parents.fatherPhone) && !PHONE_RE.test(parents.motherPhone)) {
    errors.push("At least one parent contact number (father's or mother's) is required.");
  }
  if (parents.fatherPhone && !PHONE_RE.test(parents.fatherPhone)) errors.push("Father's contact number is invalid.");
  if (parents.motherPhone && !PHONE_RE.test(parents.motherPhone)) errors.push("Mother's contact number is invalid.");
  if (parents.guardianPhone && !PHONE_RE.test(parents.guardianPhone)) errors.push("Guardian's contact number is invalid.");
  if (parents.guardianName && !NAME_RE.test(parents.guardianName)) errors.push("Guardian's name is invalid.");

  // ---- Class X ----
  const xRaw = parseJsonField(body.classX, {}) || {};
  const classX = {
    board: str(xRaw.board),
    school: str(xRaw.school),
    passingYear: checkRange(errors, 'Class X passing year', xRaw.passingYear, ACADEMIC.classX.year, { integer: true }),
    percentage: checkRange(errors, 'Class X percentage', xRaw.percentage, ACADEMIC.classX.percentage, { decimal2: true })
  };
  if (classX.board.length < 2) errors.push('Class X board is required.');
  if (classX.school.length < 2) errors.push('Class X school name is required.');

  // ---- Class XII ----
  const xiiRaw = parseJsonField(body.classXII, {}) || {};
  const classXII = {
    board: str(xiiRaw.board),
    school: str(xiiRaw.school),
    stream: str(xiiRaw.stream),
    passingYear: checkRange(errors, 'Class XII passing year', xiiRaw.passingYear, ACADEMIC.classXII.year, { integer: true }),
    percentage: checkRange(errors, 'Class XII percentage', xiiRaw.percentage, ACADEMIC.classXII.percentage, { decimal2: true }),
    pcmPercentage: undefined,
    // Maths / Business Maths / Computer Application / Computer Science studied in Class XII (BCA criterion)
    mathOrComputer: xiiRaw.mathOrComputer === true || xiiRaw.mathOrComputer === 'true'
  };
  if (classXII.board.length < 2) errors.push('Class XII board is required.');
  if (classXII.school.length < 2) errors.push('Class XII school name is required.');
  if (!CLASS_XII_STREAMS.includes(classXII.stream)) errors.push('Class XII stream selection is invalid.');
  if (str(xiiRaw.pcmPercentage) !== '') {
    classXII.pcmPercentage = checkRange(errors, 'Class XII PCM percentage', xiiRaw.pcmPercentage, { min: 0, max: 100 }, { decimal2: true });
  }
  if (
    classX.passingYear !== undefined &&
    classXII.passingYear !== undefined &&
    classXII.passingYear - classX.passingYear < ACADEMIC.minYearGap
  ) {
    errors.push(`Class XII passing year must be at least ${ACADEMIC.minYearGap} years after Class X.`);
  }

  // ---- Program (needed first: it decides which entrance exams are accepted) ----
  const program = str(body.program);
  const programRules = PROGRAMS[program];

  // ---- Competitive Exams (at least one accepted by the program, each at most once) ----
  const examsRaw = parseJsonField(body.competitiveExams, []);
  const competitiveExams = [];
  const accepted = programRules ? programRules.exams : [];
  const acceptedLabels = accepted.map((code) => COMPETITIVE_EXAMS[code].label).join(', ');
  if (!Array.isArray(examsRaw) || examsRaw.length === 0) {
    if (programRules) errors.push(`Provide details for at least one entrance exam (${acceptedLabels}).`);
  } else {
    const seen = new Set();
    examsRaw.forEach((e) => {
      const exam = str(e && e.exam);
      const rules = COMPETITIVE_EXAMS[exam];
      if (!rules) {
        errors.push(`Unknown competitive exam "${exam}".`);
        return;
      }
      if (programRules && !accepted.includes(exam)) {
        errors.push(`${rules.label} is not accepted for ${program} (accepted: ${acceptedLabels}).`);
        return;
      }
      if (seen.has(exam)) {
        errors.push(`${rules.label} details were provided more than once.`);
        return;
      }
      seen.add(exam);
      // Stored as rollNumber for compatibility; it holds the exam's application number
      const rollNumber = str(e.rollNumber);
      if (!new RegExp(rules.applicationNo.pattern).test(rollNumber)) {
        errors.push(`${rules.label} application number: ${rules.applicationNo.hint}`);
      }
      competitiveExams.push({
        exam,
        rollNumber,
        year: checkRange(errors, `${rules.label} exam year`, e.year, { min: 2018, max: 2026 }, { integer: true }),
        rank: rules.rank ? checkRange(errors, `${rules.label} rank`, e.rank, rules.rank, { integer: true }) : undefined,
        score: checkRange(errors, `${rules.label} ${rules.score.label.toLowerCase()}`, e.score, rules.score, { decimal2: true })
      });
    });
  }

  // ---- Stream preferences ----
  let streamPreferences = [];
  let department = '';
  let graduation;
  if (!programRules) {
    errors.push('Please select the program you are applying for.');
  } else {
    const prefsRaw = parseJsonField(body.streamPreferences, []);
    streamPreferences = Array.isArray(prefsRaw) ? prefsRaw.map(str).filter(Boolean) : [];
    const chosen = streamPreferences.map((name) => programRules.streams.find((s) => s.name === name));

    if (streamPreferences.length === 0) {
      errors.push(`Select at least one stream for ${program}.`);
    } else if (streamPreferences.length > programRules.maxPreferences) {
      errors.push(`${program} allows at most ${programRules.maxPreferences} stream preference(s).`);
    } else if (new Set(streamPreferences).size !== streamPreferences.length) {
      errors.push('Each stream preference must be different.');
    } else if (chosen.some((s) => !s)) {
      errors.push(`Stream "${streamPreferences[chosen.findIndex((s) => !s)]}" is not offered under ${program}.`);
    } else {
      department = chosen[0].department;

      // ---- Graduation (postgraduate streams only) ----
      if (chosen.some(streamRequiresGraduation)) {
        const gRaw = parseJsonField(body.graduation, {}) || {};
        graduation = {
          degree: str(gRaw.degree),
          university: str(gRaw.university),
          passingYear: checkRange(errors, 'Graduation passing year', gRaw.passingYear, ACADEMIC.graduation.year, { integer: true }),
          percentage: checkRange(errors, 'Graduation percentage', gRaw.percentage, ACADEMIC.graduation.percentage, { decimal2: true })
        };
        if (graduation.degree.length < 2 || graduation.degree.length > 60) errors.push('Graduation degree is required (e.g. B.Tech, B.Sc, BCA).');
        if (graduation.university.length < 2 || graduation.university.length > 100) errors.push('Graduation university / college is required.');
        if (
          graduation.passingYear !== undefined &&
          classXII.passingYear !== undefined &&
          graduation.passingYear - classXII.passingYear < ACADEMIC.minGraduationGap
        ) {
          errors.push(`Graduation must be completed at least ${ACADEMIC.minGraduationGap} years after Class XII.`);
        }
      }

      // ---- Eligibility per preferred stream (IEM admission criteria) ----
      const applicant = {
        classXIIStream: classXII.stream,
        classXPercentage: classX.percentage,
        classXIIPercentage: classXII.percentage,
        pcmPercentage: classXII.pcmPercentage,
        classXIIYear: classXII.passingYear,
        classXIIMathOrComputer: classXII.mathOrComputer,
        graduationPercentage: graduation && graduation.percentage
      };
      chosen.forEach((stream) => {
        const reasons = checkStreamEligibility(programRules, stream, applicant);
        if (reasons.length) errors.push(`Not eligible for ${stream.name}: requires ${reasons.join(', ')}.`);
      });
    }
  }
  if (department && !DEPARTMENTS.includes(department)) errors.push('Program configuration error.');

  const declaration = str(body.declaration) === 'true';
  if (!declaration) errors.push('You must accept the declaration before submitting.');

  return {
    errors,
    data: {
      fullName,
      email,
      phone,
      alternatePhone,
      dob,
      gender,
      category,
      nationality,
      address,
      city,
      state,
      pincode,
      parents,
      classX,
      classXII,
      graduation,
      competitiveExams,
      program,
      streamPreferences,
      department,
      declaration
    }
  };
};

module.exports = { validateApplication, EXAM_CODES };
