import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  plannedSeconds: number;
  workedSeconds: number;
  status: 'NONE'|'BLUE'|'RED'|'YELLOW'|'GREEN'|'ORANGE';
  justificationStatus?: 'PENDING'|'APPROVED'|'REJECTED';
}

export interface InternshipPlanDto {
  id?: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  location?: string;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarServiceApi {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  getMonth(year: number, month: number) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<{ year:number; month:number; days: CalendarDay[]; plans: any[]; justifications: any[] }>(`/api/calendar/month`, { params: { year, month } as any, headers });
  }

  upsertPlan(plan: InternshipPlanDto) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.post<{ plan: InternshipPlanDto }>(`/api/calendar/plan`, plan, { headers });
  }

  deletePlan(id: number) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.delete<{ deleted: boolean }>(`/api/calendar/plan/${id}`, { headers });
  }

  justify(payload: { date: string; planId?: number; type?: string; reason: string; }) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.post(`/api/calendar/justify`, payload, { headers });
  }

  deleteJustification(id: number) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.delete<{ deleted: boolean }>(`/api/calendar/justify/${id}`, { headers });
  }

  deleteJustificationByDate(dateIso: string) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.delete<{ deleted: boolean }>(`/api/calendar/justify`, { headers, params: { date: dateIso } as any });
  }

  getSessions(startIso: string, endIso: string) {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<any[]>(`/api/check/sessions`, { params: { start: startIso, end: endIso } as any, headers });
  }
}
