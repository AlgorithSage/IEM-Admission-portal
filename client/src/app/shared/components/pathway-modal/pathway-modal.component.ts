import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

type Role = 'applicant' | 'admin';

@Component({
  selector: 'app-pathway-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pathway-modal.component.html',
  styleUrls: ['./pathway-modal.component.css']
})
export class PathwayModalComponent {
  @Output() close = new EventEmitter<void>();

  /** Step 1 picks the role, step 2 picks log in or register */
  readonly role = signal<Role | null>(null);

  constructor(private router: Router) {}

  go(mode: 'login' | 'register'): void {
    const role = this.role();
    if (!role) return;
    this.close.emit();
    if (role === 'admin') {
      this.router.navigate(['/admin/login']);
    } else {
      this.router.navigate(['/applicant/login'], mode === 'register' ? { queryParams: { mode: 'register' } } : {});
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
