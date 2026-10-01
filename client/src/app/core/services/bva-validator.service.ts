import { Injectable } from '@angular/core';

export interface ValidationFeedback {
  isValid: boolean;
  message: string;
  rule: string;
  severity: 'error' | 'success' | 'none';
}

export interface PasswordStrength {
  score: number;
  label: 'Weak' | 'Intermediate' | 'Strong' | '';
  cssClass: string;
  percent: number;
}

@Injectable({
  providedIn: 'root'
})
export class BvaValidatorService {
  /**
   * Email Validation
   */
  validateEmail(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Email address is required.', rule: 'Required', severity: 'error' };
    }
    const email = val.trim();

    if (!email.includes('@')) {
      return {
        isValid: false,
        message: 'Please enter a valid email containing "@" (e.g. name@domain.com).',
        rule: 'Invalid Format',
        severity: 'error'
      };
    }

    const parts = email.split('@');
    if (parts.length > 2) {
      return {
        isValid: false,
        message: 'Only one "@" symbol is permitted.',
        rule: 'Invalid Format',
        severity: 'error'
      };
    }

    const localPart = parts[0];
    const domainPart = parts[1];

    if (!localPart || localPart.length === 0) {
      return {
        isValid: false,
        message: 'Username prefix before "@" cannot be empty.',
        rule: 'Invalid Format',
        severity: 'error'
      };
    }

    if (!domainPart || domainPart.length === 0) {
      return {
        isValid: false,
        message: 'Domain name missing after "@" (e.g. gmail.com, iem.edu.in).',
        rule: 'Missing Domain',
        severity: 'error'
      };
    }

    if (!domainPart.includes('.')) {
      return {
        isValid: false,
        message: 'Domain must include an extension (e.g. .com, .edu, .in).',
        rule: 'Missing Extension',
        severity: 'error'
      };
    }

