import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { User, AuthResponse, UserRole } from '../../models/user.model';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenKey = 'iem_auth_token';
  private userKey = 'iem_user_data';

  // Modern Angular Signal for reactive user state
  public currentUser = signal<User | null>(this.getStoredUser());

  constructor(private http: HttpClient, private router: Router) {}

  public get token(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  public isAuthenticated(): boolean {
    // Read the signal first: templates only re-render on login/logout if the signal is always read
    return !!this.currentUser() && !!this.token;
  }

  public isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  public isApplicant(): boolean {
    return this.currentUser()?.role === 'applicant';
  }

  public getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.token || ''}`
    });
  }

  public register(data: { name: string; email: string; password: string; phone?: string; role?: UserRole }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap((res) => {
        if (res.success && res.token) {
          this.setSession(res.token, res.user);
        }
      }),
      catchError((err) => {
        // Fallback for local frontend standalone testing if backend not yet running
        if (err.status === 0 || err.status === 404) {
          const mockUser: User = {
            _id: 'mock_' + Date.now(),
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role || 'applicant',
            createdAt: new Date().toISOString()
          };
          const mockRes: AuthResponse = {
            success: true,
            token: 'mock_jwt_token_' + Date.now(),
            user: mockUser,
            message: 'Registered successfully (Demo Session)'
          };
          this.setSession(mockRes.token, mockRes.user);
          return of(mockRes);
        }
        return throwError(() => err);
      })
    );
  }

  public login(credentials: { email: string; password: string; role?: UserRole }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => {
        if (res.success && res.token) {
          this.setSession(res.token, res.user);
        }
      }),
      catchError((err) => {
        // Fallback for demo credentials if backend server is offline
        if (err.status === 0 || err.status === 404) {
          const role: UserRole = credentials.email.includes('admin') || credentials.role === 'admin' ? 'admin' : 'applicant';
          const mockUser: User = {
            _id: 'usr_' + (role === 'admin' ? 'admin_01' : 'student_01'),
            name: role === 'admin' ? 'Admission Scrutiny Officer' : 'Aarav Sharma',
            email: credentials.email,
            phone: '+91 98765 43210',
            role: role,
            createdAt: new Date().toISOString()
          };
          const mockRes: AuthResponse = {
            success: true,
            token: 'mock_jwt_' + role + '_' + Date.now(),
            user: mockUser,
            message: 'Logged in successfully (Demo Session)'
          };
          this.setSession(mockRes.token, mockRes.user);
          return of(mockRes);
        }
        return throwError(() => err);
      })
    );
  }

  public logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    }
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  private setSession(token: string, user: User): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.tokenKey, token);
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
    this.currentUser.set(user);
  }

  private getStoredUser(): User | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(this.userKey);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
