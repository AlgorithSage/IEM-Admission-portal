import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApplicationService } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { Application } from '../../../models/application.model';

@Component({
  selector: 'app-status-tracker',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './status-tracker.component.html',
  styleUrls: ['./status-tracker.component.css']
})
export class StatusTrackerComponent implements OnInit {
  application: Application | null = null;
  loading = true;

  constructor(
    private applicationService: ApplicationService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.fetchApplication();
  }

  fetchApplication(): void {
    this.loading = true;
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        this.loading = false;
        this.application = res.application;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  printReceipt(): void {
    window.print();
  }
}
