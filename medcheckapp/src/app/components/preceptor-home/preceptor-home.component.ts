import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreceptorService } from '../../services/preceptor.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';
import { PreceptorAlunoContextService } from '../../services/preceptor-aluno-context.service';

@Component({
  selector: 'app-preceptor-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="preceptor-home-wrapper">
    <div class="ph-head container-fluid">
      <div class="toolbar glass-bar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input [(ngModel)]="q" (input)="onSearchTyping()" (keyup.enter)="reloadFirstPage()" placeholder="Buscar aluno (nome, email, CPF)" aria-label="Buscar aluno" />
          <button *ngIf="q" class="clear-btn" (click)="q=''; reloadFirstPage()" aria-label="Limpar busca"><i class="bi bi-x"></i></button>
        </div>
        <div class="filters-group">
          <div class="select-inline" *ngIf="role==='ADMIN' && adminDisciplines.length">
            <label class="mini-label">Disciplina</label>
            <select [(ngModel)]="adminDisciplineId" (change)="reloadFirstPage()" aria-label="Selecionar disciplina" class="disc-code-select">
              <option value="">Todas</option>
              <option *ngFor="let d of adminDisciplines" [ngValue]="d.id">{{ d.code }}</option>
            </select>
          </div>
          <div class="select-inline" *ngIf="role==='PRECEPTOR' && preceptorDisciplines.length">
            <label class="mini-label">Disciplina</label>
            <select [(ngModel)]="preceptorDisciplineId" (change)="reloadFirstPage()" aria-label="Selecionar disciplina" class="disc-code-select">
              <option *ngFor="let d of preceptorDisciplines" [ngValue]="d.id" [title]="d.name">{{ d.code }}</option>
            </select>
          </div>
          <div class="select-inline">
            <label class="mini-label">Ano</label>
            <select [(ngModel)]="year" (change)="reloadFirstPage()" aria-label="Selecionar ano">
              <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
            </select>
          </div>
          <div class="dropdown-filters" [class.open]="filtersOpen">
            <button class="btn-filters" type="button" (click)="toggleFilters()" [attr.aria-expanded]="filtersOpen" aria-haspopup="true" aria-label="Alternar painel de filtros">
              <i class="bi bi-sliders"></i> Filtros
            </button>
            <div class="panel" *ngIf="filtersOpen" role="menu">
              <div class="section-title">Campos</div>
              <div class="check-line">
                <input type="checkbox" id="f_fName" [(ngModel)]="filters.fName" (change)="reloadFirstPage()" />
                <label for="f_fName">Nome</label>
              </div>
              <div class="check-line">
                <input type="checkbox" id="f_fPhone" [(ngModel)]="filters.fPhone" (change)="reloadFirstPage()" />
                <label for="f_fPhone">Telefone</label>
              </div>
              <div class="check-line">
                <input type="checkbox" id="f_fEmail" [(ngModel)]="filters.fEmail" (change)="reloadFirstPage()" />
                <label for="f_fEmail">Email</label>
              </div>
              <div class="check-line">
                <input type="checkbox" id="f_fCpf" [(ngModel)]="filters.fCpf" (change)="reloadFirstPage()" />
                <label for="f_fCpf">CPF</label>
              </div>
              <div class="section-title mt-2">Status</div>
              <div class="check-line">
                <input type="checkbox" id="f_status_in" [(ngModel)]="filters.statusIn" (change)="reloadFirstPage()" />
                <label for="f_status_in">Em Serviço</label>
              </div>
              <div class="check-line">
                <input type="checkbox" id="f_status_out" [(ngModel)]="filters.statusOut" (change)="reloadFirstPage()" />
                <label for="f_status_out">Fora de Serviço</label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="metrics-row" *ngIf="!loading && items.length">
        <div class="metric-card">
          <div class="icon-wrap"><i class="bi bi-people"></i></div>
          <div class="text-zone">
            <div class="label">Total Alunos</div>
            <div class="value">{{ totalItems }}</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="icon-wrap in"><i class="bi bi-person-check"></i></div>
            <div class="text-zone">
              <div class="label">Em Serviço</div>
              <div class="value" *ngIf="!statusTotalsLoading; else stl1">{{ totalInService }}</div>
              <ng-template #stl1><div class="value small text-muted">...</div></ng-template>
            </div>
        </div>
        <div class="metric-card">
          <div class="icon-wrap off"><i class="bi bi-person-dash"></i></div>
          <div class="text-zone">
            <div class="label">Fora Serviço</div>
            <div class="value" *ngIf="!statusTotalsLoading; else stl2">{{ totalOffService }}</div>
            <ng-template #stl2><div class="value small text-muted">...</div></ng-template>
          </div>
        </div>
      </div>
    </div>

    <div class="list-container container" [class.loading]="loading">
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner-border text-primary"></div>
        <div class="small text-muted mt-2">Carregando...</div>
      </div>
      <div class="row g-4" *ngIf="items.length; else emptyState">
        <div class="col-12 col-md-6 col-xl-4" *ngFor="let a of items; trackBy: trackById">
          <div class="student-card h-100" [class.selected]="isSelecionado(a)" (click)="visualizar(a)" role="article" [attr.aria-label]="'Aluno '+a.name">
            <div class="sc-head d-flex align-items-start gap-3">
              <div class="avatar" [class.no-photo]="a._noPhoto">
                <img *ngIf="!a._noPhoto" [src]="a._avatarUrl" (error)="onImgError(a,$event)" alt="Avatar de {{a.name}}" />
                <i *ngIf="a._noPhoto" class="bi bi-person"></i>
                <span class="status-dot" [class.on]="a.inService" [class.off]="!a.inService" [title]="a.inService ? 'Em serviço' : 'Fora de serviço'"></span>
              </div>
              <div class="flex-grow-1 min-w-0">
                <div class="name text-truncate fw-semibold">{{ a.name }}</div>
                <div class="info-lines small">
                  <div class="line"><i class="bi bi-telephone"></i><span>{{ formatPhone(a.phone) }}</span></div>
                  <div class="line"><i class="bi bi-envelope"></i><span class="text-truncate">{{ a.email }}</span></div>
                  <div class="line"><i class="bi bi-credit-card-2-front"></i><span>{{ formatCpf(a.cpf) }}</span></div>
                </div>
              </div>
            </div>
            <div class="sc-actions d-flex flex-wrap gap-2 mt-3">
              <button class="btn btn-sm btn-outline-primary flex-grow-1" type="button" (click)="$event.stopPropagation(); visualizar(a)" [class.active]="isSelecionado(a)" [attr.aria-pressed]="isSelecionado(a)" [attr.aria-label]="isSelecionado(a) ? 'Aluno selecionado '+a.name : 'Visualizar aluno '+a.name">
                <i class="bi" [ngClass]="{'bi-eye': !isSelecionado(a), 'bi-check2-circle': isSelecionado(a)}"></i>
                {{ isSelecionado(a) ? 'Selecionado' : 'Visualizar' }}
              </button>
              <button *ngIf="role==='ADMIN' && a.role==='PRECEPTOR'" class="btn btn-sm btn-outline-secondary" type="button" (click)="$event.stopPropagation(); openPreceptorCode(a)" aria-label="Abrir código de preceptor">
                <i class="bi bi-upc-scan"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ng-template #emptyState>
        <div class="empty-state text-center py-5">
          <div class="emoji mb-2">🗂️</div>
          <h6 class="fw-semibold mb-1">Nenhum aluno encontrado</h6>
          <p class="text-muted small mb-2">Ajuste filtros ou refine a busca.</p>
          <button class="btn btn-sm btn-outline-primary" (click)="reloadFirstPage()"><i class="bi bi-arrow-clockwise"></i> Recarregar</button>
        </div>
      </ng-template>

      <div class="pager d-flex align-items-center mt-4" *ngIf="totalPages > 1">
        <button class="nav-btn" [disabled]="page===0" (click)="go(page-1)" aria-label="Página anterior"><i class="bi bi-chevron-left"></i></button>
        <span class="page-label">{{page+1}} / {{totalPages}}</span>
        <button class="nav-btn" [disabled]="page>=totalPages-1" (click)="go(page+1)" aria-label="Próxima página"><i class="bi bi-chevron-right"></i></button>
      </div>
    </div>

    <!-- Modal Código Preceptor -->
    <div class="ph-modal-backdrop" *ngIf="showCodeModal" (click)="closeCodeModal()"></div>
    <div class="ph-code-modal" *ngIf="showCodeModal" role="dialog" aria-modal="true" aria-label="Código do Preceptor">
      <div class="modal-head d-flex justify-content-between align-items-center">
        <h6 class="m-0 fw-semibold d-flex align-items-center gap-2"><i class="bi bi-upc-scan"></i> {{ modalPreceptor?.name }}</h6>
        <button class="btn-close" type="button" (click)="closeCodeModal()" aria-label="Fechar"></button>
      </div>
      <div class="modal-body small">
        <div class="code-block mb-3">
          <div class="hint text-muted">Código ativo</div>
          <div class="the-code" *ngIf="modalCode?.code; else noCodeBlock">{{ modalCode.code }}</div>
          <ng-template #noCodeBlock><div class="fst-italic text-muted">Nenhum código válido agora</div></ng-template>
          <div class="mt-1" *ngIf="modalCode?.code">
            <span class="badge rounded-pill bg-warning-subtle text-dark" *ngIf="modalCode?.secondsRemaining>0">Expira em {{ modalCode.secondsRemaining }}s</span>
            <span class="badge rounded-pill bg-danger-subtle text-danger" *ngIf="modalCode?.secondsRemaining===0">Expirado</span>
          </div>
        </div>
        <div class="disc-block">
          <div class="hint text-muted mb-1">Disciplinas vinculadas</div>
          <ul class="disc-list">
            <li *ngFor="let d of modalDisciplines">{{ d.code }} - {{ d.name }}</li>
            <li *ngIf="modalDisciplines.length===0" class="fst-italic text-muted">Nenhuma disciplina vinculada</li>
          </ul>
        </div>
      </div>
      <div class="modal-foot d-flex justify-content-between align-items-center">
        <small class="text-muted">Atualiza automaticamente</small>
        <button class="btn btn-sm btn-outline-primary" (click)="manualRefreshCode()" [disabled]="refreshing">{{ refreshing? '...' : 'Atualizar' }}</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    :host{display:block;}
    .preceptor-home-wrapper{min-height:100%; padding:1.2rem 0 3rem; background:linear-gradient(145deg,#e8f2ff,#dbe9ff 45%,#d4e2ff);} 
    .ph-head{margin-bottom:.75rem;}
    .glass-bar{background:#ffffff; border:1px solid #dfe7ef; border-radius:18px; padding:.85rem 1.1rem; display:flex; flex-wrap:wrap; align-items:center; gap:1rem; box-shadow:0 4px 14px -4px rgba(20,40,60,.12);} 
    .search-box{position:relative; display:flex; align-items:center; gap:.5rem; flex:1 1 260px; max-width:520px; background:linear-gradient(135deg,#f9fcff,#f1f6fb); border:1px solid #dfe7ef; border-radius:12px; padding:.4rem .75rem .4rem 2.1rem;}
    .search-box i.bi-search{position:absolute; left:.75rem; top:50%; transform:translateY(-50%); color:#5f7280; font-size:.95rem;}
    .search-box input{border:none; outline:none; background:transparent; flex:1; font-size:.85rem; font-weight:500; letter-spacing:.3px;}
    .search-box .clear-btn{background:transparent; border:none; color:#6b7a85; padding:0; line-height:1; display:inline-flex; align-items:center; cursor:pointer;}
    .filters-group{display:flex; align-items:center; gap:.9rem; flex-wrap:wrap; margin-left:auto;}
    .select-inline{display:flex; flex-direction:column; gap:.25rem;}
    .select-inline select{font-size:.7rem; text-transform:uppercase; letter-spacing:.6px; font-weight:600; padding:.25rem .55rem; border:1px solid #d5e1eb; border-radius:8px; background:#f6fafc; min-width:120px;}
    .mini-label{font-size:.55rem; font-weight:600; letter-spacing:.55px; color:#5c6e7b; text-transform:uppercase;}
    .dropdown-filters{position:relative;}
    .btn-filters{background:#f0f6fb; border:1px solid #d2dee7; border-radius:10px; padding:.45rem .75rem; font-size:.7rem; font-weight:600; letter-spacing:.5px; display:inline-flex; align-items:center; gap:.4rem;}
    .dropdown-filters .panel{position:absolute; top:calc(100% + .5rem); right:0; min-width:220px; background:#ffffff; border:1px solid #dfe7ef; border-radius:14px; padding:.9rem .9rem .8rem; box-shadow:0 10px 26px -6px rgba(20,40,60,.18); animation:fadeSlide .28s ease; z-index:30;}
    .panel .section-title{font-size:.55rem; text-transform:uppercase; font-weight:700; letter-spacing:.55px; color:#5c6e7b; margin-bottom:.4rem;}
    .check-line{display:flex; align-items:center; gap:.4rem; font-size:.7rem; padding:.25rem 0;}
    .check-line input{margin:0;}
    .metrics-row{display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:.85rem; margin-top:1rem;}
  .metric-card{background:#fff; border:1px solid #dfe7ef; border-radius:14px; padding:.65rem .75rem; position:relative; overflow:hidden; box-shadow:0 4px 12px -4px rgba(20,40,60,.12); display:flex; align-items:center; gap:.65rem; min-height:72px;}
  .metric-card:before{content:""; position:absolute; inset:0; background:radial-gradient(circle at 82% 18%, rgba(255,255,255,.65), transparent 74%); pointer-events:none;}
  .metric-card .icon-wrap{width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; color:#1d4d85; background:linear-gradient(135deg,#e6f2ff,#f5faff); border:1px solid #d2e2ef; box-shadow:0 2px 6px -2px rgba(20,40,60,.18);} 
  .metric-card .icon-wrap.in{color:#0e7c3a; background:linear-gradient(135deg,#e4f9ee,#f5fef9); border-color:#c6ead9;}
  .metric-card .icon-wrap.off{color:#7a8591; background:linear-gradient(135deg,#f1f4f6,#fbfcfd); border-color:#dde4ea;}
  .metric-card .icon-wrap.disc{color:#7c3aed; background:linear-gradient(135deg,#efe6ff,#f9f5ff); border-color:#e2d3fb;}
  .metric-card .text-zone{display:flex; flex-direction:column; line-height:1.05; flex:1;}
  .metric-card .label{font-size:.55rem; font-weight:600; letter-spacing:.55px; color:#5a6d7b; text-transform:uppercase; margin-bottom:.15rem;}
  .metric-card .value{font-size:1.25rem; font-weight:600; letter-spacing:.5px; color:#133d6b;}
  .metric-card.alt{background:linear-gradient(135deg,#f4f9ff,#e9f2ff);} 
    .list-container{position:relative;}
    .list-container.loading{opacity:.7;}
    .loading-overlay{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(3px); background:rgba(255,255,255,.55); border-radius:18px; z-index:10;}
    .student-card{background:linear-gradient(145deg,#f9fcff,#f1f6fb); border:1px solid #dfe7ef; border-radius:18px; padding:1rem .95rem .9rem; display:flex; flex-direction:column; justify-content:space-between; position:relative; box-shadow:0 4px 12px -6px rgba(20,40,60,.14); cursor:pointer; transition:.25s cubic-bezier(.4,.14,.3,1);} 
    .student-card:hover{transform:translateY(-4px); box-shadow:0 10px 24px -8px rgba(20,40,60,.22);}
    .student-card.selected{border-color:#2563eb; box-shadow:0 0 0 1px rgba(37,99,235,.4), 0 6px 20px -8px rgba(37,99,235,.35);} 
    .sc-head .avatar{width:60px; height:60px; border-radius:16px; background:#e3edf5; position:relative; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1.9rem; color:#6a7d8c; overflow:hidden; border:1px solid #d5e1eb;}
    .sc-head .avatar.no-photo{background:#edf3f8;}
    .sc-head .avatar img{width:100%; height:100%; object-fit:cover;}
    .status-dot{position:absolute; bottom:4px; right:4px; width:14px; height:14px; border-radius:50%; border:2px solid #fff;}
    .status-dot.on{background:#1faa59;}
    .status-dot.off{background:#b0bcc7;}
    .info-lines .line{display:flex; align-items:center; gap:.4rem; line-height:1.15rem; color:#5a6b78;}
    .info-lines .line i{font-size:.75rem; opacity:.65;}
    .sc-actions .btn{font-size:.65rem; letter-spacing:.4px; font-weight:600; text-transform:uppercase;}
    .sc-actions .btn-outline-primary.active{background:#2563eb; color:#fff;}
    .empty-state .emoji{font-size:2.2rem;}
    .pager .nav-btn{background:#ffffff; border:1px solid #dfe7ef; width:42px; height:42px; display:inline-flex; align-items:center; justify-content:center; border-radius:12px; font-size:1rem; color:#365166; transition:.25s;}
    .pager .nav-btn:disabled{opacity:.4; cursor:not-allowed;}
    .pager .nav-btn:not(:disabled):hover{background:#f2f8fd;}
    .pager .page-label{font-size:.75rem; font-weight:600; letter-spacing:.5px; margin:0 .75rem; color:#42596d;}
    .btn-ghost-primary{background:linear-gradient(135deg,#ffffff,#f1f7fc); border:1px solid #c9d9e6; border-radius:999px; padding:.55rem 1.1rem; font-size:.7rem; font-weight:600; letter-spacing:.5px; color:#1d4d85;}
    .btn-ghost-primary:hover{background:#eff6fb;}
    /* Modal */
    .ph-modal-backdrop{position:fixed; inset:0; background:rgba(30,45,60,.55); backdrop-filter:blur(3px); z-index:1040; animation:fadeIn .25s ease;}
    .ph-code-modal{position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:430px; max-width:92vw; background:#ffffff; border:1px solid #dfe7ef; border-radius:20px; box-shadow:0 18px 40px -14px rgba(25,50,80,.35), 0 6px 18px -6px rgba(25,50,80,.25); z-index:1050; display:flex; flex-direction:column; animation:scaleIn .35s cubic-bezier(.34,1.56,.4,1);} 
    .ph-code-modal .modal-head{padding:1rem 1rem .25rem; border-bottom:1px solid #e7edf3;}
    .ph-code-modal .modal-body{padding:.75rem 1rem 1rem;}
    .ph-code-modal .modal-foot{padding:.6rem 1rem .9rem; border-top:1px solid #e7edf3;}
    .code-block .the-code{font-size:2.2rem; font-weight:700; letter-spacing:1px; color:#163d6b; line-height:1.1;}
    .disc-list{list-style:none; margin:0; padding:0; max-height:160px; overflow:auto;}
    .disc-list li{padding:.15rem 0; font-size:.72rem;}
    /* Animations */
    @keyframes fadeSlide{from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:translateY(0);} }
    @keyframes scaleIn{from{opacity:0; transform:translate(-50%,-50%) scale(.82);} to{opacity:1; transform:translate(-50%,-50%) scale(1);} }
    @keyframes fadeIn{from{opacity:0;} to{opacity:1;} }
    /* Responsive */
    @media (max-width: 991.98px){
      .sc-head .avatar{width:54px; height:54px;}
      .metric-card .value{font-size:1.1rem;}
    }
    @media (max-width: 767.98px){
      .filters-group{width:100%; justify-content:flex-start;}
      .metrics-row{grid-template-columns:repeat(auto-fit, minmax(140px,1fr));}
    }
    @media (max-width: 575.98px){
      .glass-bar{padding:.75rem .8rem;}
      .search-box{flex:1 1 100%;}
      .select-inline select{min-width:100px;}
      .student-card{padding:.85rem .8rem .75rem;}
      .info-lines .line{font-size:.65rem;}
      .sc-actions .btn{font-size:.58rem;}
      .metric-card{padding:.65rem .7rem;}
    }
  `]
})
export class PreceptorHomeComponent implements OnInit, OnDestroy {
  items: any[] = [];
  page = 0;
  size = 8;
  totalPages = 0;
  totalItems = 0;
  totalInService = 0;
  totalOffService = 0;
  statusTotalsLoading = false;
  year = new Date().getFullYear();
  years = [new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2];
  q = '';
  loading = false;
  private searchDebounce?: any;
  filtersOpen = false;
  filters = { fName: true, fPhone: true, fEmail: true, fCpf: true, statusIn: true, statusOut: true };

  private avatarObjectUrls: string[] = [];

  constructor(private svc: PreceptorService, private http: HttpClient, private auth: AuthService, private toast: ToastService, private router: Router, private alunoCtx: PreceptorAlunoContextService) {}

  role: string | null = null;
  adminDisciplineId: string | number = '';
  adminDisciplines: any[] = [];
  preceptorDisciplineId: string | number = '';
  preceptorDisciplines: any[] = [];

  // Modal state for ADMIN viewing preceptor code
  showCodeModal = false;
  modalPreceptor: any = null;
  modalCode: any = null;
  modalDisciplines: any[] = [];
  private modalTimer?: any;
  refreshing = false;
  private autoStatusTimer?: any;
  private AUTO_INTERVAL_MS = 12000; // 12s balanceando frescor vs carga
  private lastSilentRefresh = 0;

  ngOnInit(): void {
    this.role = this.auth.getRole();
    if (this.role === 'ADMIN') {
      this.fetchAdminDisciplines();
    } else if (this.role === 'PRECEPTOR') {
      this.fetchPreceptorDisciplines();
    }
    try { window.addEventListener('mc:service-status-updated', this.onServiceStatusEvent as any); } catch {}
    try { window.addEventListener('storage', this.onStorage as any); } catch {}
    this.load();
    this.startAutoRefreshLoop();
    try { document.addEventListener('visibilitychange', this.onVisibilityChange); } catch {}
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    if (this.role === 'ADMIN') {
      const params: any = { page: this.page, size: this.size, year: this.year,
        fName: this.filters.fName, fPhone: this.filters.fPhone, fEmail: this.filters.fEmail, fCpf: this.filters.fCpf,
        statusIn: this.filters.statusIn, statusOut: this.filters.statusOut };
      if (this.q) params.q = this.q;
      if (this.adminDisciplineId) params.disciplineId = this.adminDisciplineId;
      this.http.get<any>('/api/admin/students', { params }).subscribe({
        next: res => {
          this.items = res?.items || [];
          this.totalPages = res?.totalPages || 0;
          this.totalItems = res?.totalItems || 0;
          this.page = res?.page || 0;
          this.size = res?.size || this.size;
          this.loading = false;
          this.loadAvatars();
          this.updateStatusTotals();
        },
        error: _ => { this.items = []; this.totalPages = 0; this.totalItems = 0; this.loading = false; }
      });
    } else { // PRECEPTOR
      // Passa disciplineId explicitamente apenas se selecionado (>0)
      const discId = this.preceptorDisciplineId ? this.preceptorDisciplineId : undefined;
      this.svc.students(this.year, this.page, this.size, this.q || undefined, this.filters, discId).subscribe({
        next: res => {
          this.items = res?.items || [];
          this.totalPages = res?.totalPages || 0;
          this.totalItems = res?.totalItems || 0;
          this.page = res?.page || 0;
          this.size = res?.size || this.size;
          this.loading = false;
          this.loadAvatars();
          this.updateStatusTotals();
        },
        error: _ => { this.items = []; this.totalPages = 0; this.totalItems = 0; this.loading = false; }
      });
    }
  }

  reloadFirstPage(){ this.page = 0; this.load(); }
  go(p: number){ this.page = Math.max(0, Math.min(p, this.totalPages-1)); this.load(); }
  toggleFilters(){ this.filtersOpen = !this.filtersOpen; }

  formatCpf(v: string | null | undefined): string {
    if (!v) return '';
    const digits = String(v).replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return String(v);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  formatPhone(v: string | null | undefined): string {
    if (!v) return '(00) 00000-0000';
    const d = String(v).replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) {
      // (00) 0000-0000
      return d
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{4})$/, '$1-$2');
    }
    // (00) 00000-0000
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2');
  }

  onSearchTyping() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.reloadFirstPage(), 400);
  }

  private fetchAdminDisciplines() {
    this.http.get<any[]>('/api/admin/disciplines').subscribe({
      next: list => { this.adminDisciplines = Array.isArray(list) ? list : []; },
      error: _ => { this.adminDisciplines = []; }
    });
  }
  private fetchPreceptorDisciplines(){
    this.svc.disciplines().subscribe({
      next: res => {
        const items = (res as any)?.items || []; // serviço retorna {items:[]}
        this.preceptorDisciplines = Array.isArray(items) ? items : [];
        if (this.role==='PRECEPTOR' && this.preceptorDisciplines.length && !this.preceptorDisciplineId) {
          this.preceptorDisciplineId = this.preceptorDisciplines[0].id;
          // Recarrega lista agora que definimos disciplina inicial
          this.reloadFirstPage();
        }
      },
      error: _ => { this.preceptorDisciplines = []; }
    });
  }
  onImgError(a: any, _ev: Event){ if (a) a._noPhoto = true; }

  private headers(): HttpHeaders | undefined {
    const token = this.auth.getToken?.();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined as any;
  }

  private loadAvatars() {
    // Revoke any previously created object URLs
    this.avatarObjectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    this.avatarObjectUrls = [];
    this.items.forEach(a => {
      a._noPhoto = true;
      a._avatarUrl = '';
      if (!a?.id) return;
      const ts = Date.now();
      this.http.get(`/api/users/${a.id}/photo?t=${ts}`, { headers: this.headers(), responseType: 'blob' }).subscribe({
        next: blob => {
          if (!blob || (blob as any).size === 0) { a._noPhoto = true; return; }
          const url = URL.createObjectURL(blob);
          a._avatarUrl = url;
          a._noPhoto = false;
          this.avatarObjectUrls.push(url);
        },
        error: _ => { a._noPhoto = true; }
      });
    });
  }

  ngOnDestroy(): void {
    this.avatarObjectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    this.avatarObjectUrls = [];
    if (this.modalTimer) { clearInterval(this.modalTimer); this.modalTimer = undefined; }
    try { window.removeEventListener('mc:service-status-updated', this.onServiceStatusEvent as any); } catch {}
    try { window.removeEventListener('storage', this.onStorage as any); } catch {}
    if (this.autoStatusTimer) { clearInterval(this.autoStatusTimer); this.autoStatusTimer = undefined; }
    try { document.removeEventListener('visibilitychange', this.onVisibilityChange); } catch {}
  }

  visualizar(a: any){
    if (!a?.id) return;
    if (this.isSelecionado(a)) {
      // Toggle off
      this.alunoCtx.clear();
      return;
    }
    const displayName = a.name || a.nome || a.fullName || a.email || 'Aluno';
    this.alunoCtx.setAluno(a.id, displayName);
  }

  isSelecionado(a: any): boolean {
    const current = this.alunoCtx.getAluno();
    return !!current.id && current.id === a.id;
  }

  openPreceptorCode(p: any){
    if (!p?.id) return;
    this.modalPreceptor = p;
    this.showCodeModal = true;
    this.fetchPreceptorCodeAndDisciplines();
    if (this.modalTimer) clearInterval(this.modalTimer);
    // Refresh countdown every second locally, and fetch again when expires
    this.modalTimer = setInterval(() => {
      if (this.modalCode && typeof this.modalCode.secondsRemaining === 'number' && this.modalCode.secondsRemaining > 0){
        this.modalCode.secondsRemaining -= 1;
        if (this.modalCode.secondsRemaining === 0){
          // Do not auto generate, just keep expired until manual refresh or periodic fetch
        }
      }
    }, 1000);
  }

  closeCodeModal(){
    this.showCodeModal = false;
    this.modalPreceptor = null;
    this.modalCode = null;
    this.modalDisciplines = [];
    if (this.modalTimer) { clearInterval(this.modalTimer); this.modalTimer = undefined; }
  }

  manualRefreshCode(){
    if (!this.modalPreceptor) return;
    this.fetchPreceptorCodeAndDisciplines(true);
  }

  private fetchPreceptorCodeAndDisciplines(force:boolean=false){
    if (!this.modalPreceptor?.id) return;
    this.refreshing = force;
    // code
    this.http.get<any>(`/api/check/admin/preceptor/${this.modalPreceptor.id}/code`).subscribe({
      next: c => { this.modalCode = c; this.refreshing = false; },
      error: _ => { this.modalCode = { code:null, secondsRemaining:0, expiresAt:null }; this.refreshing = false; }
    });
    // disciplines
    this.http.get<any[]>(`/api/check/admin/preceptor/${this.modalPreceptor.id}/disciplines`).subscribe({
      next: list => { this.modalDisciplines = Array.isArray(list)? list: []; },
      error: _ => { this.modalDisciplines = []; }
    });
  }
  /* ===================== REAL-TIME STATUS LISTENERS ===================== */
  private onServiceStatusEvent = (_e: any) => {
    if (this.loading) return; // simples debounce
    this.load();
  };
  private onStorage = (ev: StorageEvent) => {
    if (ev.key === 'mc:last-service-status') { if (this.loading) return; this.load(); }
  };

  /* ===================== AUTO POLLING (multi-dispositivo) ===================== */
  private startAutoRefreshLoop(){
    if (this.autoStatusTimer) clearInterval(this.autoStatusTimer);
    // Poll apenas se página visível ao carregar, senão espera visibilitychange
    if (document.visibilityState === 'visible') {
      this.queueSilentRefresh();
    }
    this.autoStatusTimer = setInterval(()=>{
      if (document.visibilityState !== 'visible') return; // não atualiza em background (economia)
      this.queueSilentRefresh();
    }, this.AUTO_INTERVAL_MS);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Faz refresh imediato ao voltar
      this.queueSilentRefresh(true);
    }
  };

  private queueSilentRefresh(force = false){
    const now = Date.now();
    if (!force && now - this.lastSilentRefresh < 4000) return; // guarda-chuva contra tempestade de chamadas
    this.lastSilentRefresh = now;
    this.silentRefreshStatuses();
  }

  private silentRefreshStatuses(){
    // Usa o mesmo endpoint, mas evita refazer layout / avatares se possível
    if (this.loading) return; // não competir com carregamento principal
    const wasLoading = this.loading;
    // Monta params iguais ao load() para consistência
    if (this.role === 'ADMIN') {
      const params: any = { page: this.page, size: this.size, year: this.year,
        fName: this.filters.fName, fPhone: this.filters.fPhone, fEmail: this.filters.fEmail, fCpf: this.filters.fCpf,
        statusIn: this.filters.statusIn, statusOut: this.filters.statusOut };
      if (this.q) params.q = this.q;
      if (this.adminDisciplineId) params.disciplineId = this.adminDisciplineId;
      this.http.get<any>('/api/admin/students', { params }).subscribe({
        next: res => this.mergeInService(res?.items || []),
        error: _ => {}
      });
    } else { // PRECEPTOR silent refresh
  const discId = this.preceptorDisciplineId ? this.preceptorDisciplineId : undefined;
  this.svc.students(this.year, this.page, this.size, this.q || undefined, this.filters, discId).subscribe({
        next: res => this.mergeInService(res?.items || []),
        error: _ => {}
      });
    }
  }

  private mergeInService(fresh: any[]){
    if (!Array.isArray(fresh) || !fresh.length) return;
    const map = new Map<number, any>();
    fresh.forEach(i=> { if (i?.id != null) map.set(i.id, i); });
    let changed = false;
    this.items.forEach(local => {
      const newer = map.get(local.id);
      if (newer && typeof newer.inService === 'boolean' && newer.inService !== local.inService){
        local.inService = newer.inService;
        changed = true;
      }
    });
    if (changed) {
      // dispara detecção de mudanças (caso OnPush no futuro)
      try { /* noop - Angular default change detection já pega. */ } catch {}
    }
  }

  // ======== Helpers de template =========
  trackById(_idx: number, item: any){ return item?.id ?? _idx; }

  private updateStatusTotals(){
    // Realiza duas chamadas leves (size=1) para obter totalItems com cada status isolado respeitando filtros de busca/ano/disciplina.
    const baseParams: any = { page: 0, size: 1, year: this.year };
    if (this.q) baseParams.q = this.q;
    if (this.role === 'ADMIN' && this.adminDisciplineId) baseParams.disciplineId = this.adminDisciplineId;
    // Clona filtros de campos para manter coerência de pesquisa textual; status será sobrescrito por cenário.
    const fieldFilters = { fName: this.filters.fName, fPhone: this.filters.fPhone, fEmail: this.filters.fEmail, fCpf: this.filters.fCpf };
    this.statusTotalsLoading = true;

    if (this.role === 'ADMIN') {
      const inParams = { ...baseParams, ...fieldFilters, statusIn: true, statusOut: false };
      const outParams = { ...baseParams, ...fieldFilters, statusIn: false, statusOut: true };
      // Em serviço
      this.http.get<any>('/api/admin/students', { params: inParams }).subscribe({
        next: res => { this.totalInService = res?.totalItems ?? 0; },
        error: _ => { this.totalInService = 0; }
      });
      // Fora de serviço
      this.http.get<any>('/api/admin/students', { params: outParams }).subscribe({
        next: res => { this.totalOffService = res?.totalItems ?? 0; this.statusTotalsLoading = false; },
        error: _ => { this.totalOffService = 0; this.statusTotalsLoading = false; }
      });
    } else { // PRECEPTOR status totals
      const inFilters = { ...fieldFilters, statusIn: true, statusOut: false };
      const outFilters = { ...fieldFilters, statusIn: false, statusOut: true };
  const discId = this.preceptorDisciplineId ? this.preceptorDisciplineId : undefined;
  this.svc.students(this.year, 0, 1, this.q || undefined, inFilters as any, discId).subscribe({
        next: res => { this.totalInService = res?.totalItems ?? 0; },
        error: _ => { this.totalInService = 0; }
      });
  this.svc.students(this.year, 0, 1, this.q || undefined, outFilters as any, discId).subscribe({
        next: res => { this.totalOffService = res?.totalItems ?? 0; this.statusTotalsLoading = false; },
        error: _ => { this.totalOffService = 0; this.statusTotalsLoading = false; }
      });
    }
  }
}
