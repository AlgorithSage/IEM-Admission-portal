import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Output() openPathway = new EventEmitter<void>();

  constructor(public authService: AuthService) {}

  getUserInitials(): string {
    const name = this.authService.currentUser()?.name || '';
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  onLoginClick(): void {
    if (this.authService.isAuthenticated()) {
      if (this.authService.isAdmin()) {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/applicant/dashboard';
      }
    } else {
      this.openPathway.emit();
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
