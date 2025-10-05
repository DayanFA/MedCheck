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
  checkIn(preceptorId: number, code: string, disciplineId?: number, lat?: number|null, lng?: number|null): Observable<any> {
    const body: any = { preceptorId, code };
    if (disciplineId) body.disciplineId = disciplineId;
    if (lat != null) body.lat = lat;
    if (lng != null) body.lng = lng;
    return this.http.post(`${this.base}/in`, body, { headers: this.authHeaders() });
  }
  checkOut(lat?: number|null, lng?: number|null): Observable<any> {
    const body: any = {};
    if (lat != null) body.lat = lat;
    if (lng != null) body.lng = lng;
    return this.http.post(`${this.base}/out`, body, { headers: this.authHeaders() });
  }
  sessions(start: string, end: string, disciplineId?: number): Observable<any> {
    let params = new HttpParams().set('start', start).set('end', end);
    if (disciplineId) params = params.set('disciplineId', String(disciplineId));
    return this.http.get(`${this.base}/sessions`, { headers: this.authHeaders(), params });
  }
  status(): Observable<any> { return this.http.get(`${this.base}/status`, { headers: this.authHeaders() }); }
  myDisciplines(): Observable<any[]> { return this.http.get<any[]>(`${this.base}/my-disciplines`, { headers: this.authHeaders() }); }
}
