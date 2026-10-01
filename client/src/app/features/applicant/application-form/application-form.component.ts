import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { BvaValidatorService, ValidationFeedback } from '../../../core/services/bva-validator.service';

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './application-form.component.html',
  styleUrls: ['./application-form.component.css']
})
export class ApplicationFormComponent implements OnInit {
  appForm: FormGroup;
  selectedFile: File | null = null;
  fileError = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  departments = ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'BBA'];

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private applicationService: ApplicationService,
    public bva: BvaValidatorService,
    private router: Router
  ) {
    const user = this.authService.currentUser();
    this.appForm = this.fb.group({
      fullName: [user?.name || '', [Validators.required, Validators.minLength(3)]],
      email: [user?.email || '', [Validators.required, Validators.email]],
      phone: [user?.phone || '', [Validators.required, Validators.pattern(/^[0-9+ -]{10,15}$/)]],
      dob: ['', [Validators.required]],
      gender: ['Male', [Validators.required]],
      address: ['', [Validators.required, Validators.minLength(10)]],
      department: ['B.Tech', [Validators.required]],
      qualifyingExam: ['Class 12th / Higher Secondary', [Validators.required]],
      passingYear: [2026, [Validators.required, Validators.min(2015), Validators.max(2026)]],
      percentage: ['', [Validators.required, Validators.min(45), Validators.max(100)]]
    });
  }

  ngOnInit(): void {
    // Check if applicant already submitted an application
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        if (res.application && res.application.status) {
          // If already submitted, redirect to status tracker
          // this.router.navigate(['/applicant/status']);
        }
      }
    });
  }

  get fullNameFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('fullName');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validateFullName(ctrl?.value || '');
  }

  get emailFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('email');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validateEmail(ctrl?.value || '');
  }

  get phoneFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('phone');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validatePhone(ctrl?.value || '');
  }

  get dobFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('dob');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validateDob(ctrl?.value || '');
  }

  get addressFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('address');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validateAddress(ctrl?.value || '');
  }

  get passingYearFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('passingYear');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validatePassingYear(ctrl?.value);
  }

  get percentageFeedback(): ValidationFeedback | null {
    const ctrl = this.appForm.get('percentage');
    if (!ctrl?.touched && !ctrl?.dirty) return null;
    return this.bva.validatePercentage(ctrl?.value);
  }

  get fileFeedback(): ValidationFeedback | null {
    if (!this.selectedFile) return null;
    return this.bva.validateFile(this.selectedFile);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndSetFile(input.files[0]);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.validateAndSetFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  validateAndSetFile(file: File): void {
    this.fileError = '';
    const feedback = this.bva.validateFile(file);
    if (!feedback.isValid) {
      this.fileError = feedback.message;
      this.selectedFile = null;
      return;
    }
    this.selectedFile = file;
  }

  removeFile(): void {
    this.selectedFile = null;
    this.fileError = '';
  }

  onSubmit(): void {
    if (this.appForm.invalid) {
      this.appForm.markAllAsTouched();
      return;
    }

    if (!this.selectedFile) {
      this.fileError = 'Please upload your marksheet / certificate document.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formData = new FormData();
    Object.keys(this.appForm.value).forEach(key => {
      formData.append(key, this.appForm.value[key]);
    });
    formData.append('marksheet', this.selectedFile);

    this.applicationService.submitApplication(formData).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = 'Application submitted successfully!';
        setTimeout(() => {
          this.router.navigate(['/applicant/status']);
        }, 1200);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Failed to submit application. Please check form values.';
      }
    });
  }
}
