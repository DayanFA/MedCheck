import { Component, ElementRef, OnDestroy, OnInit, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CheckInService } from '../../services/checkin.service';
import QRCode from 'qrcode';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-preceptor-code',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="preceptor-code-wrapper d-flex justify-content-center p-3 p-sm-4">
    <div *ngIf="!isPreceptor" class="alert alert-warning w-100 text-center" style="max-width:760px;">
      Acesso restrito: apenas PRECEPTORES podem gerar códigos de check-in.
    </div>
    <ng-container *ngIf="isPreceptor">
    <div class="code-card card p-4 w-100 position-relative" style="max-width:760px;">
      <div *ngIf="loading" class="loading-overlay d-flex flex-column align-items-center justify-content-center">
        <div class="spinner-border text-primary spinner-sm mb-2" role="status"></div>
        <span class="small text-muted">Carregando...</span>
      </div>
      <div *ngIf="errorMsg" class="alert alert-danger py-1 px-2 small mb-3 w-100 text-center position-absolute top-0 start-0">{{errorMsg}}</div>
      <div class="d-flex flex-column align-items-center text-center">
        <div class="qr-container mb-4">
          <canvas #qrCanvas class="qr-canvas shadow-sm"></canvas>
        </div>
        <div class="fs-5 fw-semibold mb-1">
          <span class="me-1">Seu Código É:</span>
          <span class="code-text">{{code?.code || '------'}}</span>
        </div>
        <div class="fs-6 mb-3 text-secondary fw-semibold">
          <span class="me-1">Seu Id é:</span>
          <span>{{ preceptorId ?? '-' }}</span>
        </div>
        <div class="progress-pill mb-2" [class.dim]="secondsLeft===0">
          <div class="fill" [style.width.%]="progressPct"></div>
        </div>
        <div class="small text-muted mb-4">
          Próximo Código Em: <strong [class.text-danger]="secondsLeft <= 10">{{ formatRemaining(secondsLeft) }}</strong>
        </div>
        <!-- Lista de disciplinas vinculadas -->
        <div class="w-100 mt-2" style="max-width:640px;">
          <div class="text-start fw-semibold mb-2">Suas disciplinas vinculadas</div>
          <div *ngIf="discLoading" class="small text-muted">Carregando disciplinas...</div>
          <div *ngIf="discError && !discLoading" class="alert alert-warning py-1 px-2 small">{{discError}}</div>
          <ul *ngIf="!discLoading && disciplines?.length" class="list-group small">
            <li class="list-group-item d-flex justify-content-between align-items-center" *ngFor="let d of disciplines">
              <span class="text-truncate">{{ d.name }}</span>
              <span class="badge bg-primary-subtle text-primary">{{ d.code }}</span>
            </li>
          </ul>
          <div *ngIf="!discLoading && !disciplines?.length && !discError" class="small text-muted">Nenhum vínculo encontrado.</div>
        </div>
      </div>
    </div>
    </ng-container>
  </div>
  `,
  styles: [
    `:host{display:block;}
     .code-card{border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.06);} 
     .qr-container{position:relative;width:300px;max-width:60vw;}
     .qr-canvas{width:100% !important;height:auto !important;aspect-ratio:1/1;border-radius:8px;background:#fff;border:4px solid #fff;}
     .code-text{color:#0d6efd;font-size:1.9rem;letter-spacing:1px;}
     .progress-pill{position:relative;width:300px;max-width:70vw;height:58px;background:#e4e9ff;border-radius:100px;display:flex;align-items:center;overflow:hidden;}
  .progress-pill .fill{position:absolute;left:0;top:0;bottom:0;background:#0366ff;transition:width .5s linear;}
  .progress-pill::after{content:'';width:100%;height:100%;position:absolute;inset:0;pointer-events:none;}
  .loading-overlay{position:absolute;inset:0;background:rgba(255,255,255,.88);z-index:5;border-radius:18px;}
  .spinner-sm{width:2.1rem;height:2.1rem;}
     @media (max-width:520px){ .code-text{font-size:1.5rem;} .progress-pill{height:46px;} }
    `]
})
export class PreceptorCodeComponent implements OnInit, OnDestroy {
  code: any;
  loading = false;
  // removemos polling de 5s para evitar flicker; apenas buscamos no início e ao expirar
  private secondsTicker?: any;
  preceptorId: number | null = null;
  secondsLeft: number = 0;
  totalWindow: number = 60; // default fallback
  progressPct = 0;
  @ViewChild('qrCanvas') qrCanvas?: ElementRef<HTMLCanvasElement>;
  errorMsg = '';
  private isBrowser: boolean;
  private initialized = false;
  fetching = false; // exposto para template (botão disabled)
  private expiresAtTs: number = 0;
  private userLoading = false;
  disciplines: Array<{id:number; code:string; name:string; hours:number; ciclo:number}> = [];
  discLoading = false;
  discError = '';
  constructor(private check: CheckInService, private auth: AuthService, @Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
  isPreceptor = false;
  ngOnInit(): void { 
    if (!this.isBrowser) { return; } // evita tentativa de gerar QR no SSR
  const u = this.auth.getUser();
  // Agora backend fornece 'id'; não usar cpf como id.
  this.preceptorId = (u?.id ?? null);
  const role = u?.role || this.auth.getRole();
  this.isPreceptor = role === 'PRECEPTOR';
  if (!this.isPreceptor) {
    return; // não prossegue com fetch de código / disciplinas
  }
    // Se ainda não temos o id mas existe token, tenta carregar do backend
    if (this.preceptorId == null) {
      this.ensureUserLoaded();
    }
    this.fetch();
    this.fetchDisciplines();
    if (this.isBrowser) {
      document.addEventListener('visibilitychange', this.handleVisibility);
      window.addEventListener('focus', this.handleVisibility);
    }
  }
  ngOnDestroy(): void { 
    if (this.secondsTicker) clearInterval(this.secondsTicker);
    if (this.isBrowser) {
      document.removeEventListener('visibilitychange', this.handleVisibility);
      window.removeEventListener('focus', this.handleVisibility);
    }
  }
  private fetchDisciplines() {
    this.discError = '';
    this.disciplines = [];
    this.discLoading = true;
    this.check.myDisciplines().subscribe({
      next: list => { this.disciplines = list || []; this.discLoading = false; },
      error: _ => { this.discError = 'Falha ao carregar disciplinas'; this.discLoading = false; }
    });
  }
  private handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      this.recomputeRemaining();
      if (this.secondsLeft <= 0) {
        this.fetch();
      } else {
        this.restartTicker();
      }
    }
  };
  fetch() {
    if (!this.isBrowser) return;
    if (this.fetching) return;
    this.fetching = true;
    if (!this.initialized) this.loading = true; // só mostra skeleton na primeira vez
    this.errorMsg='';
    // Garantir que tentamos carregar usuário caso ainda não tenha vindo
    if (this.preceptorId == null) {
      this.ensureUserLoaded();
    }
    this.check.currentCode().subscribe({ 
      next: c => { 
        const prev = this.code?.code;
        this.code = c; 
        this.loading = false; this.initialized = true;
        // Preferir cálculo baseado em expiresAt para evitar divergência de zona
        if (c.expiresAt) {
          this.expiresAtTs = Date.parse(c.expiresAt);
          const diff = this.expiresAtTs - Date.now();
          this.secondsLeft = Math.max(0, Math.floor(diff/1000));
        } else {
          // fallback para secondsRemaining
          this.secondsLeft = (c.secondsRemaining ?? 0);
          this.expiresAtTs = Date.now() + this.secondsLeft*1000;
        }
        this.totalWindow = 60; // janela fixa
        if (prev !== c.code) { this.renderQR(); }
        this.restartTicker();
        this.fetching = false;
      }, 
      error: err => { this.loading = false; this.errorMsg = 'Falha ao obter código'; this.fetching=false; }
    });
  }
  renderQR() {
    if (!this.qrCanvas || !this.code?.code || !this.isBrowser) return;
    const value = JSON.stringify({ code: this.code.code, preceptorId: this.preceptorId });
    QRCode.toCanvas(this.qrCanvas.nativeElement, value, { width: 300, margin: 1 }, () => {});
  }
  // Funções de copiar/baixar removidas
  private ensureUserLoaded() {
    if (this.userLoading) return;
    const token = this.auth.getToken();
    if (!token) return;
    // Tentativa de extrair do token (fallback rápido)
    // Tentamos extrair 'id' do token apenas se presente explicitamente (não usar subject/cpf)
    if (this.preceptorId == null) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1] || ''));
        if (payload.id != null && !isNaN(Number(payload.id))) {
          this.preceptorId = Number(payload.id);
          if (this.code?.code) this.renderQR();
          return;
        }
      } catch {}
    }
    // Chamada à API /me para obter dados completos
    this.userLoading = true;
    this.auth.me().subscribe({
      next: user => {
        this.userLoading = false;
  const idVal = user?.id ?? null; // não confundir com cpf
        if (idVal != null) {
          this.preceptorId = Number(idVal);
          // Persistir para próximos acessos
          this.auth.setUser(user, true); // assume remember; poderia detectar preferencia
          if (this.code?.code) this.renderQR();
        }
      },
      error: () => { this.userLoading = false; }
    });
  }
  private restartTicker() {
    if (this.secondsTicker) clearInterval(this.secondsTicker);
    const tick = () => {
      this.recomputeRemaining();
      if (this.secondsLeft <= 0) {
        clearInterval(this.secondsTicker);
        this.fetch();
      }
    };
    tick();
    this.secondsTicker = setInterval(tick, 1000);
  }

  private recomputeRemaining() {
    if (!this.expiresAtTs) return;
    const diff = this.expiresAtTs - Date.now();
    this.secondsLeft = Math.max(0, Math.floor(diff/1000));
    this.progressPct = this.totalWindow ? ((this.totalWindow - this.secondsLeft) / this.totalWindow) * 100 : 0;
  }

  formatRemaining(sec: number): string {
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = (sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }
}
