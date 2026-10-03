import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Opens an authenticated file (fetched as a Blob) in a new tab.
 * The tab is opened synchronously inside the click handler so popup blockers allow it,
 * then pointed at the blob once it arrives.
 */
export function openBlobInNewTab(source: Observable<Blob>, onError: (message: string) => void): void {
  const tab = window.open('', '_blank');
  source.subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    error: async (err) => {
      tab?.close();
      onError(await errorMessage(err));
    }
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Extracts the API error message, including from Blob error bodies of file requests. */
export async function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): Promise<string> {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (err.error instanceof Blob) {
      try {
        return JSON.parse(await err.error.text()).message || fallback;
      } catch {
        return fallback;
      }
    }
    return err.error?.message || fallback;
  }
  return fallback;
}

/** Synchronous variant for JSON error responses. */
export function apiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    return err.error?.message || fallback;
  }
  return fallback;
}
