import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoordinatorService } from '../../services/coordinator.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { PreceptorAlunoContextService } from '../../services/preceptor-aluno-context.service';

@Component({
  selector: 'app-coordinator-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="coord-home-wrapper">
    <div class="ch-head container-fluid">
      <div class="toolbar glass-bar">
        <div class="search-box" *ngIf="disciplineId">
          <i class="bi bi-search"></i>
          <input [(ngModel)]="q" (input)="onSearchTyping()" (keyup.enter)="reloadFirstPage()" placeholder="Buscar aluno (nome, email, CPF)" aria-label="Buscar aluno" />
          <button *ngIf="q" class="clear-btn" (click)="q=''; reloadFirstPage()" aria-label="Limpar busca"><i class="bi bi-x"></i></button>
        </div>
        <div class="filters-group" *ngIf="disciplineId">
          <div class="select-inline">
            <label class="mini-label">Disciplina</label>
            <select [(ngModel)]="disciplineId" (change)="onDisciplineChange()" aria-label="Selecionar disciplina">
              <option *ngFor="let d of disciplines" [ngValue]="d.id">{{d.code || d.id}}</option>
            </select>
          </div>
          <div class="select-inline">
            <label class="mini-label">Ano</label>
            <select [(ngModel)]="year" (change)="yearChanged()" aria-label="Selecionar ano">
              <option value="all">Todos</option>
              <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
            </select>
          </div>
          <div class="dropdown-filters" [class.open]="filtersOpen" *ngIf="disciplineId">
            <button class="btn-filters" type="button" (click)="toggleFilters()" [attr.aria-expanded]="filtersOpen" aria-haspopup="true" aria-label="Alternar painel de filtros">
              <i class="bi bi-sliders"></i> Filtros
            </button>
            <div class="panel" *ngIf="filtersOpen" role="menu">
              <div class="section-title">Campos</div>
              <div class="check-line"><input type="checkbox" id="cf_name" [(ngModel)]="filters.fName" (change)="reloadFirstPage()" /><label for="cf_name">Nome</label></div>
              <div class="check-line"><input type="checkbox" id="cf_phone" [(ngModel)]="filters.fPhone" (change)="reloadFirstPage()" /><label for="cf_phone">Telefone</label></div>
              <div class="check-line"><input type="checkbox" id="cf_email" [(ngModel)]="filters.fEmail" (change)="reloadFirstPage()" /><label for="cf_email">Email</label></div>
              <div class="check-line"><input type="checkbox" id="cf_cpf" [(ngModel)]="filters.fCpf" (change)="reloadFirstPage()" /><label for="cf_cpf">CPF</label></div>
              <div class="section-title mt-2">Status</div>
              <div class="check-line"><input type="checkbox" id="cf_in" [(ngModel)]="filters.statusIn" (change)="reloadFirstPage()" /><label for="cf_in">Em Serviço</label></div>
              <div class="check-line"><input type="checkbox" id="cf_out" [(ngModel)]="filters.statusOut" (change)="reloadFirstPage()" /><label for="cf_out">Fora de Serviço</label></div>
            </div>
          </div>
        </div>
      </div>
      <div class="metrics-row" *ngIf="!loading && items.length">
        <div class="metric-card">
          <div class="icon-wrap"><i class="bi bi-people"></i></div>
          <div class="text-zone"><div class="label">Total Alunos</div><div class="value">{{ totalItems }}</div></div>
        </div>
        <div class="metric-card">
          <div class="icon-wrap in"><i class="bi bi-person-check"></i></div>
          <div class="text-zone"><div class="label">Em Serviço</div><div class="value">{{ inServiceCount() }}</div></div>
        </div>
        <div class="metric-card">
          <div class="icon-wrap off"><i class="bi bi-person-dash"></i></div>
          <div class="text-zone"><div class="label">Fora Serviço</div><div class="value">{{ offServiceCount() }}</div></div>
        </div>
        <!-- Card de preceptores removido conforme solicitação -->
      </div>
    </div>

    <div class="list-container container" [class.loading]="loading" *ngIf="disciplineId; else carregandoDisciplinaAuto">
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner-border text-primary"></div>
        <div class="small text-muted mt-2">Carregando...</div>
      </div>
      <div class="row g-4" *ngIf="items.length; else emptyState">
        <div class="col-12 col-md-6 col-xl-4" *ngFor="let a of items">
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
                <div class="tags d-flex flex-wrap gap-1 mt-2" *ngIf="a.preceptores?.length">
                  <span *ngFor="let pn of a.preceptores" class="badge rounded-pill text-bg-light border small fw-normal">{{pn}}</span>
                </div>
              </div>
            </div>
            <div class="sc-actions d-flex flex-wrap gap-2 mt-3">
              <button class="btn btn-sm btn-outline-primary flex-grow-1" type="button" (click)="$event.stopPropagation(); visualizar(a)" [class.active]="isSelecionado(a)" [attr.aria-pressed]="isSelecionado(a)">
                <i class="bi" [ngClass]="{'bi-eye': !isSelecionado(a), 'bi-check2-circle': isSelecionado(a)}"></i>
                {{ isSelecionado(a) ? 'Selecionado' : 'Visualizar' }}
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
    <ng-template #carregandoDisciplinaAuto>
      <div class="container py-5 text-center text-muted">
        <p class="mb-0">Carregando...</p>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    :host{display:block;}
    .coord-home-wrapper{min-height:100%; padding:1.2rem 0 3rem; background:linear-gradient(145deg,#e8f2ff,#dbe9ff 45%,#d4e2ff);} 
    .ch-head{margin-bottom:.75rem;}
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
    @keyframes fadeSlide{from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:translateY(0);} }
    @media (max-width: 991.98px){ .sc-head .avatar{width:54px; height:54px;} .metric-card .value{font-size:1.1rem;} }
    @media (max-width: 767.98px){ .filters-group{width:100%; justify-content:flex-start;} .metrics-row{grid-template-columns:repeat(auto-fit, minmax(140px,1fr));} }
    @media (max-width: 575.98px){ .glass-bar{padding:.75rem .8rem;} .search-box{flex:1 1 100%;} .select-inline select{min-width:100px;} .student-card{padding:.85rem .8rem .75rem;} .info-lines .line{font-size:.65rem;} .sc-actions .btn{font-size:.58rem;} .metric-card{padding:.65rem .7rem;} }
  `]
})
export class CoordinatorHomeComponent implements OnInit, OnDestroy {
  disciplines: any[] = [];
  disciplineId?: number;
  items: any[] = [];
  page = 0; size = 8; totalPages = 0; totalItems = 0;
  year: string | number = new Date().getFullYear();
  years = [new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2];
  q = '';
  loading = false;
  filtersOpen = false;
  filters: any = { fName: true, fPhone: true, fEmail: true, fCpf: true, statusIn: true, statusOut: true, preceptorId: undefined, sort: 'lastCheckIn,desc' };
  private searchDebounce?: any;
  private avatarObjectUrls: string[] = [];
  /* ===== AUTO POLLING (multi-dispositivo) ===== */
  private autoStatusTimer?: any;
  private AUTO_INTERVAL_MS = 12000; // mesmo intervalo usado em preceptor-home
  private lastSilentRefresh = 0;
  private autoLoopStarted = false;

  constructor(private coord: CoordinatorService, private http: HttpClient, private auth: AuthService, private toast: ToastService, private alunoCtx: PreceptorAlunoContextService) {}

  ngOnInit(){ this.loadDisciplines(); }
  // Flag para saber se já houve interação manual de mudança de ano
  private userChangedYear = false;

  ngOnDestroy(){
    this.avatarObjectUrls.forEach(u=>{try{URL.revokeObjectURL(u);}catch{}});
    this.avatarObjectUrls = [];
    this.unregisterRealtime();
    if (this.autoStatusTimer) { clearInterval(this.autoStatusTimer); this.autoStatusTimer = undefined; }
    try { document.removeEventListener('visibilitychange', this.onVisibilityChange); } catch {}
  }
  private registerRealtime(){
    try { window.addEventListener('mc:service-status-updated', this.onServiceStatusEvent as any); } catch {}
    try { window.addEventListener('storage', this.onStorage as any); } catch {}
    try { document.addEventListener('visibilitychange', this.onVisibilityChange); } catch {}
  }
  private unregisterRealtime(){
    try { window.removeEventListener('mc:service-status-updated', this.onServiceStatusEvent as any); } catch {}
    try { window.removeEventListener('storage', this.onStorage as any); } catch {}
  }

  private authHeaders(): HttpHeaders | undefined { const token = this.auth.getToken?.(); return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined as any; }

  loadDisciplines(){
    this.coord.listDisciplines().subscribe({
      next: (list: any) => {
        this.disciplines = Array.isArray(list)? list : (list.items || list);
        if (this.disciplines.length){
          if (!this.disciplineId){
            this.disciplineId = this.disciplines[0].id;
            this.reloadFirstPage();
          }
          this.registerRealtime();
        }
      },
      error: _ => { this.toast.show('error','Erro ao carregar disciplinas'); }
    });
  }

  onDisciplineChange(){ this.page = 0; this.reloadFirstPage(); this.alunoCtx.clear(); }

  load(){
    if (!this.disciplineId || this.loading) return; this.loading = true;
    // Só envia ano se o usuário trocou manualmente ou se selecionou 'all'
    const sendYear = this.userChangedYear || this.year === 'all';
    const yValue = sendYear ? (this.year === 'all' ? 'all' : this.year) : undefined;
    this.coord.studentsByDiscipline(this.disciplineId, yValue as any, this.page, this.size, this.q || undefined, this.filters).subscribe({
      next: res => {
        this.items = res?.items || [];
        this.totalPages = res?.totalPages || 0;
        this.totalItems = res?.totalItems || 0;
        this.page = res?.page || 0;
        this.size = res?.size || this.size;
        this.loading = false;
        this.loadAvatars();
        // inicia loop após primeiro carregamento bem-sucedido
        if (!this.autoLoopStarted) { this.startAutoRefreshLoop(); this.autoLoopStarted = true; }
      },
      error: _ => { this.items = []; this.totalPages = 0; this.totalItems = 0; this.loading = false; }
    });
  }

  private loadAvatars(){
    this.avatarObjectUrls.forEach(u=>{ try { URL.revokeObjectURL(u); } catch {} });
    this.avatarObjectUrls = [];
    this.items.forEach(a => {
      a._noPhoto = true; a._avatarUrl=''; if (!a?.id) return; const ts = Date.now();
      this.http.get(`/api/users/${a.id}/photo?t=${ts}`, { headers: this.authHeaders(), responseType: 'blob' }).subscribe({
        next: blob => {
          if (!blob || (blob as any).size === 0){ a._noPhoto = true; return; }
          const url = URL.createObjectURL(blob); a._avatarUrl = url; a._noPhoto = false; this.avatarObjectUrls.push(url);
        },
        error: _ => { a._noPhoto = true; }
      });
    });
  }

  reloadFirstPage(){ this.page = 0; this.load(); }
  // interceptar mudança de ano
  yearChanged(){ this.userChangedYear = true; this.reloadFirstPage(); }
  go(p:number){ this.page = Math.max(0, Math.min(p, this.totalPages-1)); this.load(); }
  toggleFilters(){ this.filtersOpen = !this.filtersOpen; }
  onSearchTyping(){ if (this.searchDebounce) clearTimeout(this.searchDebounce); this.searchDebounce = setTimeout(()=> this.reloadFirstPage(), 400); }

  visualizar(a:any){ if (!a?.id) return; if (this.isSelecionado(a)) { this.alunoCtx.clear(); return; } const displayName = a.name || a.nome || a.fullName || a.email || 'Aluno'; this.alunoCtx.setAluno(a.id, displayName); }
  isSelecionado(a:any){ const current = this.alunoCtx.getAluno(); return !!current.id && current.id === a.id; }
  onImgError(a:any,_ev:Event){ if (a) a._noPhoto = true; }
  formatCpf(v: string | null | undefined): string { if (!v) return ''; const digits = String(v).replace(/\D/g,'').slice(0,11); if (digits.length !==11) return String(v); return digits.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2'); }
  formatPhone(v: string | null | undefined): string { if (!v) return '(00) 00000-0000'; const d = String(v).replace(/\D/g,'').slice(0,11); if (d.length <=10) return d.replace(/^(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d{4})$/,'$1-$2'); return d.replace(/^(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{4})$/,'$1-$2'); }
  formatDateTime(dt: string | Date | null | undefined): string { if(!dt) return ''; const d = new Date(dt); if(isNaN(d.getTime())) return ''; return d.toLocaleString('pt-BR',{dateStyle:'short', timeStyle:'short'}); }
  /* ===================== REAL-TIME STATUS LISTENERS ===================== */
  private onServiceStatusEvent = (_e:any) => {
    if (this.loading) return; // debounce
    if (this.autoLoopStarted) { this.queueSilentRefresh(true); } else { this.reloadFirstPage(); }
  };
  private onStorage = (ev: StorageEvent) => {
    if (ev.key === 'mc:last-service-status') {
      if (this.loading) return;
      if (this.autoLoopStarted) { this.queueSilentRefresh(true); } else { this.reloadFirstPage(); }
    }
  };

  /* ===================== AUTO POLLING (multi-dispositivo) ===================== */
  private startAutoRefreshLoop(){
    if (this.autoStatusTimer) clearInterval(this.autoStatusTimer);
    if (document.visibilityState === 'visible') {
      this.queueSilentRefresh();
    }
    this.autoStatusTimer = setInterval(()=>{
      if (document.visibilityState !== 'visible') return;
      this.queueSilentRefresh();
    }, this.AUTO_INTERVAL_MS);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.queueSilentRefresh(true);
    }
  };

  private queueSilentRefresh(force=false){
    const now = Date.now();
    if (!force && now - this.lastSilentRefresh < 4000) return; // proteção contra tempestade
    this.lastSilentRefresh = now;
    this.silentRefreshStatuses();
  }

  private silentRefreshStatuses(){
    if (!this.disciplineId) return;
    if (this.loading) return; // não competir com carregamento completo
    const sendYear = this.userChangedYear || this.year === 'all';
    const yValue = sendYear ? (this.year === 'all' ? 'all' : this.year) : undefined;
    this.coord.studentsByDiscipline(this.disciplineId, yValue as any, this.page, this.size, this.q || undefined, this.filters).subscribe({
      next: res => this.mergeInService(res?.items || []),
      error: _ => {}
    });
  }

  private mergeInService(fresh:any[]){
    if (!Array.isArray(fresh) || !fresh.length) return;
    const map = new Map<number, any>();
    fresh.forEach(i=>{ if (i?.id != null) map.set(i.id, i); });
    let changed = false;
    this.items.forEach(local => {
      const newer = map.get(local.id);
      if (newer && typeof newer.inService === 'boolean' && newer.inService !== local.inService){
        local.inService = newer.inService;
        changed = true;
      }
    });
    if (changed) { try { /* Angular default CD detecta */ } catch {} }
  }

  /* ===== Derived counts for metrics (sem endpoints globais ainda) ===== */
  inServiceCount(){ return this.items.filter(i=> i.inService).length; }
  offServiceCount(){ return this.items.filter(i=> !i.inService).length; }
}
