import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PreceptorAlunoContextService } from '../services/preceptor-aluno-context.service';

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
  private disciplines: any[] = [];
  private LOCAL_DISC_KEY = 'mc_current_discipline_id';
  selectedAlunoName: string = '';
  private alunoChangedListener = (e: any) => {
    this.updateAlunoBadge();
  };
  private storageListener = (e: StorageEvent) => {
    // Atualização de usuário ainda mantém avatar / nome
    if (e.key === 'mc_user' && e.newValue) {
      try { this.loadAvatarIfAny(); } catch {}
    }
    if (e.key === this.LOCAL_DISC_KEY) {
      this.updateDisciplineLabel();
    }
  };
  private disciplineChangedListener = (e: any) => {
    this.updateDisciplineLabel();
  };
  constructor(private userService: UserService, private auth: AuthService, private http: HttpClient, private alunoCtx: PreceptorAlunoContextService, @Inject(PLATFORM_ID) private platformId: Object) {}

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
      const u = this.userService.getCurrentUser();
      this.userName = (u.name || '').split(' ')[0];
    }
    // Carrega avatar apenas no browser (evita SSR sem token)
    if (isPlatformBrowser(this.platformId)) {
      // Pequeno atraso para garantir que o token seja restaurado pelos storages
      setTimeout(() => { this.loadAvatarIfAny(); this.loadUserDetails(); }, 0);
      // Ouve alterações no usuário em cache para refletir disciplina no header
      window.addEventListener('storage', this.storageListener);
      window.addEventListener('mc:discipline-changed', this.disciplineChangedListener as any);
      window.addEventListener('mc:aluno-changed', this.alunoChangedListener as any);
      this.loadDisciplines();
      this.updateAlunoBadge();
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
      window.removeEventListener('mc:discipline-changed', this.disciplineChangedListener as any);
      window.removeEventListener('mc:aluno-changed', this.alunoChangedListener as any);
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

  private loadAvatarIfAny() {
    // Consultar cache e evitar 404s desnecessários quando não há avatar
    try {
      const raw = localStorage.getItem('mc_user') || sessionStorage.getItem('mc_user');
      const u = raw ? JSON.parse(raw) : null;
      if (!u || u.hasAvatar !== true) { this.clearAvatarUrl(); return; }
    } catch { /* ignore parse errors */ }
    this.loadAvatar();
  }

  private clearAvatarUrl() {
    if (this.avatarObjectUrl) {
      try { URL.revokeObjectURL(this.avatarObjectUrl); } catch {}
    }
    this.avatarObjectUrl = null;
    this.avatarUrl = '';
  }

  private updateDisciplineLabel() {
    try {
      const stored = localStorage.getItem(this.LOCAL_DISC_KEY);
      const id = stored ? parseInt(stored, 10) : null;
      if (id && this.disciplines.length) {
        const d = this.disciplines.find(x => x.id === id);
        if (d) {
          this.currentDisciplineLabel = `${d.code} - ${d.name}`;
          return;
        }
      }
      // Sem seleção ou não encontrada => limpa badge
      this.currentDisciplineLabel = '';
    } catch { this.currentDisciplineLabel = ''; }
  }

  private loadDisciplines() {
    this.http.get('/api/users/me/disciplines').subscribe({
      next: (list: any) => {
        this.disciplines = Array.isArray(list) ? list : [];
        this.updateDisciplineLabel();
      },
      error: _ => { this.disciplines = []; this.updateDisciplineLabel(); }
    });
  }

  private updateAlunoBadge(){
    const c = this.alunoCtx.getAluno();
    this.selectedAlunoName = c.name || '';
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
          // Disciplinas do preceptor ainda podem ser mostradas (fora do escopo atual do aluno)
          // tenta carregar avatar se perfil indica que há
          if (isPlatformBrowser(this.platformId)) this.loadAvatarIfAny();
          // Atualiza label (se for preceptor não dependemos mais do currentDisciplineCode)
          this.updateDisciplineLabel();
        } catch {}
      },
      error: _ => {}
    });
  }
}
