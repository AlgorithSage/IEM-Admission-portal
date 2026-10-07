import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';
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
import { Subscription, debounceTime, filter } from 'rxjs';
import { apiError, openBlobInNewTab } from '../../../core/utils/file.util';
import { UploadService } from '../../../core/services/upload.service';
import { CITIES_BY_STATE } from '../../../models/india-cities';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService, ApplicationDraft, DraftDocument } from '../../../core/services/application.service';
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

/** A document slot: chosen file (this visit) or a file restored from a saved draft */
interface UploadState {
  status: 'uploading' | 'done' | 'error';
  uploadId?: string;
  error?: string;
  name: string;
  size: number;
  type: string;
}

type StepId = 'program' | 'personal' | 'address' | 'parents' | 'classX' | 'classXII' | 'graduation' | 'exams' | 'declaration' | 'review';
type StepStatus = 'current' | 'done' | 'error' | 'todo';
type FormErrorKey = 'yearGap' | 'parentContact' | 'noExam' | 'duplicateStream' | 'graduationGap' | 'samePhone';

interface StepDef {
  id: StepId;
  title: string;
  /** Form controls (paths) that belong to this phase */
  controls: string[];
  /** Cross-field errors shown in this phase */
  errors: FormErrorKey[];
}

const STEPS: StepDef[] = [
  { id: 'program', title: 'Program & Stream', controls: ['program', 'streamPrefs'], errors: ['duplicateStream'] },
  { id: 'personal', title: 'Personal & Contact', controls: ['fullName', 'dob', 'gender', 'category', 'nationality', 'email', 'phone', 'alternatePhone'], errors: ['samePhone'] },
  { id: 'address', title: 'Address', controls: ['address', 'city', 'state', 'pincode'], errors: [] },
  { id: 'parents', title: 'Parent / Guardian', controls: ['parents'], errors: ['parentContact'] },
  { id: 'classX', title: 'Class X', controls: ['classX'], errors: [] },
  { id: 'classXII', title: 'Class XII', controls: ['classXII'], errors: ['yearGap'] },
  { id: 'graduation', title: 'Graduation', controls: ['graduation'], errors: ['graduationGap'] },
  { id: 'exams', title: 'Entrance Exams', controls: ['exams'], errors: ['noExam'] },
  { id: 'declaration', title: 'Declaration', controls: ['declaration'], errors: [] },
  { id: 'review', title: 'Review & Submit', controls: [], errors: [] }
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ChosenStream {
  ordinal: string;
  stream: StreamOption;
  reasons: string[];
}

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, StatusLabelPipe, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './application-form.component.html',
  styleUrls: ['./application-form.component.css']
})
export class ApplicationFormComponent implements OnInit, OnDestroy {
  appForm: FormGroup;
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  submitAttempted = false;

  /** Phase on screen; phases the applicant has opened; phases where Next was pressed */
  readonly current = signal<StepId>('program');
  private readonly visited = signal<Set<StepId>>(new Set(['program']));
  private readonly attempted = signal<Set<StepId>>(new Set());

  /** Draft ("Save as draft") state */
  readonly draftLoaded = signal(false);
  readonly draftRestored = signal(false);
  /** Phases before this one were filled in an earlier session (restored draft) */
  private resumeIndex = 0;
  readonly saveState = signal<SaveState>('idle');
  readonly savedAt = signal<Date | null>(null);
  private draftSub?: Subscription;

  /** Files chosen during this visit (kept for instant local preview) */
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
  /** False until we know whether the applicant already has an application */
  readonly appChecked = signal(false);
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
        rollNumber: [{ value: '', disabled: true }, v((x) => this.validateApplicationNo(x, exam))],
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
        gender: ['', Validators.required],
        category: ['', Validators.required],
        nationality: ['Indian', v((x) => bva.validateText(x, 'Nationality', 2, 40, true))],

