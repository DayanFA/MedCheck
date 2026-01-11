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
    <div *ngIf="!isPreceptor" class="code-alert alert alert-warning w-100 text-center">
      <i class="bi bi-shield-lock me-1"></i>Acesso restrito: apenas PRECEPTORES podem gerar códigos de check-in.
    </div>
    <ng-container *ngIf="isPreceptor">
    <div class="code-card glass-card p-4 w-100 position-relative">
      <div *ngIf="loading" class="loading-overlay d-flex flex-column align-items-center justify-content-center">
        <div class="spinner-border text-primary spinner-sm mb-2" role="status"></div>
        <span class="small text-muted">Carregando...</span>
      </div>
      <div *ngIf="errorMsg" class="error-banner alert alert-danger small mb-3 w-100 text-center">{{errorMsg}}</div>
      <div class="card-inner d-flex flex-column align-items-center text-center">
        <div class="qr-wrapper mb-4">
          <div class="qr-frame">
            <canvas #qrCanvas class="qr-canvas"></canvas>
          </div>
        </div>
        <div class="code-line fw-semibold mb-1">
          <span class="label">Seu Código:</span>
          <span class="code-text" aria-live="polite">{{code?.code || '------'}}</span>
        </div>
        <div class="id-line mb-3 text-secondary fw-semibold small">
          <span class="me-1 text-muted">ID:</span>
          <span class="mono">{{ preceptorId ?? '-' }}</span>
        </div>
        <div class="progress-shell mb-2" [class.expired]="secondsLeft===0" aria-label="Tempo restante" role="progressbar" [attr.aria-valuenow]="60-secondsLeft" aria-valuemin="0" aria-valuemax="60">
          <div class="bar" [style.width.%]="progressPct"></div>
          <div class="ticks">
            <span *ngFor="let t of [0,15,30,45,60]" class="tick" [class.active]="secondsLeft <= (60 - t)"></span>
          </div>
        </div>
        <div class="remaining small text-muted mb-4">
          Próximo código em <strong [class.text-danger]="secondsLeft <= 10">{{ formatRemaining(secondsLeft) }}</strong>
        </div>
        <!-- Lista de disciplinas vinculadas -->
        <div class="disciplines-panel w-100 mt-2">
          <div class="panel-head d-flex align-items-center justify-content-between mb-2">
            <div class="title fw-semibold">Disciplinas Vinculadas</div>
            <div class="pill small text-uppercase" *ngIf="!discLoading && disciplines?.length">{{disciplines.length}}</div>
          </div>
          <div *ngIf="discLoading" class="small text-muted skeleton-line">Carregando disciplinas...</div>
          <div *ngIf="discError && !discLoading" class="alert alert-warning py-1 px-2 small mb-0">{{discError}}</div>
          <ul *ngIf="!discLoading && disciplines?.length" class="disc-list small">
            <li class="disc-item" *ngFor="let d of disciplines">
              <span class="name text-truncate">{{ d.name }}</span>
              <span class="code badge">{{ d.code }}</span>
            </li>
          </ul>
          <div *ngIf="!discLoading && !disciplines?.length && !discError" class="small text-muted fst-italic">Nenhum vínculo encontrado.</div>
        </div>
      </div>
    </div>
    </ng-container>
  </div>
  `,
  styles: [
    `:host{display:block;}
     .preceptor-code-wrapper{min-height:100%;background:linear-gradient(145deg,#eef5ff,#e3eefc 50%,#dbe8f7);}
     .code-alert{max-width:760px;border-radius:14px;}
     .glass-card{max-width:760px;border:1px solid #d9e4ef;background:rgba(255,255,255,.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:24px;box-shadow:0 10px 28px -10px rgba(32,56,92,.25),0 4px 14px -4px rgba(32,56,92,.18);}
     .error-banner{border-radius:0 0 12px 12px;}
     .card-inner{padding-top:.25rem;}
     .qr-wrapper{display:flex;align-items:center;justify-content:center;}
     .qr-frame{position:relative;width:300px;max-width:64vw;aspect-ratio:1/1;border-radius:26px;padding:14px;background:linear-gradient(135deg,#f7fbff,#edf4fa);border:1px solid #dbe5ef;box-shadow:0 6px 18px -8px rgba(30,54,90,.25);}
     .qr-canvas{width:100% !important;height:100% !important;border-radius:18px;background:#fff;}
     .code-line .label{font-size:.75rem;text-transform:uppercase;letter-spacing:.5px;color:#5c7182;margin-right:.35rem;}
     .code-text{color:#1d4d85;font-size:2rem;letter-spacing:2px;font-weight:700;font-family:ui-monospace,monospace;}
  /* Aumentar destaque visual do ID */
  .id-line{font-size:.95rem;display:flex;align-items:baseline;gap:.25rem;}
  .id-line .mono{font-family:ui-monospace,monospace;color:#2c5b92;font-size:1.5rem;line-height:1;font-weight:700;letter-spacing:1px;}
     .progress-shell{position:relative;width:320px;max-width:75vw;height:34px;background:linear-gradient(90deg,#f0f5fa,#e9f1f8);border:1px solid #d5e2ec;border-radius:999px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.06);} 
     .progress-shell.expired{opacity:.55;}
     .progress-shell .bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#4b90ff,#2563eb);transition:width .6s cubic-bezier(.4,.14,.3,1);box-shadow:0 0 0 1px rgba(255,255,255,.4),0 2px 8px -3px rgba(37,99,235,.55);} 
     .progress-shell .ticks{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 10px;pointer-events:none;}
     .progress-shell .tick{width:4px;height:4px;border-radius:50%;background:#98b5cc;opacity:.5;transition:.4s;}
     .progress-shell .tick.active{opacity:.9;background:#1d4d85;}
     .remaining strong{font-variant-numeric:tabular-nums;}
     .disciplines-panel{max-width:640px;margin-left:auto;margin-right:auto;background:linear-gradient(135deg,#f8fbfe,#f3f8fc);border:1px solid #dce6ef;border-radius:18px;padding:1rem .95rem .85rem;box-shadow:0 4px 14px -6px rgba(30,54,90,.15);} 
     .disciplines-panel .panel-head .title{font-size:.8rem;text-transform:uppercase;letter-spacing:.65px;color:#2f577f;}
     .disciplines-panel .pill{background:#e6eef6;padding:.15rem .55rem;border-radius:24px;font-weight:600;letter-spacing:.5px;color:#406186;}
     .disc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem;max-height:240px;overflow:auto;}
     .disc-item{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.5rem .65rem;border:1px solid #e1eaf2;border-radius:12px;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,.04);} 
     .disc-item .code{background:#eef5ff;color:#1d4d85;font-weight:600;border-radius:14px;}
     .skeleton-line{background:linear-gradient(90deg,#edf3f8,#f3f8fc 40%,#edf3f8 80%);background-size:200% 100%;animation:shimmer 1.2s linear infinite;border-radius:6px;padding:.35rem .6rem;display:inline-block;}
     .loading-overlay{position:absolute;inset:0;background:rgba(255,255,255,.92);z-index:5;border-radius:24px;}
     .spinner-sm{width:2.1rem;height:2.1rem;}
     @keyframes shimmer{0%{background-position:0 0;}100%{background-position:200% 0;}}
     @media (max-width:640px){
       .qr-frame{width:240px;padding:12px;border-radius:22px;}
       .code-text{font-size:1.6rem;letter-spacing:1.2px;}
       .progress-shell{height:30px;width:260px;}
       .disciplines-panel{padding:.85rem .75rem .7rem;}
       .id-line .mono{font-size:1.3rem;}
     }
     @media (max-width:420px){
       .qr-frame{width:200px;padding:10px;border-radius:20px;}
       .progress-shell{height:26px;width:220px;}
       .code-text{font-size:1.4rem;}
       .disc-item{padding:.45rem .55rem;}
       .id-line .mono{font-size:1.15rem;}
     }
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
