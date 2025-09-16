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
  // Disciplina atual do aluno
  disciplines: any[] = [];
  selectedDisciplineId: number | null = null;
  constructor(private userService: UserService, private auth: AuthService, private router: Router, private check: CheckInService, private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object, private zone: NgZone) {}

  private userUpdatedListener = (e: any) => {
    try {
      // Quando o usuário em cache mudar (por upload/remoção de foto), recarregar avatar
      if (isPlatformBrowser(this.platformId)) this.loadAvatarIfAny();
    } catch {}
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
      // Se cache já tiver disciplina, seta no seletor
      if (cached.currentDisciplineId != null) {
        this.selectedDisciplineId = cached.currentDisciplineId;
      }
  this.role = cached.role || null;
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
          this.role = data?.role || null;
          // tenta aplicar disciplina atual vinda do backend (se /auth/me expuser)
          try { this.selectedDisciplineId = (data as any)?.currentDisciplineId ?? this.selectedDisciplineId; } catch {}
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
  }
  }

  ngOnDestroy(): void {
  if (this.intervalId) window.clearInterval(this.intervalId);
  if (this.statusInterval) clearInterval(this.statusInterval);
  this.clearAvatarUrl();
  if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('mc:user-updated', this.userUpdatedListener as any);
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
      next: _ => { this.submitting=false; this.showCheckoutConfirm=false; this.loadStatus(); },
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
        const cached = (this.auth as any).getUser?.();
        if (this.selectedDisciplineId == null) {
          this.selectedDisciplineId = cached?.currentDisciplineId || null;
        }
      },
      error: err => { console.error('Falha ao carregar disciplinas', err); this.disciplines = []; }
    });
  }

  onChangeDiscipline() {
    const body = this.selectedDisciplineId ? { disciplineId: this.selectedDisciplineId } : { disciplineId: null } as any;
    this.http.put('/api/users/me/discipline', body).subscribe({
      next: (res: any) => {
        // Atualiza usuário em cache para refletir a disciplina atual (id, code, name)
        try {
          const cached = (this.auth as any).getUser?.() || {};
          const updated = {
            ...cached,
            currentDisciplineId: res?.currentDisciplineId ?? null,
            currentDisciplineName: res?.currentDisciplineName ?? null,
            currentDisciplineCode: res?.currentDisciplineCode ?? null
          };
          // mantemos preferência de persistência (localStorage se token estiver lá)
          const remember = !!window.localStorage.getItem('token');
          this.auth.setUser(updated, remember);
          window.dispatchEvent(new StorageEvent('storage', { key: 'mc_user', newValue: JSON.stringify(updated) }));
        } catch {}
        // Recarrega status e deixa histórico/calendário serem filtrados por backend
        this.loadStatus();
      },
      error: _ => {}
    });
  }
}

// Backwards compatibility alias (remove later if unused)
export const InternHomeComponent = HomeComponent;
