import { Injectable } from '@angular/core';

export interface ValidationFeedback {
  isValid: boolean;
  message: string;
  rule: string;
  severity: 'error' | 'success' | 'none';
}

@Injectable({
  providedIn: 'root'
})
export class BvaValidatorService {
  /**
   * Email Equivalence Partitioning & Boundary Analysis
   */
  validateEmail(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Email address is required.', rule: 'Required', severity: 'error' };
    }
    const email = val.trim();

    if (!email.includes('@')) {
      return {
        isValid: false,
        message: 'Missing "@" character. Email format must be "username@domain.com".',
        rule: 'BVA: @ Delimiter',
        severity: 'error'
      };
    }

    const parts = email.split('@');
    if (parts.length > 2) {
      return {
        isValid: false,
        message: 'Multiple "@" symbols detected. Only one "@" is permitted.',
        rule: 'EP: Single Delimiter',
        severity: 'error'
      };
    }

    const localPart = parts[0];
    const domainPart = parts[1];

    if (!localPart || localPart.length === 0) {
      return {
        isValid: false,
        message: 'Username prefix before "@" cannot be empty.',
        rule: 'BVA: Local-part > 0',
        severity: 'error'
      };
    }

    if (!domainPart || domainPart.length === 0) {
      return {
        isValid: false,
        message: 'Domain name missing after "@" (e.g. gmail.com, iem.edu.in).',
        rule: 'EP: Domain Required',
        severity: 'error'
      };
    }

    if (!domainPart.includes('.')) {
      return {
        isValid: false,
        message: 'Domain must include an extension (e.g. ".com", ".in", ".edu").',
        rule: 'BVA: TLD Delimiter',
        severity: 'error'
      };
    }

