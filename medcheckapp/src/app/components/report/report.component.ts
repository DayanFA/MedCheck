import { Component, HostListener, Input, OnChanges, SimpleChanges, Inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CalendarServiceApi } from '../../services/calendar.service';
import { WeekSelectionService } from '../../services/week-selection.service';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreceptorService } from '../../services/preceptor.service';
import { EvaluationService } from '../../services/evaluation.service';
// Removido import estático de jsPDF para evitar erro em SSR; será carregado dinamicamente dentro de onGeneratePdf.

interface PeriodInterval { start: string; end: string; }
interface DayPeriod { shift: string; locations: string[]; intervals: PeriodInterval[]; }
interface WeekDayRow { weekday: string; date: Date; periods: DayPeriod[]; }
interface WeekData { number: number; days: WeekDayRow[]; evaluation: number | null; loaded: boolean; rotationPeriod: string; }

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
  @ViewChild('fullReportRoot') fullReportRoot?: ElementRef<HTMLDivElement>;

  // Mapas para exibir textos completos das dimensões e questões na modal de detalhes
  dimensionTitles: Record<string,string> = {
    dim1: 'Dimensão 1: Clínica da APS',
    dim2: 'Dimensão 2: Atuação comunitária',
    dim3: 'Dimensão 3: Vínculo com a equipe e processo de trabalho',
    dim4: 'Dimensão 4: Sistema de saúde e políticas públicas'
  };
  private questionTexts: Record<string, Record<string,string>> = {
    dim1: {
      q1: 'Atua com empatia e busca criar vínculo com as pessoas?',
      q2: 'Utiliza o tempo de forma adequada no atendimento às necessidades apresentadas?',
      q3: 'Sabe conduzir a entrevista clínica abordando os diversos problemas relatados?',
      q4: 'Sabe conduzir o exame clínico com base nas informações da entrevista?',
      q5: 'Busca a compreensão do processo de adoecimento de forma ampla?',
      q6: 'Oportuniza contato para explorar condições de vida e saúde de membros da família?',
      q7: 'Estabelece diálogo acessível à compreensão dos pacientes?',
      q8: 'Dedica-se à explicação detalhada da condição de saúde acolhendo dúvidas?',
      q9: 'Confecciona lista de problemas com propostas de encaminhamentos?',
      q10: 'Compreende os ciclos de vida das famílias e aplica no entendimento do adoecimento?',
      q11: 'Domina a clínica da APS, principais temas e manejo clínico adequado?'
    },
    dim2: {
      q1: 'Dispõe-se, havendo indicação, a realizar visita domiciliar de reconhecimento, seguimento ou busca ativa?',
      q2: 'É permeável ao contato e vínculo com outros equipamentos e representações sociais no território?',
      q3: 'Propõe e realiza atividades nos ambientes comunitários (escolas, associações, espaços coletivos)?'
    },
    dim3: {
      q1: 'Tem bom vínculo com a equipe de saúde?',
      q2: 'Atua de forma integrada e solidária junto à equipe buscando melhorar o processo de trabalho?',
      q3: 'Compreende a necessidade de fortalecimento e legitimação da equipe junto à comunidade?',
      q4: 'Compreende as limitações do local onde atua e adequa condutas aos recursos disponíveis sem prejuízo ao tratamento?',
      q5: 'É proativo na coordenação do cuidado (acompanhamento, resgate de faltosos etc.)?'
    },
    dim4: {
      q1: 'Conhece o sistema de saúde loco-regional e direciona os pacientes adequadamente (integralidade)?',
      q2: 'Compreende processos de gestão e gerenciamento como fundamentais para garantir melhor cuidado?',
      q3: 'É capaz de elaborar e ter visão crítica e propositiva sobre as políticas de saúde?'
    }
  };

  fullQuestionText(dimId: string, qId: string): string {
    return this.questionTexts[dimId]?.[qId] || qId;
  }

  // Armazena conjunto global de turnos usados em todas as semanas carregadas
  private globalShiftSet: Set<string> = new Set<string>();
  globalRotationPeriod: string = '—';

  constructor(private auth: AuthService,
              private calApi: CalendarServiceApi,
              private weekSync: WeekSelectionService,
              private route: ActivatedRoute,
              private preceptorService: PreceptorService,
              private router: Router,
              private evalService: EvaluationService,
              @Inject(PLATFORM_ID) private platformId: Object) {
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
    this.weeks = Array.from({ length: 10 }, (_, i) => ({ number: i + 1, days: [], evaluation: null, loaded: false, rotationPeriod: '—' }));
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
        if (p.intervals.length > 0 || p.locations.length > 0) used.add(p.shift);
      }
    }
    const order = ['Manhã','Tarde','Noite'];
    const list = order.filter(o => used.has(o));
    week.rotationPeriod = list.length ? list.join(', ') : '—';
    // Atualiza cabeçalho exibido apenas se esta é a semana selecionada (para UI interativa)
    if (this.selectedWeek && this.selectedWeek.number === week.number) {
      this.student.rotationPeriod = week.rotationPeriod;
    }
    // Atualiza conjunto global e string global
    for (const s of used) this.globalShiftSet.add(s);
    const globalList = order.filter(o => this.globalShiftSet.has(o));
    this.globalRotationPeriod = globalList.length ? globalList.join(', ') : '—';
  }

  get overallRotationPeriod(): string {
    const used = new Set<string>();
    for (const w of this.weeks) {
      for (const d of w.days) {
        for (const p of d.periods) {
          if (p.intervals.length > 0 || p.locations.length > 0) used.add(p.shift);
        }
      }
    }
    if (!used.size) return '—';
    const order = ['Manhã','Tarde','Noite'];
    return order.filter(o => used.has(o)).join(', ');
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
  // (stub removido)
  // Verifica se avaliação global existe
  get hasGlobalEvaluation(): boolean { return this.weeks.some(w => w.evaluation !== null && w.evaluation !== undefined); }

  // Geração de PDF consolidando TODAS as semanas + avaliação global (dinâmico / browser only)
  async onGeneratePdf() {
    if (!isPlatformBrowser(this.platformId)) {
      return; // evita executar em ambiente SSR
    }
    // Bloqueia se não houver avaliação
    if (!this.hasGlobalEvaluation || !this.evaluationDetails) {
      alert('Para gerar o PDF é necessário primeiro registrar a avaliação.');
      return;
    }
    // Garantir que todas as semanas estejam carregadas antes de gerar
    const unloaded = this.weeks.filter(w => !w.loaded).map(w => w.number);
    if (unloaded.length) {
      // Carrega sequencialmente e re-invoca após concluído
      let idx = 0;
      const loadNext = () => {
        if (idx >= unloaded.length) { this.onGeneratePdf(); return; }
        const n = unloaded[idx++];
        // Forçar reload
        const wref = this.weeks[n-1];
        if (wref) wref.loaded = false;
        this.loadWeek(n);
        setTimeout(loadNext, 350); // pequeno intervalo para permitir subscribe concluir
      };
      loadNext();
      return;
    }
    // --- Nova abordagem: capturar cada bloco (semana + formulário) individualmente para evitar cortes ---
    await new Promise(r => setTimeout(r, 50));
    const root = this.fullReportRoot?.nativeElement;
    if (!root) { alert('Estrutura completa ainda não pronta para exportar.'); return; }
    root.classList.remove('d-none');
    let jsPDFMod: any; let html2canvasMod: any;
    try {
      [jsPDFMod, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);
    } catch (e) {
      console.error('Falha ao carregar libs PDF/canvas', e); root.classList.add('d-none'); alert('Erro ao carregar bibliotecas para exportar PDF.'); return; }
    const jsPDF = jsPDFMod.default || jsPDFMod;
    const html2canvas = html2canvasMod.default || html2canvasMod;
    const pdf = new jsPDF('p','pt','a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 20;
    const usableWidth = pageWidth - marginX*2;

    // Selecionar todos os blocos semanais e formulário final
    const blocks: HTMLElement[] = Array.from(root.querySelectorAll('.weekly-sheet')) as HTMLElement[];
    const evalForm = root.querySelector('.evaluation-form-print') as HTMLElement | null;
    if (evalForm) blocks.push(evalForm);

    // Ajustar largura para render
    const originalWidth = root.style.width;
    root.style.width = '1100px';
    for (let i=0;i<blocks.length;i++) {
      const b = blocks[i];
      // Garantir pequeno delay para layout
      await new Promise(r => setTimeout(r, 25));
      const canvas = await html2canvas(b, { scale: 2, useCORS: true, backgroundColor:'#ffffff' });
      const imgWidth = usableWidth;
      const imgHeight = canvas.height * (imgWidth / canvas.width);
      if (i>0) pdf.addPage();
      const yStart = 20;
      // Se imagem maior que página, escala adicional para caber (fit-to-page)
      let drawWidth = imgWidth;
      let drawHeight = imgHeight;
      const maxHeight = pageHeight - 40; // margem vertical
      if (drawHeight > maxHeight) {
        const ratio = maxHeight / drawHeight;
        drawHeight = maxHeight;
        drawWidth = drawWidth * ratio;
      }
      const xCentered = marginX + (usableWidth - drawWidth)/2;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xCentered, yStart, drawWidth, drawHeight, undefined, 'FAST');
    }
    root.style.width = originalWidth;
    root.classList.add('d-none');
    pdf.save(`relatorio-internato-${this.student.name.replace(/\s+/g,'_')}.pdf`);
  }
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
