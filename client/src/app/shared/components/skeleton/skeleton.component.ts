import { Component, computed, input } from '@angular/core';

/**
 * Placeholder shown while content loads. Decorative only (aria-hidden): the surrounding region
 * sets aria-busy and announces "Loading" to assistive technology.
 *
 *   <app-skeleton variant="text" [lines]="3" />
 *   <app-skeleton variant="block" height="180px" />
 *   <app-skeleton variant="circle" width="40px" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @if (variant() === 'text') {
      @for (w of lineWidths(); track $index) {
        <span class="sk sk-line" [style.width]="w"></span>
      }
    } @else {
      <span class="sk" [class.sk-circle]="variant() === 'circle'" [class.sk-pill]="variant() === 'pill'"
        [style.width]="width()" [style.height]="height()"></span>
    }
  `,
  host: { 'aria-hidden': 'true', class: 'sk-host' },
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }
      .sk-line {
        height: 0.8em;
      }
      .sk-circle {
        border-radius: 50%;
        aspect-ratio: 1;
      }
      .sk-pill {
        border-radius: 999px;
      }
    `
  ]
})
export class SkeletonComponent {
  readonly variant = input<'text' | 'block' | 'circle' | 'pill'>('block');
  readonly lines = input(1);
  readonly width = input('100%');
  readonly height = input('16px');

  /** Text lines with a shorter last line, like real paragraphs */
  readonly lineWidths = computed(() =>
    Array.from({ length: this.lines() }, (_, i) => (i === this.lines() - 1 && this.lines() > 1 ? '62%' : this.width()))
  );
}
