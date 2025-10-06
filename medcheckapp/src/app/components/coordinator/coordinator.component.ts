import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoordinatorService } from '../../services/coordinator.service';

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
    </div>
  </div>
  `,
  styles: [`
    :host{display:block;}
    .coord-wrapper{min-height:100%; background:linear-gradient(145deg,#e8f2ff,#dbe9ff 45%,#d4e2ff);}
    .coord-shell{position:relative;}
    .page-title{font-size:1.15rem; font-weight:600; letter-spacing:.4px;}
    .subtitle{font-size:.7rem; letter-spacing:.5px;}
    .select-inline{display:flex; flex-direction:column; gap:.25rem;}
    .select-inline select{font-size:.7rem; text-transform:uppercase; letter-spacing:.55px; font-weight:600; padding:.4rem .65rem; border:1px solid #d5e1eb; border-radius:10px; background:#f6fafc; min-width:240px;}
    .mini-label{font-size:.55rem; font-weight:600; letter-spacing:.55px; color:#5c6e7b; text-transform:uppercase;}
    .glass-card{background:#ffffff; border:1px solid #dfe7ef; border-radius:18px; padding:1rem .95rem .85rem; box-shadow:0 4px 14px -6px rgba(20,40,60,.14); display:flex; flex-direction:column;}
    .glass-card .section-title{font-size:.85rem; font-weight:600; letter-spacing:.5px;}
    .list.reset{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.55rem;}
    .item{background:linear-gradient(135deg,#f9fcff,#f1f6fb); border:1px solid #dfe7ef; border-radius:14px; padding:.65rem .75rem; position:relative; transition:.25s cubic-bezier(.4,.14,.3,1);}
    .item:hover{transform:translateY(-3px); box-shadow:0 8px 20px -8px rgba(20,40,60,.2);} 
    .item .name{font-size:.83rem;}
    .item .meta{font-size:.62rem; letter-spacing:.3px;}
    .actions .btn{font-size:.6rem; letter-spacing:.4px; font-weight:600; text-transform:uppercase;}
    .empty{padding:.4rem .25rem;}
    .loading-overlay{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(3px); background:rgba(255,255,255,.55); border-radius:20px; z-index:10;}
    .dimmed{opacity:.45; pointer-events:none;}
    @media (max-width: 767.98px){
      .select-inline select{min-width:200px;}
      .glass-card{padding:.85rem .85rem .75rem;}
      .item{padding:.55rem .65rem;}
      .item .name{font-size:.8rem;}
    }
  `]
})
export class CoordinatorComponent implements OnInit {
  disciplinas: any[] = [];
  preceptores: any[] = [];
  selecionadaId: number | null = null;
  vinculados: any[] = [];
  carregando = false;

  constructor(private coord: CoordinatorService) {}

  ngOnInit(): void {
    this.carregando = true;
    Promise.all([
      this.coord.listDisciplines().toPromise(),
      this.coord.listPreceptors().toPromise(),
    ]).then(([d, p]) => {
      this.disciplinas = d || [];
      this.preceptores = p || [];
      if (this.disciplinas.length) {
        this.selecionadaId = this.disciplinas[0].id;
        this.onSelectDisciplina();
      }
    }).finally(() => this.carregando = false);
  }

  onSelectDisciplina() {
    if (!this.selecionadaId) { this.vinculados = []; return; }
    this.coord.listDisciplinePreceptors(this.selecionadaId).subscribe(v => this.vinculados = v);
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
}