    const domainParts = domainPart.split('.');
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) {
      return {
        isValid: false,
        message: `Extension ".${tld}" must be at least 2 characters (e.g. .com, .in).`,
        rule: 'Invalid Extension',
        severity: 'error'
      };
    }

    const standardRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!standardRegex.test(email)) {
      return {
        isValid: false,
        message: 'Invalid characters or spacing in email address.',
        rule: 'Invalid Characters',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid email address.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Full Name Validation (2 <= length <= 60, Multi-word)
   */
  validateFullName(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Full name is required.', rule: 'Required', severity: 'error' };
    }
    const name = val.trim();

    if (name.length < 2) {
      return {
        isValid: false,
        message: 'Name must be at least 2 characters long.',
        rule: 'Too Short',
        severity: 'error'
      };
    }

    if (name.length > 60) {
      return {
        isValid: false,
        message: 'Name cannot exceed 60 characters.',
        rule: 'Too Long',
        severity: 'error'
      };
    }

    if (/\d/.test(name)) {
      return {
        isValid: false,
        message: 'Name cannot contain numerical digits.',
        rule: 'Letters Only',
        severity: 'error'
      };
    }

    if (/[^a-zA-Z\s.'-]/.test(name)) {
      return {
        isValid: false,
        message: 'Name cannot contain special symbols.',
        rule: 'Letters Only',
        severity: 'error'
      };
    }

    const words = name.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) {
      return {
        isValid: false,
        message: 'Please provide both First Name and Surname (e.g. Aarav Sharma).',
        rule: 'Full Name Required',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid name.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Phone Number Validation (10 digits Indian telecom standard)
   */
  validatePhone(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Mobile number is required.', rule: 'Required', severity: 'error' };
    }
    const raw = val.trim();

    if (/[a-zA-Z]/.test(raw)) {
      return {
        isValid: false,
        message: 'Mobile number cannot contain letters.',
        rule: 'Digits Only',
        severity: 'error'
      };
    }

    let clean = raw.replace(/^(\+91|91)/, '').replace(/[\s-]/g, '');

    if (clean.length < 10) {
      return {
        isValid: false,
        message: `Mobile number incomplete: exactly 10 digits required (${clean.length} of 10).`,
        rule: '10 Digits Required',
        severity: 'error'
      };
    }

    if (clean.length > 10) {
      return {
        isValid: false,
        message: `Mobile number cannot exceed 10 digits (${clean.length} entered).`,
        rule: 'Max 10 Digits',
        severity: 'error'
      };
    }

    if (!/^[6-9]/.test(clean)) {
      return {
        isValid: false,
        message: 'Mobile number must begin with 6, 7, 8, or 9.',
        rule: 'Invalid Prefix',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid 10-digit mobile number.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Password Validation (Min 6, Max 32)
   */
  validatePassword(val: string): ValidationFeedback {
    if (!val) {
      return { isValid: false, message: 'Password is required.', rule: 'Required', severity: 'error' };
    }

    if (val.length < 6) {
      return {
        isValid: false,
        message: `Password too short: minimum 6 characters required (${val.length} of 6).`,
        rule: 'Min 6 Characters',
        severity: 'error'
      };
    }

    if (val.length > 32) {
      return {
        isValid: false,
        message: 'Password cannot exceed 32 characters.',
        rule: 'Max 32 Characters',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid password.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Password Strength Analysis (Weak, Intermediate, Strong)
   */
  evaluatePasswordStrength(password: string): PasswordStrength {
    if (!password) {
      return { score: 0, label: '', cssClass: '', percent: 0 };
    }

    let criteriaMet = 0;
    if (password.length >= 8) criteriaMet++;
    if (/[a-z]/.test(password)) criteriaMet++;
    if (/[A-Z]/.test(password)) criteriaMet++;
    if (/\d/.test(password)) criteriaMet++;
    if (/[^a-zA-Z0-9]/.test(password)) criteriaMet++;

    if (password.length < 6 || criteriaMet <= 2) {
      return {
        score: 1,
        label: 'Weak',
        cssClass: 'strength-weak',
        percent: 33
      };
    } else if (password.length >= 8 && criteriaMet >= 4) {
      return {
        score: 3,
        label: 'Strong',
        cssClass: 'strength-strong',
        percent: 100
      };
    } else {
      return {
        score: 2,
        label: 'Intermediate',
        cssClass: 'strength-intermediate',
        percent: 66
      };
    }
  }

  /**
   * Confirm Password Match Check
   */
  validateConfirmPassword(pass: string, confirm: string): ValidationFeedback {
    if (!confirm) {
      return { isValid: false, message: 'Please confirm your password.', rule: 'Required', severity: 'error' };
    }

    if (pass !== confirm) {
      return {
        isValid: false,
        message: 'Passwords do not match.',
        rule: 'Mismatch',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Passwords match.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Academic Percentage Validation (45.0% <= score <= 100.0%)
   */
  validatePercentage(val: any): ValidationFeedback {
    if (val === null || val === undefined || val === '') {
      return { isValid: false, message: 'Percentage / CGPA is required.', rule: 'Required', severity: 'error' };
    }

    const num = Number(val);
    if (isNaN(num)) {
      return {
        isValid: false,
        message: 'Please enter a valid numeric percentage.',
        rule: 'Numeric Required',
        severity: 'error'
      };
    }

    if (num < 0) {
      return {
        isValid: false,
        message: 'Percentage cannot be negative.',
        rule: 'Invalid Value',
        severity: 'error'
      };
    }

    if (num < 45.0) {
      return {
        isValid: false,
        message: `Minimum 45.0% aggregate required for admission eligibility (${num}% entered).`,
        rule: 'Min 45.0% Required',
        severity: 'error'
      };
    }

    if (num > 100.0) {
      return {
        isValid: false,
        message: 'Percentage cannot exceed 100.0%.',
        rule: 'Max 100%',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Eligible percentage.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Passing Year Validation (2018 <= Year <= 2026)
   */
  validatePassingYear(val: any): ValidationFeedback {
    if (!val) {
      return { isValid: false, message: 'Passing year is required.', rule: 'Required', severity: 'error' };
    }

    const year = Number(val);
    if (isNaN(year)) {
      return { isValid: false, message: 'Passing year must be a 4-digit year.', rule: 'Invalid Year', severity: 'error' };
    }

    if (year < 2018) {
      return {
        isValid: false,
        message: `Passing year must be 2018 or later (${year} entered).`,
        rule: 'Eligible: 2018+',
        severity: 'error'
      };
    }

    if (year > 2026) {
      return {
        isValid: false,
        message: 'Passing year cannot be in the future (up to 2026).',
        rule: 'Max Year: 2026',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid passing year.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Date of Birth Validation (16 <= Age <= 35)
   */
  validateDob(val: string): ValidationFeedback {
    if (!val) {
      return { isValid: false, message: 'Date of birth is required.', rule: 'Required', severity: 'error' };
    }

    const birthDate = new Date(val);
    const today = new Date();

    if (isNaN(birthDate.getTime())) {
      return { isValid: false, message: 'Please enter a valid date.', rule: 'Invalid Date', severity: 'error' };
    }

    if (birthDate > today) {
      return {
        isValid: false,
        message: 'Date of birth cannot be in the future.',
        rule: 'Invalid Date',
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
        message: `Applicant age must be at least 16 years (currently ${age} years).`,
        rule: 'Min Age 16',
        severity: 'error'
      };
    }

    if (age > 35) {
      return {
        isValid: false,
        message: `Applicant age cannot exceed 35 years (currently ${age} years).`,
        rule: 'Max Age 35',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Eligible age.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Address Validation (10 <= length <= 200)
   */
  validateAddress(val: string): ValidationFeedback {
    if (!val || val.trim() === '') {
      return { isValid: false, message: 'Permanent address is required.', rule: 'Required', severity: 'error' };
    }
    const clean = val.trim();

    if (clean.length < 10) {
      return {
        isValid: false,
        message: `Please provide a complete address with street/city (minimum 10 characters, currently ${clean.length}).`,
        rule: 'Too Brief',
        severity: 'error'
      };
    }

    if (clean.length > 200) {
      return {
        isValid: false,
        message: 'Address cannot exceed 200 characters.',
        rule: 'Too Long',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      message: 'Valid address.',
      rule: 'Valid',
      severity: 'success'
    };
  }

  /**
   * Document File Validation (0 < size <= 5.0 MB, Whitelist MIME)
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
        message: `Invalid format (.${ext}). Only PDF (.pdf) and Image files (.jpg, .png) are permitted.`,
        rule: 'Format Error',
        severity: 'error'
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        message: 'Empty file detected. Please upload a valid document.',
        rule: 'Empty File',
        severity: 'error'
      };
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        message: `File size (${sizeMB} MB) exceeds maximum permitted limit of 5.0 MB.`,
        rule: 'Max 5MB',
        severity: 'error'
      };
    }

    const sizeKB = (file.size / 1024).toFixed(1);
    return {
      isValid: true,
      message: `Valid document (.${ext}, ${sizeKB} KB).`,
      rule: 'Valid',
      severity: 'success'
    };
  }
}
