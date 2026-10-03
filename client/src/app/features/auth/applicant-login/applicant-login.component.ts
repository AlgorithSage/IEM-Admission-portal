import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BvaValidatorService, ValidationFeedback, PasswordStrength } from '../../../core/services/bva-validator.service';

@Component({
  selector: 'app-applicant-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './applicant-login.component.html',
  styleUrls: ['./applicant-login.component.css']
})
export class ApplicantLoginComponent {
  isRegisterMode = false;
  loginForm: FormGroup;
  registerForm: FormGroup;
  readonly errorMessage = signal<string>('');
  readonly loading = signal<boolean>(false);
  // Password visibility toggles
  showLoginPassword = false;
  showRegisterPassword = false;
  showRegisterConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public bva: BvaValidatorService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      password: ['', [Validators.required]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  // Runtime BVA Feedback Getters
  getLoginEmailFeedback(): ValidationFeedback | null {
    const ctrl = this.loginForm.get('email');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validateEmail(ctrl.value || '');
  }

  getLoginPasswordFeedback(): ValidationFeedback | null {
    const ctrl = this.loginForm.get('password');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validatePassword(ctrl.value || '');
  }

  getRegisterNameFeedback(): ValidationFeedback | null {
    const ctrl = this.registerForm.get('name');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validateFullName(ctrl.value || '');
  }

  getRegisterEmailFeedback(): ValidationFeedback | null {
    const ctrl = this.registerForm.get('email');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validateEmail(ctrl.value || '');
  }

  getRegisterPhoneFeedback(): ValidationFeedback | null {
    const ctrl = this.registerForm.get('phone');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validatePhone(ctrl.value || '');
  }

  getRegisterPasswordFeedback(): ValidationFeedback | null {
    const ctrl = this.registerForm.get('password');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validatePassword(ctrl.value || '');
  }

  getPasswordStrength(val: string): PasswordStrength {
    return this.bva.evaluatePasswordStrength(val || '');
  }

  getRegisterConfirmPasswordFeedback(): ValidationFeedback | null {
    const ctrl = this.registerForm.get('confirmPassword');
    const pass = this.registerForm.get('password')?.value || '';
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validateConfirmPassword(pass, ctrl.value || '');
  }

  isRegisterFormValid(): boolean {
    const nameFb = this.bva.validateFullName(this.registerForm.get('name')?.value || '');
    const emailFb = this.bva.validateEmail(this.registerForm.get('email')?.value || '');
    const phoneFb = this.bva.validatePhone(this.registerForm.get('phone')?.value || '');
    const passFb = this.bva.validatePassword(this.registerForm.get('password')?.value || '');
    const confirmFb = this.bva.validateConfirmPassword(this.registerForm.get('password')?.value || '', this.registerForm.get('confirmPassword')?.value || '');
    return nameFb.isValid && emailFb.isValid && phoneFb.isValid && passFb.isValid && confirmFb.isValid;
  }

  toggleMode(mode: boolean): void {
    this.isRegisterMode = mode;
    this.errorMessage.set('');
  }

  useDemoStudent(): void {
    this.loginForm.patchValue({
      email: 'aarav.sharma@gmail.com',
      password: 'password123'
    });
    this.onLoginSubmit();
  }

  onLoginSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login({
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      role: 'applicant'
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate(['/applicant/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Authentication failed. Please verify credentials.');
      }
    });
  }

  onRegisterSubmit(): void {
    if (this.registerForm.invalid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.register({
      name: this.registerForm.value.name,
      email: this.registerForm.value.email,
      phone: this.registerForm.value.phone,
      password: this.registerForm.value.password,
      role: 'applicant'
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate(['/applicant/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Registration failed. Email might already exist.');
      }
    });
  }
}
