import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgeService } from '../../../core/services/nav-badge.service';

export interface ShellNavItem {
  label: string;
  icon: string;
  link: string;
  /** Query params for the link (e.g. a pre-filtered list) */
  query?: Record<string, string>;
  /** Key of a count published through NavBadgeService */
  badge?: string;
  /** Only highlight on an exact URL match */
  exact?: boolean;
}

/**
 * Signed-in layout shared by the applicant and admin areas: left navigation + page content.
 * The menu comes from the route's data (`nav`), so each area defines only its items.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent {
  readonly nav: ShellNavItem[] = inject(ActivatedRoute).snapshot.data['nav'] || [];
  readonly label: string = inject(ActivatedRoute).snapshot.data['navLabel'] || 'Navigation';
  readonly badges = inject(NavBadgeService).counts;

  /** Sidebar visibility on small screens */
  readonly menuOpen = signal(false);

  constructor(public authService: AuthService, router: Router) {
    // Close the mobile menu after navigating
    router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuOpen.set(false));
  }

  signOut(): void {
    this.authService.logout();
  }
}
