import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Application } from '../../../models/application.model';
import { Router, RouterModule } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';
import { apiError } from '../../../core/utils/file.util';
import { UploadService } from '../../../core/services/upload.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { BvaValidatorService, ValidationFeedback } from '../../../core/services/bva-validator.service';
import {
  ACADEMIC_RULES,
  BOARDS,
  CATEGORIES,
  CLASS_XII_STREAMS,
  COMPETITIVE_EXAMS,
  CompetitiveExamCode,
  CompetitiveExamRule,
  INDIAN_STATES,
  PROGRAMS,
  ProgramRule,
  StreamOption,
  checkStreamEligibility,
  streamRequiresGraduation
} from '../../../models/admission-rules';

const PREF_KEYS = ['pref1', 'pref2', 'pref3'] as const;

type UploadField = 'classXMarksheet' | 'classXIIMarksheet' | 'graduationMarksheet' | `scorecard_${CompetitiveExamCode}`;

interface UploadState {
  status: 'uploading' | 'done' | 'error';
  uploadId?: string;
  error?: string;
}

export interface ChosenStream {
  ordinal: string;
  stream: StreamOption;
  reasons: string[];
}

const DRAFT_PREFIX = 'iem-application-draft:';

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './application-form.component.html',
  styleUrls: ['./application-form.component.css']
})
export class ApplicationFormComponent implements OnInit, OnDestroy {
  appForm: FormGroup;
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  submitAttempted = false;
  /** 'form' while filling in, 'review' for the final check before submission */
  step: 'form' | 'review' = 'form';
  draftRestored = false;
  private draftSub?: Subscription;

  files: Partial<Record<UploadField, File>> = {};
  fileErrors: Partial<Record<UploadField, string>> = {};
  /** Upload progress per document; files upload as soon as they are chosen */
  readonly uploadState = signal<Partial<Record<UploadField, UploadState>>>({});

