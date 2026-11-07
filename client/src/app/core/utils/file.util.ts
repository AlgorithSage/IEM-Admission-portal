import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Opens an authenticated file (fetched as a Blob) in a new tab.
 * The tab is opened synchronously inside the click handler so popup blockers allow it,
 * with an immediate loading state, then pointed at the blob once it arrives.
 */
export function openBlobInNewTab(
  source: Observable<Blob>,
  onError: (message: string) => void,
  onComplete?: () => void
): void {
  const tab = window.open('', '_blank');
  if (tab && tab.document) {
    try {
      tab.document.title = 'Loading Document...';
      tab.document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#f8fafc;">
          <div style="background:#1e293b;padding:36px 44px;border-radius:14px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);text-align:center;max-width:380px;border:1px solid #334155;">
            <div style="width:42px;height:42px;border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:iem-spin 0.8s linear infinite;margin:0 auto 18px;"></div>
            <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:600;color:#f1f5f9;">Loading Document</h3>
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Retrieving your uploaded file from secure storage, please wait...</p>
          </div>
          <style>@keyframes iem-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
      `;
    } catch {
      // Ignored for restrictive environments
    }
  }

  source.subscribe({
    next: (blob) => {
      onComplete?.();
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.replace(url);
      } else {
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    },
    error: async (err) => {
      onComplete?.();
      const msg = await errorMessage(err);
      if (tab && tab.document) {
        try {
          tab.document.title = 'Unable to Load Document';
          tab.document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#f8fafc;">
              <div style="background:#1e293b;padding:36px 44px;border-radius:14px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);text-align:center;max-width:380px;border:1px solid #334155;">
                <div style="width:44px;height:44px;background:#450a0a;color:#f87171;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px;font-weight:bold;">&times;</div>
                <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:600;color:#fca5a5;">Could Not Open Document</h3>
                <p style="margin:0 0 20px 0;font-size:13px;color:#94a3b8;line-height:1.5;">${msg}</p>
                <button onclick="window.close()" style="background:#0284c7;color:#fff;border:none;padding:9px 20px;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">Close Tab</button>
              </div>
            </div>
          `;
        } catch {
          tab?.close();
        }
      } else {
        tab?.close();
      }
      onError(msg);
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
