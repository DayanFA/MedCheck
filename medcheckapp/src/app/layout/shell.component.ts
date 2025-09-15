import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnInit, OnDestroy {
  collapsed = false;
  userName = '';
  avatarUrl = '';
  private avatarObjectUrl: string | null = null;
  constructor(private userService: UserService, private auth: AuthService, private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    // Restaura estado do sidebar (persistência após F5)
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved === '1') this.collapsed = true;
    } catch { /* ignore storage errors */ }
    // Tenta pegar usuário real do AuthService (cache de login)
    const cached: any = (this.auth as any).getUser?.();
    if (cached && cached.name) {
      this.userName = (cached.name || '').split(' ')[0];
    } else {
      // Fallback antigo
      const u = this.userService.getCurrentUser();
      this.userName = (u.name || '').split(' ')[0];
    }
    // Carrega avatar apenas no browser (evita SSR sem token)
    if (isPlatformBrowser(this.platformId)) {
      // Pequeno atraso para garantir que o token seja restaurado pelos storages
      setTimeout(() => this.loadAvatar(), 0);
    }
  }
  toggleSidebar() {
    this.collapsed = !this.collapsed;
    try { localStorage.setItem('sidebarCollapsed', this.collapsed ? '1' : '0'); } catch {}
  }

  ngOnDestroy(): void {
    this.clearAvatarUrl();
  }

  private headers(): HttpHeaders | undefined {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined as any;
  }

  private loadAvatar() {
    this.http.get('/api/users/me/photo', { headers: this.headers(), responseType: 'blob' }).subscribe({
      next: blob => {
        this.clearAvatarUrl();
        const url = URL.createObjectURL(blob);
        this.avatarObjectUrl = url;
        this.avatarUrl = url;
      },
      error: _ => { this.clearAvatarUrl(); }
    });
  }

  private clearAvatarUrl() {
    if (this.avatarObjectUrl) {
      try { URL.revokeObjectURL(this.avatarObjectUrl); } catch {}
    }
    this.avatarObjectUrl = null;
    this.avatarUrl = '';
  }
}
