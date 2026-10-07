import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User, AuthResponse, UserRole } from '../../models/user.model';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Session = the JWT issued by the server (valid for 1 day) plus the signed-in user.
 * The token's own `exp` claim decides when the session ends; the server enforces the same expiry.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenKey = 'iem_auth_token';
  private userKey = 'iem_user_data';
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Signed-in user; null when signed out or the session has expired */
  public currentUser = signal<User | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    const token = this.storedToken();
    const user = this.getStoredUser();
    if (token && user && !this.isExpired(token)) {
      this.currentUser.set(user);
      this.scheduleExpiry(token);
    } else {
      this.clearSession();
    }
  }

  public get token(): string | null {
    const token = this.storedToken();
    return token && !this.isExpired(token) ? token : null;
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

  /** Where a signed-in user's dashboard is */
  public dashboardUrl(): string {
    return this.isAdmin() ? '/admin/dashboard' : '/applicant/dashboard';
  }

  public getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.token || ''}`
    });
  }

  public register(data: { name: string; email: string; password: string; phone?: string; role?: UserRole }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(tap((res) => this.startSession(res)));
  }

  public login(credentials: { email: string; password: string; role?: UserRole }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(tap((res) => this.startSession(res)));
  }

  public logout(): void {
    this.clearSession();
    this.router.navigate(['/']);
  }

  /** Session ended (expired or rejected by the server): sign out and ask the user to log in again */
  public expireSession(): void {
    const wasAdmin = this.isAdmin();
    this.clearSession();
    this.router.navigate([wasAdmin ? '/admin/login' : '/applicant/login'], { queryParams: { expired: 1 } });
  }

  private startSession(res: AuthResponse): void {
    if (!res.success || !res.token) return;
    try {
      localStorage.setItem(this.tokenKey, res.token);
      localStorage.setItem(this.userKey, JSON.stringify(res.user));
    } catch {
      // Storage blocked (private mode): the session lasts until the page is closed
    }
    this.currentUser.set(res.user);
    this.scheduleExpiry(res.token);
  }

  private clearSession(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    } catch {
      // ignore
    }
    this.currentUser.set(null);
  }

  /** Signs the user out the moment the token expires, even if the tab stays open */
  private scheduleExpiry(token: string): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const ms = this.expiresAt(token) - Date.now();
    // setTimeout cannot wait longer than ~24.8 days; tokens here last 1 day
    if (ms > 0 && ms < 2_000_000_000) this.expiryTimer = setTimeout(() => this.expireSession(), ms);
  }

  /** Expiry time (ms) from the JWT `exp` claim; 0 when the token cannot be read */
  private expiresAt(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }

  private isExpired(token: string): boolean {
    return this.expiresAt(token) <= Date.now();
  }

  private storedToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  private getStoredUser(): User | null {
    try {
      const data = localStorage.getItem(this.userKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}
