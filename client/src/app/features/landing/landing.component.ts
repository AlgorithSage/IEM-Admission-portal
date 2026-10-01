import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent {
  @Output() openPathway = new EventEmitter<void>();

  programs = [
    { name: 'B.Tech', duration: '4 Years', icon: 'fa-solid fa-graduation-cap', desc: 'Computer Science, IT, Electronics, Electrical, Mechanical' },
    { name: 'M.Tech', duration: '2 Years', icon: 'fa-solid fa-graduation-cap', desc: 'Advanced Computer Science, VLSI & Microelectronics' },
    { name: 'MBA', duration: '2 Years', icon: 'fa-solid fa-briefcase', desc: 'Finance, Marketing, HR, Business Analytics' },
    { name: 'MCA', duration: '2 Years', icon: 'fa-solid fa-laptop-code', desc: 'Master of Computer Applications & Software Engineering' },
    { name: 'BBA', duration: '3 Years', icon: 'fa-solid fa-book-open', desc: 'Bachelor of Business Administration & Management' }
  ];

  features = [
    { title: 'Easy Application', desc: 'Fill and submit your application online in simple steps.', icon: 'fa-solid fa-file-lines' },
    { title: 'Secure & Reliable', desc: 'Your data is secure with industry-standard protection.', icon: 'fa-solid fa-shield-halved' },
    { title: 'Track in Real-time', desc: 'Track your application status anytime, anywhere.', icon: 'fa-solid fa-chart-line' },
    { title: 'Timely Updates', desc: 'Get instant notifications on your application via email / SMS.', icon: 'fa-solid fa-bell' }
  ];

  constructor(public authService: AuthService, private router: Router) {}

  onApplyNow(): void {
    if (this.authService.isAuthenticated()) {
      if (this.authService.isAdmin()) {
        this.router.navigate(['/admin/dashboard']);
      } else {
        this.router.navigate(['/applicant/dashboard']);
      }
    } else {
      this.openPathway.emit();
    }
  }

  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
