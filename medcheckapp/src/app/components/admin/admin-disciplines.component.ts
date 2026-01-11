import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin-disciplines',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-disciplines.component.html',
  styleUrls: ['./admin-disciplines.component.scss']
})
export class AdminDisciplinesComponent {
  private http = inject(HttpClient);
  loading = false;
  data: any[] = [];
  msg = '';

  ngOnInit() { this.load(); }
  load() {
    this.loading = true;
    this.http.get<any[]>('/api/admin/disciplines').subscribe({
      next: d => { this.data = d; this.loading = false; },
      error: _ => { this.msg = 'Falha ao carregar disciplinas'; this.loading = false; }
    });
  }
}
