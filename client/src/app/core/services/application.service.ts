import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { Application, AdminStats, ApplicationStatus } from '../../models/application.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private apiUrl = environment.apiUrl;

  // In-memory fallback mock store for demo when backend is offline
  private mockApplications: Application[] = [
    {
      _id: 'app_101',
      applicant: { _id: 'usr_student_01', name: 'Aarav Sharma', email: 'aarav.sharma@gmail.com' },
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@gmail.com',
      phone: '+91 98301 23456',
      dob: '2005-04-12',
      gender: 'Male',
      address: 'Salt Lake Sector V, Kolkata, West Bengal - 700091',
      department: 'B.Tech',
      qualifyingExam: 'WBJEE / JEE Main 2026',
      passingYear: 2026,
      percentage: 92.5,
      document: {
        fileName: 'marksheet-1711001.pdf',
        originalName: '12th_Standard_Marksheet.pdf',
        filePath: 'http://localhost:5000/uploads/sample-marksheet.pdf',
        mimeType: 'application/pdf',
        fileSize: 1048576,
        uploadedAt: new Date(Date.now() - 86400000).toISOString()
      },
      status: 'Submitted',
      adminRemarks: 'Application submitted successfully. Awaiting scrutiny.',
      statusHistory: [
        {
          fromStatus: 'Submitted',
          toStatus: 'Submitted',
          changedAt: new Date(Date.now() - 86400000).toISOString(),
          remarks: 'Submitted by applicant'
        }
      ],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      _id: 'app_102',
      applicant: { _id: 'usr_student_02', name: 'Priya Mukherjee', email: 'priya.m@gmail.com' },
      fullName: 'Priya Mukherjee',
      email: 'priya.m@gmail.com',
      phone: '+91 98312 87654',
      dob: '2004-11-20',
      gender: 'Female',
      address: 'New Town, Kolkata, West Bengal - 700156',
      department: 'MBA',
      qualifyingExam: 'CAT / MAT 2025',
      passingYear: 2025,
      percentage: 88.0,
      document: {
        fileName: 'grad-marksheet-1711002.pdf',
        originalName: 'BSc_Graduation_Final_Grades.pdf',
        filePath: 'http://localhost:5000/uploads/sample-marksheet.pdf',
        mimeType: 'application/pdf',
        fileSize: 854200,
        uploadedAt: new Date(Date.now() - 172800000).toISOString()
      },
      status: 'Review',
      adminRemarks: 'Document marksheet verified. Under academic scrutiny.',
      statusHistory: [
        { fromStatus: 'Submitted', toStatus: 'Review', changedAt: new Date(Date.now() - 72000000).toISOString(), remarks: 'Marked for scrutiny' }
      ],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 72000000).toISOString()
    },
    {
      _id: 'app_103',
      applicant: { _id: 'usr_student_03', name: 'Rohan Sen', email: 'rohan.sen@gmail.com' },
      fullName: 'Rohan Sen',
      email: 'rohan.sen@gmail.com',
      phone: '+91 97480 11223',
      dob: '2003-08-15',
      gender: 'Male',
      address: 'Ballygunge, Kolkata, West Bengal - 700019',
      department: 'MCA',
      qualifyingExam: 'JECA 2026',
      passingYear: 2026,
      percentage: 84.5,
      document: {
        fileName: 'bca-marksheet-1711003.pdf',
        originalName: 'BCA_Transcript.pdf',
        filePath: 'http://localhost:5000/uploads/sample-marksheet.pdf',
        mimeType: 'application/pdf',
        fileSize: 1224000,
        uploadedAt: new Date(Date.now() - 259200000).toISOString()
      },
      status: 'Selected',
      adminRemarks: 'Eligible and approved for admission. Welcome to IEM MCA program!',
      statusHistory: [
        { fromStatus: 'Submitted', toStatus: 'Review', changedAt: new Date(Date.now() - 150000000).toISOString() },
        { fromStatus: 'Review', toStatus: 'Selected', changedAt: new Date(Date.now() - 50000000).toISOString(), remarks: 'Admission Granted' }
      ],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 50000000).toISOString()
    }
  ];

  constructor(private http: HttpClient, private authService: AuthService) {}

  public submitApplication(formData: FormData): Observable<{ success: boolean; application: Application; message?: string }> {
    return this.http.post<{ success: boolean; application: Application; message?: string }>(
      `${this.apiUrl}/applications`,
      formData,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      catchError((err) => {
        if (err.status === 0 || err.status === 404) {
          const user = this.authService.currentUser();
          const newApp: Application = {
            _id: 'app_' + Date.now(),
            applicant: user ? user._id : 'usr_guest',
            fullName: (formData.get('fullName') as string) || (user?.name ?? 'Applicant'),
            email: (formData.get('email') as string) || (user?.email ?? 'applicant@gmail.com'),
            phone: (formData.get('phone') as string) || '+91 99999 88888',
            dob: (formData.get('dob') as string) || '2005-01-01',
            gender: (formData.get('gender') as any) || 'Male',
            address: (formData.get('address') as string) || 'Kolkata, WB',
            department: (formData.get('department') as any) || 'B.Tech',
            qualifyingExam: (formData.get('qualifyingExam') as string) || 'Class 12th Board',
            passingYear: Number(formData.get('passingYear')) || 2026,
            percentage: Number(formData.get('percentage')) || 85.0,
            document: {
              fileName: 'marksheet-demo.pdf',
              originalName: (formData.get('marksheet') as File)?.name || 'marksheet.pdf',
              filePath: 'assets/sample-marksheet.pdf',
              mimeType: 'application/pdf',
              fileSize: 524288,
              uploadedAt: new Date().toISOString()
            },
            status: 'Submitted',
            adminRemarks: 'Application submitted successfully. Awaiting scrutiny.',
            statusHistory: [{ fromStatus: 'Submitted', toStatus: 'Submitted', changedAt: new Date().toISOString(), remarks: 'Form submitted' }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.mockApplications.unshift(newApp);
          return of({ success: true, application: newApp, message: 'Application submitted successfully (Offline Mode)' });
        }
        return throwError(() => err);
      })
    );
  }

  public getMyApplication(): Observable<{ success: boolean; application: Application | null }> {
    return this.http.get<{ success: boolean; application: Application | null }>(
      `${this.apiUrl}/applications/my-application`,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      catchError((err) => {
        if (err.status === 0 || err.status === 404) {
          const user = this.authService.currentUser();
          const found = this.mockApplications.find(a => 
            typeof a.applicant === 'object' ? a.applicant.email === user?.email : a.email === user?.email
          ) || this.mockApplications[0];
          return of({ success: true, application: found || null });
        }
        return throwError(() => err);
      })
    );
  }

  public getAdminStats(): Observable<{ success: boolean; stats: AdminStats }> {
    return this.http.get<{ success: boolean; stats: AdminStats }>(
      `${this.apiUrl}/admin/stats`,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      catchError((err) => {
        if (err.status === 0 || err.status === 404) {
          const stats: AdminStats = {
            total: this.mockApplications.length,
            byStatus: [
              { _id: 'Submitted', count: this.mockApplications.filter(a => a.status === 'Submitted').length },
              { _id: 'Review', count: this.mockApplications.filter(a => a.status === 'Review').length },
              { _id: 'Selected', count: this.mockApplications.filter(a => a.status === 'Selected').length },
              { _id: 'Rejected', count: this.mockApplications.filter(a => a.status === 'Rejected').length }
            ],
            byDepartment: [
              { _id: 'B.Tech', count: this.mockApplications.filter(a => a.department === 'B.Tech').length },
              { _id: 'M.Tech', count: this.mockApplications.filter(a => a.department === 'M.Tech').length },
              { _id: 'MBA', count: this.mockApplications.filter(a => a.department === 'MBA').length },
              { _id: 'MCA', count: this.mockApplications.filter(a => a.department === 'MCA').length },
              { _id: 'BBA', count: this.mockApplications.filter(a => a.department === 'BBA').length }
            ]
          };
          return of({ success: true, stats });
        }
        return throwError(() => err);
      })
    );
  }

  public getApplications(filter?: { status?: string; department?: string; search?: string }): Observable<{ success: boolean; applications: Application[] }> {
    let params: any = {};
    if (filter?.status) params.status = filter.status;
    if (filter?.department) params.department = filter.department;
    if (filter?.search) params.search = filter.search;

    return this.http.get<{ success: boolean; applications: Application[] }>(
      `${this.apiUrl}/admin/applications`,
      { headers: this.authService.getAuthHeaders(), params }
    ).pipe(
      catchError((err) => {
        if (err.status === 0 || err.status === 404) {
          let list = [...this.mockApplications];
          if (filter?.status && filter.status !== 'All') {
            list = list.filter(a => a.status === filter.status);
          }
          if (filter?.department && filter.department !== 'All') {
            list = list.filter(a => a.department === filter.department);
          }
          if (filter?.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(a => a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
          }
          return of({ success: true, applications: list });
        }
        return throwError(() => err);
      })
    );
  }

  public updateStatus(id: string, newStatus: ApplicationStatus, remarks?: string): Observable<{ success: boolean; application: Application; message?: string }> {
    return this.http.patch<{ success: boolean; application: Application; message?: string }>(
      `${this.apiUrl}/admin/applications/${id}/status`,
      { status: newStatus, remarks },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      catchError((err) => {
        if (err.status === 0 || err.status === 404) {
          const app = this.mockApplications.find(a => a._id === id);
          if (app) {
            // Validate allowed transitions on client side for fallback
            const ALLOWED: Record<ApplicationStatus, ApplicationStatus[]> = {
              'Submitted': ['Review'],
              'Review': ['Selected', 'Rejected'],
              'Selected': [],
              'Rejected': ['Review']
            };
            if (!ALLOWED[app.status]?.includes(newStatus)) {
              return throwError(() => ({
                error: { message: `Invalid status transition: Cannot transition from '${app.status}' to '${newStatus}'` }
              }));
            }
            app.statusHistory = app.statusHistory || [];
            app.statusHistory.push({
              fromStatus: app.status,
              toStatus: newStatus,
              changedAt: new Date().toISOString(),
              remarks: remarks || `Transitioned to ${newStatus}`
            });
            app.status = newStatus;
            app.adminRemarks = remarks || `Status changed to ${newStatus}`;
            app.updatedAt = new Date().toISOString();
            return of({ success: true, application: app, message: 'Status updated successfully (Demo Mode)' });
          }
        }
        return throwError(() => err);
      })
    );
  }
}
