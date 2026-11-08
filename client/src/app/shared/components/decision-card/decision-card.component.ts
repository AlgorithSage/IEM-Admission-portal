import { AfterViewInit, Component, ElementRef, OnDestroy, computed, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationService } from '../../../core/services/application.service';
import { downloadBlob, errorMessage } from '../../../core/utils/file.util';
import { Application } from '../../../models/application.model';

/**
 * The final admission decision, shown to the applicant.
 *   Approved — celebratory: medallion, congratulations, confetti burst (once per device, skipped
 *              when the user prefers reduced motion) and the next steps.
 *   Rejected — calm and respectful: the reason and what the applicant can do next.
 */
@Component({
  selector: 'app-decision-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './decision-card.component.html',
  styleUrls: ['./decision-card.component.css']
})
export class DecisionCardComponent implements AfterViewInit, OnDestroy {
  readonly application = input.required<Application>();
  /** Compact version for the dashboard (no next-steps list) */
  readonly compact = input(false);

  readonly approved = computed(() => this.application().status === 'Selected');
  readonly firstName = computed(() => (this.application().fullName || '').trim().split(/\s+/)[0] || 'there');
  readonly decidedAt = computed(() => {
    const h = [...(this.application().statusHistory || [])].reverse().find((e) => e.toStatus === this.application().status);
    return h?.changedAt;
  });
  /** Remarks the office wrote, unless it is only the generic default */
  readonly remarks = computed(() => {
    const r = (this.application().adminRemarks || '').trim();
    return /^Your application has (been approved|not been approved)\.$/.test(r) ? '' : r;
  });

  readonly downloading = signal(false);
  readonly error = signal('');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('confetti');
  private frame = 0;

  constructor(private applicationService: ApplicationService) {}

  ngAfterViewInit(): void {
    if (!this.approved()) return;
    const key = `iem_celebrated_${this.application()._id}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === '1';
      localStorage.setItem(key, '1');
    } catch {
      // storage blocked: celebrate anyway
    }
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!seen && !reduced) this.burst();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  downloadSlip(): void {
    const app = this.application();
    this.downloading.set(true);
    this.error.set('');
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

  /** Lightweight confetti on a canvas over the card (no library) */
  private burst(): void {
    const el = this.canvas()?.nativeElement;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    cancelAnimationFrame(this.frame);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = el.clientWidth;
    const h = el.clientHeight;
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#f59e0b', '#10b981', '#1e3a8a', '#ef4444', '#fbbf24', '#ffffff'];
    const pieces = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? 0 : w,
        y: h * 0.75,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 7),
        vy: -(7 + Math.random() * 9),
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[i % colors.length]
      };
    });
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - t / 3200);
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < 3200) this.frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
