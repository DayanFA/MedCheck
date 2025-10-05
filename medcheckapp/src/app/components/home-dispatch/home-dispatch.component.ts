import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AlunoHomeComponent } from '../intern-home/intern-home.component';
import { PreceptorHomeComponent } from '../preceptor-home/preceptor-home.component';
import { CoordinatorHomeComponent } from '../coordinator-home/coordinator-home.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, AlunoHomeComponent, PreceptorHomeComponent, CoordinatorHomeComponent],
  template: `
    <ng-container [ngSwitch]="role">
      <app-aluno-home *ngSwitchCase="'ALUNO'"></app-aluno-home>
      <app-coordinator-home *ngSwitchCase="'COORDENADOR'"></app-coordinator-home>
      <app-preceptor-home *ngSwitchCase="'PRECEPTOR'"></app-preceptor-home>
      <app-preceptor-home *ngSwitchCase="'ADMIN'"></app-preceptor-home>
      <div *ngSwitchDefault class="p-4 text-muted small">Carregando...</div>
    </ng-container>
  `
})
export class HomeComponent implements OnInit {
  role: string | null = null;
  constructor(private auth: AuthService) {}
  ngOnInit(): void {
    const cached: any = (this.auth as any).getUser?.();
    this.role = cached?.role ? String(cached.role).toUpperCase() : null;
    if (!this.role) {
      // Fallback async
      this.auth.me?.().subscribe({
        next: (u: any) => this.role = u?.role ? String(u.role).toUpperCase() : null,
        error: _ => this.role = null
      });
    }
  }
}
