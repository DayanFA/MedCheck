import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
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
export class ShellComponent implements OnInit, OnDestroy, AfterViewInit {
  collapsed = false;
  userName: string = '';
  avatarUrl: string = '';
  private userPreference: 'collapsed' | 'expanded' = 'expanded';
  private AUTO_BREAKPOINT = 960; // px collapse sidebar
  private TOP_NARROW_BREAKPOINT = 860; // px to switch discipline label formatting & hide 'Visualizando:'
  isNarrowTop = false;
  disciplineCode: string = '';
  disciplineName: string = '';
  private avatarObjectUrl: string | null = null;
  currentDisciplineLabel = '';
  private disciplines: any[] = [];
  private LOCAL_DISC_KEY = 'mc_current_discipline_id';
  selectedAlunoName: string = '';
  showWelcome: boolean = true; // control to hide welcome text before wrapping
  userRole: string = '';

  // Template element refs for dynamic measurement
  @ViewChild('topBar') topBarRef?: ElementRef<HTMLElement>;
  @ViewChild('rightInfo') rightInfoRef?: ElementRef<HTMLElement>;
  @ViewChild('hamburgerBtn') hamburgerRef?: ElementRef<HTMLElement>;
  @ViewChild('welcomeRef') welcomeRef?: ElementRef<HTMLElement>;
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
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved === '1') { this.userPreference = 'collapsed'; }
      else if (saved === '0') { this.userPreference = 'expanded'; }
    } catch {}
    // Apply initial based on viewport
    this.applyResponsiveForced();
    this.updateTopNarrowState();
    // Tenta pegar usuário real do AuthService (cache de login)
    const cached: any = (this.auth as any).getUser?.();
    if (cached && cached.name) {
      this.userName = (cached.name || '').split(' ')[0];
      this.userRole = cached.role || '';
    } else {
      const u = this.userService.getCurrentUser();
      this.userName = (u.name || '').split(' ')[0];
  this.userRole = (u as any).role || '';
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
      window.addEventListener('resize', this.onResizeForced, { passive: true });
    }
  }
  ngAfterViewInit(): void {
    // Delay to allow view to settle then measure
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.recalculateWelcomeVisibility(), 0);
    }
  }
  toggleSidebar() {
    // Only toggle when in large screen context. If small, we still allow user to open, but userPreference updates so when they return to large it reflects.
    this.collapsed = !this.collapsed;
    this.userPreference = this.collapsed ? 'collapsed' : 'expanded';
    try { localStorage.setItem('sidebarCollapsed', this.collapsed ? '1' : '0'); } catch {}
  }
  private onResizeForced = () => {
    this.applyResponsiveForced();
    this.updateTopNarrowState(); // triggers label refresh if crossing
    // Recalculate after next paint to let text changes apply
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.recalculateWelcomeVisibility(), 0);
  };
  private applyResponsiveForced() {
    if (!isPlatformBrowser(this.platformId)) return;
    const w = window.innerWidth;
    if (w < this.AUTO_BREAKPOINT) {
      // Force collapsed state on small screens regardless of preference
      this.collapsed = true;
    } else {
      // Restore last manual preference
      this.collapsed = (this.userPreference === 'collapsed');
    }
  }
  private updateTopNarrowState() {
    if (!isPlatformBrowser(this.platformId)) return;
    const prev = this.isNarrowTop;
    this.isNarrowTop = window.innerWidth < this.TOP_NARROW_BREAKPOINT;
    if (prev !== this.isNarrowTop) {
      // Breakpoint crossing: recalc label to switch between code-only and full form
      this.updateDisciplineLabel();
      // Also re-evaluate welcome visibility
      this.recalculateWelcomeVisibility();
    }
  }
  ngOnDestroy(): void {
    this.clearAvatarUrl();
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('storage', this.storageListener);
      window.removeEventListener('mc:discipline-changed', this.disciplineChangedListener as any);
      window.removeEventListener('mc:aluno-changed', this.alunoChangedListener as any);
      window.removeEventListener('resize', this.onResizeForced);
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
          this.disciplineCode = d.code;
          this.disciplineName = d.name;
          this.currentDisciplineLabel = this.isNarrowTop ? d.code : `${d.code} - ${d.name}`;
          // Recalculate after label potentially changed width
          if (isPlatformBrowser(this.platformId)) setTimeout(() => this.recalculateWelcomeVisibility(), 0);
          return;
        }
      }
      this.disciplineCode = '';
      this.disciplineName = '';
      this.currentDisciplineLabel = '';
    } catch { this.disciplineCode = ''; this.disciplineName=''; this.currentDisciplineLabel = ''; }
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
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.recalculateWelcomeVisibility(), 0);
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

  private recalculateWelcomeVisibility() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isNarrowTop) { this.showWelcome = false; return; }
    const topBar = this.topBarRef?.nativeElement;
    const rightInfo = this.rightInfoRef?.nativeElement;
    const hamburger = this.hamburgerRef?.nativeElement;
    const welcome = this.welcomeRef?.nativeElement;
    if (!topBar || !rightInfo || !hamburger || !welcome) { this.showWelcome = true; return; }
    // Use precise measurements including horizontal gaps
    const style = getComputedStyle(topBar);
    const gap = parseFloat(style.columnGap || style.gap || '0');
    const leftPad = parseFloat(style.paddingLeft || '0');
    const rightPad = parseFloat(style.paddingRight || '0');
    const totalWidth = topBar.getBoundingClientRect().width;
    const occupied = hamburger.getBoundingClientRect().width + gap + rightInfo.getBoundingClientRect().width + leftPad + rightPad;
    const available = totalWidth - occupied - 4; // small safety margin
    this.showWelcome = welcome.getBoundingClientRect().width <= available;
    if (!this.showWelcome) {
      // Extra guard: ensure no wrapping by hiding early
      if (welcome && welcome.style.display !== 'none') {
        // nothing else needed; the *ngIf will remove it next change detection
      }
    }
  }
}
