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
  <div class="preceptor-code-wrapper d-flex justify-content-center p-3 p-sm-4" *ngIf="role==='ADMIN'; else noAccess">
    <div class="code-card card p-4 w-100 position-relative" style="max-width:760px;">
      <div class="d-flex flex-column flex-md-row w-100 mb-3 gap-3">
        <div class="flex-grow-1">
          <label class="form-label small text-muted mb-1">Selecionar Preceptor</label>
          <select class="form-select form-select-sm" [(ngModel)]="selectedPreceptorId" (change)="onSelectPreceptor()">
            <option value="" disabled>-- Escolha --</option>
            <option *ngFor="let p of preceptors" [ngValue]="p.id">{{ p.name }} (ID {{p.id}})</option>
          </select>
        </div>
        <div class="d-flex align-items-end small text-muted" *ngIf="selectedPreceptorId">
          Atualização automática ativa
        </div>
      </div>
      <div *ngIf="loadingCode" class="loading-overlay d-flex flex-column align-items-center justify-content-center">
        <div class="spinner-border text-primary spinner-sm mb-2" role="status"></div>
        <span class="small text-muted">Carregando...</span>
      </div>
      <div *ngIf="codeError" class="alert alert-danger py-1 px-2 small mb-3 w-100 text-center">{{codeError}}</div>
      <div class="d-flex flex-column align-items-center text-center" *ngIf="selectedPreceptorId; else selecione">
        <div class="qr-container mb-4 position-relative">
          <canvas #qrCanvas class="qr-canvas shadow-sm" [class.invisible]="!code?.code && !lastNonEmptyCode"></canvas>
          <!-- Loading inicial -->
          <div *ngIf="!code?.code && !firstLoadDone" class="qr-placeholder position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center flex-column">
            <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
            <div class="small text-muted mt-3">Carregando código...</div>
          </div>
          <!-- Loading de rotação -->
          <div *ngIf="rotatingLoading" class="qr-rotating-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center">
            <div class="spinner-border text-primary spinner-rot" role="status"></div>
            <div class="small text-muted mt-2">Atualizando...</div>
          </div>
          <!-- Placeholder definitivo -->
          <div *ngIf="!rotatingLoading && !code?.code && firstLoadDone && !lastNonEmptyCode" class="qr-placeholder position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center flex-column">
            <i class="bi bi-qr-code fs-1 text-muted"></i>
            <div class="small text-muted mt-2">Sem código ativo</div>
          </div>
        </div>
        <div class="fs-5 fw-semibold mb-1">
          <span class="me-1">Código:</span>
          <span class="code-text">{{ displayCode() }}</span>
        </div>
        <div class="fs-6 mb-3 text-secondary fw-semibold">
          <span class="me-1">Preceptor Id:</span>
          <span>{{ selectedPreceptorId }}</span>
        </div>
        <div class="progress-pill mb-2" [class.dim]="secondsLeft===0">
          <div class="fill" [style.width.%]="progressPct"></div>
        </div>
        <div class="small text-muted mb-4" *ngIf="code?.code; else somenteLeitura">
          Expira em: <strong [class.text-danger]="secondsLeft <= 10">{{ formatRemaining(secondsLeft) }}</strong>
        </div>
        <ng-template #somenteLeitura>
          <div class="small text-muted mb-4">Leitura apenas • Não há código válido</div>
        </ng-template>
        <!-- Disciplinas -->
        <div class="w-100 mt-2" style="max-width:640px;">
          <div class="text-start fw-semibold mb-2">Disciplinas vinculadas</div>
          <div *ngIf="loadingDisc" class="small text-muted">Carregando disciplinas...</div>
          <div *ngIf="discError && !loadingDisc" class="alert alert-warning py-1 px-2 small">{{discError}}</div>
          <ul *ngIf="!loadingDisc && disciplines?.length" class="list-group small">
            <li class="list-group-item d-flex justify-content-between align-items-center" *ngFor="let d of disciplines">
              <span class="text-truncate">{{ d.name }}</span>
              <span class="badge bg-primary-subtle text-primary">{{ d.code }}</span>
            </li>
          </ul>
          <div *ngIf="!loadingDisc && !disciplines?.length && !discError" class="small text-muted">Nenhuma disciplina vinculada.</div>
        </div>
        <div class="mt-4 small text-muted">Modo leitura (ADMIN) – Não gera/renova códigos</div>
      </div>
      <ng-template #selecione>
        <div class="text-center text-muted py-5 small">Selecione um preceptor para visualizar o código.</div>
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
    .code-card{border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.06);min-height:560px;}
    .qr-container{position:relative;width:300px;max-width:60vw;}
  .qr-canvas{width:100% !important;height:auto !important;aspect-ratio:1/1;border-radius:8px;background:#fff;border:4px solid #fff;}
  .qr-canvas.invisible{visibility:hidden;}
    .qr-placeholder{width:300px;max-width:60vw;aspect-ratio:1/1;border:4px dashed #ced4da;border-radius:8px;}
    .code-text{color:#0d6efd;font-size:1.9rem;letter-spacing:1px;}
    .progress-pill{position:relative;width:300px;max-width:70vw;height:58px;background:#e4e9ff;border-radius:100px;display:flex;align-items:center;overflow:hidden;}
    .progress-pill .fill{position:absolute;left:0;top:0;bottom:0;background:#0366ff;transition:width .5s linear;}
    .loading-overlay{position:absolute;inset:0;background:rgba(255,255,255,.88);z-index:5;border-radius:18px;}
    .spinner-sm{width:2.1rem;height:2.1rem;}
  .qr-rotating-overlay{backdrop-filter:blur(2px);background:rgba(255,255,255,.65);border:4px solid #fff;border-radius:8px;}
  .spinner-rot{width:2.1rem;height:2.1rem;}
    @media (max-width:520px){ .code-text{font-size:1.5rem;} .progress-pill{height:46px;} }
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
