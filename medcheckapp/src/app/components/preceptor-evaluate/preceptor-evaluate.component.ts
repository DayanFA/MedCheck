import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PreceptorService } from '../../services/preceptor.service';
import { CalendarServiceApi } from '../../services/calendar.service';
import { WeekSelectionService } from '../../services/week-selection.service';
import { FormsModule } from '@angular/forms';
import { ReportComponent } from '../report/report.component';

@Component({
  selector: 'app-preceptor-evaluate',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportComponent],
  template: `
  <div class="container py-3 d-flex flex-column gap-3">
    <div class="d-flex flex-column flex-sm-row align-items-sm-end gap-2">
      <h4 class="mb-0">Avaliação do Interno</h4>
      <div class="small text-muted" *ngIf="studentName() !== '...'">{{ studentName() }} <span *ngIf="currentDisciplineLabel()">— {{ currentDisciplineLabel() }}</span></div>
    </div>
    <div *ngIf="alunoId(); else noAluno" class="d-flex flex-wrap gap-3 align-items-end">
      <div>
        <label class="form-label small mb-1">Semana</label>
        <select class="form-select form-select-sm" [(ngModel)]="week" (change)="onWeekChange()">
          <option *ngFor="let w of weeks" [ngValue]="w">Semana {{w}}</option>
        </select>
      </div>
      <div *ngIf="disciplines().length > 1">
        <label class="form-label small mb-1">Disciplina</label>
        <select class="form-select form-select-sm" [(ngModel)]="selectedDisciplineId" (change)="reloadWeek()">
          <option *ngFor="let d of disciplines()" [ngValue]="d.id">{{ d.code }} - {{ d.name }}</option>
        </select>
      </div>
      <div *ngIf="disciplines().length === 1" class="small text-muted">
        {{ disciplines()[0].code }} - {{ disciplines()[0].name }}
      </div>
    </div>
    <ng-template #noAluno>
      <div class="alert alert-warning small mb-0">Aluno não especificado.</div>
    </ng-template>

    <div *ngIf="plansLoading()" class="text-center py-5 text-muted">Carregando planos...</div>

    <app-report *ngIf="!plansLoading()" [alunoId]="alunoId() || undefined" [disciplineId]="selectedDisciplineId || undefined" />
  </div>
  `
})
export class PreceptorEvaluateComponent implements OnInit {
  weeks = Array.from({length:10}, (_,i)=> i+1);
  week = 1;
  selectedDisciplineId: number | null = null;
  private _alunoId = signal<number | null>(null);
  alunoId = this._alunoId.asReadonly();
  private _disciplines = signal<{id:number; code:string; name:string;}[]>([]);
  disciplines = this._disciplines.asReadonly();
  private _plansLoading = signal(false);
  plansLoading = this._plansLoading.asReadonly();
  studentName = signal<string>('...');
  currentDisciplineLabel = signal<string>('');

  constructor(private route: ActivatedRoute, private preceptor: PreceptorService, private cal: CalendarServiceApi, private weekSync: WeekSelectionService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(pm => {
      const aid = pm.get('alunoId');
      this._alunoId.set(aid ? Number(aid) : null);
      if (this.alunoId()) {
        this.loadDisciplines();
        this.reloadWeek();
      }
    });
  }

  private loadDisciplines() {
    this.preceptor.disciplines().subscribe(res => {
      const items = res?.items || [];
      this._disciplines.set(items);
      if (items.length === 1) this.selectedDisciplineId = items[0].id;
      this.loadStudentInfo();
    });
  }

  onWeekChange() {
    this.weekSync.setWeek(this.week);
    this.reloadWeek();
  }

  reloadWeek() {
    if (!this.alunoId()) return;
    this._plansLoading.set(true);
    this.loadStudentInfo();
    // Forçar reload no ReportComponent limpando cache via service state (sem acesso direto -> usar WeekSelectionService)
    this.weekSync.setWeek(this.week);
    this.cal.getWeekPlans(this.week, this.alunoId()!, this.selectedDisciplineId || undefined).subscribe({
      next: _ => { this._plansLoading.set(false); },
      error: _ => { this._plansLoading.set(false); }
    });
  }

  private loadStudentInfo() {
    if (!this.alunoId()) return;
    this.preceptor.studentInfo(this.alunoId()!, this.selectedDisciplineId || undefined).subscribe(resp => {
      if (resp?.name) this.studentName.set(resp.name);
      if (resp?.discipline) {
        this.currentDisciplineLabel.set(`${resp.discipline.code} - ${resp.discipline.name}`);
      } else {
        this.currentDisciplineLabel.set('');
      }
    });
  }
}
