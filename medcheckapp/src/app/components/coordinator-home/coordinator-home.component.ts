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
  <div class="preceptor-home d-flex flex-column" style="min-height:100%;">
    <!-- Toolbar simplificada: busca + filtros -->
    <div class="topbar container-fluid py-3">
      <div class="d-flex flex-wrap align-items-center gap-2 w-100">
        <!-- REMOVIDO seletor de preceptor -->
        <div class="input-group search-group" *ngIf="disciplineId">
          <span class="input-group-text bg-white border-0"><i class="bi bi-search text-muted"></i></span>
          <input [(ngModel)]="q" (input)="onSearchTyping()" (keyup.enter)="reloadFirstPage()" class="form-control border-0 shadow-none" placeholder="Buscar..." />
        </div>
        <div class="ms-auto d-flex align-items-center gap-2 flex-wrap position-relative" *ngIf="disciplineId">
          <div class="d-flex align-items-center gap-2">
            <label class="text-muted small">Ano</label>
            <select class="form-select form-select-sm year-select" [(ngModel)]="year" (change)="yearChanged()">
              <option value="all">Todos</option>
              <option *ngFor="let y of years" [ngValue]="y">{{y}}</option>
            </select>
          </div>
          <div class="dropdown" [class.show]="filtersOpen">
            <button class="btn btn-light border shadow-sm small dropdown-toggle" type="button" (click)="toggleFilters()">Filtros</button>
            <div class="dropdown-menu p-3" [class.show]="filtersOpen">
              <div class="mb-2 fw-semibold small text-uppercase text-muted">Campos</div>
              <div class="form-check small">
                <input class="form-check-input" type="checkbox" id="fName" [(ngModel)]="filters.fName" (change)="reloadFirstPage()">
                <label class="form-check-label" for="fName">Nome</label>
              </div>
              <div class="form-check small">
                <input class="form-check-input" type="checkbox" id="fPhone" [(ngModel)]="filters.fPhone" (change)="reloadFirstPage()">
                <label class="form-check-label" for="fPhone">Telefone</label>
              </div>
              <div class="form-check small">
                <input class="form-check-input" type="checkbox" id="fEmail" [(ngModel)]="filters.fEmail" (change)="reloadFirstPage()">
                <label class="form-check-label" for="fEmail">Email</label>
              </div>
              <div class="form-check small mb-2">
                <input class="form-check-input" type="checkbox" id="fCpf" [(ngModel)]="filters.fCpf" (change)="reloadFirstPage()">
                <label class="form-check-label" for="fCpf">CPF</label>
              </div>
              <div class="mb-2 fw-semibold small text-uppercase text-muted">Status</div>
              <div class="form-check small">
                <input class="form-check-input" type="checkbox" id="statusIn" [(ngModel)]="filters.statusIn" (change)="reloadFirstPage()">
                <label class="form-check-label" for="statusIn">Em Serviço</label>
              </div>
              <div class="form-check small">
                <input class="form-check-input" type="checkbox" id="statusOut" [(ngModel)]="filters.statusOut" (change)="reloadFirstPage()">
                <label class="form-check-label" for="statusOut">Fora de Serviço</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Grid de cards -->
    <div class="container pb-4" *ngIf="disciplineId; else carregandoDisciplinaAuto">
      <ng-container *ngIf="items.length; else noStudentsBlock">
        <div class="row g-4">
          <div class="col-12 col-lg-6" *ngFor="let a of items">
            <div class="student-card card border-0 shadow-sm p-3 h-100" [class.selected]="isSelecionado(a)">
              <div class="row g-3 align-items-center">
                <div class="col-auto">
                  <div aria-label="Avatar" class="rounded-circle bg-secondary-subtle user-avatar d-flex align-items-center justify-content-center overflow-hidden">
                    <img *ngIf="!a._noPhoto" [src]="a._avatarUrl" (error)="onImgError(a, $event)" alt="Avatar" class="w-100 h-100 object-fit-cover" />
                    <i *ngIf="a._noPhoto" class="bi bi-person text-muted"></i>
                  </div>
                </div>
                <div class="col">
                  <div class="fw-semibold text-truncate d-flex align-items-center gap-2">
                    <span>{{ a.name }}</span>
                    <!-- badge de horas removido conforme solicitação -->
                  </div>
                  <div class="d-flex flex-column small text-muted mt-1">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <i class="bi bi-telephone"></i>
                      <span class="text-truncate">{{ formatPhone(a.phone) }}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <i class="bi bi-envelope"></i>
                      <span class="text-truncate">{{ a.email }}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <i class="bi bi-credit-card-2-front"></i>
                      <span class="text-truncate">{{ formatCpf(a.cpf) }}</span>
                    </div>
                    <div class="d-flex flex-wrap gap-1 mt-1" *ngIf="a.preceptores?.length">
                      <span *ngFor="let pn of a.preceptores" class="badge rounded-pill text-bg-light border small fw-normal">{{pn}}</span>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-sm-auto ms-sm-auto d-flex flex-column gap-2 align-items-stretch">
                  <span class="status badge px-3 py-2 w-100 w-sm-auto d-inline-block text-center" [class.in-service]="a.inService" [class.off-service]="!a.inService">
                    {{ a.inService ? 'Em Serviço' : 'Fora de Serviço' }}
                  </span>
                  <button class="btn btn-outline-primary btn-sm w-100" type="button"
                          (click)="$event.stopPropagation(); visualizar(a)"
                          [class.active]="isSelecionado(a)">
                    {{ isSelecionado(a) ? 'Selecionado' : 'Visualizar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Paginação -->
        <div class="d-flex align-items-center mt-3">
          <div class="mx-auto d-flex align-items-center gap-2" *ngIf="totalPages > 1">
            <button class="btn btn-link text-dark" [disabled]="page===0" (click)="go(page-1)"><i class="bi bi-chevron-left"></i></button>
            <span class="small">{{page+1}}/{{totalPages}}</span>
            <button class="btn btn-link text-dark" [disabled]="page>=totalPages-1" (click)="go(page+1)"><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      </ng-container>
      <ng-template #noStudentsBlock>
        <div class="py-5 text-center text-muted" *ngIf="!loading">
          <p class="mb-3">Nenhum aluno encontrado para os filtros / período.</p>
          <div *ngIf="disciplinaPreceptores.length" class="mb-4">
            <p class="small mb-2">Filtrar por preceptor:</p>
            <div class="d-flex flex-wrap gap-2 justify-content-center">
              <button type="button" class="btn btn-outline-primary btn-sm" *ngFor="let p of disciplinaPreceptores" (click)="selectPreceptor(p)">{{p.name}}</button>
            </div>
          </div>
          <div *ngIf="!disciplinaPreceptores.length" class="small">Nenhum preceptor vinculado.</div>
        </div>
      </ng-template>
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
    .preceptor-home{background:#cfe1ff;}
    .topbar .search-group{min-width: 260px; max-width: 540px; background:#fff;border-radius:8px; border:1px solid #e9ecef;}
    .topbar .search-group .form-control{height:40px;}
    .year-select{width: 120px;}
    .student-card{border-radius:14px; background:#f8f9fc; transition:box-shadow .12s ease, border-color .12s ease;}
    .student-card.selected{border:2px solid #0d6efd !important; box-shadow:0 0 0 .25rem rgba(13,110,253,.25)!important;}
    .btn-outline-primary.active{background:#0d6efd; color:#fff;}
    .user-avatar{width:64px;height:64px;}
    .user-avatar i{font-size:2rem;}
    .status{border-radius:16px;}
    .status.in-service{background:#4b2ca3; color:#fff;}
    .status.off-service{background:#ced4da; color:#495057;}
    .dropdown-menu{min-width: 240px;}
    @media (max-width: 576px){
      .topbar .search-group{flex:1 1 auto;}
      .year-select{width:auto;}
      .status{width:100%;}
    }
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
  disciplinaPreceptores: any[] = [];
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
            this.loadDisciplinaPreceptores(); // carrega preceptores já na seleção automática
            this.reloadFirstPage();
          }
          this.registerRealtime();
        }
      },
      error: _ => { this.toast.show('error','Erro ao carregar disciplinas'); }
    });
  }

  onDisciplineChange(){ this.page = 0; this.loadDisciplinaPreceptores(); this.reloadFirstPage(); this.alunoCtx.clear(); }

  loadDisciplinaPreceptores(){
    if(!this.disciplineId) { this.disciplinaPreceptores = []; return; }
    this.coord.listDisciplinePreceptors(this.disciplineId).subscribe({
      next: list => { this.disciplinaPreceptores = Array.isArray(list)?list:[]; },
      error: _ => { this.disciplinaPreceptores = []; }
    });
  }

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
  selectPreceptor(p:any){
    if(!p) return; this.filters.preceptorId = p.id; this.reloadFirstPage();
  }
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
}
