import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApplicationService } from '../../../core/services/application.service';
import { AuditEntry } from '../../../models/application.model';
import { apiError } from '../../../core/utils/file.util';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, StatusLabelPipe, FormsModule, RouterModule],
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.css']
})
export class AuditLogComponent implements OnInit {
  readonly items = signal<AuditEntry[]>([]);
  readonly actions = signal<string[]>([]);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');
  page = 1;
  action = '';

  constructor(private applicationService: ApplicationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.applicationService.getAuditLog(this.page, this.action).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.pages.set(Math.max(1, res.pages));
        this.actions.set(res.actions);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Could not load the audit log.'));
      }
    });
  }

  onFilter(): void {
    this.page = 1;
    this.load();
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page = page;
    this.load();
  }

}
