import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() collapsed = false;
  @HostBinding('class.collapsed') get isCollapsed() { return this.collapsed; }
  activePath = '';
  role: string | null = null;

  constructor(private authService: AuthService, private router: Router, private toast: ToastService) {}

  ngOnInit(): void {
    this.activePath = this.router.url.split('?')[0];
    // Recupera role do usuário salvo
    try {
      const raw = localStorage.getItem('mc_user') || sessionStorage.getItem('mc_user');
      if (raw) this.role = JSON.parse(raw).role || null;
    } catch {}
    // Escuta mudanças de rota para atualizar highlight
    this.router.events.subscribe(() => {
      this.activePath = this.router.url.split('?')[0];
    });
  }

  logout() {
  this.authService.logout();
  this.toast.show('info', 'Sessão encerrada.');
    this.router.navigate(['/login']);
  }
}
