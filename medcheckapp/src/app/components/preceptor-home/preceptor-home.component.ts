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
  <div class="preceptor-home d-flex flex-column" style="min-height:100%;">
    <!-- Toolbar: search + filters -->
    <div class="topbar container-fluid py-3">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <div class="input-group search-group">
          <span class="input-group-text bg-white border-0"><i class="bi bi-search text-muted"></i></span>
          <input [(ngModel)]="q" (input)="onSearchTyping()" (keyup.enter)="reloadFirstPage()" class="form-control border-0 shadow-none" placeholder="Buscar..." />
        </div>
        <div class="ms-auto d-flex align-items-center gap-2 flex-wrap position-relative">
          <!-- ADMIN: seletor de disciplina (Todos) -->
          <div *ngIf="role==='ADMIN'" class="d-flex align-items-center gap-2">
            <label class="text-muted small">Disciplina</label>
            <select class="form-select form-select-sm" style="min-width:180px" [(ngModel)]="adminDisciplineId" (change)="reloadFirstPage()">
              <option value="">Todos</option>
              <option *ngFor="let d of adminDisciplines" [ngValue]="d.id">{{d.code}} - {{d.name}}</option>
            </select>
          </div>
          <div class="d-flex align-items-center gap-2">
            <label class="text-muted small">Ano</label>
            <select class="form-select form-select-sm year-select" [(ngModel)]="year" (change)="reloadFirstPage()">
              <option *ngFor="let y of years" [ngValue]="y">{{y}}</option>
            </select>
          </div>
          <div class="dropdown" [class.show]="filtersOpen">
            <button class="btn btn-light border shadow-sm small dropdown-toggle" type="button" (click)="toggleFilters()">
              Filtros
            </button>
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
    <div class="container pb-4">
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
                <div class="fw-semibold text-truncate">{{ a.name }}</div>
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
                    <span>{{ formatCpf(a.cpf) }}</span>
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
                <!-- ADMIN: ver código do PRECEPTOR (quando o item for um preceptor) -->
                <button *ngIf="role==='ADMIN' && a.role==='PRECEPTOR'" class="btn btn-secondary btn-sm w-100" type="button"
                        (click)="$event.stopPropagation(); openPreceptorCode(a)">
                  Código / Disciplinas
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Paginação + CTA -->
      <div class="d-flex align-items-center mt-3">
        <div class="mx-auto d-flex align-items-center gap-2" *ngIf="totalPages > 1">
          <button class="btn btn-link text-dark" [disabled]="page===0" (click)="go(page-1)"><i class="bi bi-chevron-left"></i></button>
          <span class="small">{{page+1}}/{{totalPages}}</span>
          <button class="btn btn-link text-dark" [disabled]="page>=totalPages-1" (click)="go(page+1)"><i class="bi bi-chevron-right"></i></button>
        </div>
        <div class="ms-auto">
          <button class="btn btn-primary-subtle btn-cta">Gerenciar Internos</button>
        </div>
      </div>
    </div>
    <!-- Modal simples para exibir código e disciplinas de um preceptor (ADMIN) -->
    <div class="modal-backdrop fade show" *ngIf="showCodeModal" (click)="closeCodeModal()"></div>
    <div class="code-modal card shadow-lg" *ngIf="showCodeModal">
      <div class="card-header d-flex align-items-center justify-content-between py-2">
        <h6 class="mb-0">Preceptor: {{ modalPreceptor?.name }}</h6>
        <button type="button" class="btn-close btn-sm" (click)="closeCodeModal()"></button>
      </div>
      <div class="card-body small">
        <div class="mb-3">
          <div class="text-muted">Código ativo (read-only)</div>
          <div class="display-6 fw-bold" *ngIf="modalCode?.code; else noCode">{{ modalCode.code }}</div>
          <ng-template #noCode>
            <div class="text-muted fst-italic">Nenhum código válido agora</div>
          </ng-template>
          <div class="mt-1" *ngIf="modalCode?.code">
            <span class="badge bg-dark-subtle text-dark" *ngIf="modalCode?.secondsRemaining>0">Expira em {{ modalCode.secondsRemaining }}s</span>
            <span class="badge bg-danger-subtle text-danger" *ngIf="modalCode?.secondsRemaining===0">Expirado</span>
          </div>
        </div>
        <div>
          <div class="text-muted mb-1">Disciplinas vinculadas</div>
          <ul class="list-unstyled mb-0 max-h-150 overflow-auto small">
            <li *ngFor="let d of modalDisciplines">• {{ d.code }} - {{ d.name }}</li>
            <li *ngIf="modalDisciplines.length===0" class="fst-italic text-muted">Nenhuma disciplina vinculada</li>
          </ul>
        </div>
      </div>
      <div class="card-footer d-flex justify-content-between align-items-center py-2">
        <small class="text-muted">Atualiza automaticamente</small>
        <button class="btn btn-outline-secondary btn-sm" (click)="manualRefreshCode()" [disabled]="refreshing">{{ refreshing? '...' : 'Atualizar agora' }}</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    :host{display:block;}
    .preceptor-home{background:#cfe1ff;} /* azul suave do mock */
    .topbar .search-group{min-width: 260px; max-width: 540px; background:#fff;border-radius:8px; border:1px solid #e9ecef;}
    .topbar .search-group .form-control{height:40px;}
    .year-select{width: 120px;}
  .student-card{border-radius:14px; background:#f8f9fc; transition:box-shadow .12s ease, border-color .12s ease;}
  .student-card.selected{border:2px solid #0d6efd !important; box-shadow:0 0 0 .25rem rgba(13,110,253,.25)!important;}
  .btn-outline-primary.active{background:#0d6efd; color:#fff;}
  .user-avatar{width:64px;height:64px;}
  .user-avatar i{font-size:2rem;}
    .status{border-radius:16px;}
    .status.in-service{background:#4b2ca3; color:#fff;} /* roxo do mock */
    .status.off-service{background:#ced4da; color:#495057;}
    .btn-cta{background:#0d6efd1a; color:#0d6efd; border:1px solid #0d6efd3d;}
    .dropdown-menu{min-width: 240px;}
    @media (max-width: 576px){
      .topbar .search-group{flex:1 1 auto;}
      .year-select{width:auto;}
      .status{width:100%;}
    }
    .code-modal{position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:420px; max-width:94vw; z-index:1056; border-radius:14px;}
    .modal-backdrop{z-index:1055; background:rgba(33,37,41,.55);}
    .max-h-150{max-height:150px;}
  `]
})
export class PreceptorHomeComponent implements OnInit, OnDestroy {
  items: any[] = [];
  page = 0;
  size = 8;
  totalPages = 0;
  totalItems = 0;
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

  // Modal state for ADMIN viewing preceptor code
  showCodeModal = false;
  modalPreceptor: any = null;
  modalCode: any = null;
  modalDisciplines: any[] = [];
  private modalTimer?: any;
  refreshing = false;

  ngOnInit(): void {
    this.role = this.auth.getRole();
    if (this.role === 'ADMIN') {
      this.fetchAdminDisciplines();
    }
    this.load();
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
        },
        error: _ => { this.items = []; this.totalPages = 0; this.totalItems = 0; this.loading = false; }
      });
    } else {
      this.svc.students(this.year, this.page, this.size, this.q || undefined, this.filters).subscribe({
        next: res => {
          this.items = res?.items || [];
          this.totalPages = res?.totalPages || 0;
          this.totalItems = res?.totalItems || 0;
          this.page = res?.page || 0;
          this.size = res?.size || this.size;
          this.loading = false;
          this.loadAvatars();
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
}
