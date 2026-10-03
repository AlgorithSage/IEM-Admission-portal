import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  AdminStats,
  Application,
  ApplicationDetail,
  ApplicationListItem,
  ApplicationStatus,
  CheckoutResult,
  PaymentOrder
} from '../../models/application.model';
import { environment } from '../../../environments/environment';

interface AppResponse {
  success: boolean;
  message?: string;
  application: Application;
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

  replaceDocument(docKey: string, uploadId: string): Observable<AppResponse> {
    return this.http.put<AppResponse>(`${this.api}/applications/my-application/documents/${encodeURIComponent(docKey)}`, { uploadId });
  }

  resubmit(): Observable<AppResponse> {
    return this.http.post<AppResponse>(`${this.api}/applications/my-application/resubmit`, {});
  }

  // ---------- Payment (Razorpay-compatible, mock checkout in test mode) ----------

  createPaymentOrder(): Observable<{ success: boolean; order: PaymentOrder; methods: string[] }> {
    return this.http.post<{ success: boolean; order: PaymentOrder; methods: string[] }>(`${this.api}/payments/order`, {});
  }

  mockCheckout(orderId: string, method: string, outcome: 'success' | 'failure'): Observable<CheckoutResult> {
    return this.http.post<CheckoutResult>(`${this.api}/payments/mock-checkout`, { orderId, method, outcome });
  }

  verifyPayment(result: CheckoutResult, method: string): Observable<AppResponse> {
    return this.http.post<AppResponse>(`${this.api}/payments/verify`, { ...result, method });
  }

  // ---------- Files (owner or admin; streamed with auth, never public URLs) ----------

  getDocument(appId: string, docKey: string): Observable<Blob> {
    return this.http.get(`${this.api}/applications/${appId}/documents/${encodeURIComponent(docKey)}`, { responseType: 'blob' });
  }

  getSlip(appId: string): Observable<Blob> {
    return this.http.get(`${this.api}/applications/${appId}/slip`, { responseType: 'blob' });
  }

  // ---------- Admin ----------

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<{ success: boolean; stats: AdminStats }>(`${this.api}/admin/stats`).pipe(map((r) => r.stats));
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
