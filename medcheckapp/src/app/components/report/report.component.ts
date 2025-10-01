import { Component, HostListener } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CalendarServiceApi } from '../../services/calendar.service';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DayPeriod { shift: string; location: string; }
interface WeekDayRow { weekday: string; date: Date; periods: DayPeriod[]; }
interface WeekData { number: number; days: WeekDayRow[]; evaluation: number | null; }

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss']
})
export class ReportComponent {
  weeks: WeekData[] = [];
  selectedWeekIndex = 0;

  // Configuração de paginação
  groupSize = 5;            // tamanho do grupo em telas pequenas
  breakpointPx = 900;        // largura abaixo da qual ativa paginação
  paginated = false;         // estado atual (determinado por largura de janela)
  groupStartIndex = 0;       // índice inicial do grupo atual

  student = { name: '...', preceptorName: '', rotationPeriod: 'Manhã e Tarde' };
  disciplineLabel = '';

  constructor(private auth: AuthService, private calApi: CalendarServiceApi) {
    this.generateMockWeeks();
    this.updatePaginationMode();
    this.ensureGroupForSelected();
    // tenta pegar nome real do usuário logado
    const u = this.auth.getUser();
    if (u?.name) this.student.name = u.name;
    if (u?.currentDisciplineName) {
      // Monta label: CURSO DE MEDICINA - {NOME DA DISCIPLINA}
      const code = u.currentDisciplineCode ? u.currentDisciplineCode + ' - ' : '';
      this.disciplineLabel = `CURSO DE MEDICINA - ${code}${u.currentDisciplineName}`;
    } else {
      this.disciplineLabel = 'CURSO DE MEDICINA';
    }
    // Busca preceptor vinculado à disciplina atual
    this.calApi.getCurrentPreceptor().subscribe(p => {
      if (p?.name) {
        this.student.preceptorName = p.name;
      }
    });
  }

  @HostListener('window:resize') onResize() { this.updatePaginationMode(); }

  private updatePaginationMode() {
    const wasPaginated = this.paginated;
    this.paginated = window.innerWidth < this.breakpointPx;
    if (!this.paginated) {
      // reset group when leaving paginated mode
      this.groupStartIndex = 0;
    } else if (!wasPaginated && this.paginated) {
      // entering paginated mode - align group to selected
      this.ensureGroupForSelected();
    }
  }

  private ensureGroupForSelected() {
    if (!this.paginated) return;
    const group = Math.floor(this.selectedWeekIndex / this.groupSize);
    this.groupStartIndex = group * this.groupSize;
  }

  private generateMockWeeks() {
    const start = new Date();
    const diffToThursday = (4 - start.getDay() + 7) % 7;
    const firstThursday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + diffToThursday);
    for (let w = 0; w < 10; w++) {
      const weekDays: WeekDayRow[] = [];
      for (let d = 0; d < 3; d++) {
        const date = new Date(firstThursday); date.setDate(firstThursday.getDate() + w * 7 + d);
        const weekdayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        const weekday = weekdayNames[(4 + d) % 7];
        weekDays.push({ weekday, date, periods: [ { shift: 'Manhã', location: '' }, { shift: 'Tarde', location: '' } ] });
      }
      this.weeks.push({ number: w + 1, days: weekDays, evaluation: null });
    }
  }

  get selectedWeek(): WeekData { return this.weeks[this.selectedWeekIndex]; }

  // Semanas exibidas (modo paginado ou completo)
  get displayedWeeks(): WeekData[] {
    if (!this.paginated) return this.weeks;
    return this.weeks.slice(this.groupStartIndex, this.groupStartIndex + this.groupSize);
  }

  get hasPrevGroup(): boolean { return this.paginated && this.groupStartIndex > 0; }
  get hasNextGroup(): boolean { return this.paginated && (this.groupStartIndex + this.groupSize) < this.weeks.length; }

  prevGroup() {
    if (this.hasPrevGroup) {
      this.groupStartIndex = Math.max(0, this.groupStartIndex - this.groupSize);
    }
  }
  nextGroup() {
    if (this.hasNextGroup) {
      this.groupStartIndex = this.groupStartIndex + this.groupSize;
    }
  }

  selectWeek(i: number) {
    this.selectedWeekIndex = i;
    this.ensureGroupForSelected();
  }

  onGeneratePdf() { console.log('Gerar PDF semana', this.selectedWeek.number, this.selectedWeek); }
  onSubmit() { console.log('Enviar relatório semana', this.selectedWeek.number, this.selectedWeek); }
}
