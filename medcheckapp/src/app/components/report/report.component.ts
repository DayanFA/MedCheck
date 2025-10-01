import { Component, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CalendarServiceApi } from '../../services/calendar.service';
import { WeekSelectionService } from '../../services/week-selection.service';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreceptorService } from '../../services/preceptor.service';
import { EvaluationService } from '../../services/evaluation.service';

interface PeriodInterval { start: string; end: string; }
interface DayPeriod { shift: string; locations: string[]; intervals: PeriodInterval[]; }
interface WeekDayRow { weekday: string; date: Date; periods: DayPeriod[]; }
interface WeekData { number: number; days: WeekDayRow[]; evaluation: number | null; loaded: boolean; }

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss']
})
export class ReportComponent implements OnChanges {
  weeks: WeekData[] = [];
  selectedWeekIndex = 0;
  // Mapeamento das carinhas (mesma ordem usada na tela de avaliação)
  faces: string[] = ['😠','🙁','😐','🙂','😄'];

  // Configuração de paginação
  groupSize = 5;            // tamanho do grupo em telas pequenas
  breakpointPx = 900;        // largura abaixo da qual ativa paginação
  paginated = false;         // estado atual (determinado por largura de janela)
  groupStartIndex = 0;       // índice inicial do grupo atual

  student = { name: '...', preceptorName: '', rotationPeriod: 'Manhã e Tarde' };
  disciplineLabel = '';

  @Input() alunoId?: number;          // usado em contexto de preceptor
  @Input() disciplineId?: number;     // usado em contexto de preceptor

  evaluationDetails: any = null; // cache da avaliação carregada (aluno view)
  showEvalModal = false;

