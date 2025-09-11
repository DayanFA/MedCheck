import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CheckInService {
  private base = '/api/check';
  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  currentCode(): Observable<any> { return this.http.get(`${this.base}/code`, { headers: this.authHeaders() }); }
  checkIn(preceptorId: number, code: string): Observable<any> { return this.http.post(`${this.base}/in`, { preceptorId, code }, { headers: this.authHeaders() }); }
  checkOut(): Observable<any> { return this.http.post(`${this.base}/out`, {}, { headers: this.authHeaders() }); }
  sessions(start: string, end: string): Observable<any> { return this.http.get(`${this.base}/sessions`, { headers: this.authHeaders(), params: new HttpParams().set('start', start).set('end', end) }); }
  status(): Observable<any> { return this.http.get(`${this.base}/status`, { headers: this.authHeaders() }); }
}
