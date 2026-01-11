import { Component, OnDestroy, OnInit, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import QRCode from 'qrcode';

@Component({
  standalone: true,
  selector: 'app-admin-preceptor-codes',
  imports: [CommonModule, FormsModule],
  template: `
  <div class="admin-preceptor-codes-wrapper d-flex justify-content-center p-3 p-sm-4" *ngIf="role==='ADMIN'; else noAccess">
    <div class="glass-card code-shell p-4 w-100 position-relative">
      <!-- Header / Selector -->
      <div class="selector-row d-flex flex-column flex-md-row w-100 mb-4 gap-3">
        <div class="flex-grow-1">
          <label class="mini-label d-block mb-1">Selecionar Preceptor</label>
          <select class="form-select form-select-sm shadow-sm" [(ngModel)]="selectedPreceptorId" (change)="onSelectPreceptor()">
            <option value="" disabled>-- Escolha --</option>
            <option *ngFor="let p of preceptors" [ngValue]="p.id">{{ p.name }} (ID {{p.id}})</option>
          </select>
        </div>
        <div class="auto-hint small text-muted d-flex align-items-end" *ngIf="selectedPreceptorId">
          <i class="bi bi-arrow-repeat me-1"></i>Atualização automática ativa
        </div>
      </div>

      <!-- Loading overlay -->
      <div *ngIf="loadingCode" class="loading-overlay d-flex flex-column align-items-center justify-content-center">
        <div class="spinner-border text-primary spinner-sm mb-2" role="status"></div>
        <span class="small text-muted">Carregando...</span>
      </div>
      <div *ngIf="codeError" class="alert alert-danger small py-1 px-2 mb-3 text-center rounded-3">{{codeError}}</div>

      <ng-container *ngIf="selectedPreceptorId; else selecione">
        <div class="content d-flex flex-column align-items-center text-center">
          <div class="qr-frame mb-4 position-relative">
            <canvas #qrCanvas class="qr-canvas" [class.invisible]="!code?.code && !lastNonEmptyCode"></canvas>
            <!-- Initial load -->
            <div *ngIf="!code?.code && !firstLoadDone" class="qr-placeholder centered-col">
              <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
              <div class="small text-muted mt-3">Carregando código...</div>
            </div>
            <!-- Rotating load -->
            <div *ngIf="rotatingLoading" class="qr-rotating-overlay centered-col">
              <div class="spinner-border text-primary spinner-rot" role="status"></div>
              <div class="small text-muted mt-2">Atualizando...</div>
            </div>
            <!-- Empty finalized -->
            <div *ngIf="!rotatingLoading && !code?.code && firstLoadDone && !lastNonEmptyCode" class="qr-placeholder centered-col final">
              <i class="bi bi-qr-code fs-1 text-muted"></i>
              <div class="small text-muted mt-2">Sem código ativo</div>
            </div>
          </div>
          <div class="code-line fw-semibold mb-1"><span class="lbl">Código:</span><span class="code-text">{{ displayCode() }}</span></div>
          <div class="id-line mb-3 text-secondary fw-semibold small"><span class="me-1 text-muted">Preceptor ID:</span><span class="mono">{{ selectedPreceptorId }}</span></div>
          <div class="progress-shell mb-2" [class.expired]="secondsLeft===0" aria-label="Tempo restante" role="progressbar" [attr.aria-valuenow]="60-secondsLeft" aria-valuemin="0" aria-valuemax="60">
            <div class="bar" [style.width.%]="progressPct"></div>
          </div>
          <div class="remaining small text-muted mb-4" *ngIf="code?.code; else leitura">
            Expira em <strong [class.text-danger]="secondsLeft <= 10">{{ formatRemaining(secondsLeft) }}</strong>
          </div>
          <ng-template #leitura><div class="small text-muted mb-4">Leitura apenas • Não há código válido</div></ng-template>

          <!-- Disciplines Panel -->
          <div class="disciplines-panel w-100 mt-2">
            <div class="panel-head d-flex align-items-center justify-content-between mb-2">
              <div class="title fw-semibold">Disciplinas Vinculadas</div>
              <div class="pill small text-uppercase" *ngIf="!loadingDisc && disciplines?.length">{{disciplines.length}}</div>
            </div>
            <div *ngIf="loadingDisc" class="small text-muted skeleton-line">Carregando disciplinas...</div>
            <div *ngIf="discError && !loadingDisc" class="alert alert-warning py-1 px-2 small mb-2">{{discError}}</div>
            <ul *ngIf="!loadingDisc && disciplines?.length" class="disc-list small">
              <li class="disc-item" *ngFor="let d of disciplines">
                <span class="name text-truncate">{{ d.name }}</span>
                <span class="code badge">{{ d.code }}</span>
              </li>
            </ul>
            <div *ngIf="!loadingDisc && !disciplines?.length && !discError" class="small text-muted fst-italic">Nenhum vínculo encontrado.</div>
          </div>
          <div class="mt-4 small text-muted">Modo leitura (ADMIN) – Não gera/renova códigos</div>
        </div>
      </ng-container>
      <ng-template #selecione>
        <div class="text-center text-muted py-5 small fst-italic">Selecione um preceptor para visualizar o código.</div>
      </ng-template>
    </div>
  </div>
  <ng-template #noAccess>
    <div class="container py-5">
      <div class="alert alert-warning">Acesso restrito ao ADMIN.</div>
    </div>
  </ng-template>
  `,
  styles: [`
    :host{display:block;}
    .admin-preceptor-codes-wrapper{min-height:100%;background:linear-gradient(145deg,#eef5ff,#e3eefc 50%,#dbe8f7);} 
    .glass-card{max-width:760px;border:1px solid #d9e4ef;background:rgba(255,255,255,.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:24px;box-shadow:0 10px 28px -10px rgba(32,56,92,.25),0 4px 14px -4px rgba(32,56,92,.18);min-height:560px;}
    .selector-row select{border-radius:14px;font-size:.8rem;}
    .mini-label{font-size:.65rem;font-weight:600;letter-spacing:.6px;color:#5c7182;text-transform:uppercase;}
    .loading-overlay{position:absolute;inset:0;background:rgba(255,255,255,.92);z-index:5;border-radius:24px;}
    .spinner-sm{width:2.1rem;height:2.1rem;}
    .qr-frame{position:relative;width:300px;max-width:64vw;aspect-ratio:1/1;border-radius:26px;padding:14px;background:linear-gradient(135deg,#f7fbff,#edf4fa);border:1px solid #dbe5ef;box-shadow:0 6px 18px -8px rgba(30,54,90,.25);} 
    .qr-canvas{width:100% !important;height:100% !important;border-radius:18px;background:#fff;}
    .qr-canvas.invisible{visibility:hidden;}
    .centered-col{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;}
    .qr-placeholder.final{border:2px dashed #ced4da;border-radius:18px;background:rgba(255,255,255,.6);} 
    .qr-rotating-overlay{backdrop-filter:blur(2px);background:rgba(255,255,255,.65);border:4px solid #fff;border-radius:18px;}
    .code-line .lbl{font-size:.75rem;text-transform:uppercase;letter-spacing:.5px;color:#5c7182;margin-right:.35rem;}
    .code-text{color:#1d4d85;font-size:2rem;letter-spacing:2px;font-weight:700;font-family:ui-monospace,monospace;}
    .id-line .mono{font-family:ui-monospace,monospace;color:#2c5b92;font-size:1.2rem;line-height:1;font-weight:700;letter-spacing:1px;}
    .progress-shell{position:relative;width:320px;max-width:75vw;height:34px;background:linear-gradient(90deg,#f0f5fa,#e9f1f8);border:1px solid #d5e2ec;border-radius:999px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.06);} 
    .progress-shell.expired{opacity:.55;}
    .progress-shell .bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#4b90ff,#2563eb);transition:width .6s cubic-bezier(.4,.14,.3,1);box-shadow:0 0 0 1px rgba(255,255,255,.4),0 2px 8px -3px rgba(37,99,235,.55);} 
    .remaining strong{font-variant-numeric:tabular-nums;}
    .disciplines-panel{max-width:640px;margin-left:auto;margin-right:auto;background:linear-gradient(135deg,#f8fbfe,#f3f8fc);border:1px solid #dce6ef;border-radius:18px;padding:1rem .95rem .85rem;box-shadow:0 4px 14px -6px rgba(30,54,90,.15);} 
    .disciplines-panel .panel-head .title{font-size:.8rem;text-transform:uppercase;letter-spacing:.65px;color:#2f577f;}
    .disciplines-panel .pill{background:#e6eef6;padding:.15rem .55rem;border-radius:24px;font-weight:600;letter-spacing:.5px;color:#406186;}
    .disc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem;max-height:240px;overflow:auto;}
    .disc-item{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.5rem .65rem;border:1px solid #e1eaf2;border-radius:12px;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,.04);} 
    .disc-item .code{background:#eef5ff;color:#1d4d85;font-weight:600;border-radius:14px;}
    .skeleton-line{background:linear-gradient(90deg,#edf3f8,#f3f8fc 40%,#edf3f8 80%);background-size:200% 100%;animation:shimmer 1.2s linear infinite;border-radius:6px;padding:.35rem .6rem;display:inline-block;}
    @keyframes shimmer{0%{background-position:0 0;}100%{background-position:200% 0;}}
    @media (max-width:640px){
      .qr-frame{width:240px;padding:12px;border-radius:22px;}
      .code-text{font-size:1.6rem;letter-spacing:1.2px;}
      .progress-shell{height:30px;width:260px;}
      .disciplines-panel{padding:.85rem .75rem .7rem;}
      .id-line .mono{font-size:1.05rem;}
    }
    @media (max-width:420px){
      .qr-frame{width:200px;padding:10px;border-radius:20px;}
      .progress-shell{height:26px;width:220px;}
      .code-text{font-size:1.4rem;}
      .disc-item{padding:.45rem .55rem;}
    }
  `]
})
export class AdminPreceptorCodesComponent implements OnInit, OnDestroy {
  role: string | null = null;
  preceptors: any[] = [];
  selectedPreceptorId: number | '' = '';
  code: any = null;
  disciplines: any[] = [];
  loadingCode = false;
  loadingDisc = false;
  codeError = '';
  discError = '';
  private intervalId?: any; // ticker
  private fetching = false; // evita fetch concorrente
  private visibilityHandler = () => {
    if (!this.isBrowser) return;
    if (document.visibilityState === 'visible') {
      this.recomputeRemaining();
      if (this.secondsLeft <= 0 && this.selectedPreceptorId) {
        this.fetchCode(true);
        this.fetchDisciplines();
      } else {
        this.restartTicker();
      }
    }
  };
  @ViewChild('qrCanvas') qrCanvas?: ElementRef<HTMLCanvasElement>;
  secondsLeft = 0;
  totalWindow = 60;
  progressPct = 0;
  private expiresAtTs = 0;
  private isBrowser: boolean;
  private emptyCounter = 0; // contagem de segundos sem código para polling leve
  firstLoadDone = false;
  lastNonEmptyCode: string | null = null;
  rotatingLoading = false;

  constructor(private http: HttpClient, private auth: AuthService, @Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.role = this.auth.getRole();
    if (this.role === 'ADMIN') {
      this.loadPreceptors();
      if (this.isBrowser) {
        document.addEventListener('visibilitychange', this.visibilityHandler);
        window.addEventListener('focus', this.visibilityHandler);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.isBrowser) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('focus', this.visibilityHandler);
    }
  }

  loadPreceptors(){
    // Reusa /api/admin/users e filtra client-side por PRECEPTOR (dataset pequeno)
    this.http.get<any>(`/api/admin/users?size=500`).subscribe({
      next: res => {
        const list = res?.items || [];
        this.preceptors = list.filter((u:any) => u.role === 'PRECEPTOR');
      },
      error: _ => { this.preceptors = []; }
    });
  }

  onSelectPreceptor(){
    if (!this.selectedPreceptorId) { this.clearData(); return; }
    this.fetchAll();
    this.restartTicker();
  }
  // refresh manual removido (auto)

  private fetchAll(force:boolean=false){
    if (!this.selectedPreceptorId) return;
    this.fetchCode(force);
    this.fetchDisciplines();
  }

  private fetchCode(force:boolean=false){
    if (this.fetching) return; // evita corrida
    this.fetching = true;
    this.loadingCode = true; this.codeError='';
    this.http.get<any>(`/api/check/admin/preceptor/${this.selectedPreceptorId}/code`).subscribe({
      next: c => {
        const prev = this.code?.code;
  this.code = c; this.loadingCode = false; this.fetching = false; this.rotatingLoading = false;
        if (c?.code) { this.lastNonEmptyCode = c.code; }
        if (c?.expiresAt) {
          this.expiresAtTs = Date.parse(c.expiresAt);
          const diff = this.expiresAtTs - Date.now();
          this.secondsLeft = Math.max(0, Math.floor(diff/1000));
        } else {
          this.secondsLeft = (c?.secondsRemaining ?? 0);
          this.expiresAtTs = Date.now() + this.secondsLeft*1000;
        }
        this.totalWindow = 60;
        this.recomputeRemaining();
        // Garante tentativa de render mesmo se prev==undefined e canvas recém montado
        if (prev !== c?.code || !prev) {
          this.renderQR();
        } else {
          // Caso canvas ainda não esteja no DOM neste tick
          this.scheduleQRRender();
        }
        if (!this.firstLoadDone) this.firstLoadDone = true;
        // se não há código, não reinicia ticker agressivamente, polling leve já está ativo
        if (c?.code) {
          this.restartTicker();
        }
      },
  error: _ => { this.codeError = 'Falha ao carregar código'; this.loadingCode = false; this.fetching=false; this.rotatingLoading = false; this.code = null; this.secondsLeft = 0; this.progressPct=0; if (!this.firstLoadDone) this.firstLoadDone = true; }
    });
  }
  private fetchDisciplines(){
    this.loadingDisc = true; this.discError=''; this.disciplines=[];
    this.http.get<any[]>(`/api/check/admin/preceptor/${this.selectedPreceptorId}/disciplines`).subscribe({
      next: list => { this.disciplines = Array.isArray(list)? list: []; this.loadingDisc=false; },
      error: _ => { this.discError = 'Falha ao carregar disciplinas'; this.loadingDisc=false; }
    });
  }
  private clearData(){
    this.code = null; this.disciplines=[]; this.codeError=''; this.discError='';
    this.secondsLeft = 0; this.progressPct = 0; this.expiresAtTs = 0;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = undefined; }
  }

  private restartTicker(){
    if (this.intervalId) clearInterval(this.intervalId);
    const tick = () => {
      this.recomputeRemaining();
      if (this.selectedPreceptorId) {
        if (this.code?.code) {
          // código ativo: refetch somente ao expirar
          if (this.secondsLeft <= 0) {
            if (!this.fetching) this.rotatingLoading = true;
            this.fetchCode(true);
          }
        } else {
          // sem código ativo: polling mais lento (a cada 5 ticks ~5s) para detectar novo código
          this.emptyCounter++;
          if (this.emptyCounter % 5 === 0) {
            this.fetchCode(true);
          }
        }
      }
    };
    tick();
    this.intervalId = setInterval(tick, 1000);
  }

  private recomputeRemaining(){
    if (!this.expiresAtTs) { this.secondsLeft = 0; this.progressPct = 0; return; }
    const diff = this.expiresAtTs - Date.now();
    this.secondsLeft = Math.max(0, Math.floor(diff/1000));
    this.progressPct = this.totalWindow ? ((this.totalWindow - this.secondsLeft)/this.totalWindow)*100 : 0;
  }

  private renderQR(){
    if (!this.isBrowser) return;
    if (!this.qrCanvas) return;
    const effectiveCode = this.code?.code || this.lastNonEmptyCode;
    if (!effectiveCode || !this.selectedPreceptorId) {
      const ctx = this.qrCanvas.nativeElement.getContext('2d');
      if (ctx) { ctx.clearRect(0,0,this.qrCanvas.nativeElement.width,this.qrCanvas.nativeElement.height); }
      return;
    }
    const value = JSON.stringify({ code: effectiveCode, preceptorId: this.selectedPreceptorId });
    QRCode.toCanvas(this.qrCanvas.nativeElement, value, { width:300, margin:1, color: { dark:'#000000', light:'#FFFFFF' } }, () => {});
  }

  private scheduleQRRender(){
    if (!this.isBrowser) return;
    setTimeout(() => this.renderQR(), 0);
  }

  formatRemaining(sec: number): string {
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = (sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  displayCode(): string {
    if (this.code?.code) return this.code.code;
    if (this.lastNonEmptyCode) return this.lastNonEmptyCode; // mantém código anterior até confirmação de ausência real
    return this.firstLoadDone ? '------' : '••••••';
  }
}
