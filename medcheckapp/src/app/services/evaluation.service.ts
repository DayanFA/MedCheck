import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EvaluationDetailsDimension {
  id: string;
  questions: { id: string; text: string; score?: number }[];
}
export interface EvaluationPayload {
  alunoId: number; weekNumber: number; disciplineId?: number;
  score?: number; comment?: string;
  details: { dimensions: { id: string; answers: Record<string, number> }[] };
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private base = '/api/preceptor';
  constructor(private http: HttpClient) {}

  get(alunoId: number, weekNumber: number, disciplineId?: number) : Observable<any> {
    let params = new HttpParams().set('alunoId', alunoId).set('weekNumber', weekNumber);
    if (disciplineId) params = params.set('disciplineId', disciplineId);
    return this.http.get(this.base + '/evaluation', { params });
  }

  save(payload: EvaluationPayload): Observable<any> {
    return this.http.post(this.base + '/evaluate', payload);
  }
}
