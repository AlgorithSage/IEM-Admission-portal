import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { COMPETITIVE_EXAMS, PROGRAMS, StreamOption } from '../../models/admission-rules';

const PROGRAM_ICONS: Record<string, string> = {
  'B.Tech': 'fa-solid fa-microchip',
  'M.Tech': 'fa-solid fa-gears',
  MBA: 'fa-solid fa-briefcase',
  'MBA (General Management)': 'fa-solid fa-briefcase',
  Management: 'fa-solid fa-chart-pie',
  'Hotel Management': 'fa-solid fa-hotel',
  'Computer Application': 'fa-solid fa-laptop-code'
};

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent {
  @Output() openPathway = new EventEmitter<void>();

  // Program cards come from the same catalogue the form and the server use
  readonly programs = PROGRAMS.map((p) => {
    const years = [...new Set(p.streams.map((s) => s.durationYears))].sort();
    return {
      name: p.name,
      duration: `${years.join(' / ')} Years`,
      icon: PROGRAM_ICONS[p.name] || 'fa-solid fa-graduation-cap'
    };
  });

  features = [
    { title: 'Apply Online', desc: 'Fill the form and upload documents from any device.', icon: 'fa-solid fa-file-lines' },
    { title: 'Pay Online', desc: 'Pay the application fee by UPI, card or net banking.', icon: 'fa-solid fa-indian-rupee-sign' },
    { title: 'Track Status', desc: 'See document verification and decisions as they happen.', icon: 'fa-solid fa-chart-line' },
    { title: 'Email Updates', desc: 'Get your application ID, admission slip and status changes by email.', icon: 'fa-solid fa-envelope' }
  ];

  // One row per stream for the eligibility & fees table
  readonly courseRows = PROGRAMS.flatMap((p) =>
    p.streams.map((stream) => ({
      program: p.name,
      stream,
      exams: COMPETITIVE_EXAMS.filter((e) => p.exams.includes(e.code)).map((e) => e.label).join(' / ')
    }))
  );

  constructor(public authService: AuthService, private router: Router) {}

  eligibilityText(stream: StreamOption): string {
    const e = stream.eligibility;
    const parts = [`Class X ${e.classX}%`, `Class XII ${e.classXII}%`];
    if (e.pcm !== undefined) parts.push(`PCM ${e.pcm}%`);
    if (e.graduation !== undefined) parts.push(`Graduation ${e.graduation}%`);
    if (e.maxGapYears !== undefined) parts.push(`max ${e.maxGapYears}-year gap after Class XII`);
    if (e.classXIISubject) parts.push('Maths / Business Maths / Computer Application / Computer Science in Class XII');
    return parts.join(', ');
  }

  inr(amount: number): string {
    return 'Rs. ' + amount.toLocaleString('en-IN');
  }

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
