import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoordinatorService } from '../../services/coordinator.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-coordinator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="coord-wrapper py-3 py-md-4">
    <div class="coord-shell container">
      <div class="head d-flex flex-wrap align-items-center justify-content-between mb-3 gap-3">
        <div>
          <h2 class="page-title m-0 d-flex align-items-center gap-2"><i class="bi bi-diagram-3"></i> Vínculo de Preceptores</h2>
          <div class="subtitle text-muted small mt-1">Gerencie quais preceptores estão associados a cada disciplina.</div>
        </div>
        <div class="disc-select select-inline">
          <label class="mini-label">Disciplina</label>
          <select class="form-select form-select-sm" [(ngModel)]="selecionadaId" (ngModelChange)="onSelectDisciplina()" aria-label="Selecionar disciplina">
            <option *ngFor="let d of disciplinas" [ngValue]="d.id">{{ d.code }} - {{ d.name }}</option>
          </select>
        </div>
      </div>

      <div *ngIf="carregando" class="loading-overlay glass-pane text-center py-5">
        <div class="spinner-border text-primary"></div>
        <div class="small text-muted mt-2">Carregando...</div>
      </div>

      <div class="row g-4" [class.dimmed]="carregando">
        <div class="col-md-6">
          <div class="glass-card h-100 d-flex flex-column">
            <div class="card-head d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-person-plus"></i>
              <h5 class="m-0 section-title">Preceptores Disponíveis</h5>
            </div>
            <ul class="list reset flex-grow-1 overflow-auto">
              <li *ngFor="let p of preceptores" class="item d-flex align-items-start justify-content-between gap-2">
                <div class="info min-w-0">
                  <div class="name text-truncate fw-semibold">{{ p.name }}</div>
                  <div class="meta small text-muted text-truncate">CPF: {{ p.cpf }} • {{ p.email }}</div>
                </div>
                <div class="actions">
                  <button class="btn btn-sm btn-outline-primary" [disabled]="jaVinculado(p)" (click)="vincular(p)" [attr.aria-disabled]="jaVinculado(p)">
                    <i class="bi" [ngClass]="{'bi-link-45deg': !jaVinculado(p), 'bi-check2': jaVinculado(p)}"></i>
                    {{ jaVinculado(p) ? 'Vinculado' : 'Vincular' }}
                  </button>
                </div>
              </li>
              <li *ngIf="!preceptores.length" class="empty small text-muted fst-italic">Nenhum preceptor encontrado.</li>
            </ul>
          </div>
        </div>
        <div class="col-md-6">
          <div class="glass-card h-100 d-flex flex-column">
            <div class="card-head d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-people"></i>
              <h5 class="m-0 section-title">Preceptores Vinculados</h5>
            </div>
            <ul class="list reset flex-grow-1 overflow-auto">
              <li *ngFor="let p of vinculados" class="item d-flex align-items-start justify-content-between gap-2">
                <div class="info min-w-0">
                  <div class="name text-truncate fw-semibold">{{ p.name }}</div>
                  <div class="meta small text-muted text-truncate">CPF: {{ p.cpf }} • {{ p.email }}</div>
                </div>
                <div class="actions">
                  <button class="btn btn-sm btn-outline-danger" (click)="desvincular(p)">
                    <i class="bi bi-x-lg"></i> Remover
                  </button>
                </div>
              </li>
              <li *ngIf="!vinculados.length" class="empty small text-muted fst-italic">Nenhum preceptor vinculado.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ADMIN only: Coordinator linking section -->
      <div *ngIf="isAdmin" class="mt-4">
        <div class="head d-flex flex-wrap align-items-center justify-content-between mb-3 gap-3">
          <div>
            <h2 class="page-title m-0 d-flex align-items-center gap-2"><i class="bi bi-person-badge"></i> Vínculo de Coordenadores</h2>
            <div class="subtitle text-muted small mt-1">Vincule coordenadores às disciplinas (somente administradores).</div>
          </div>
        </div>
        <div class="row g-4" [class.dimmed]="carregandoCoord">
          <div class="col-md-6">
            <div class="glass-card h-100 d-flex flex-column">
              <div class="card-head d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-person-plus"></i>
                <h5 class="m-0 section-title">Coordenadores Disponíveis</h5>
              </div>
              <ul class="list reset flex-grow-1 overflow-auto">
                <li *ngFor="let c of coordenadores" class="item d-flex align-items-start justify-content-between gap-2">
                  <div class="info min-w-0">
                    <div class="name text-truncate fw-semibold">{{ c.name }}</div>
                    <div class="meta small text-muted text-truncate">CPF: {{ c.cpf }} • {{ c.email }}</div>
                  </div>
                  <div class="actions">
                    <button class="btn btn-sm btn-outline-primary" [disabled]="jaCoordVinculado(c)" (click)="vincularCoord(c)" [attr.aria-disabled]="jaCoordVinculado(c)">
                      <i class="bi" [ngClass]="{'bi-link-45deg': !jaCoordVinculado(c), 'bi-check2': jaCoordVinculado(c)}"></i>
                      {{ jaCoordVinculado(c) ? 'Vinculado' : 'Vincular' }}
                    </button>
                  </div>
                </li>
                <li *ngIf="!coordenadores.length" class="empty small text-muted fst-italic">Nenhum coordenador encontrado.</li>
              </ul>
            </div>
          </div>
          <div class="col-md-6">
            <div class="glass-card h-100 d-flex flex-column">
              <div class="card-head d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-people"></i>
                <h5 class="m-0 section-title">Coordenadores Vinculados</h5>
              </div>
              <ul class="list reset flex-grow-1 overflow-auto">
                <li *ngFor="let c of vinculadosCoord" class="item d-flex align-items-start justify-content-between gap-2">
                  <div class="info min-w-0">
                    <div class="name text-truncate fw-semibold">{{ c.name }}</div>
                    <div class="meta small text-muted text-truncate">CPF: {{ c.cpf }} • {{ c.email }}</div>
                  </div>
                  <div class="actions">
                    <button class="btn btn-sm btn-outline-danger" (click)="desvincularCoord(c)">
                      <i class="bi bi-x-lg"></i> Remover
                    </button>
                  </div>
                </li>
                <li *ngIf="!vinculadosCoord.length" class="empty small text-muted fst-italic">Nenhum coordenador vinculado.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    :host{display:block;}
    /* Wrapper aligned with Admin Users visual */
    .coord-wrapper{ 
      min-height:100%; 
      background: linear-gradient(145deg,#eef5ff,#e3eefc 50%,#dbe8f7);
      border: 1px solid #dae4ef;
      border-radius: 26px;
      box-shadow: 0 14px 42px -14px rgba(32,56,92,.25), 0 6px 20px -8px rgba(32,56,92,.18);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .coord-shell{position:relative;}
    .page-title{font-size:1.05rem; font-weight:600; letter-spacing:.4px;}
    .subtitle{font-size:.7rem; letter-spacing:.5px;}
    /* Head toolbar (glass) */
    .head{ 
      background: linear-gradient(135deg,#ffffff,#f2f7fb);
      border:1px solid #d9e4ef;
      border-radius: 18px;
      padding:.65rem .9rem;
      box-shadow:0 6px 18px -8px rgba(32,56,92,.18);
    }
    .select-inline{display:flex; flex-direction:column; gap:.25rem;}
    .select-inline select{
      font-size:.7rem; text-transform:uppercase; letter-spacing:.55px; font-weight:600;
      padding:.4rem .65rem; border:1px solid #d5e1eb; border-radius:10px; background:#f6fafc; min-width:240px;
      /* Show a custom dropdown arrow */
      -webkit-appearance: none; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20'%3E%3Cpath fill='%235a6d7b' d='M5.23 7.21a.75.75 0 011.06.02L10 10.06l3.71-2.83a.75.75 0 11.92 1.18l-4.24 3.24a.75.75 0 01-.92 0L5.21 8.41a.75.75 0 01.02-1.2z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right .55rem center;
      background-size: .8rem;
      padding-right: 1.8rem;
      cursor: pointer;
    }
    .mini-label{font-size:.55rem; font-weight:600; letter-spacing:.55px; color:#5c6e7b; text-transform:uppercase;}
    /* Cards aligned with users page containers */
    .glass-card{background:#ffffff; border:1px solid #dfe7ef; border-radius:18px; padding:1rem .95rem .85rem; box-shadow:0 8px 26px -10px rgba(30,54,90,.18), 0 2px 10px -4px rgba(30,54,90,.15); display:flex; flex-direction:column;}
    .glass-card .section-title{font-size:.85rem; font-weight:600; letter-spacing:.5px;}
    .list.reset{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.55rem;}
  .list.reset{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.55rem;}
  .item{background:linear-gradient(90deg,#f3f8fc,#eef4f9); border:1px solid #d6e1ec; border-radius:14px; padding:.65rem .75rem; position:relative; transition:.25s cubic-bezier(.4,.14,.3,1); display:flex; align-items:flex-start; gap:.5rem;}
    .item:hover{background:#f2f8fd; transform:translateY(-2px); box-shadow:0 8px 20px -10px rgba(30,54,90,.18);} 
    .item .name{font-size:.83rem;}
    .item .meta{font-size:.62rem; letter-spacing:.3px;}
  .actions .btn{font-size:.6rem; letter-spacing:.4px; font-weight:600; text-transform:uppercase; white-space:nowrap;}
  /* Layout helpers to improve responsiveness */
  .item .info{flex:1 1 auto; min-width:0;} /* allow truncation */
  .item .actions{flex:0 0 auto; display:flex; align-items:center; justify-content:flex-end; margin-left: .5rem;}
    .empty{padding:.4rem .25rem;}
    .loading-overlay{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(3px); background:rgba(255,255,255,.55); border-radius:20px; z-index:10;}
    .dimmed{opacity:.45; pointer-events:none;}
    @media (max-width: 767.98px){
      .select-inline select{min-width:200px;}
      .glass-card{padding:.85rem .85rem .75rem;}
      .item{padding:.55rem .65rem;}
      .item .name{font-size:.8rem;}
      /* On small screens stack actions under the info and keep button aligned to right */
      .item{flex-wrap:wrap;}
      .item .actions{flex:1 0 100%; margin-top:.45rem; justify-content:flex-end;}
      .item .meta{display:block; overflow:hidden; text-overflow:ellipsis;}
    }
  `]
})
export class CoordinatorComponent implements OnInit {
  disciplinas: any[] = [];
  preceptores: any[] = [];
  selecionadaId: number | null = null;
  vinculados: any[] = [];
  carregando = false;
  // ADMIN only
  isAdmin = false;
  coordenadores: any[] = [];
  vinculadosCoord: any[] = [];
  carregandoCoord = false;

  constructor(private coord: CoordinatorService, private auth: AuthService) {}

  ngOnInit(): void {
    this.carregando = true;
    this.isAdmin = this.auth.getRole() === 'ADMIN';
    forkJoin({
      d: this.coord.listDisciplines().pipe(catchError(() => of([]))),
      p: this.coord.listPreceptors().pipe(catchError(() => of([]))),
      c: (this.isAdmin ? this.coord.listCoordinators() : of([])).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ d, p, c }) => {
        this.disciplinas = Array.isArray(d) ? d : [];
        this.preceptores = Array.isArray(p) ? p : [];
        this.coordenadores = this.isAdmin && Array.isArray(c) ? c : [];
        if (this.disciplinas.length) {
          this.selecionadaId = this.disciplinas[0].id;
          this.onSelectDisciplina();
        }
      },
      error: _ => { /* already handled per-stream */ },
      complete: () => { this.carregando = false; }
    });
  }

  onSelectDisciplina() {
    if (!this.selecionadaId) { 
      this.vinculados = []; 
      if (this.isAdmin) this.vinculadosCoord = []; 
      return; 
    }
    this.coord.listDisciplinePreceptors(this.selecionadaId).subscribe(v => this.vinculados = v);
    if (this.isAdmin) {
      this.carregandoCoord = true;
      this.coord.listDisciplineCoordinators(this.selecionadaId).subscribe(v => { this.vinculadosCoord = v; this.carregandoCoord = false; }, _ => this.carregandoCoord = false);
    }
  }

  jaVinculado(u: any): boolean {
    return this.vinculados.some(v => v.id === u.id);
  }

  vincular(u: any) {
    if (!this.selecionadaId) return;
    this.coord.linkPreceptor(this.selecionadaId, u.id).subscribe(() => this.onSelectDisciplina());
  }

  desvincular(u: any) {
    if (!this.selecionadaId) return;
    this.coord.unlinkPreceptor(this.selecionadaId, u.id).subscribe(() => this.onSelectDisciplina());
  }

  // ADMIN only methods
  jaCoordVinculado(u: any): boolean { return this.vinculadosCoord.some(v => v.id === u.id); }
  vincularCoord(u: any) { if (!this.selecionadaId) return; this.coord.linkCoordinator(this.selecionadaId, u.id).subscribe(() => this.onSelectDisciplina()); }
  desvincularCoord(u: any) { if (!this.selecionadaId) return; this.coord.unlinkCoordinator(this.selecionadaId, u.id).subscribe(() => this.onSelectDisciplina()); }
}
