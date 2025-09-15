import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CpfPipe } from '../../pipes/cpf.pipe';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, CpfPipe],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent {
  private http = inject(HttpClient);
  loading = false;
  users: any[] = [];
  roles = ['ALUNO','PRECEPTOR','COORDENADOR','ADMIN'];
  msg = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<any[]>('/api/admin/users').subscribe({
      next: data => { this.users = data; this.loading = false; },
      error: _ => { this.msg = 'Falha ao carregar usuários'; this.loading = false; }
    });
  }

  changeRole(u: any, role: any) {
    const value = String(role);
    this.http.put(`/api/admin/users/${u.id}/role`, { role: value }).subscribe({
      next: _ => { this.msg = 'Role atualizada'; u.role = role; },
      error: _ => { this.msg = 'Falha ao atualizar role'; }
    });
  }

  deleteUser(u: any) {
    if (!confirm(`Excluir usuário ${u.name}?`)) return;
    this.http.delete(`/api/admin/users/${u.id}`).subscribe({
      next: _ => { this.msg = 'Usuário excluído'; this.users = this.users.filter(x => x.id !== u.id); },
      error: _ => { this.msg = 'Falha ao excluir'; }
    });
  }
}