        // Address
        address: ['', v((x) => bva.validateAddress(x))],
        city: ['', v((x) => this.validateCity(x))],
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
          this.alternatePhoneValidator,
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
        this.appChecked.set(true);
      },
      error: () => this.appChecked.set(true)
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

    this.applicationService.getDraft().subscribe({
      next: (draft) => {
        if (draft) this.restoreDraft(draft);
        this.startAutosave();
      },
      error: () => this.startAutosave()
    });
  }

  ngOnDestroy(): void {
    this.draftSub?.unsubscribe();
  }

  // ---------- Phases ----------

  /** Phases for the current choices (Graduation only for postgraduate streams) */
  get steps(): StepDef[] {
    return STEPS.filter((st) => st.id !== 'graduation' || this.needsGraduation);
  }

  stepNumber(id: StepId): number {
    return this.steps.findIndex((st) => st.id === id) + 1;
  }

  get currentStep(): StepDef {
    return this.steps.find((st) => st.id === this.current()) || this.steps[0];
  }

  isStep(id: StepId): boolean {
    return this.current() === id;
  }

  private stepUploads(id: StepId): UploadField[] {
    if (id === 'classX') return ['classXMarksheet'];
    if (id === 'classXII') return ['classXIIMarksheet'];
    if (id === 'graduation') return ['graduationMarksheet'];
    if (id === 'exams') return COMPETITIVE_EXAMS.filter((e) => this.isExamSelected(e.code)).map((e) => this.scorecardField(e.code));
    return [];
  }

  /** True when every field, cross-field rule and document of a phase is complete */
  stepValid(id: StepId): boolean {
    if (id === 'review') return false;
    const def = STEPS.find((st) => st.id === id)!;
    const controlsOk = def.controls.every((path) => {
      const ctrl = this.appForm.get(path);
      return !ctrl || ctrl.disabled || ctrl.valid;
    });
    const errorsOk = def.errors.every((key) => !this.appForm.errors?.[key]);
    const uploadsOk = this.stepUploads(id).every((f) => this.uploadState()[f]?.status === 'done');
    return controlsOk && errorsOk && uploadsOk;
  }

  stepStatus(id: StepId): StepStatus {
    if (this.current() === id) return 'current';
    if (id === 'review') return 'todo';
    const seen = this.visited().has(id) || this.steps.findIndex((st) => st.id === id) < this.resumeIndex;
    if (!seen) return 'todo';
    return this.stepValid(id) ? 'done' : 'error';
  }

  get completedSteps(): number {
    return this.steps.filter((st) => st.id !== 'review' && this.stepValid(st.id)).length;
  }

  /** Jump to any phase from the progress panel */
  goTo(id: StepId): void {
    if (id === 'review') {
      this.onReview();
      return;
    }
    this.errorMessage.set('');
    this.show(id);
  }

  next(): void {
    const id = this.current();
    this.touchStep(id);
    if (!this.stepValid(id)) {
      this.errorMessage.set('Please complete or correct the highlighted fields before continuing.');
      this.scrollToForm();
      return;
    }
    this.errorMessage.set('');
    const list = this.steps;
    const following = list[list.findIndex((st) => st.id === id) + 1];
    if (following.id === 'review') {
      this.onReview();
    } else {
      this.show(following.id);
    }
    this.saveDraft(true);
  }

  back(): void {
    const list = this.steps;
    const i = list.findIndex((st) => st.id === this.current());
    if (i > 0) {
      this.errorMessage.set('');
      this.show(list[i - 1].id);
    }
  }

  get isFirstStep(): boolean {
    return this.steps[0].id === this.current();
  }

  get isLastInputStep(): boolean {
    const list = this.steps;
    return list[list.length - 2]?.id === this.current();
  }

  private show(id: StepId): void {
    this.current.set(id);
    this.visited.update((set) => new Set(set).add(id));
    this.scrollToForm();
  }

  /** Marks a phase's fields as touched so their messages appear, and records the attempt */
  private touchStep(id: StepId): void {
    const def = STEPS.find((st) => st.id === id)!;
    def.controls.forEach((path) => this.appForm.get(path)?.markAllAsTouched());
    this.attempted.update((set) => new Set(set).add(id));
    this.stepUploads(id).forEach((field) => {
      if (!this.uploadState()[field]) this.fileErrors[field] = 'Please upload this document.';
    });
  }

  private stepOfError(key: FormErrorKey): StepId {
    return STEPS.find((st) => st.errors.includes(key))!.id;
  }

  private scrollToForm(): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Draft ----------

  private startAutosave(): void {
    this.draftLoaded.set(true);
    if (this.alreadySubmittedApp()) return;
    // Save quietly a few seconds after the applicant stops typing
    this.draftSub = this.appForm.valueChanges
      .pipe(
        filter(() => !this.alreadySubmittedApp()),
        debounceTime(3000)
      )
      .subscribe(() => this.saveDraft(true));
  }

  private draftDocuments(): Record<string, DraftDocument> {
    const docs: Record<string, DraftDocument> = {};
    Object.entries(this.uploadState()).forEach(([field, st]) => {
      if (st?.status === 'done' && st.uploadId) docs[field] = { uploadId: st.uploadId, name: st.name, type: st.type, size: st.size };
    });
    return docs;
  }

  /** Saves the form (and attached documents) as a draft on the server */
  saveDraft(quiet = false): void {
    if (this.alreadySubmittedApp() || !this.draftLoaded()) return;
    this.saveState.set('saving');
    const { declaration, ...data } = this.appForm.getRawValue();
    this.applicationService.saveDraft({ data, documents: this.draftDocuments(), step: this.current() }).subscribe({
      next: () => {
        this.saveState.set('saved');
        this.savedAt.set(new Date());
      },
      error: () => {
        // Quiet autosaves fail silently; an explicit save reports the problem
        this.saveState.set(quiet ? 'idle' : 'error');
      }
    });
  }

  private restoreDraft(draft: ApplicationDraft): void {
    const { program, exams, ...rest } = draft.data || {};
    // Order matters: program and exam toggles enable dependent controls before values are applied
    if (program) this.appForm.get('program')!.setValue(program);
    COMPETITIVE_EXAMS.forEach((e) => {
      if (exams?.[e.code]?.selected) this.examGroup(e.code).get('selected')!.setValue(true);
    });
    this.appForm.patchValue({ ...rest, ...(exams ? { exams } : {}) });
    this.syncGraduationSection();

    const docs: Partial<Record<UploadField, UploadState>> = {};
    Object.entries(draft.documents || {}).forEach(([field, d]) => {
      docs[field as UploadField] = { status: 'done', uploadId: d.uploadId, name: d.name, size: d.size, type: d.type };
    });
    this.uploadState.set(docs);

    const resumeAt = STEPS.find((st) => st.id === draft.step && st.id !== 'review');
    if (resumeAt) {
      this.current.set(resumeAt.id);
      this.resumeIndex = this.steps.findIndex((st) => st.id === resumeAt.id);
    }
    this.draftRestored.set(true);
    this.savedAt.set(draft.updatedAt ? new Date(draft.updatedAt) : null);
    this.saveState.set('saved');
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

  private validateApplicationNo(val: string, exam: CompetitiveExamRule): ValidationFeedback {
    const clean = (val || '').trim();
    if (!clean) {
      return { isValid: false, message: `${exam.label} application number is required.`, rule: 'Required', severity: 'error' };
    }
    if (!new RegExp(exam.applicationNo.pattern).test(clean)) {
      return { isValid: false, message: exam.applicationNo.hint, rule: 'Invalid Format', severity: 'error' };
    }
    return this.ok();
  }

  private validateCity(val: string): ValidationFeedback {
    const clean = (val || '').trim();
    if (!clean) return { isValid: false, message: 'City / town is required.', rule: 'Required', severity: 'error' };
    if (!/^[A-Za-z][A-Za-z\s.'()-]{1,49}$/.test(clean)) {
      return { isValid: false, message: 'Enter a valid city or town name (letters only).', rule: 'Invalid', severity: 'error' };
    }
    return this.ok();
  }

  private alternatePhoneValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const norm = (v: string) => (v || '').trim().replace(/^(\+91|91)/, '').replace(/[\s-]/g, '');
    const alt = norm(form.get('alternatePhone')?.value);
    return alt && alt === norm(form.get('phone')?.value) ? { samePhone: true } : null;
  };

  /** Suggestions for the city field, based on the selected state */
  get cityOptions(): string[] {
    return CITIES_BY_STATE[this.appForm.get('state')?.value] || [];
  }

  /** Date-of-birth bounds for the eligible age range (16 to 35 years) */
  readonly dobMax = this.yearsAgo(16);
  readonly dobMin = this.yearsAgo(36, 1);

  private yearsAgo(years: number, plusDays = 0): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(d.getDate() + plusDays);
    return d.toISOString().slice(0, 10);
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

  formError(key: FormErrorKey): boolean {
    if (!this.appForm.errors?.[key]) return false;
    if (this.submitAttempted || this.attempted().has(this.stepOfError(key)) || key === 'duplicateStream' || key === 'samePhone') return true;
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

  /** The document in a slot (chosen now or restored from a draft) */
  docFor(field: UploadField): UploadState | undefined {
    return this.uploadState()[field];
  }

  /** Opens a document: the local file if chosen in this visit, otherwise the uploaded copy */
  viewDoc(field: UploadField): void {
    const local = this.files[field];
    if (local) {
      this.previewFile(local);
      return;
    }
    const uploadId = this.uploadState()[field]?.uploadId;
    if (uploadId) openBlobInNewTab(this.uploadService.content(uploadId), (msg) => (this.fileErrors[field] = msg));
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
    const meta = { name: file.name, size: file.size, type: file.type };
    this.setUploadState(field, { status: 'uploading', ...meta });
    this.uploadService
      .upload(file, field)
      .then((staged) => {
        // The applicant may have replaced or removed the file while it was uploading
        if (this.files[field] !== file) {
          this.uploadService.discard(staged.uploadId);
          return;
        }
        this.setUploadState(field, { status: 'done', uploadId: staged.uploadId, ...meta });
        this.saveDraft(true);
      })
      .catch((err) => {
        if (this.files[field] !== file) return;
        this.setUploadState(field, { status: 'error', error: apiError(err, 'Upload failed. Choose the file again.'), ...meta });
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
    if (this.appForm.errors?.['samePhone']) missing.push('Alternate mobile number must differ from the mobile number');
    if (this.appForm.errors?.['graduationGap']) missing.push(`Graduation year must be ${ACADEMIC_RULES.minGraduationGap}+ years after Class XII`);
    this.eligibilityErrors.forEach((e) => missing.push(`Not eligible: ${e}`));

    COMPETITIVE_EXAMS.filter((e) => this.isExamSelected(e.code)).forEach((e) => {
      const g = this.examGroup(e.code);
      const names: Record<string, string> = { rollNumber: 'Application Number', year: 'Year', rank: 'Rank', score: e.score.label };
      ['rollNumber', 'year', 'rank', 'score'].forEach((k) => {
        if (g.enabled && g.get(k)?.enabled && g.get(k)?.invalid) missing.push(`${e.label} ${names[k]}`);
      });
    });

    this.requiredUploads().forEach(({ field, label }) => {
      const status = this.uploadStatus(field);
      if (status === 'uploading') {
        missing.push(`${label} (still uploading)`);
        return;
      }
      if (status === 'error') {
        missing.push(`${label} (upload failed, choose the file again)`);
        return;
      }
      if (!status) {
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
      this.steps.forEach((st) => this.visited.update((set) => new Set(set).add(st.id)));
      // Take the applicant to the first phase that needs attention
      const firstBad = this.steps.find((st) => st.id !== 'review' && !this.stepValid(st.id));
      const target = firstBad?.id || (this.eligibilityErrors.length ? 'program' : this.current());
      this.show(target === 'review' ? 'program' : target);
      this.errorMessage.set(`Please complete or correct the following: ${missing.join(', ')}.`);
      return;
    }
    this.errorMessage.set('');
    this.show('review');
  }

  backToEdit(): void {
    this.errorMessage.set('');
    this.show('declaration');
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

  get reviewDocuments(): { field: UploadField; label: string; doc: UploadState | undefined }[] {
    return this.requiredUploads().map((u) => ({ ...u, doc: this.uploadState()[u.field] }));
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
