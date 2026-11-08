import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import {
  AdminOverview,
  AdminStats,
  AuditEntry,
  Application,
  ApplicationDetail,
  ApplicationListItem,
  ApplicationStatus,
  CheckoutResult,
  PaymentOrder,
  FeeQuote
} from '../../models/application.model';
import { environment } from '../../../environments/environment';

interface AppResponse {
  success: boolean;
  message?: string;
  application: Application;
}

/** Which confirmation emails reached the mail server after payment */
export interface PaymentEmails {
  applicationId: boolean;
  admissionSlip: boolean;
  paymentReceipt?: boolean;
}

/** A document attached to a saved draft (already uploaded, not yet submitted) */
export interface DraftDocument {
  uploadId: string;
  name: string;
  type: string;
  size: number;
}

export interface ApplicationDraft {
  data: Record<string, any>;
  documents: Record<string, DraftDocument>;
  step: string;
  updatedAt: string;
}

export interface ListFilter {
  status?: string;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Talks to the REST API. Auth headers are added by the auth interceptor. */
@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ---------- Applicant ----------

  /** body.documents maps document slots to upload IDs from UploadService */
  submitApplication(body: object): Observable<AppResponse> {
    return this.http.post<AppResponse>(`${this.api}/applications`, body);
  }

  getMyApplication(): Observable<{ success: boolean; application: Application | null }> {
    return this.http.get<{ success: boolean; application: Application | null }>(`${this.api}/applications/my-application`);
  }

  getDraft(): Observable<ApplicationDraft | null> {
    return this.http.get<{ draft: ApplicationDraft | null }>(`${this.api}/applications/my-draft`).pipe(map((r) => r.draft));
  }

  saveDraft(draft: { data: object; documents: Record<string, DraftDocument>; step: string }): Observable<ApplicationDraft> {
    return this.http.put<{ draft: ApplicationDraft }>(`${this.api}/applications/my-draft`, draft).pipe(map((r) => r.draft));
  }

  private readonly docCache = new Map<string, Blob>();

  replaceDocument(docKey: string, uploadId: string): Observable<AppResponse> {
    return this.http
      .put<AppResponse>(`${this.api}/applications/my-application/documents/${encodeURIComponent(docKey)}`, { uploadId })
      .pipe(
        tap(() => {
          // Clear any cached copy of this replaced document
          for (const key of this.docCache.keys()) {
            if (key.includes(`:${docKey}:`)) this.docCache.delete(key);
          }
        })
      );
  }

  resubmit(): Observable<AppResponse> {
    return this.http.post<AppResponse>(`${this.api}/applications/my-application/resubmit`, {});
  }

  // ---------- Payment (Razorpay-compatible, mock checkout in test mode) ----------

  getFee(): Observable<{ success: boolean; fee: FeeQuote }> {
    return this.http.get<{ success: boolean; fee: FeeQuote }>(`${this.api}/payments/fee`);
  }

  createPaymentOrder(): Observable<{ success: boolean; order: PaymentOrder; methods: string[] }> {
    return this.http.post<{ success: boolean; order: PaymentOrder; methods: string[] }>(`${this.api}/payments/order`, {});
  }

  mockCheckout(orderId: string, method: string, outcome: 'success' | 'failure'): Observable<CheckoutResult> {
    return this.http.post<CheckoutResult>(`${this.api}/payments/mock-checkout`, { orderId, method, outcome });
  }

  verifyPayment(result: CheckoutResult, method: string): Observable<AppResponse & { emails: PaymentEmails | null }> {
    return this.http.post<AppResponse & { emails: PaymentEmails | null }>(`${this.api}/payments/verify`, { ...result, method });
  }

  // ---------- Files (owner or admin; streamed with auth, never public URLs) ----------

  /**
   * A stored document. Cached per *file* (slot + upload time), not per slot: when a file is replaced
   * the new one gets a new cache entry, so no screen can show the old file or a stale miss.
   */
  getDocument(appId: string, docKey: string, uploadedAt?: string): Observable<Blob> {
    const cacheKey = `${appId}:${docKey}:${uploadedAt || ''}`;
    if (!uploadedAt) {
      return this.http.get(`${this.api}/applications/${appId}/documents/${encodeURIComponent(docKey)}`, { responseType: 'blob' });
    }
    const cached = this.docCache.get(cacheKey);
    if (cached) return of(cached);
    return this.http
      .get(`${this.api}/applications/${appId}/documents/${encodeURIComponent(docKey)}`, { responseType: 'blob' })
      .pipe(tap((b) => this.docCache.set(cacheKey, b)));
  }

  getReceipt(appId: string): Observable<Blob> {
    return this.http.get(`${this.api}/applications/${appId}/receipt`, { responseType: 'blob' });
  }

  getSlip(appId: string): Observable<Blob> {
    return this.http.get(`${this.api}/applications/${appId}/slip`, { responseType: 'blob' });
  }

  // ---------- Admin ----------

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<{ success: boolean; stats: AdminStats }>(`${this.api}/admin/stats`).pipe(map((r) => r.stats));
  }

  getAdminOverview(year?: number): Observable<AdminOverview> {
    const params = year ? new HttpParams().set('year', String(year)) : undefined;
    return this.http.get<{ overview: AdminOverview }>(`${this.api}/admin/overview`, { params }).pipe(map((r) => r.overview));
  }

  getAuditLog(page = 1, action = ''): Observable<{ items: AuditEntry[]; total: number; page: number; pages: number; actions: string[] }> {
    let params = new HttpParams().set('page', String(page));
    if (action) params = params.set('action', action);
    return this.http.get<{ items: AuditEntry[]; total: number; page: number; pages: number; actions: string[] }>(`${this.api}/admin/audit`, { params });
  }

  getApplications(filter: ListFilter): Observable<{ applications: ApplicationListItem[]; total: number; page: number; pages: number }> {
    return this.http.get<{ applications: ApplicationListItem[]; total: number; page: number; pages: number }>(
      `${this.api}/admin/applications`,
      { params: this.toParams(filter) }
    );
  }

  getApplicationDetail(id: string): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${this.api}/admin/applications/${id}`);
  }

  verifyDocument(id: string, docKey: string, status: 'Verified' | 'Rejected', remarks: string, version: number): Observable<AppResponse> {
    return this.http.patch<AppResponse>(`${this.api}/admin/applications/${id}/documents/${encodeURIComponent(docKey)}`, { status, remarks, version });
  }

  updateStatus(id: string, status: ApplicationStatus, remarks: string, version: number): Observable<AppResponse> {
    return this.http.patch<AppResponse>(`${this.api}/admin/applications/${id}/status`, { status, remarks, version });
  }

  deleteApplication(id: string, confirm: string, reason: string, eraseAccount = false): Observable<{ success: boolean; message: string; accountErased: boolean }> {
    return this.http.delete<{ success: boolean; message: string; accountErased: boolean }>(`${this.api}/admin/applications/${id}`, { body: { confirm, reason, eraseAccount } });
  }

  exportReport(filter: ListFilter): Observable<Blob> {
    return this.http.get(`${this.api}/admin/report.csv`, { params: this.toParams(filter), responseType: 'blob' });
  }

  private toParams(filter: ListFilter): HttpParams {
    let params = new HttpParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'All') params = params.set(k, String(v));
    });
    return params;
  }
}
