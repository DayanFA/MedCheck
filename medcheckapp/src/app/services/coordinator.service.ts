import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CoordinatorService {
  private api = '/api/coord';
  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  listDisciplines(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/disciplinas`, { headers: this.authHeaders() });
  }

  listPreceptors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/preceptores`, { headers: this.authHeaders() });
  }

  listDisciplinePreceptors(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/disciplinas/${id}/preceptores`, { headers: this.authHeaders() });
  }

  linkPreceptor(id: number, preceptorId: number): Observable<any> {
    return this.http.post(`${this.api}/disciplinas/${id}/preceptores`, { preceptorId }, { headers: this.authHeaders() });
  }

  unlinkPreceptor(id: number, preceptorId: number): Observable<any> {
    return this.http.delete(`${this.api}/disciplinas/${id}/preceptores/${preceptorId}`, { headers: this.authHeaders() });
  }

  // Coordinators management (ADMIN only usage on UI)
  listCoordinators(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/coordenadores`, { headers: this.authHeaders() });
  }

  listDisciplineCoordinators(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/disciplinas/${id}/coordenadores`, { headers: this.authHeaders() });
  }

  linkCoordinator(id: number, coordinatorId: number): Observable<any> {
    return this.http.post(`${this.api}/disciplinas/${id}/coordenadores`, { coordinatorId }, { headers: this.authHeaders() });
  }

  unlinkCoordinator(id: number, coordinatorId: number): Observable<any> {
    return this.http.delete(`${this.api}/disciplinas/${id}/coordenadores/${coordinatorId}`, { headers: this.authHeaders() });
  }

  studentsByDiscipline(disciplineId: number, year?: number | string, page: number = 0, size: number = 8, q?: string,
    filters?: { fName?: boolean; fPhone?: boolean; fEmail?: boolean; fCpf?: boolean; statusIn?: boolean; statusOut?: boolean; preceptorId?: number; sort?: string }): Observable<any> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (year !== undefined) params = params.set('year', String(year));
    if (q) params = params.set('q', q);
    if (filters) {
      if (filters.fName !== undefined) params = params.set('fName', String(filters.fName));
      if (filters.fPhone !== undefined) params = params.set('fPhone', String(filters.fPhone));
      if (filters.fEmail !== undefined) params = params.set('fEmail', String(filters.fEmail));
      if (filters.fCpf !== undefined) params = params.set('fCpf', String(filters.fCpf));
      if (filters.statusIn !== undefined) params = params.set('statusIn', String(filters.statusIn));
      if (filters.statusOut !== undefined) params = params.set('statusOut', String(filters.statusOut));
      if (filters.preceptorId !== undefined && filters.preceptorId !== null) params = params.set('preceptorId', String(filters.preceptorId));
      if (filters.sort) params = params.set('sort', filters.sort);
    }
    return this.http.get(`${this.api}/disciplinas/${disciplineId}/alunos`, { headers: this.authHeaders(), params });
  }

  studentInfo(alunoId: number, disciplineId?: number): Observable<{ alunoId:number; name:string; cpf:string; discipline?: {id:number;code:string;name:string} }> {
    let params = new HttpParams().set('alunoId', alunoId);
    if (disciplineId) params = params.set('disciplineId', disciplineId);
    return this.http.get<{ alunoId:number; name:string; cpf:string; discipline?: {id:number;code:string;name:string} }>(`${this.api}/student-info`, { headers: this.authHeaders(), params });
  }

  // Avaliação final do coordenador
  getFinalEvaluation(alunoId: number, disciplineId: number): Observable<any> {
    const params = new HttpParams().set('alunoId', alunoId).set('disciplineId', disciplineId);
    return this.http.get<any>(`${this.api}/evaluate-final`, { headers: this.authHeaders(), params });
  }

  evaluateFinal(alunoId: number, disciplineId: number, score: number | null, comment: string | null): Observable<any> {
    const body: any = { alunoId, disciplineId };
    if (score !== null && score !== undefined) body.score = score;
    if (comment !== null && comment !== undefined) body.comment = comment;
    return this.http.post<any>(`${this.api}/evaluate-final`, body, { headers: this.authHeaders() });
  }

  deleteFinalEvaluation(alunoId: number, disciplineId: number): Observable<any> {
    const params = new HttpParams().set('alunoId', alunoId).set('disciplineId', disciplineId);
    return this.http.delete<any>(`${this.api}/evaluate-final`, { headers: this.authHeaders(), params });
  }

  // Final evaluation for the logged-in user (student)
  getMyFinalEvaluation(disciplineId?: number): Observable<any> {
    let params = new HttpParams();
    if (disciplineId != null) params = params.set('disciplineId', String(disciplineId));
    return this.http.get<any>(`/api/users/me/final-evaluation`, { headers: this.authHeaders(), params });
  }
}