    const domainParts = domainPart.split('.');
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) {
      return {
        isValid: false,
        message: `Top-level domain ".${tld}" too short. Must be at least 2 characters (e.g. .in, .com).`,
        rule: 'BVA: TLD >= 2 chars',
        severity: 'error'
      };
    }

    const standardRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!standardRegex.test(email)) {
      return {
        isValid: false,
        message: 'Invalid characters or spacing in email address.',
        rule: 'EP: Character Whitelist',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid institutional / personal email format.',
      rule: 'EP: Valid Partition',
      severity: 'success'
    };
  }

  /**
   * Full Name Equivalence Partitioning & BVA (2 <= length <= 60)
   */
  validateFullName(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Full name is required.', rule: 'Required', severity: 'error' };
    }
    const name = val.trim();

    if (name.length < 2) {
      return {
        isValid: false,
        message: `Name too short: must be at least 2 characters (currently ${name.length}).`,
        rule: 'BVA: Length >= 2',
        severity: 'error'
      };
    }

    if (name.length > 60) {
      return {
        isValid: false,
        message: `Name too long: cannot exceed 60 characters (currently ${name.length}).`,
        rule: 'BVA: Length <= 60',
        severity: 'error'
      };
    }

    if (/\d/.test(name)) {
      return {
        isValid: false,
        message: 'Name cannot contain numerical digits.',
        rule: 'EP: Alphabetic Only',
        severity: 'error'
      };
    }

    if (/[^a-zA-Z\s.'-]/.test(name)) {
      return {
        isValid: false,
        message: 'Name cannot contain special symbols.',
        rule: 'EP: Alphabetic Only',
        severity: 'error'
      };
    }

    const words = name.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) {
      return {
        isValid: false,
        message: 'Please provide both First Name and Surname (e.g. Aarav Sharma).',
        rule: 'EP: Multi-word Name',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid full candidate name.',
      rule: 'EP: Valid Partition',
      severity: 'success'
    };
  }

  /**
   * Phone Number BVA (10 digits Indian telecom standard)
   */
  validatePhone(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Mobile number is required.', rule: 'Required', severity: 'error' };
    }
    const raw = val.trim();

    if (/[a-zA-Z]/.test(raw)) {
      return {
        isValid: false,
        message: 'Phone number cannot contain alphabetic letters.',
        rule: 'EP: Digits Only',
        severity: 'error'
      };
    }

    // Strip +91, spaces, hyphens
    let clean = raw.replace(/^(\+91|91)/, '').replace(/[\s-]/g, '');

    if (clean.length < 10) {
      return {
        isValid: false,
        message: `Phone number incomplete: exactly 10 digits required (currently ${clean.length} of 10).`,
        rule: 'BVA: Length == 10',
        severity: 'error'
      };
    }

    if (clean.length > 10) {
      return {
        isValid: false,
        message: `Phone number too long: cannot exceed 10 digits (currently ${clean.length}).`,
        rule: 'BVA: Length <= 10',
        severity: 'error'
      };
    }

    if (!/^[6-9]/.test(clean)) {
      return {
        isValid: false,
        message: 'Indian mobile numbers must begin with digits 6, 7, 8, or 9.',
        rule: 'EP: Telecom Standard',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid 10-digit mobile number (+91 accepted).',
      rule: 'EP: Valid Partition',
      severity: 'success'
    };
  }

  /**
   * Password BVA (Min 6, Max 32)
   */
  validatePassword(val: string): ValidationFeedback {
    if (!val) {
      return { isValid: false, message: 'Password is required.', rule: 'Required', severity: 'error' };
    }

    if (val.length < 6) {
      return {
        isValid: false,
        message: `Password too short: minimum 6 characters required (currently ${val.length} of 6).`,
        rule: 'BVA: Min >= 6',
        severity: 'error'
      };
    }

    if (val.length > 32) {
      return {
        isValid: false,
        message: `Password exceeds maximum allowed boundary of 32 characters (currently ${val.length}).`,
        rule: 'BVA: Max <= 32',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: `Valid password security strength (${val.length} chars).`,
      rule: 'EP: Valid Partition',
      severity: 'success'
    };
  }

  /**
   * Confirm Password Match Check
   */
  validateConfirmPassword(pass: string, confirm: string): ValidationFeedback {
    if (!confirm) {
      return { isValid: false, message: 'Please re-type your password.', rule: 'Required', severity: 'error' };
    }

    if (pass !== confirm) {
      return {
        isValid: false,
        message: 'Passwords do not match.',
        rule: 'EP: Equality Mismatch',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Passwords match perfectly.',
      rule: 'EP: Valid Match',
      severity: 'success'
    };
  }

  /**
   * Academic Percentage BVA (45.0% <= score <= 100.0%)
   */
  validatePercentage(val: any): ValidationFeedback {
    if (val === null || val === undefined || val === '') {
      return { isValid: false, message: 'Percentage / CGPA is required.', rule: 'Required', severity: 'error' };
    }

    const num = Number(val);
    if (isNaN(num)) {
      return {
        isValid: false,
        message: 'Percentage must be a valid numerical value.',
        rule: 'EP: Numeric Type',
        severity: 'error'
      };
    }

    if (num < 0) {
      return {
        isValid: false,
        message: 'Percentage cannot be negative (boundary error).',
        rule: 'BVA: Lower Bound >= 0',
        severity: 'error'
      };
    }

    if (num < 45.0) {
      return {
        isValid: false,
        message: `Eligibility Cutoff Error: Minimum 45.0% required for IEM admission eligibility (entered ${num}%).`,
        rule: 'BVA: AICTE Cutoff >= 45.0%',
        severity: 'error'
      };
    }

    if (num > 100.0) {
      return {
        isValid: false,
        message: `Percentage cannot exceed 100.0% (entered ${num}% exceeds upper boundary).`,
        rule: 'BVA: Upper Bound <= 100.0%',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: `Eligible academic percentage (${num}%).`,
      rule: 'EP: Eligible Partition',
      severity: 'success'
    };
  }

  /**
   * Passing Year BVA (2018 <= Year <= 2026)
   */
  validatePassingYear(val: any): ValidationFeedback {
    if (!val) {
      return { isValid: false, message: 'Passing year is required.', rule: 'Required', severity: 'error' };
    }

    const year = Number(val);
    if (isNaN(year)) {
      return { isValid: false, message: 'Passing year must be a 4-digit number.', rule: 'EP: Numeric', severity: 'error' };
    }

    if (year < 2018) {
      return {
        isValid: false,
        message: `Passing year ${year} is outside the eligible window (must be 2018 or later).`,
        rule: 'BVA: Year >= 2018',
        severity: 'error'
      };
    }

    if (year > 2026) {
      return {
        isValid: false,
        message: `Passing year cannot be in the future (cannot exceed 2026).`,
        rule: 'BVA: Year <= 2026',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: `Eligible qualifying examination passing year (${year}).`,
      rule: 'EP: Valid Partition',
      severity: 'success'
    };
  }

  /**
   * Date of Birth BVA (16 <= Age <= 35)
   */
  validateDob(val: string): ValidationFeedback {
    if (!val) {
      return { isValid: false, message: 'Date of birth is required.', rule: 'Required', severity: 'error' };
    }

    const birthDate = new Date(val);
    const today = new Date();

    if (isNaN(birthDate.getTime())) {
      return { isValid: false, message: 'Invalid calendar date format.', rule: 'EP: Date Format', severity: 'error' };
    }

    if (birthDate > today) {
      return {
        isValid: false,
        message: 'Date of birth cannot be in the future.',
        rule: 'EP: Temporal Boundary',
        severity: 'error'
      };
    }

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 16) {
      return {
        isValid: false,
        message: `Applicant age (${age} years) is below minimum eligibility boundary of 16 years.`,
        rule: 'BVA: Age >= 16',
        severity: 'error'
      };
    }

    if (age > 35) {
      return {
        isValid: false,
        message: `Applicant age (${age} years) exceeds maximum undergraduate/postgraduate limit of 35 years.`,
        rule: 'BVA: Age <= 35',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: `Eligible candidate age: ${age} years.`,
      rule: 'EP: Valid Age Partition',
      severity: 'success'
    };
  }

  /**
   * Address BVA (10 <= length <= 200)
   */
  validateAddress(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Permanent address is required.', rule: 'Required', severity: 'error' };
    }
    const clean = val.trim();

    if (clean.length < 10) {
      return {
        isValid: false,
        message: `Address too brief: minimum 10 characters required including street/city (currently ${clean.length} chars).`,
        rule: 'BVA: Length >= 10',
        severity: 'error'
      };
    }

    if (clean.length > 200) {
      return {
        isValid: false,
        message: `Address exceeds maximum boundary of 200 characters (currently ${clean.length} chars).`,
        rule: 'BVA: Length <= 200',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Sufficiently detailed communication address.',
      rule: 'EP: Valid Partition',
      severity: 'success'
    };
  }

  /**
   * Document File BVA (0 < size <= 5.0 MB, Whitelist MIME)
   */
  validateFile(file: File | null): ValidationFeedback {
    if (!file) {
      return { isValid: false, message: 'Marksheet document file is mandatory.', rule: 'Required', severity: 'error' };
    }

    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExt = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!allowedMime.includes(file.type) && !allowedExt.includes(ext || '')) {
      return {
        isValid: false,
        message: `Disallowed file format (.${ext}). Only PDF (.pdf) and Image (.jpg, .png) are permitted.`,
        rule: 'EP: Whitelist MIME Filter',
        severity: 'error'
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        message: 'Empty file detected (0 bytes). Please upload a valid document.',
        rule: 'BVA: File Size > 0',
        severity: 'error'
      };
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        message: `File size boundary overflow: ${sizeMB} MB exceeds maximum permitted limit of 5.0 MB.`,
        rule: 'BVA: Max Size <= 5.0MB',
        severity: 'error'
      };
    }

    const sizeKB = (file.size / 1024).toFixed(1);
    return {
      isValid: true,
      message: `Valid document format (.${ext}, ${sizeKB} KB). Ready for submission.`,
      rule: 'EP: Valid File Partition',
      severity: 'success'
    };
  }
}
