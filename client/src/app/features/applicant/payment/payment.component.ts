import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs';
import { ApplicationService } from '../../../core/services/application.service';
import { Application, PaymentOrder } from '../../../models/application.model';
import { apiError, downloadBlob, errorMessage } from '../../../core/utils/file.util';

type Stage = 'loading' | 'summary' | 'checkout' | 'processing' | 'done';

// State changed by HTTP callbacks lives in signals: components are OnPush/zoneless by default (Angular 22)
@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit {
  readonly stage = signal<Stage>('loading');
  readonly application = signal<Application | null>(null);
  readonly order = signal<PaymentOrder | null>(null);
  readonly methods = signal<string[]>([]);
  readonly error = signal('');
  readonly info = signal('');
  readonly downloading = signal(false);
  method = 'UPI';

  constructor(private applicationService: ApplicationService, private router: Router) {}

  ngOnInit(): void {
    this.applicationService.getMyApplication().subscribe({
      next: ({ application }) => {
        if (!application) {
          this.router.navigate(['/applicant/apply']);
          return;
        }
        this.application.set(application);
        this.stage.set(application.status === 'Payment Pending' ? 'summary' : 'done');
      },
      error: (err) => {
        this.error.set(apiError(err, 'Could not load your application.'));
        this.stage.set('summary');
      }
    });
  }

  get amountRupees(): number {
    const order = this.order();
    return order ? order.amount / 100 : 0;
  }

  /** Step 1: create (or reuse) the gateway order, then open checkout */
  startPayment(): void {
    this.error.set('');
    this.info.set('');
    this.applicationService.createPaymentOrder().subscribe({
      next: (res) => {
        this.order.set(res.order);
        this.methods.set(res.methods);
        this.method = res.methods[0];
        this.stage.set('checkout');
      },
      error: (err) => {
        if (err.status === 409 && err.error?.application) {
          this.application.set(err.error.application);
          this.stage.set('done');
          return;
        }
        this.error.set(apiError(err, 'Could not start the payment.'));
      }
    });
  }

  /** Step 2 (mock gateway) + Step 3 (server-side signature verification) */
  pay(outcome: 'success' | 'failure'): void {
    const order = this.order();
    if (!order) return;
    this.stage.set('processing');
    this.error.set('');
    this.applicationService
      .mockCheckout(order.orderId, this.method, outcome)
      .pipe(switchMap((result) => this.applicationService.verifyPayment(result, this.method)))
      .subscribe({
        next: (res) => {
          this.application.set(res.application);
          this.info.set(res.message || '');
          this.stage.set('done');
        },
        error: (err) => {
          this.error.set(apiError(err, 'Payment failed. No money was taken. Please try again.'));
          this.stage.set('summary');
        }
      });
  }

  cancelCheckout(): void {
    this.stage.set('summary');
    this.info.set('Payment cancelled. You can pay any time from this page.');
  }

  downloadSlip(): void {
    const app = this.application();
    if (!app) return;
    this.downloading.set(true);
    this.applicationService.getSlip(app._id).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        downloadBlob(blob, `Admission-Slip-${app.applicationId}.pdf`);
      },
      error: async (err) => {
        this.downloading.set(false);
        this.error.set(await errorMessage(err, 'Could not download the slip.'));
      }
    });
  }
}
