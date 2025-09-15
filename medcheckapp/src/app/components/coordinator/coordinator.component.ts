import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoordinatorService } from '../../services/coordinator.service';

@Component({
  selector: 'app-coordinator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coordinator.component.html',
  styleUrl: './coordinator.component.scss'
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
