import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';
  private tokenKey = 'token';
  private userKey = 'mc_user';

  constructor(private http: HttpClient) { }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/signin`, credentials);
  }

  signup(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup`, userData);
  }

  requestPasswordReset(email: string): Observable<any> {
    // backend endpoint será implementado: /api/auth/forgot-password
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, password });
  }

  me(): Observable<any> {
    const token = this.getToken();
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    return this.http.get(`${this.apiUrl}/me`, { headers });
  }

  setToken(token: string, remember: boolean) {
    if (typeof window === 'undefined') return; // SSR safety
    try {
      if (remember) {
        window.localStorage?.setItem(this.tokenKey, token);
        window.sessionStorage?.removeItem(this.tokenKey);
      } else {
        window.sessionStorage?.setItem(this.tokenKey, token);
        window.localStorage?.removeItem(this.tokenKey);
      }
    } catch {}
  }

  setUser(user: any, remember: boolean) {
    if (typeof window === 'undefined') return;
    try {
      const str = JSON.stringify(user || {});
      if (remember) {
        window.localStorage?.setItem(this.userKey, str);
        window.sessionStorage?.removeItem(this.userKey);
      } else {
        window.sessionStorage?.setItem(this.userKey, str);
        window.localStorage?.removeItem(this.userKey);
      }
      // Notifica ouvintes (ex.: header) sobre mudança do usuário
      window.dispatchEvent(new CustomEvent('mc:user-updated', { detail: user }));
    } catch {}
  }

  getRole(): string | null {
    const u = this.getUser();
    return u?.role || null;
  }

  getUser(): any {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage?.getItem(this.userKey) || window.sessionStorage?.getItem(this.userKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  clearUser() {
    if (typeof window === 'undefined') return;
    try { window.localStorage?.removeItem(this.userKey); window.sessionStorage?.removeItem(this.userKey); } catch {}
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage?.getItem(this.tokenKey) || window.sessionStorage?.getItem(this.tokenKey);
    } catch { return null; }
  }

  isRemembered(): boolean {
    if (typeof window === 'undefined') return false;
    try { return !!window.localStorage?.getItem(this.tokenKey); } catch { return false; }
  }

  clearToken() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.removeItem(this.tokenKey);
      window.sessionStorage?.removeItem(this.tokenKey);
  this.clearUser();
    } catch {}
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout() {
    this.clearToken();
  }
}
