import { Component, OnDestroy, OnInit } from '@angular/core';
import { UserService, CurrentUser } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './intern-home.component.html',
  styleUrl: './intern-home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  user!: CurrentUser;
  currentTime = '';
  private intervalId?: number;
  firstName = '';
  inService = false; // derived from open session
  performing = false;

  loading = true;
  constructor(private userService: UserService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const cached = (this.auth as any).getUser?.();
    if (cached && cached.name) {
      this.user = {
        name: cached.name,
        matricula: cached.matricula || '',
        cpf: cached.cpf || '',
        email: cached.email || '',
        status: 'Em serviço',
        performedHours: '00:00:00'
      };
      this.inService = this.user.status === 'Em serviço';
      this.firstName = (this.user.name || '').split(' ')[0];
      this.loading = false;
    } else {
      this.auth.me().subscribe({
        next: data => {
          this.user = {
            name: data?.name || '',
            matricula: data?.matricula || '',
            cpf: data?.cpf || '',
            email: data?.email || '',
            status: 'Em serviço',
            performedHours: '00:00:00'
          };
          this.inService = this.user.status === 'Em serviço';
          if (!this.user.name) {
            this.router.navigate(['/login']);
            return;
          }
          this.firstName = (this.user.name || '').split(' ')[0];
          this.loading = false;
        },
        error: _ => this.router.navigate(['/login'])
      });
    }
    this.updateTime();
    this.intervalId = window.setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) window.clearInterval(this.intervalId);
  }

  private updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('pt-BR', { hour12: false });
  }

  onPrimaryAction() {
    // Agora sempre redireciona para a página de Check-In, conforme solicitado.
    if (this.performing) return;
    this.performing = true;
    this.router.navigate(['/checkin']).finally(() => this.performing = false);
  }
}

// Backwards compatibility alias (remove later if unused)
export const InternHomeComponent = HomeComponent;
