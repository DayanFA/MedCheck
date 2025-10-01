import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PreceptorService {
  private base = '/api/preceptor';
  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  students(
    year?: number,
    page: number = 0,
    size: number = 8,
    q?: string,
    filters?: { fName?: boolean; fPhone?: boolean; fEmail?: boolean; fCpf?: boolean; statusIn?: boolean; statusOut?: boolean }
  ): Observable<any> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (year) params = params.set('year', year);
    if (q) params = params.set('q', q);
    if (filters) {
      if (filters.fName !== undefined) params = params.set('fName', String(filters.fName));
      if (filters.fPhone !== undefined) params = params.set('fPhone', String(filters.fPhone));
      if (filters.fEmail !== undefined) params = params.set('fEmail', String(filters.fEmail));
      if (filters.fCpf !== undefined) params = params.set('fCpf', String(filters.fCpf));
      if (filters.statusIn !== undefined) params = params.set('statusIn', String(filters.statusIn));
      if (filters.statusOut !== undefined) params = params.set('statusOut', String(filters.statusOut));
    }
    return this.http.get(`${this.base}/students`, { headers: this.authHeaders(), params });
  }

  disciplines() {
    return this.http.get<{ items: { id:number; code:string; name:string; hours:number; ciclo:number; }[] }>(`${this.base}/disciplines`, { headers: this.authHeaders() });
  }

  weekReport(weekNumber: number, alunoId: number, disciplineId?: number) {
    const params: any = { weekNumber, alunoId };
    if (disciplineId) params.disciplineId = disciplineId;
    return this.http.get<{ weekNumber:number; count:number; plans:any[]; discipline?: any }>(`/api/calendar/week`, { headers: this.authHeaders(), params });
  }

  studentInfo(alunoId: number, disciplineId?: number) {
    const params: any = { alunoId };
    if (disciplineId) params.disciplineId = disciplineId;
    return this.http.get<{ alunoId:number; name:string; cpf:string; discipline?: {id:number;code:string;name:string}; preceptor:any }>(`${this.base}/student-info`, { headers: this.authHeaders(), params });
  }
}