  readonly programs = PROGRAMS;
  readonly prefOrdinals = ['1st', '2nd', '3rd'];
  readonly categories = CATEGORIES;
  readonly boards = BOARDS;
  readonly streams = CLASS_XII_STREAMS;
  readonly states = INDIAN_STATES;
  readonly exams = COMPETITIVE_EXAMS;
  readonly rules = ACADEMIC_RULES;
  readonly alreadySubmittedApp = signal<Application | null>(null);
  // Human-readable labels used in the "missing fields" summary
  private readonly labels: Record<string, string> = {
    fullName: 'Full Name',
    email: 'Email Address',
    phone: 'Mobile Number',
    alternatePhone: 'Alternate Mobile Number',
    dob: 'Date of Birth',
    category: 'Category',
    nationality: 'Nationality',
    address: 'Address',
    city: 'City',
    state: 'State',
    pincode: 'PIN Code',
    'parents.fatherName': "Father's Name",
    'parents.fatherPhone': "Father's Contact Number",
    'parents.motherName': "Mother's Name",
    'parents.motherPhone': "Mother's Contact Number",
    'parents.guardianName': "Guardian's Name",
    'parents.guardianPhone': "Guardian's Contact Number",
    'classX.board': 'Class X Board',
    'classX.school': 'Class X School',
    'classX.passingYear': 'Class X Passing Year',
    'classX.percentage': 'Class X Percentage',
    'classXII.board': 'Class XII Board',
    'classXII.school': 'Class XII School',
    'classXII.stream': 'Class XII Stream',
    'classXII.passingYear': 'Class XII Passing Year',
    'classXII.percentage': 'Class XII Percentage',
    'classXII.pcmPercentage': 'Class XII PCM Percentage',
    'graduation.degree': 'Graduation Degree',
    'graduation.university': 'Graduation University / College',
    'graduation.passingYear': 'Graduation Passing Year',
    'graduation.percentage': 'Graduation Percentage',
    program: 'Applying For (Program)',
    'streamPrefs.pref1': '1st Stream Preference',
    declaration: 'Declaration'
  };

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private applicationService: ApplicationService,
    public bva: BvaValidatorService,
    private router: Router,
    private uploadService: UploadService
  ) {
    const user = this.authService.currentUser();
    const v = (fn: (val: any) => ValidationFeedback) => this.bvaValidator(fn);
    const { classX, classXII, examYear } = ACADEMIC_RULES;

    const examGroups: Record<string, FormGroup> = {};
    COMPETITIVE_EXAMS.forEach((exam) => {
      examGroups[exam.code] = this.fb.group({
        selected: [false],
        rollNumber: [{ value: '', disabled: true }, v((x) => this.validateRollNumber(x, exam.label))],
        year: [{ value: 2026, disabled: true }, v((x) => bva.validateRange(x, `${exam.label} exam year`, examYear.min, examYear.max, { integer: true }))],
        rank: [{ value: '', disabled: true }, v((x) => (exam.rank ? bva.validateRange(x, `${exam.label} rank`, exam.rank.min, exam.rank.max, { integer: true }) : this.ok()))],
        score: [{ value: '', disabled: true }, v((x) => bva.validateRange(x, `${exam.label} ${exam.score.label.toLowerCase()}`, exam.score.min, exam.score.max, { maxDecimals: 2 }))]
      });
    });

    this.appForm = this.fb.group(
      {
        // Personal
        fullName: [user?.name || '', v((x) => bva.validateFullName(x))],
        email: [user?.email || '', v((x) => bva.validateEmail(x))],
        phone: [user?.phone || '', v((x) => bva.validatePhone(x))],
        alternatePhone: ['', v((x) => this.optionalPhone(x, 'Alternate mobile number'))],
        dob: ['', v((x) => bva.validateDob(x))],
        gender: ['Male', Validators.required],
        category: ['General', Validators.required],
        nationality: ['Indian', v((x) => bva.validateText(x, 'Nationality', 2, 40, true))],

        // Address
        address: ['', v((x) => bva.validateAddress(x))],
        city: ['', v((x) => bva.validateText(x, 'City', 2, 50, true))],
        state: ['West Bengal', Validators.required],
        pincode: ['', v((x) => bva.validatePincode(x))],

        // Parents / Guardian
        parents: this.fb.group({
          fatherName: ['', v((x) => bva.validateText(x, "Father's name", 2, 60, true))],
          fatherPhone: ['', v((x) => this.optionalPhone(x, "Father's contact number"))],
          fatherOccupation: ['', Validators.maxLength(60)],
          motherName: ['', v((x) => bva.validateText(x, "Mother's name", 2, 60, true))],
          motherPhone: ['', v((x) => this.optionalPhone(x, "Mother's contact number"))],
          motherOccupation: ['', Validators.maxLength(60)],
          guardianName: ['', v((x) => (x ? bva.validateText(x, "Guardian's name", 2, 60, true) : this.ok()))],
          guardianRelation: ['', Validators.maxLength(30)],
          guardianPhone: ['', v((x) => this.optionalPhone(x, "Guardian's contact number"))]
        }),

        // Class X
        classX: this.fb.group({
          board: ['', Validators.required],
          school: ['', v((x) => bva.validateText(x, 'School name', 2, 100))],
          passingYear: [2024, v((x) => bva.validateRange(x, 'Class X passing year', classX.year.min, classX.year.max, { integer: true }))],
          percentage: ['', v((x) => bva.validateRange(x, 'Class X percentage', classX.percentage.min, classX.percentage.max, { maxDecimals: 2 }))]
        }),

        // Class XII
        classXII: this.fb.group({
          board: ['', Validators.required],
          school: ['', v((x) => bva.validateText(x, 'School / college name', 2, 100))],
          stream: ['Science (PCM)', Validators.required],
          passingYear: [2026, v((x) => bva.validateRange(x, 'Class XII passing year', classXII.year.min, classXII.year.max, { integer: true }))],
          percentage: ['', v((x) => bva.validateRange(x, 'Class XII percentage', classXII.percentage.min, classXII.percentage.max, { maxDecimals: 2 }))],
          pcmPercentage: ['', v((x) => bva.validateRange(x, 'PCM percentage', 0, 100, { maxDecimals: 2, optional: true }))],
          mathOrComputer: [false]
        }),

        // Graduation (enabled only for postgraduate streams: M.Tech, MBA, MCA)
        graduation: this.fb.group({
          degree: [{ value: '', disabled: true }, v((x) => bva.validateText(x, 'Degree', 2, 60))],
          university: [{ value: '', disabled: true }, v((x) => bva.validateText(x, 'University / college', 2, 100))],
          passingYear: [{ value: 2026, disabled: true }, v((x) => bva.validateRange(x, 'Graduation passing year', ACADEMIC_RULES.graduation.year.min, ACADEMIC_RULES.graduation.year.max, { integer: true }))],
          percentage: [{ value: '', disabled: true }, v((x) => bva.validateRange(x, 'Graduation percentage', 0, 100, { maxDecimals: 2 }))]
        }),

        // Competitive exams (at least one)
        exams: this.fb.group(examGroups),

        // Program & stream preferences (ranked)
        program: ['', Validators.required],
        streamPrefs: this.fb.group({
          pref1: [{ value: '', disabled: true }, Validators.required],
          pref2: [{ value: '', disabled: true }],
          pref3: [{ value: '', disabled: true }]
        }),

        declaration: [false, Validators.requiredTrue]
      },
      {
        validators: [
          this.yearGapValidator,
          this.parentContactValidator,
          this.atLeastOneExamValidator,
          this.distinctStreamsValidator,
          this.graduationGapValidator,
          this.eligibilityValidator
        ]
      }
    );
  }

  ngOnInit(): void {
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        if (res.application && res.application._id) {
          this.alreadySubmittedApp.set(res.application);
        }
      }
    });

    // Program change resets stream choices and opens as many preference slots as the program allows
    this.appForm.get('program')!.valueChanges.subscribe((name: string) => {
      const rule = PROGRAMS.find((p) => p.name === name);
      this.computePrefSlots();
      PREF_KEYS.forEach((key, i) => {
        const ctrl = this.appForm.get(['streamPrefs', key])!;
        ctrl.setValue('', { emitEvent: false });
        rule && i < rule.maxPreferences ? ctrl.enable({ emitEvent: false }) : ctrl.disable({ emitEvent: false });
      });
      // Drop exams the new program does not accept
      COMPETITIVE_EXAMS.filter((e) => !rule?.exams.includes(e.code)).forEach((e) =>
        this.examGroup(e.code).get('selected')!.setValue(false)
      );
      // Single-stream programs need no choice
      if (rule && rule.streams.length === 1) {
        this.appForm.get(['streamPrefs', 'pref1'])!.setValue(rule.streams[0].name, { emitEvent: false });
      }
      this.syncGraduationSection();
    });

    this.appForm.get('streamPrefs')!.valueChanges.subscribe(() => this.syncGraduationSection());

    // Enable an exam's fields only when the applicant opts into that exam
    COMPETITIVE_EXAMS.forEach((exam) => {
      const group = this.examGroup(exam.code);
      group.get('selected')!.valueChanges.subscribe((selected: boolean) => {
        ['rollNumber', 'year', 'rank', 'score'].forEach((key) => {
          const ctrl = group.get(key)!;
          const hasField = key !== 'rank' || !!exam.rank;
          selected && hasField ? ctrl.enable({ emitEvent: false }) : ctrl.disable({ emitEvent: false });
        });
        if (!selected) {
          this.removeFile(`scorecard_${exam.code}`);
        }
        this.appForm.updateValueAndValidity();
      });
    });

    this.restoreDraft();
    this.draftSub = this.appForm.valueChanges.pipe(debounceTime(600)).subscribe(() => this.saveDraft());
  }

  ngOnDestroy(): void {
    this.draftSub?.unsubscribe();
  }

  // ---------- Draft (save / resume). Text fields only: files cannot be stored in the browser ----------

  private get draftKey(): string {
    return DRAFT_PREFIX + (this.authService.currentUser()?._id || 'anonymous');
  }

  private saveDraft(): void {
    try {
      const { declaration, ...values } = this.appForm.getRawValue();
      localStorage.setItem(this.draftKey, JSON.stringify({ savedAt: Date.now(), values }));
    } catch {
      /* storage unavailable (private mode / quota): drafts are a convenience only */
    }
  }

  private restoreDraft(): void {
    let draft: { values: any } | null = null;
    try {
      draft = JSON.parse(localStorage.getItem(this.draftKey) || 'null');
    } catch {
      draft = null;
    }
    if (!draft?.values) return;
    const { program, exams, ...rest } = draft.values;
    // Order matters: program and exam toggles enable dependent controls before values are applied
    if (program) this.appForm.get('program')!.setValue(program);
    COMPETITIVE_EXAMS.forEach((e) => {
      if (exams?.[e.code]?.selected) this.examGroup(e.code).get('selected')!.setValue(true);
    });
    this.appForm.patchValue({ ...rest, exams });
    this.syncGraduationSection();
    this.draftRestored = true;
  }

  clearDraft(): void {
    try {
      localStorage.removeItem(this.draftKey);
    } catch {
      /* ignore */
    }
  }

  // ---------- Validation helpers ----------

  private ok(): ValidationFeedback {
    return { isValid: true, message: '', rule: 'Valid', severity: 'none' };
  }

  private bvaValidator(fn: (val: any) => ValidationFeedback): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const res = fn(control.value);
      return res.isValid ? null : { bva: res.message };
    };
  }

  private optionalPhone(val: string, label: string): ValidationFeedback {
    if (!val || !val.trim()) return this.ok();
    const res = this.bva.validatePhone(val);
    return res.isValid ? res : { ...res, message: `${label}: ${res.message}` };
  }

  private validateRollNumber(val: string, examLabel: string): ValidationFeedback {
    const clean = (val || '').trim();
    if (!clean) {
      return { isValid: false, message: `${examLabel} roll / application number is required.`, rule: 'Required', severity: 'error' };
    }
    if (!/^[A-Za-z0-9-]{4,20}$/.test(clean)) {
      return { isValid: false, message: 'Use 4–20 letters, digits or hyphens.', rule: 'Invalid Format', severity: 'error' };
    }
    return this.ok();
  }

  private yearGapValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const x = Number(form.get('classX.passingYear')?.value);
    const xii = Number(form.get('classXII.passingYear')?.value);
    if (!x || !xii) return null;
    return xii - x < ACADEMIC_RULES.minYearGap ? { yearGap: true } : null;
  };

  private parentContactValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const father = (form.get('parents.fatherPhone')?.value || '').trim();
    const mother = (form.get('parents.motherPhone')?.value || '').trim();
    return father || mother ? null : { parentContact: true };
  };

  private atLeastOneExamValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const rule = PROGRAMS.find((p) => p.name === form.get('program')?.value);
    if (!rule) return null;
    const any = rule.exams.some((code) => form.get(['exams', code, 'selected'])?.value);
    return any ? null : { noExam: true };
  };

  private distinctStreamsValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const picked = PREF_KEYS.map((k) => form.get(['streamPrefs', k])).filter((c) => c?.enabled && c.value).map((c) => c!.value);
    return new Set(picked).size === picked.length ? null : { duplicateStream: true };
  };

  private graduationGapValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const grad = form.get('graduation.passingYear');
    const xii = Number(form.get('classXII.passingYear')?.value);
    if (!grad?.enabled || !grad.value || !xii) return null;
    return Number(grad.value) - xii < ACADEMIC_RULES.minGraduationGap ? { graduationGap: true } : null;
  };

  /** Blocks submission when any preferred stream's IEM admission criteria are not met */
  private eligibilityValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const failing = this.chosenStreamsFrom(form).filter((c) => c.reasons.length > 0);
    return failing.length ? { eligibility: failing.map((c) => `${c.stream.name} requires ${c.reasons.join(', ')}`) } : null;
  };

  private numOrUndefined(val: unknown): number | undefined {
    if (val === null || val === undefined || String(val).trim() === '') return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }

  private chosenStreamsFrom(form: AbstractControl): ChosenStream[] {
    const rule = PROGRAMS.find((p) => p.name === form.get('program')?.value);
    if (!rule) return [];
    const scores = {
      classXIIStream: form.get('classXII.stream')?.value,
      classXPercentage: this.numOrUndefined(form.get('classX.percentage')?.value),
      classXIIPercentage: this.numOrUndefined(form.get('classXII.percentage')?.value),
      pcmPercentage: this.numOrUndefined(form.get('classXII.pcmPercentage')?.value),
      classXIIYear: this.numOrUndefined(form.get('classXII.passingYear')?.value),
      classXIIMathOrComputer: !!form.get('classXII.mathOrComputer')?.value,
      graduationPercentage: this.numOrUndefined(form.get('graduation.percentage')?.value)
    };
    const chosen: ChosenStream[] = [];
    PREF_KEYS.slice(0, rule.maxPreferences).forEach((key, i) => {
      const name = form.get(['streamPrefs', key])?.value as string;
      const stream = rule.streams.find((st) => st.name === name);
      if (stream) {
        chosen.push({ ordinal: this.prefOrdinals[i], stream, reasons: checkStreamEligibility(rule, stream, scores) });
      }
    });
    return chosen;
  }

  /** Preferred streams with their criteria, fees and live eligibility result */
  get chosenStreams(): ChosenStream[] {
    return this.chosenStreamsFrom(this.appForm);
  }

  get needsGraduation(): boolean {
    return this.chosenStreams.some((c) => streamRequiresGraduation(c.stream));
  }

  get needsClassXIISubject(): boolean {
    return this.chosenStreams.some((c) => !!c.stream.eligibility.classXIISubject);
  }

  get eligibilityErrors(): string[] {
    return (this.appForm.errors?.['eligibility'] as string[]) || [];
  }

  private syncGraduationSection(): void {
    const group = this.appForm.get('graduation')!;
    if (this.needsGraduation) {
      group.enable({ emitEvent: false });
    } else {
      group.disable({ emitEvent: false });
      this.removeFile('graduationMarksheet');
    }
    this.appForm.updateValueAndValidity({ emitEvent: false });
  }

  /** Inline error message for a control, shown once touched or after a submit attempt */
  err(path: string | (string | number)[]): string | null {
    const ctrl = this.appForm.get(path);
    if (!ctrl || ctrl.disabled || ctrl.valid) return null;
    if (!(ctrl.touched || ctrl.dirty || this.submitAttempted)) return null;
    if (ctrl.errors?.['bva']) return ctrl.errors['bva'];
    if (ctrl.errors?.['required'] || ctrl.errors?.['requiredTrue']) return 'This field is required.';
    if (ctrl.errors?.['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} characters.`;
    return 'Invalid value.';
  }

  isValid(path: string | (string | number)[]): boolean {
    const ctrl = this.appForm.get(path);
    return !!ctrl && ctrl.enabled && ctrl.valid && (ctrl.touched || ctrl.dirty) && ctrl.value !== '' && ctrl.value !== null;
  }

  formError(key: 'yearGap' | 'parentContact' | 'noExam' | 'duplicateStream' | 'graduationGap'): boolean {
    if (!this.appForm.errors?.[key]) return false;
    if (this.submitAttempted || key === 'duplicateStream') return true;
    if (key === 'graduationGap') return !!this.appForm.get('graduation.passingYear')?.dirty;
    if (key === 'yearGap') return !!(this.appForm.get('classX.passingYear')?.dirty || this.appForm.get('classXII.passingYear')?.dirty);
    if (key === 'parentContact') return !!(this.appForm.get('parents.fatherPhone')?.touched && this.appForm.get('parents.motherPhone')?.touched);
    return false;
  }

  get selectedProgram(): ProgramRule | undefined {
    return PROGRAMS.find((p) => p.name === this.appForm.get('program')?.value);
  }

  /** Preference slots shown for the selected program */
  /** Preference slots for the selected program. Recomputed only when the program changes, so the
   * form controls bound inside *ngFor are not torn down and re-registered on every change detection. */
  prefSlots: { key: string; ordinal: string; required: boolean }[] = [];

  private computePrefSlots(): void {
    const rule = this.selectedProgram;
    this.prefSlots = rule
      ? PREF_KEYS.slice(0, rule.maxPreferences).map((key, i) => ({ key, ordinal: this.prefOrdinals[i], required: i === 0 }))
      : [];
  }

  trackByKey(_: number, item: { key: string }): string {
    return item.key;
  }

  trackByStream(_: number, item: ChosenStream): string {
    return item.ordinal + item.stream.name;
  }

  trackByValue(_: number, item: string): string {
    return item;
  }

  trackByField(_: number, item: { field: string }): string {
    return item.field;
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  /** Streams available for a slot, excluding ones already picked in other slots */
  streamOptionsFor(slotKey: string): string[] {
    const rule = this.selectedProgram;
    if (!rule) return [];
    const takenElsewhere = PREF_KEYS.filter((k) => k !== slotKey)
      .map((k) => this.appForm.get(['streamPrefs', k])?.value)
      .filter(Boolean);
    return rule.streams.map((st) => st.name).filter((name) => !takenElsewhere.includes(name));
  }

  examGroup(code: CompetitiveExamCode): FormGroup {
    return this.appForm.get(['exams', code]) as FormGroup;
  }

  isExamSelected(code: CompetitiveExamCode): boolean {
    return !!this.examGroup(code).get('selected')?.value;
  }

  /** Entrance exams accepted for the selected program */
  get acceptedExams(): CompetitiveExamRule[] {
    const rule = this.selectedProgram;
    return rule ? COMPETITIVE_EXAMS.filter((e) => rule.exams.includes(e.code)) : [];
  }

  get acceptedExamLabels(): string {
    return this.acceptedExams.map((e) => e.label).join(', ');
  }

  get selectedExamCount(): number {
    return COMPETITIVE_EXAMS.filter((e) => this.isExamSelected(e.code)).length;
  }

  trackExam(_: number, exam: CompetitiveExamRule): string {
    return exam.code;
  }

  // ---------- File handling ----------

  scorecardField(code: CompetitiveExamCode): UploadField {
    return `scorecard_${code}`;
  }

  fileFor(field: UploadField): File | undefined {
    return this.files[field];
  }

  fileErrorFor(field: UploadField): string {
    return this.fileErrors[field] || this.uploadState()[field]?.error || '';
  }

  uploadStatus(field: UploadField): UploadState['status'] | undefined {
    return this.uploadState()[field]?.status;
  }

  private setUploadState(field: UploadField, state: UploadState | undefined): void {
    this.uploadState.update((all) => {
      const next = { ...all };
      if (state) next[field] = state;
      else delete next[field];
      return next;
    });
  }

  onFileSelected(field: UploadField, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(field, input.files[0]);
    }
    // Allow re-selecting the same file after removal
    input.value = '';
  }

  onFileDrop(field: UploadField, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.setFile(field, event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private setFile(field: UploadField, file: File): void {
    const feedback = this.bva.validateFile(file);
    if (!feedback.isValid) {
      this.removeFile(field);
      this.fileErrors[field] = feedback.message;
      return;
    }
    this.removeFile(field);
    this.files[field] = file;
    this.setUploadState(field, { status: 'uploading' });
    this.uploadService
      .upload(file, field)
      .then((staged) => {
        // The applicant may have replaced or removed the file while it was uploading
        if (this.files[field] !== file) {
          this.uploadService.discard(staged.uploadId);
          return;
        }
        this.setUploadState(field, { status: 'done', uploadId: staged.uploadId });
      })
      .catch((err) => {
        if (this.files[field] !== file) return;
        this.setUploadState(field, { status: 'error', error: apiError(err, 'Upload failed. Choose the file again.') });
      });
  }

  removeFile(field: UploadField): void {
    const uploadId = this.uploadState()[field]?.uploadId;
    if (uploadId) this.uploadService.discard(uploadId);
    delete this.files[field];
    this.fileErrors[field] = '';
    this.setUploadState(field, undefined);
  }

  private requiredUploads(): { field: UploadField; label: string }[] {
    const list: { field: UploadField; label: string }[] = [
      { field: 'classXMarksheet', label: 'Class X Marksheet' },
      { field: 'classXIIMarksheet', label: 'Class XII Marksheet' }
    ];
    if (this.needsGraduation) {
      list.push({ field: 'graduationMarksheet', label: 'Graduation Marksheet' });
    }
    COMPETITIVE_EXAMS.filter((e) => this.isExamSelected(e.code)).forEach((e) =>
      list.push({ field: this.scorecardField(e.code), label: `${e.label} Scorecard` })
    );
    return list;
  }

  // ---------- Submit ----------

  private collectMissing(): string[] {
    const missing: string[] = [];
    Object.entries(this.labels).forEach(([path, label]) => {
      const ctrl = this.appForm.get(path);
      if (ctrl && ctrl.enabled && ctrl.invalid) missing.push(label);
    });

    if (this.appForm.errors?.['parentContact']) missing.push("Father's or Mother's Contact Number");
    if (this.appForm.errors?.['yearGap']) missing.push(`Class XII year must be ${ACADEMIC_RULES.minYearGap}+ years after Class X`);
    if (this.appForm.errors?.['noExam']) missing.push('At least one Competitive Exam');
    if (this.appForm.errors?.['duplicateStream']) missing.push('Stream preferences must be different');
    if (this.appForm.errors?.['graduationGap']) missing.push(`Graduation year must be ${ACADEMIC_RULES.minGraduationGap}+ years after Class XII`);
    this.eligibilityErrors.forEach((e) => missing.push(`Not eligible: ${e}`));

    COMPETITIVE_EXAMS.filter((e) => this.isExamSelected(e.code)).forEach((e) => {
      const g = this.examGroup(e.code);
      const names: Record<string, string> = { rollNumber: 'Roll Number', year: 'Year', rank: 'Rank', score: e.score.label };
      ['rollNumber', 'year', 'rank', 'score'].forEach((k) => {
        if (g.enabled && g.get(k)?.enabled && g.get(k)?.invalid) missing.push(`${e.label} ${names[k]}`);
      });
    });

    this.requiredUploads().forEach(({ field, label }) => {
      const status = this.uploadStatus(field);
      if (this.files[field] && status === 'uploading') {
        missing.push(`${label} (still uploading)`);
        return;
      }
      if (this.files[field] && status === 'error') {
        missing.push(`${label} (upload failed, choose the file again)`);
        return;
      }
      if (!this.files[field]) {
        missing.push(label);
        this.fileErrors[field] = `${label} upload is required.`;
      }
    });
    return missing;
  }

  /** Validates everything, then shows the read-only review of the whole application */
  onReview(): void {
    this.submitAttempted = true;
    this.errorMessage.set('');

    const missing = this.collectMissing();
    if (this.appForm.invalid || missing.length > 0) {
      this.appForm.markAllAsTouched();
      this.errorMessage.set(`Please complete or correct the following: ${missing.join(', ')}.`);
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }
    this.step = 'review';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToEdit(): void {
    this.step = 'form';
    this.errorMessage.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Review helpers ----------

  get v(): any {
    return this.appForm.getRawValue();
  }

  get reviewExams(): { label: string; rollNumber: string; year: number; rank?: number; scoreLabel: string; score: number }[] {
    const raw = this.v;
    return this.acceptedExams
      .filter((e) => this.isExamSelected(e.code))
      .map((e) => ({
        label: e.label,
        rollNumber: raw.exams[e.code].rollNumber,
        year: raw.exams[e.code].year,
        rank: e.rank ? raw.exams[e.code].rank : undefined,
        scoreLabel: e.score.label,
        score: raw.exams[e.code].score
      }));
  }

  get reviewDocuments(): { field: UploadField; label: string; file: File }[] {
    return this.requiredUploads().map((u) => ({ ...u, file: this.files[u.field] as File }));
  }

  /** Opens a locally selected file so the applicant can check it before submitting */
  previewFile(file: File): void {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- Submit ----------

  confirmSubmit(): void {
    const raw = this.appForm.getRawValue();
    const maxPrefs = this.selectedProgram?.maxPreferences ?? 1;
    const uploads = this.uploadState();
    const body = {
      fullName: raw.fullName.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim(),
      alternatePhone: (raw.alternatePhone || '').trim(),
      dob: raw.dob,
      gender: raw.gender,
      category: raw.category,
      nationality: raw.nationality.trim(),
      address: raw.address.trim(),
      city: raw.city.trim(),
      state: raw.state,
      pincode: raw.pincode.trim(),
      program: raw.program,
      streamPreferences: PREF_KEYS.slice(0, maxPrefs).map((k) => raw.streamPrefs[k]).filter(Boolean),
      declaration: raw.declaration,
      parents: raw.parents,
      classX: raw.classX,
      classXII: raw.classXII,
      graduation: this.needsGraduation ? raw.graduation : undefined,
      competitiveExams: COMPETITIVE_EXAMS.filter((e) => this.isExamSelected(e.code)).map((e) => {
        const g = raw.exams[e.code];
        return { exam: e.code, rollNumber: String(g.rollNumber).trim(), year: g.year, rank: e.rank ? g.rank : undefined, score: g.score };
      }),
      documents: Object.fromEntries(this.requiredUploads().map(({ field }) => [field, uploads[field]?.uploadId]))
    };

    this.applicationService.submitApplication(body).subscribe({
      next: () => {
        this.loading.set(false);
        this.clearDraft();
        this.router.navigate(['/applicant/payment']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(apiError(err, 'Failed to submit application. Please check your details and try again.'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
}
