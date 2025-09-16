import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreceptorService } from '../../services/preceptor.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';

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
          <div class="student-card card border-0 shadow-sm p-3 h-100 clickable" (click)="openCalendar(a)">
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
                <button class="btn btn-success btn-sm w-100 w-sm-auto" type="button" (click)="$event.stopPropagation(); avaliar(a)">Avaliar</button>
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
  </div>
  `,
  styles: [`
    :host{display:block;}
    .preceptor-home{background:#cfe1ff;} /* azul suave do mock */
    .topbar .search-group{min-width: 260px; max-width: 540px; background:#fff;border-radius:8px; border:1px solid #e9ecef;}
    .topbar .search-group .form-control{height:40px;}
    .year-select{width: 120px;}
  .student-card{border-radius:14px; background:#f8f9fc;}
  .student-card.clickable{cursor:pointer; transition:transform .06s ease, box-shadow .1s ease;}
  .student-card.clickable:hover{transform: translateY(-1px); box-shadow: 0 .5rem 1rem rgba(0,0,0,.12)!important;}
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

  constructor(private svc: PreceptorService, private http: HttpClient, private auth: AuthService, private toast: ToastService, private router: Router) {}

  ngOnInit(): void { this.load(); }

  load() {
    if (this.loading) return;
    this.loading = true;
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
  }

  avaliar(a: any){
    const nome = a?.name || 'Interno';
    this.toast.show('info', `Avaliação de ${nome} em breve.`);
  }

  openCalendar(a: any){
    if (!a?.id) return;
    this.router.navigate(['/calendario'], { queryParams: { alunoId: a.id } });
  }
}
