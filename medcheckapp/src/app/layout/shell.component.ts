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
  currentDisciplineLabel = '';
  private storageListener = (e: StorageEvent) => {
    if (e.key === 'mc_user' && e.newValue) {
      try {
        const u = JSON.parse(e.newValue);
        this.applyDisciplineFromUser(u);
        // Reload avatar when user cache changes (e.g., after updating profile photo)
        this.loadAvatar();
      } catch {}
    }
  };
  private userUpdatedListener = (e: any) => {
    try { this.applyDisciplineFromUser(e?.detail); this.loadAvatar(); } catch {}
  };
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
      this.applyDisciplineFromUser(cached);
    } else {
      // Fallback antigo
      const u = this.userService.getCurrentUser();
      this.userName = (u.name || '').split(' ')[0];
      this.applyDisciplineFromUser(u as any);
    }
    // Carrega avatar apenas no browser (evita SSR sem token)
    if (isPlatformBrowser(this.platformId)) {
      // Pequeno atraso para garantir que o token seja restaurado pelos storages
      setTimeout(() => { this.loadAvatar(); this.loadUserDetails(); }, 0);
      // Ouve alterações no usuário em cache para refletir disciplina no header
      window.addEventListener('storage', this.storageListener);
      window.addEventListener('mc:user-updated', this.userUpdatedListener as any);
    }
  }
  toggleSidebar() {
    this.collapsed = !this.collapsed;
    try { localStorage.setItem('sidebarCollapsed', this.collapsed ? '1' : '0'); } catch {}
  }

  ngOnDestroy(): void {
    this.clearAvatarUrl();
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('storage', this.storageListener);
      window.removeEventListener('mc:user-updated', this.userUpdatedListener as any);
    }
  }

  private headers(): HttpHeaders | undefined {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined as any;
  }

  private loadAvatar() {
    // Cache-bust to ensure we fetch the latest avatar after updates
    const ts = Date.now();
    this.http.get(`/api/users/me/photo?t=${ts}` as string, { headers: this.headers(), responseType: 'blob' }).subscribe({
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

  private applyDisciplineFromUser(u: any) {
    const code = u?.currentDisciplineCode;
    const name = u?.currentDisciplineName;
    if (code && name) {
      this.currentDisciplineLabel = `${code} - ${name}`;
      return;
    }
    // Se for preceptor e tiver disciplinas vinculadas, exibir também no cabeçalho (mesmo formato: CODE - Nome)
    if (u?.role === 'PRECEPTOR' && Array.isArray(u?.preceptorDisciplines) && u.preceptorDisciplines.length > 0) {
      const discs = u.preceptorDisciplines as Array<any>;
      if (discs.length === 1) {
        const d = discs[0];
        if (d?.code && d?.name) {
          this.currentDisciplineLabel = `${d.code} - ${d.name}`;
          return;
        }
      }
      // múltiplas: lista todos como "CODE - Nome"
      const pairs = discs
        .filter(d => d && d.code && d.name)
        .map(d => `${d.code} - ${d.name}`);
      this.currentDisciplineLabel = pairs.join(' | ');
      return;
    }
    if (u?.role === 'PRECEPTOR') {
      // Não exibir badge quando não houver vínculo
      this.currentDisciplineLabel = '';
      return;
    }
    this.currentDisciplineLabel = '';
  }

  private loadUserDetails() {
    // Enriquecer cache com dados detalhados (inclui preceptorDisciplines)
    this.http.get('/api/users/me').subscribe({
      next: (profile: any) => {
        try {
          const raw = localStorage.getItem('mc_user') || sessionStorage.getItem('mc_user') || '{}';
          const cached = JSON.parse(raw || '{}');
          const merged = { ...cached, ...profile };
          const remember = !!localStorage.getItem('token');
          // atualiza cache e notifica ouvintes
          localStorage.removeItem('mc_user');
          sessionStorage.removeItem('mc_user');
          if (remember) localStorage.setItem('mc_user', JSON.stringify(merged)); else sessionStorage.setItem('mc_user', JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('mc:user-updated', { detail: merged }));
          // aplica imediatamente no header
          this.applyDisciplineFromUser(merged);
        } catch {}
      },
      error: _ => {}
    });
  }
}
