import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DisciplineService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  get(id: number): Observable<{ id:number; code:string; name:string; hours:number; ciclo:number; preceptors: {id:number; name:string;}[] }> {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<{ id:number; code:string; name:string; hours:number; ciclo:number; preceptors: {id:number; name:string;}[] }>(`/api/disciplines/${id}`, { headers });
  }
}