  constructor(private auth: AuthService,
              private calApi: CalendarServiceApi,
              private weekSync: WeekSelectionService,
              private route: ActivatedRoute,
              private preceptorService: PreceptorService,
              private router: Router,
              private evalService: EvaluationService) {
    this.initWeeks();
    this.updatePaginationMode();
    this.ensureGroupForSelected();
    const u = this.auth.getUser();
    if (u?.name) this.student.name = u.name;
    if (u?.currentDisciplineName) {
      const code = u.currentDisciplineCode ? u.currentDisciplineCode + ' - ' : '';
      this.disciplineLabel = `CURSO DE MEDICINA - ${code}${u.currentDisciplineName}`;
    } else {
      this.disciplineLabel = 'CURSO DE MEDICINA';
    }
    this.calApi.getCurrentPreceptor().subscribe(p => {
      if (p?.name) this.student.preceptorName = p.name;
    });
    // Sincroniza semana global selecionada vinda do calendário (se já alterada lá)
    const globalWeek = this.weekSync.week();
    if (globalWeek && globalWeek >=1 && globalWeek <=10) {
      this.selectedWeekIndex = globalWeek - 1;
    }
    // Carrega imediatamente a semana inicial no contexto do aluno.
    // Para o preceptor, ngOnChanges (inputs) irá forçar recarga depois.
    this.loadWeek(this.selectedWeek.number);
    // Caso seja acessado via rota /relatorio?alunoId=... (preceptor/admin) sem uso de inputs.
    this.route.queryParamMap.subscribe(pm => {
      // Só aplica se não recebemos @Input (Inputs prevalecem via ngOnChanges)
      if (this.alunoId) return;
      const aid = pm.get('alunoId');
      const did = pm.get('disciplineId');
      if (aid) {
        this.alunoId = Number(aid);
        this.disciplineId = did ? Number(did) : undefined;
        this.weeks.forEach(w => w.loaded = false);
        this.fetchStudentInfo();
        this.loadWeek(this.selectedWeek.number);
      }
    });

    // Se navegação veio com pedido de refresh de avaliação global
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state && (nav.extras.state as any).refreshEval) {
      this.evaluationDetails = null;
      // forçar recarregar avaliação (loadWeek chama loadEvaluationForWeek na primeira semana)
      this.weeks.forEach(w => w.evaluation = null);
      this.loadEvaluationForWeek(this.selectedWeek.number);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['alunoId'] || changes['disciplineId']) {
      // Contexto preceptor: carregar info do aluno selecionado
      if (this.alunoId) {
        this.fetchStudentInfo();
      }
      // Resetar cache semanas para forçar recarga com novo contexto
      this.weeks.forEach(w => w.loaded = false);
      // Recarregar semana atual
      this.loadWeek(this.selectedWeek.number);
    }
  }

  private fetchStudentInfo() {
    if (!this.alunoId) return;
    this.preceptorService.studentInfo(this.alunoId, this.disciplineId).subscribe(info => {
      if (info?.name) this.student.name = info.name;
      if (info?.preceptor?.name) this.student.preceptorName = info.preceptor.name;
      if (info?.discipline) {
        this.disciplineLabel = `CURSO DE MEDICINA - ${info.discipline.code} - ${info.discipline.name}`;
      } else {
        // Sem disciplina específica: manter curso genérico
        this.disciplineLabel = 'CURSO DE MEDICINA';
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

  private initWeeks() {
    this.weeks = Array.from({ length: 10 }, (_, i) => ({ number: i + 1, days: [], evaluation: null, loaded: false }));
  }

  private loadWeek(weekNumber: number) {
    const idx = weekNumber - 1;
    const wk = this.weeks[idx];
    if (!wk) return;
    if (wk.loaded) return; // evitar reload repetido (pode ajustar depois com refresh)
    this.calApi.getWeekPlans(weekNumber, this.alunoId, this.disciplineId).subscribe(res => {
      const plans = res?.plans || [];
      // Se estamos no contexto do aluno (sem @Input alunoId) e veio metadado de disciplina, atualizar cabeçalho
      const anyRes: any = res as any;
      if (!this.alunoId && anyRes?.discipline) {
        const d = anyRes.discipline;
        this.disciplineLabel = `CURSO DE MEDICINA - ${d.code} - ${d.name}`;
      }
      // Fallback: se não há planos retornados (talvez registros antigos sem weekNumber), tentar derivar semana pegando todos planos do mês e filtrando por intervalo de datas.
      // (Simplificação: se vazio, não fazemos chamada extra agora para evitar overhead; poderia haver endpoint futuro.)
      // Agrupar por dia
      const byDate: Record<string, any[]> = {};
      for (const p of plans) {
        byDate[p.date] = byDate[p.date] || [];
        byDate[p.date].push(p);
      }
      const weekdayFull = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
      const dayRows: WeekDayRow[] = Object.keys(byDate).sort().map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        const weekday = weekdayFull[date.getDay()];
        const periodsMap: { [shift: string]: { locs: Set<string>; intervals: PeriodInterval[] } } = {
          'Manhã': { locs: new Set<string>(), intervals: [] },
          'Tarde': { locs: new Set<string>(), intervals: [] },
          'Noite': { locs: new Set<string>(), intervals: [] }
        };
        for (const plan of byDate[dateStr]) {
          const start = plan.startTime;
          const end = plan.endTime;
          // Se end < start, é overnight: dividir em (start-23:59) no dia atual e (00:00-end) no dia seguinte
          if (start && end && end < start) {
            // Primeiro segmento (dia atual)
            const shift1 = this.classifyShift(start);
            if (plan.location) periodsMap[shift1].locs.add(plan.location);
            periodsMap[shift1].intervals.push({ start: start, end: '23:59' });
            // Segundo segmento: armazenar em buffer para dia seguinte
            const nextDate = new Date(date.getTime());
            nextDate.setDate(nextDate.getDate() + 1);
            const nextIso = nextDate.toISOString().substring(0,10);
            // garantir estrutura no map global byDate se for do mesmo fetch (apenas para visual no relatório semanal)
            if (!byDate[nextIso]) byDate[nextIso] = [];
            byDate[nextIso].push({ ...plan, date: nextIso, startTime: '00:00', endTime: end });
          } else {
            // Normal
            const shift = this.classifyShift(start);
            if (plan.location) periodsMap[shift].locs.add(plan.location);
            if (plan.startTime && plan.endTime) {
              periodsMap[shift].intervals.push({ start: plan.startTime, end: plan.endTime });
            }
          }
        }
        const periods: DayPeriod[] = Object.keys(periodsMap).map(shift => {
          const data = periodsMap[shift];
          // ordenar intervalos
          const ordered = data.intervals.sort((a,b) => a.start.localeCompare(b.start));
          // opcional: merge intervalos sobrepostos (não solicitado; manter granular)
          return {
            shift,
            locations: Array.from(data.locs),
            intervals: ordered
          } as DayPeriod;
        }).filter(p => p.locations.length > 0 || p.intervals.length > 0);
        return { weekday, date, periods };
      });
      // Se nenhum dia carregado, garantir estrutura vazia com placeholders (Seg-Sex) para não aparecer tabela em branco.
      if (dayRows.length === 0) {
        // Aproximação: construir uma semana base a partir da data atual + (weekNumber-1)*7
        const base = new Date();
        base.setHours(0,0,0,0);
        // alinhar base para segunda-feira
        const day = base.getDay(); // 0=Dom
        const diffToMon = (day === 0 ? -6 : 1 - day); // deslocamento até segunda
        base.setDate(base.getDate() + diffToMon + (weekNumber-1)*7);
        for (let i=0;i<5;i++) { // Segunda..Sexta
          const d = new Date(base.getTime());
          d.setDate(base.getDate() + i);
          const weekday = weekdayFull[d.getDay()];
          dayRows.push({ weekday, date: d, periods: [] });
        }
      }
      wk.days = dayRows;
      wk.loaded = true;
      this.updateRotationPeriodSummary(wk);
      // Carregar avaliação se modo aluno (sem alunoId input) ou se preceptor vendo aluno (mostrar nota se existir)
      this.loadEvaluationForWeek(wk.number);
      // Caso contexto preceptor e ainda não tenha carregado info (ex: input chegou antes de subscribe), reforçar
      if (this.alunoId) this.fetchStudentInfo();
    });
  }

  private loadEvaluationForWeek(_weekNumberIgnored: number) {
    // Força uso de weekNumber=1 como chave global de avaliação
    const alunoRef = this.alunoId || this.auth.getUser()?.id;
    if (!alunoRef) return;
    this.evalService.get(alunoRef, 1, this.disciplineId).subscribe(res => {
      if (!(res && res.found)) return;
      // Parse e enriquecer detalhes (JSON string -> objeto com textos das perguntas se disponíveis)
      let parsed: any = null;
      if (res.details) {
        try { parsed = typeof res.details === 'string' ? JSON.parse(res.details) : res.details; } catch { parsed = null; }
      }
      const enriched: any = { score: res.score, comment: res.comment, preceptorName: res.preceptorName };
      if (parsed?.dimensions) {
        enriched.details = { dimensions: parsed.dimensions.map((d: any) => {
          const answers = d.answers || {};
          const questions = Object.keys(answers).map(qId => ({ id: qId, text: qId, answer: answers[qId] }));
          return { id: d.id, name: d.id, questions };
        }) };
      }
      this.evaluationDetails = enriched;
      // Propagar score para todas as semanas para exibição uniforme.
      for (const w of this.weeks) { w.evaluation = res.score; }
    });
  }

  openEvaluationDetails() { this.showEvalModal = true; }
  closeEvaluationDetails() { this.showEvalModal = false; }

  private updateRotationPeriodSummary(week: WeekData) {
    const used = new Set<string>();
    for (const d of week.days) {
      for (const p of d.periods) {
        if (p.intervals.length > 0 || p.locations.length > 0) {
          used.add(p.shift);
        }
      }
    }
    if (used.size === 0) {
      this.student.rotationPeriod = '—';
      return;
    }
    // Ordem desejada: Manhã, Tarde, Noite
    const order = ['Manhã','Tarde','Noite'];
    const list = order.filter(o => used.has(o));
    this.student.rotationPeriod = list.join(', ');
  }

  private classifyShift(startTime: string): 'Manhã'|'Tarde'|'Noite' {
    // startTime formato HH:mm
    const [hStr, mStr] = startTime.split(':');
    const h = parseInt(hStr, 10); const m = parseInt(mStr, 10) || 0;
    const minutes = h*60 + m;
    const manhaStart = 4*60; // 04:00
    const manhaEnd = 12*60 + 59; // 12:59
    const tardeStart = 13*60; // 13:00
    const tardeEnd = 17*60 + 59; // 17:59
    // noite: 18:00 (1080) até 23:59 (1439) e 00:00 (0) até 03:59 (239)
    if (minutes >= manhaStart && minutes <= manhaEnd) return 'Manhã';
    if (minutes >= tardeStart && minutes <= tardeEnd) return 'Tarde';
    return 'Noite';
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
    const wk = this.weeks[i];
    if (wk) {
      // sempre recarrega para refletir alterações recentes feitas no calendário
      wk.loaded = false; // invalidar cache
      this.loadWeek(wk.number);
      this.weekSync.setWeek(wk.number);
    }
  }

  onGeneratePdf() { console.log('Gerar PDF semana', this.selectedWeek.number, this.selectedWeek); }
  onSubmit() { console.log('Enviar relatório semana', this.selectedWeek.number, this.selectedWeek); }
  isPreceptorViewingStudent(): boolean {
    const u = this.auth.getUser();
    return !!(u && (u.role === 'PRECEPTOR' || u.role === 'ADMIN') && this.alunoId);
  }

  goToEvaluation() {
    // Navega para avaliação global (sem parâmetro de semana)
    const queryParams: any = { alunoId: this.alunoId || '' };
    if (this.disciplineId) queryParams.disciplineId = this.disciplineId;
    this.router.navigate(['/avaliacao'], { queryParams });
  }
}
