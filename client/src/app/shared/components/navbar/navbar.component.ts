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
