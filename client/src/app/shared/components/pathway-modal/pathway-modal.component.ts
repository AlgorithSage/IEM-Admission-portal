import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pathway-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pathway-modal.component.html',
  styleUrls: ['./pathway-modal.component.css']
})
export class PathwayModalComponent {
  @Output() close = new EventEmitter<void>();

  constructor(private router: Router) {}

  selectPathway(path: 'applicant' | 'admin'): void {
    this.close.emit();
    if (path === 'applicant') {
      this.router.navigate(['/applicant/login']);
    } else {
      this.router.navigate(['/admin/login']);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
