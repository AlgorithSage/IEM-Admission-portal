import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BvaValidatorService, ValidationFeedback } from '../../../core/services/bva-validator.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent {
  loginForm: FormGroup;
  // Sent here because the 1-day session ended
  readonly errorMessage = signal<string>(
    inject(ActivatedRoute).snapshot.queryParamMap.has('expired') ? 'Your session has expired. Please log in again.' : ''
  );
  readonly loading = signal<boolean>(false);
  showPassword = false;

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
  }

  getEmailFeedback(): ValidationFeedback | null {
    const ctrl = this.loginForm.get('email');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validateEmail(ctrl.value || '');
  }

  getPasswordFeedback(): ValidationFeedback | null {
    const ctrl = this.loginForm.get('password');
    if (!ctrl || !ctrl.dirty) return null;
    return this.bva.validatePassword(ctrl.value || '');
  }

  useDemoAdmin(): void {
    this.loginForm.patchValue({
      email: 'admin@iem.edu.in',
      password: 'adminpassword123'
    });
    this.onSubmit();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login({
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      role: 'admin'
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Access Denied. Invalid administrative credentials.');
      }
    });
  }
}
