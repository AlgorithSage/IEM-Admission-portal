import { Component, EventEmitter, Output, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
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

  private readonly url;

  /** On public pages (landing) a signed-in user gets a way back into the portal; inside it the sidebar has this */
  readonly showDashboardLink;

  constructor(public authService: AuthService, router: Router) {
    this.url = toSignal(router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => router.url)), { initialValue: router.url });
    this.showDashboardLink = computed(() => this.authService.isAuthenticated() && !/^\/(applicant|admin)\//.test(this.url()));
  }

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
