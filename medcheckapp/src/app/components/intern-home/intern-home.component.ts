import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CheckInService } from '../../services/checkin.service';
import { UserService, CurrentUser } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intern-home.component.html',
  styleUrl: './intern-home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  user!: CurrentUser;
  role: string | null = null;
  currentTime = '';
  private intervalId?: number;
  firstName = '';
  inService = false; // derived from open session (API status)
  workedToday = '00:00:00';
  sessionStart: string | null = null;
  private statusInterval?: any;
  performing = false;

  // Modal / action state
  showCheckoutConfirm = false;
  submitting = false;

  // Baseline para somar tempo decorrido da sessão atual sem perder sessões anteriores
  private baselineWorkedSeconds = 0; // segundos acumulados (sessões anteriores + instante inicial da sessão aberta)
  private baselineCaptureTs = 0; // timestamp (ms) de quando baseline foi capturado
  private todayDate = new Date().toISOString().substring(0,10);
  private cacheKey = 'mc_worked_cache_home'; // será sobrescrito com CPF depois do user carregar

  loading = true;
  avatarUrl = '';
  private avatarObjectUrl: string | null = null;
  // Disciplinas do aluno (somente para filtro visual de calendário / relatórios / check-in)
  disciplines: any[] = [];
  // Mantemos somente localmente; não enviamos mais para backend para não afetar entidades.
  selectedDisciplineId: number | null = null;
  private LOCAL_DISC_KEY = 'mc_current_discipline_id';
  constructor(private userService: UserService, private auth: AuthService, private router: Router, private check: CheckInService, private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object, private zone: NgZone) {}

  private userUpdatedListener = (e: any) => {
    try {
      // Quando o usuário em cache mudar (por upload/remoção de foto), recarregar avatar
      if (isPlatformBrowser(this.platformId)) this.loadAvatarIfAny();
    } catch {}
  };
  private serviceStatusListener = (_e: any) => {
    try {
      // Atualiza imediatamente usando o payload antes de consultar API
      const det = (_e as CustomEvent).detail;
      if (det && typeof det.inService === 'boolean') {
        this.inService = det.inService;
        if (!det.inService) this.sessionStart = null;
      }
    } catch {}
    this.loadStatus(); // confirma com backend / sincroniza tempo
  };

  ngOnInit(): void {
    // Restaura baseline persistido (secs + ts) para evitar reset visual
    this.loadWorkedCache();
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
      // Não usamos mais currentDisciplineId do backend para não influenciar banco – carregaremos de storage local.
  this.role = cached.role ? String(cached.role).toUpperCase() : null;
  this.afterRoleSet();
  this.updateCacheKeyWithUser();
      // Recarrega cache (agora com chave específica do usuário)
      this.loadWorkedCache();
      this.inService = this.user.status === 'Em serviço';
      this.firstName = (this.user.name || '').split(' ')[0];
  if (isPlatformBrowser(this.platformId)) this.loadAvatarIfAny();
      this.loading = false;
      // IMPORTANTE: carrega lista de disciplinas quando usuário vem do cache
      this.loadDisciplinesAndSelection();
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
          this.role = data?.role ? String(data.role).toUpperCase() : null;
          this.afterRoleSet();
          // Ignoramos currentDisciplineId do backend; seleção é puramente local.
            // Persistimos no cache também (para manter após F5)
            try {
              const cachedPrev = (this.auth as any).getUser?.() || {};
              const remember = this.auth.isRemembered();
              const merged = {
                ...cachedPrev,
                ...data
              };
              this.auth.setUser(merged, remember);
            } catch {}
          this.inService = this.user.status === 'Em serviço';
          if (!this.user.name) {
            this.router.navigate(['/login']);
            return;
          }
          this.firstName = (this.user.name || '').split(' ')[0];
          if (isPlatformBrowser(this.platformId)) this.loadAvatarIfAny();
          this.loading = false;
          this.updateCacheKeyWithUser();
          this.loadWorkedCache();
          this.loadDisciplinesAndSelection();
        },
        error: _ => this.router.navigate(['/login'])
      });
    }
  this.updateTime();
  this.loadStatus();
  // Mover timers para fora da zona Angular para não bloquear estabilização/hidratação
  this.zone.runOutsideAngular(() => {
    this.statusInterval = setInterval(() => {
      // Reentrar na zona apenas para atualizar o estado
      this.zone.run(() => this.refreshDynamic());
    }, 1000);
    this.intervalId = window.setInterval(() => {
      this.zone.run(() => this.updateTime());
    }, 1000);
  });
  // Ouve atualizações do usuário (ex.: upload/remoção de foto) para atualizar avatar imediatamente
  if (isPlatformBrowser(this.platformId)) {
    window.addEventListener('mc:user-updated', this.userUpdatedListener as any);
    window.addEventListener('mc:service-status-updated', this.serviceStatusListener as any);
    window.addEventListener('storage', (ev) => {
      if (ev.key === 'mc:last-service-status') this.loadStatus();
    });
  }
  // Fallback: caso role seja atribuída após micro-task ou cache não disponível de imediato
  setTimeout(() => this.ensureAdminDataLoaded(), 200);
  }

  ngOnDestroy(): void {
  if (this.intervalId) window.clearInterval(this.intervalId);
  if (this.statusInterval) clearInterval(this.statusInterval);
  this.clearAvatarUrl();
  if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('mc:user-updated', this.userUpdatedListener as any);
    window.removeEventListener('mc:service-status-updated', this.serviceStatusListener as any);
  }
  }

  private updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('pt-BR', { hour12: false });
  }

  private loadStatus() {
    this.check.status().subscribe({
      next: st => {
        this.inService = !!st.inService;
        const secs = st.workedSeconds || 0;
        const nowTs = Date.now();
        // Calcula progresso local atual antes de sobrescrever
        const localTotal = this.computeCurrentTotal();
        // Garante monotonicidade (não voltar no tempo se houver pequeno drift)
        const serverTotal = secs;
        let chosen: number;
        if (!this.inService) {
          // Sem sessão aberta: evitar drift adotando exatamente o valor do backend
            chosen = serverTotal;
        } else {
          // Em serviço: mantém monotonicidade local sem regredir
          chosen = Math.max(serverTotal, localTotal);
          if (serverTotal + 300 < localTotal) {
            // Diferença muito grande -> provável reinício
            chosen = serverTotal;
          }
        }
        this.baselineWorkedSeconds = chosen;
        this.baselineCaptureTs = nowTs; // baseline representa 'chosen' neste instante
        this.workedToday = this.formatSecs(chosen);
        this.persistWorkedCache(chosen, nowTs);
        this.sessionStart = st.openSession?.checkInTime || null;
      },
      error: _ => {}
    });
  }

  private refreshDynamic() {
    this.updateTime();
    // Cálculo: baseline (tudo até o momento da última loadStatus) + tempo decorrido desde então se ainda em serviço
    let total = this.baselineWorkedSeconds;
    if (this.inService) {
      const elapsed = Math.floor((Date.now() - this.baselineCaptureTs)/1000);
      total += elapsed;
    }
    this.workedToday = this.formatSecs(total);
    if (total % 15 === 0) this.persistWorkedCache(total, Date.now());
  }

  private computeCurrentTotal(): number {
    if (!this.baselineCaptureTs) return this.baselineWorkedSeconds;
    const elapsed = Math.floor((Date.now() - this.baselineCaptureTs)/1000);
    return this.baselineWorkedSeconds + (this.inService ? elapsed : 0);
  }

  private loadWorkedCache() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.date !== this.todayDate) return; // ignora dia diferente
      if (typeof obj.secs === 'number' && typeof obj.ts === 'number') {
        // Restaura baseline exatamente como salvo; incrementos virão do ticker
        this.baselineWorkedSeconds = obj.secs;
        this.baselineCaptureTs = obj.ts;
        const total = this.computeCurrentTotal();
        this.workedToday = this.formatSecs(total);
      }
    } catch {}
  }

  private persistWorkedCache(totalSecs: number, ts: number) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify({ secs: totalSecs, ts, date: this.todayDate }));
    } catch {}
  }

  private updateCacheKeyWithUser() {
    if (this.user?.cpf) {
      this.cacheKey = `mc_worked_cache_${this.user.cpf}_${this.todayDate}`;
    }
  }

  private formatSecs(s: number): string { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }

  onPrimaryAction() {
    if (this.inService) {
      // Exibe modal de confirmação para Check-Out
      this.showCheckoutConfirm = true;
    } else {
      if (this.performing) return;
      this.performing = true;
      this.router.navigate(['/checkin']).finally(() => this.performing = false);
    }
  }

  confirmCheckout() {
    if (this.submitting) return;
    this.submitting = true;
    this.check.checkOut().subscribe({
      next: _ => { this.submitting=false; this.showCheckoutConfirm=false; this.loadStatus(); this.broadcastServiceStatus(false); },
      error: _ => { this.submitting=false; this.showCheckoutConfirm=false; }
    });
  }
  cancelCheckout(){ if (this.submitting) return; this.showCheckoutConfirm=false; }

  private headers(): HttpHeaders | undefined {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined as any;
  }

  private loadAvatar() {
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
    try {
      const raw = localStorage.getItem('mc_user') || sessionStorage.getItem('mc_user');
      const u = raw ? JSON.parse(raw) : null;
      if (!u || u.hasAvatar !== true) { this.clearAvatarUrl(); return; }
    } catch {}
    this.loadAvatar();
  }

  private clearAvatarUrl() {
    if (this.avatarObjectUrl) {
      try { URL.revokeObjectURL(this.avatarObjectUrl); } catch {}
    }
    this.avatarObjectUrl = null;
    this.avatarUrl = '';
  }

  // Formata CPF como 000.000.000-00 no front
  formatCpf(v: string | null | undefined): string {
    if (!v) return '';
    const digits = String(v).replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return String(v);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  private loadDisciplinesAndSelection() {
    if (!isPlatformBrowser(this.platformId)) { return; }
    this.http.get('/api/users/me/disciplines').subscribe({
      next: (list: any) => {
        this.disciplines = Array.isArray(list) ? list : [];
        // Seleção vem do localStorage (preferência do usuário)
        if (this.selectedDisciplineId == null) {
          try {
            const stored = localStorage.getItem(this.LOCAL_DISC_KEY);
            if (stored) this.selectedDisciplineId = parseInt(stored, 10);
          } catch {}
        }
        // Se ainda não há seleção válida, auto seleciona primeira disciplina disponível
        if ((this.selectedDisciplineId == null || !this.disciplines.some(d => d.id === this.selectedDisciplineId)) && this.disciplines.length > 0) {
          this.selectedDisciplineId = this.disciplines[0].id;
          this.persistLocalDiscipline();
        }
      },
      error: err => { console.error('Falha ao carregar disciplinas', err); this.disciplines = []; }
    });
  }

  onChangeDiscipline() {
    // Apenas persistir localmente; não chama backend
    this.persistLocalDiscipline();
    // Status não depende mais de disciplina, mas calendário/relatórios externos usarão disciplineId explicitamente.
  }

  private persistLocalDiscipline() {
    try {
      if (this.selectedDisciplineId != null) localStorage.setItem(this.LOCAL_DISC_KEY, String(this.selectedDisciplineId));
      else localStorage.removeItem(this.LOCAL_DISC_KEY);
    } catch {}
    // Notifica shell/header para atualizar badge
    try { window.dispatchEvent(new CustomEvent('mc:discipline-changed', { detail: { id: this.selectedDisciplineId } })); } catch {}
  }

  /* ===================== BLOCO ADMIN: LISTAGEM DE USUÁRIOS ===================== */
  adminUsers: any[] = [];
  adminDisciplines: any[] = [];
  adminLoading = false;
  adminMsg = '';
  adminDisciplineId: string | number = '';
  adminQ = '';
  adminPage = 0; adminSize = 20; adminTotalPages = 0; adminTotalItems = 0;
  private adminInitDone = false;

  private ensureAdminDataLoaded() {
    if (this.role !== 'ADMIN') return;
    if (!this.adminInitDone) {
      // Debug rápido
      try { console.debug('[Home ADMIN] Carregando disciplinas/usuários (init)'); } catch {}
      this.fetchAdminDisciplines();
      this.loadAdminUsers(true);
      this.adminInitDone = true;
    }
  }

  private fetchAdminDisciplines() {
    this.http.get<any[]>('/api/admin/disciplines').subscribe({
      next: list => { this.adminDisciplines = Array.isArray(list) ? list : []; },
      error: _ => { this.adminDisciplines = []; }
    });
  }

  loadAdminUsers(reset: boolean = false) {
    if (this.role !== 'ADMIN') return;
    if (reset) this.adminPage = 0;
    this.adminLoading = true;
    try { console.debug('[Home ADMIN] loadAdminUsers', { reset, page: this.adminPage }); } catch {}
    const params: any = { page: this.adminPage, size: this.adminSize };
    if (this.adminDisciplineId) params.disciplineId = this.adminDisciplineId;
    if (this.adminQ && this.adminQ.trim()) params.q = this.adminQ.trim();
    this.http.get<any>('/api/admin/users', { params }).subscribe({
      next: data => {
        try { console.debug('[Home ADMIN] resposta users', data); } catch {}
        this.adminUsers = data.items || [];
        this.adminPage = data.page || 0;
        this.adminSize = data.size || this.adminSize;
        this.adminTotalPages = data.totalPages || 0;
        this.adminTotalItems = data.totalItems || 0;
        this.adminLoading = false;
      },
      error: _ => { this.adminMsg = 'Falha ao carregar usuários'; this.adminLoading = false; }
    });
  }

  adminChangeRole(u: any, role: string) {
    this.http.put(`/api/admin/users/${u.id}/role`, { role }).subscribe({
      next: _ => { u.role = role; this.adminMsg = 'Role atualizada'; },
      error: _ => { this.adminMsg = 'Erro ao atualizar role'; }
    });
  }
  adminDeleteUser(u: any) {
    if (!confirm(`Excluir usuário ${u.name}?`)) return;
    this.http.delete(`/api/admin/users/${u.id}`).subscribe({
      next: _ => { this.adminUsers = this.adminUsers.filter(x => x.id !== u.id); this.adminMsg='Usuário excluído'; },
      error: _ => { this.adminMsg = 'Erro ao excluir'; }
    });
  }
  adminSearchEnter(ev: KeyboardEvent) { if (ev.key === 'Enter') this.loadAdminUsers(true); }
  adminClearSearch() { this.adminQ=''; this.loadAdminUsers(true); }
  adminNextPage() { if (this.adminPage +1 < this.adminTotalPages) { this.adminPage++; this.loadAdminUsers(); } }
  adminPrevPage() { if (this.adminPage>0) { this.adminPage--; this.loadAdminUsers(); } }
  adminFirstPage() { if (this.adminPage!==0) { this.adminPage=0; this.loadAdminUsers(); } }
  adminLastPage() { if (this.adminPage+1 < this.adminTotalPages) { this.adminPage=this.adminTotalPages-1; this.loadAdminUsers(); } }

  // Hook após role carregada
  private afterRoleSet() { this.ensureAdminDataLoaded(); }

  /* ===================== REAL-TIME STATUS BROADCAST ===================== */
  private broadcastServiceStatus(inService: boolean) {
    try {
      const payload = { ts: Date.now(), inService };
      localStorage.setItem('mc:last-service-status', JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('mc:service-status-updated', { detail: payload }));
    } catch {}
  }
}

// Backwards compatibility alias (remove later if unused)
export const InternHomeComponent = HomeComponent;
