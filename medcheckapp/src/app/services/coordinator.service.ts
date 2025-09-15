import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CoordinatorService {
  private api = '/api/coord';
  constructor(private http: HttpClient) {}

  listDisciplines(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/disciplinas`);
  }

  listPreceptors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/preceptores`);
  }

  listDisciplinePreceptors(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/disciplinas/${id}/preceptores`);
  }

  linkPreceptor(id: number, preceptorId: number): Observable<any> {
    return this.http.post(`${this.api}/disciplinas/${id}/preceptores`, { preceptorId });
  }

  unlinkPreceptor(id: number, preceptorId: number): Observable<any> {
    return this.http.delete(`${this.api}/disciplinas/${id}/preceptores/${preceptorId}`);
  }
}
