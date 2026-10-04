import { Injectable, signal } from '@angular/core';

/** Counts shown next to sidebar items (e.g. applications waiting for review). */
@Injectable({ providedIn: 'root' })
export class NavBadgeService {
  readonly counts = signal<Record<string, number>>({});

  set(key: string, count: number): void {
    this.counts.update((all) => ({ ...all, [key]: count }));
  }
}
