import { Component, HostListener, Input, OnChanges, SimpleChanges, Inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CalendarServiceApi } from '../../services/calendar.service';
import { WeekSelectionService } from '../../services/week-selection.service';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { PreceptorService } from '../../services/preceptor.service';
import { CoordinatorService } from '../../services/coordinator.service';
import { EvaluationService } from '../../services/evaluation.service';
import { DisciplineService } from '../../services/discipline.service';
import { PreceptorAlunoContextService } from '../../services/preceptor-aluno-context.service';
import { ToastService } from '../../services/toast.service';
// Removido import estático de jsPDF para evitar erro em SSR; será carregado dinamicamente dentro de onGeneratePdf.

interface PeriodInterval { start: string; end: string; }
interface DayPeriod { shift: string; locations: string[]; intervals: PeriodInterval[]; }
interface WeekDayRow { weekday: string; date: Date; periods: DayPeriod[]; preceptors: string[]; }
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
  faces: string[] = ['😞','🙁','😐','🙂','😃'];

  // Configuração de paginação
  groupSize = 5;            // tamanho do grupo em telas pequenas
  breakpointPx = 900;        // largura abaixo da qual ativa paginação
  paginated = false;         // estado atual (determinado por largura de janela)
  groupStartIndex = 0;       // índice inicial do grupo atual

  student = { name: '...', preceptorName: '', rotationPeriod: 'Manhã e Tarde' };
  disciplineLabel = '';
  // Lista de disciplinas para contexto PRECEPTOR visualizando um aluno
  preceptorDisciplines: any[] | null = null; // null = carregando, [] = nenhuma
  isCoordinator = false;
  coordinatorDisciplines: any[] | null = null; // lista de disciplinas vinculadas ao coordenador quando visualizando aluno
  // Avaliação final do coordenador (nota/comentário)
  // Começa como loaded=true para não bloquear o botão/enviar em cenários onde o fetch ainda não ocorreu
  finalEval: { score: number | null; comment: string; loaded: boolean; saving: boolean } = { score: null, comment: '', loaded: true, saving: false };
  // Indica se já existe avaliação final persistida no servidor
  finalExists = false;
  // Snapshot do valor persistido no servidor (para detectar alterações locais)
  private finalOriginal: { score: number | null; comment: string } = { score: null, comment: '' };
  // Estado de edição/remoção da avaliação final do coordenador
  finalEditing = false;
  showFinalDeleteConfirm = false;
  deletingFinal = false;

  @Input() alunoId?: number;          // usado em contexto de preceptor
  @Input() disciplineId?: number;     // usado em contexto de preceptor

  evaluationDetails: any = null; // cache da avaliação carregada (aluno view)
  showEvalModal = false;
  // Lista de avaliações dos preceptores (pode haver múltiplas)
  preceptorEvaluations: any[] = [];
  @ViewChild('fullReportRoot') fullReportRoot?: ElementRef<HTMLDivElement>;
  generatingPdf = false; // controla estado de geração para evitar múltiplos cliques e flicker
  // Modal de confirmação para salvar avaliação final do coordenador
  showFinalSaveConfirm = false;
  // Indica, de forma unificada entre papéis, se a disciplina está FINALIZADA
  // (i.e., existe avaliação final do coordenador persistida para o par aluno+disciplina)
  finalFound = false;

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
      q2: 'Utiliza o tempo de forma adequada ao atendimento das necessidades apresentadas?',
      q3: 'Sabe conduzir a entrevista clínica abordando os diversos problemas relatados?',
      q4: 'Sabe conduzir o exame clínico com base nas informações da entrevista?',
      q5: 'Busca a compreensão do processo de adoecimento de forma mais ampla, abordando temas afeitos às condições de vida, trabalho, relações interpessoais, violência, risco nutricional, p. ex.?',
      q6: 'Oportuniza o contato para explorar as condições de vida e saúde dos demais membros da família?',
      q7: 'Estabelece diálogo acessível à compreensão dos pacientes?',
      q8: 'Dedica-se à explicação detalhada da condição de saúde acolhendo dúvidas e questionamentos por parte de pacientes e familiares?',
      q9: 'Confecciona lista de problemas com propostas de encaminhamentos para cada situação?',
      q10: 'Compreende os ciclos de vida das famílias e os aplica no entendimento dos processos de adoecimento e sofrimento?',
      q11: 'Domina a clínica da APS, principais temas e manejo clínico adequado?'
    },
    dim2: {
      q1: 'Dispõe-se, havendo indicação, a realizar visita domiciliar de reconhecimento, seguimento ou busca ativa?',
      q2: 'É permeável ao contato e vínculo com outros equipamentos e representações sociais no território como escolas, igrejas, associações comunitárias, p. ex.?',
      q3: 'Propõe e realiza atividades nos ambientes citados acima?'
    },
    dim3: {
      q1: 'Tem bom vínculo com a equipe de saúde?',
      q2: 'Atua de forma integrada e solidária junto à equipe buscando melhorar o processo de trabalho?',
      q3: 'Compreende a necessidade de fortalecimento e legitimação da equipe junto à comunidade?',
      q4: 'Compreende as limitações do local onde atua e procura adequar suas condutas aos equipamentos, medicamentos e insumos disponíveis sem prejuízo ao tratamento dos pacientes?',
      q5: 'É proativo na coordenação do cuidado, manifestando interesse pelo acompanhamento dos pacientes inclusive com resgate dos faltosos (contato telefônico, envio de mensagem, visita domiciliar p. ex.)?'
    },
    dim4: {
      q1: 'Conhece o sistema de saúde loco-regional, reconhece os diversos pontos de atenção e consegue direcionar os pacientes aos serviços adequados à continuidade do cuidado (integralidade da atenção)?',
      q2: 'Compreende os processos de gestão e gerenciamento como fundamentais para a garantia do melhor cuidado às pessoas incluindo os trabalhadores em saúde (condições e organização do processo de trabalho, remuneração, p. ex.)?',
  q3: 'É capaz de elaborar e ter visão crítica e propositiva sobre as políticas de saúde?'
    }
  };

  fullQuestionText(dimId: string, qId: string): string {
    return this.questionTexts[dimId]?.[qId] || qId;
  }

  // Armazena conjunto global de turnos usados em todas as semanas carregadas
  private globalShiftSet: Set<string> = new Set<string>();
  globalRotationPeriod: string = '—';

  private disciplineCache: any[] = [];
  private lastDisciplineDetail: any = null;

  private alunoCtx = new PreceptorAlunoContextService(); // manual inject fallback (standalone new)
  private alunoChangedHandler = (e: any) => {
    if (this.alunoId) return; // já temos alunoId definido (query ou input)
    const c = this.alunoCtx.getAluno();
    if (c.id) {
      this.alunoId = c.id;
      this.weeks.forEach(w => { w.loaded = false; w.days = []; w.evaluation = null; });
      this.loadWeek(this.selectedWeek.number);
      this.fetchStudentInfo();
    }
  };

  constructor(private auth: AuthService,
              private calApi: CalendarServiceApi,
              private weekSync: WeekSelectionService,
              private route: ActivatedRoute,
              private preceptorService: PreceptorService,
              private coordService: CoordinatorService,
              private router: Router,
              private evalService: EvaluationService,
              private http: HttpClient,
              private disciplineService: DisciplineService,
              private toast: ToastService,
              @Inject(PLATFORM_ID) private platformId: Object) {
    // Guard pós-inicialização: se preceptor/admin e nenhum aluno selecionado (contexto + query), redirecionar
    setTimeout(() => {
      const u = this.auth.getUser();
      if (u && (u.role === 'PRECEPTOR' || u.role === 'ADMIN' || u.role === 'COORDENADOR') && !this.alunoId) {
  const dest = '/home'; // unified home
        const feature = 'relatório';
        this.toast.show('warning', `Por favor selecione um aluno para visualizar o ${feature}.`);
  this.router.navigate([dest]);
      }
    }, 60);
    this.initWeeks();
    this.updatePaginationMode();
    this.ensureGroupForSelected();
    const u = this.auth.getUser();
    if (u?.role === 'COORDENADOR') this.isCoordinator = true;
    // Para evitar exibir o nome do coordenador/preceptor no cabeçalho do relatório,
    // só preenche o nome do cabeçalho com o usuário logado quando o usuário for ALUNO (auto-relatório)
    if (u?.role === 'ALUNO' && u?.name) this.student.name = u.name;
    // Disciplina passa a ser derivada de preference local do aluno (mc_current_discipline_id) ou parâmetro disciplineId quando preceptor.
    this.setupInitialDisciplineContext();
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
    // Se não veio alunoId (query) e contexto global tem aluno selecionado, aplicar (preceptor menu acesso direto)
    if (!this.alunoId) {
      const c = this.alunoCtx.getAluno();
      if (c.id) {
        this.alunoId = c.id;
        this.fetchStudentInfo();
        this.weeks.forEach(w => w.loaded = false);
        this.loadWeek(this.selectedWeek.number);
        this.fetchPreceptorDisciplines();
        if (this.isCoordinator) this.fetchCoordinatorDisciplines();
      }
    }
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('mc:aluno-changed', this.alunoChangedHandler as any);
    }
    // Se já temos alunoId via query params (preceptor) carregar disciplinas vinculadas
    if (this.alunoId) {
      this.fetchPreceptorDisciplines();
      if (this.isCoordinator) this.fetchCoordinatorDisciplines();
      // Carregar avaliação final conforme papel
      if (this.disciplineId) {
        if (this.isCoordinator) {
          this.fetchCoordinatorFinalEval();
        } else {
          const u2 = this.auth.getUser();
          if (u2 && (u2.role === 'PRECEPTOR' || u2.role === 'ADMIN')) {
            this.fetchStaffFinalEval();
          }
        }
      }
    } else {
      // Contexto aluno: buscar avaliação final própria quando já tivermos disciplina
      if (this.isAlunoUser && this.disciplineId) this.fetchMyFinalEval();
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

  private setupInitialDisciplineContext() {
    // Preceptor / admin visualizando aluno: disciplineId já pode vir por @Input ou query param; label será ajustado em fetchStudentInfo
    if (this.alunoId) {
      this.disciplineLabel = 'CURSO DE MEDICINA';
      return;
    }
    // Contexto aluno: tentar carregar preference local
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem('mc_current_discipline_id');
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!Number.isNaN(parsed)) this.disciplineId = parsed;
        }
      } catch {}
    }
    // Se há disciplineId carregada localmente, label será atualizado após primeira carga de semana (metadado retornado) ou via avaliação.
    this.disciplineLabel = 'CURSO DE MEDICINA';
    // Carregar lista das disciplinas do aluno para permitir exibir label imediatamente sem esperar weekPlans
    this.fetchOwnDisciplines();
    // Escuta mudanças de disciplina (evento global disparado pela Home)
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('mc:discipline-changed', this.onDisciplineChanged as any);
    }
    // Buscar metadados detalhados da disciplina (preceptores) se já temos uma id
    if (this.disciplineId) this.fetchDisciplineDetail();
  }

  private fetchOwnDisciplines() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.http.get<any[]>('/api/users/me/disciplines').subscribe({
      next: list => {
        this.disciplineCache = Array.isArray(list) ? list : [];
        this.applyDisciplineLabelFromCache();
      },
      error: _ => { /* silencioso */ }
    });
  }

  private applyDisciplineLabelFromCache() {
    if (!this.disciplineId) return;
    const d = this.disciplineCache.find(x => x.id === this.disciplineId);
    if (d) this.disciplineLabel = `CURSO DE MEDICINA - ${d.code} - ${d.name}`;
  }

  private onDisciplineChanged = (e: any) => {
    if (this.alunoId) return; // ignore se preceptor
    let id: number | undefined = undefined;
    if (e?.detail?.id != null) id = e.detail.id;
    else if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem('mc_current_discipline_id');
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!Number.isNaN(parsed)) id = parsed;
        }
      } catch {}
    }
    this.disciplineId = id;
    // Limpa label até nova resposta chegar
    this.disciplineLabel = 'CURSO DE MEDICINA';
    // Resetar cabeçalho dependente da disciplina para evitar mostrar dados antigos
    this.student.preceptorName = '—';
    this.student.rotationPeriod = '—';
    // Invalida cache das semanas e avaliação para evitar exibir dado da disciplina anterior
    this.weeks.forEach(w => { w.loaded = false; w.evaluation = null; w.days = []; });
    this.evaluationDetails = null;
    // Tenta aplicar label instantâneo caso já esteja em cache
    this.applyDisciplineLabelFromCache();
    // Se ainda não temos a disciplina no cache, refaz fetch
    if (this.disciplineId && !this.disciplineCache.some(d => d.id === this.disciplineId)) {
      this.fetchOwnDisciplines();
    }
    // Carregar detalhes (preceptores) da nova disciplina
    if (this.disciplineId) this.fetchDisciplineDetail();
    // Recarrega semana selecionada (sem atraso) com novo filtro
    this.loadWeek(this.selectedWeek.number);
    // Se aluno, carregar avaliação final própria para a nova disciplina
    if (this.isAlunoUser && this.disciplineId) this.fetchMyFinalEval();
  };

  private fetchStudentInfo() {
    if (!this.alunoId) return;
    const u = this.auth.getUser();
    const source$ = (u?.role === 'COORDENADOR')
      ? this.coordService.studentInfo(this.alunoId!, this.disciplineId)
      : this.preceptorService.studentInfo(this.alunoId!, this.disciplineId);
    source$.subscribe(info => {
      if (info?.name) this.student.name = info.name;
      // Em contexto de preceptor, queremos exibir os preceptores vinculados à disciplina (se houver)
      // Limpa qualquer nome antigo até disciplina detalhada chegar
      this.student.preceptorName = '—';
      // Sempre que a API retornar preceptor principal, aplicar (independente de haver disciplineId)
      if ((info as any)?.preceptor?.name) {
        this.student.preceptorName = (info as any).preceptor.name;
      }
      if (info?.discipline) {
        this.disciplineLabel = `CURSO DE MEDICINA - ${info.discipline.code} - ${info.discipline.name}`;
      } else {
        // Sem disciplina específica: manter curso genérico
        this.disciplineLabel = 'CURSO DE MEDICINA';
      }
      // Sempre buscar detalhes da disciplina quando disciplineId definido para garantir lista de preceptores
      if (this.disciplineId) {
        this.fetchDisciplineDetail();
      }
      // NÃO resetar rotationPeriod aqui: evita sumir valor existente antes de semana recalcular
    });
  }

  private fetchPreceptorDisciplines() {
    if (!isPlatformBrowser(this.platformId)) return;
    // Somente no contexto preceptor visualizando aluno
    const u = this.auth.getUser();
    if (!(u && (u.role === 'PRECEPTOR' || u.role === 'ADMIN') && this.alunoId)) return;
    // Evitar refetch desnecessário se já carregado
    this.preceptorDisciplines = null; // estado carregando
    // ADMIN deve ver TODAS as disciplinas existentes (não apenas as dele)
    if (u.role === 'ADMIN') {
      this.http.get<any[]>('/api/admin/disciplines').subscribe({
        next: list => {
          this.preceptorDisciplines = Array.isArray(list) ? list : [];
          if (this.disciplineId && !this.preceptorDisciplines.some(d => d.id === this.disciplineId)) {
            this.disciplineId = undefined;
          }
          if (!this.disciplineId && this.preceptorDisciplines.length > 0) {
            this.disciplineId = this.preceptorDisciplines[0].id;
            this.resetWeeksAndReload();
          }
        },
        error: _ => { this.preceptorDisciplines = []; }
      });
      return;
    }
    // PRECEPTOR mantém lógica anterior baseada em /api/users/me
    const token = (this.auth as any)?.getToken?.();
    const init: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    fetch('/api/users/me', init)
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (profile && Array.isArray(profile.preceptorDisciplines)) {
          this.preceptorDisciplines = profile.preceptorDisciplines;
        } else {
          this.preceptorDisciplines = [];
        }
        if (this.disciplineId && this.preceptorDisciplines && !this.preceptorDisciplines.some(d => d.id === this.disciplineId)) {
          this.disciplineId = undefined;
        }
        if (!this.disciplineId && this.preceptorDisciplines && this.preceptorDisciplines.length > 0) {
          this.disciplineId = this.preceptorDisciplines[0].id;
          this.resetWeeksAndReload();
        }
      })
      .catch(() => { this.preceptorDisciplines = []; });
  }

  private fetchCoordinatorDisciplines() {
    if (!this.isCoordinator || !this.alunoId) return;
    this.coordinatorDisciplines = null; // loading
    const token = (this.auth as any)?.getToken?.();
    const init: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    fetch('/api/coord/disciplinas', init)
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        if (!Array.isArray(list)) list = [];
        this.coordinatorDisciplines = list;
        // validar disciplina atual
        if (this.disciplineId && !list.some((d: any) => d.id === this.disciplineId)) {
          this.disciplineId = undefined;
        }
        if (!this.disciplineId && list.length > 0) {
          this.disciplineId = list[0].id;
          this.resetWeeksAndReload();
          // Após definir disciplina automaticamente, buscar avaliação final do coordenador
          if (this.alunoId && this.disciplineId) this.fetchCoordinatorFinalEval();
        } else {
          // Mesmo sem mudança, garantir label e avaliação final corretas se disciplinaId já setada
          if (this.disciplineId) {
            this.fetchDisciplineDetail();
            if (this.alunoId) this.fetchCoordinatorFinalEval();
          }
        }
      })
      .catch(() => { this.coordinatorDisciplines = []; });
  }

  setDisciplineForCoordinator(raw: any) {
    const idNum = raw ? Number(raw) : undefined;
    if (idNum && this.coordinatorDisciplines && !this.coordinatorDisciplines.some(d => d.id === idNum)) return;
    if (this.disciplineId === idNum) return;
    this.disciplineId = idNum;
    // Atualiza label imediatamente para evitar atraso visual até respostas assíncronas
    if (this.disciplineId && this.coordinatorDisciplines) {
      const d = this.coordinatorDisciplines.find(cd => cd.id === this.disciplineId);
      if (d && d.code && d.name) {
        this.disciplineLabel = `CURSO DE MEDICINA - ${d.code} - ${d.name}`;
      } else {
        this.disciplineLabel = 'CURSO DE MEDICINA';
      }
    } else {
      this.disciplineLabel = 'CURSO DE MEDICINA';
    }
    this.resetWeeksAndReload();
    const qp: any = { alunoId: this.alunoId };
    if (this.disciplineId) qp.disciplineId = this.disciplineId;
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: 'merge' });
    // Atualizar avaliação final quando disciplina mudar
    if (this.isCoordinator && this.alunoId && this.disciplineId) {
      this.fetchCoordinatorFinalEval();
    } else {
      this.finalEval = { score: null, comment: '', loaded: false, saving: false };
    }
  }

  setDisciplineForPreceptor(raw: any) {
    const idNum = raw ? Number(raw) : undefined;
    if (idNum && this.preceptorDisciplines && !this.preceptorDisciplines.some(d => d.id === idNum)) {
      return; // inválido
    }
    if (this.disciplineId === idNum) return; // nada mudou
    this.disciplineId = idNum;
    this.resetWeeksAndReload();
    // Atualizar query params para compartilhamento de URL
    const qp: any = { alunoId: this.alunoId };
    if (this.disciplineId) qp.disciplineId = this.disciplineId;
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: 'merge' });
    // Atualizar avaliação final (somente leitura) para preceptor/admin
    const u = this.auth.getUser();
    if (!this.isCoordinator && this.alunoId && this.disciplineId && u && (u.role === 'PRECEPTOR' || u.role === 'ADMIN')) {
      this.fetchStaffFinalEval();
    }
  }

  private resetWeeksAndReload() {
    this.weeks.forEach(w => { w.loaded = false; w.days = []; w.evaluation = null; });
    this.evaluationDetails = null;
    this.finalFound = false; // resetar estado de finalização até novo fetch
    this.fetchStudentInfo();
    this.loadWeek(this.selectedWeek.number);
  }

  private fetchCoordinatorFinalEval() {
    if (!this.isCoordinator || !this.alunoId || !this.disciplineId) return;
    this.finalEval.loaded = false;
    this.coordService.getFinalEvaluation(this.alunoId, this.disciplineId).subscribe({
      next: res => {
        if (res && res.found) {
          this.finalEval.score = res.score ?? null;
          this.finalEval.comment = res.comment ?? '';
          this.finalExists = true;
          this.finalFound = true;
          this.finalOriginal = {
            score: this.finalEval.score,
            comment: this.finalEval.comment || ''
          };
        } else {
          this.finalEval.score = null;
          this.finalEval.comment = '';
          this.finalExists = false;
          this.finalFound = false;
          this.finalOriginal = { score: null, comment: '' };
        }
        this.finalEval.loaded = true;
        // Ao recarregar do servidor, saímos do modo de edição
        this.finalEditing = false;
      },
      error: _ => {
        this.finalEval.score = null;
        this.finalEval.comment = '';
        this.finalEval.loaded = true;
        this.finalExists = false;
        this.finalFound = false;
        this.finalOriginal = { score: null, comment: '' };
      }
    });
  }

  openFinalSaveConfirm() {
    if (!this.isCoordinator || !this.alunoId || !this.disciplineId) return;
    // pré-validação simples de faixa
    const s = this.finalEval.score;
    if (s != null && (s < 0 || s > 10)) {
      this.toast.show('warning','A nota deve estar entre 0 e 10.');
      return;
    }
    this.showFinalSaveConfirm = true;
  }

  cancelFinalSave() {
    if (this.finalEval.saving) return;
    this.showFinalSaveConfirm = false;
  }

  confirmFinalSave() {
    if (this.finalEval.saving) return;
    this.saveCoordinatorFinalEval();
  }

  saveCoordinatorFinalEval() {
    if (!this.isCoordinator || !this.alunoId || !this.disciplineId) return;
    if (this.finalEval.saving) return;
    // score opcional (pode ser null), mas se fornecido precisa estar entre 0 e 10
    const s = this.finalEval.score;
    if (s != null && (s < 0 || s > 10)) {
      this.toast.show('warning','A nota deve estar entre 0 e 10.');
      return;
    }
    this.finalEval.saving = true;
    this.coordService.evaluateFinal(this.alunoId, this.disciplineId, s ?? null, this.finalEval.comment || null).subscribe({
      next: _ => {
        this.toast.show('success','Nota enviada com sucesso.');
        this.finalEval.saving = false;
        this.showFinalSaveConfirm = false;
        this.finalEditing = false;
        this.finalExists = true;
        this.finalFound = true;
        // Atualiza snapshot local imediatamente
        this.finalOriginal = {
          score: this.finalEval.score,
          comment: this.finalEval.comment || ''
        };
        // Após salvar, recarrega para garantir consistência
        this.fetchCoordinatorFinalEval();
      },
      error: _ => {
        this.toast.show('error','Falha ao enviar a nota.');
        this.finalEval.saving = false;
      }
    });
  }

  // Valida se a nota final está pronta para envio (inteiro 0..10)
  isFinalScoreValid(): boolean {
    const v = this.finalEval.score;
    if (v === null || v === undefined) return false;
    if (typeof v !== 'number' || Number.isNaN(v)) return false;
    if (!Number.isInteger(v)) return false;
    return v >= 0 && v <= 10;
  }

  startEditFinal() {
    if (!this.isCoordinator || !this.alunoId || !this.disciplineId) return;
    this.finalEditing = true;
  }

  cancelEditFinal() {
    // Recarrega do servidor para descartar alterações locais
    this.fetchCoordinatorFinalEval();
    this.finalEditing = false;
  }

  openFinalDeleteConfirm() {
    if (!this.isCoordinator || !this.alunoId || !this.disciplineId) return;
    this.showFinalDeleteConfirm = true;
  }

  cancelFinalDelete() {
    if (this.deletingFinal) return;
    this.showFinalDeleteConfirm = false;
  }

  confirmFinalDelete() {
    if (this.deletingFinal || !this.isCoordinator || !this.alunoId || !this.disciplineId) return;
    this.deletingFinal = true;
    this.coordService.deleteFinalEvaluation(this.alunoId, this.disciplineId).subscribe({
      next: _ => {
        this.toast.show('success', 'Nota final excluída.');
        this.deletingFinal = false;
        this.showFinalDeleteConfirm = false;
        this.finalEditing = false;
        // Limpa estado local e recarrega
        this.finalEval.score = null;
        this.finalEval.comment = '';
        this.finalExists = false;
        this.finalFound = false;
        this.finalOriginal = { score: null, comment: '' };
        this.fetchCoordinatorFinalEval();
      },
      error: _ => {
        this.toast.show('error', 'Falha ao excluir a nota final.');
        this.deletingFinal = false;
      }
    });
  }

  // Verifica se houve mudança local em relação ao valor persistido
  isFinalDirty(): boolean {
    const curScore = this.finalEval.score;
    const curComment = (this.finalEval.comment || '').trim();
    const origScore = this.finalOriginal.score;
    const origComment = (this.finalOriginal.comment || '').trim();
    const scoreChanged = curScore !== origScore;
    const commentChanged = curComment !== origComment;
    return scoreChanged || commentChanged;
  }

  // Carrega avaliação final própria (contexto ALUNO)
  private fetchMyFinalEval() {
    this.finalEval.loaded = false;
    this.coordService.getMyFinalEvaluation(this.disciplineId).subscribe({
      next: res => {
        if (res && res.found) {
          this.finalEval.score = res.score ?? null;
          this.finalEval.comment = res.comment ?? '';
          this.finalFound = true;
        } else {
          this.finalEval.score = null;
          this.finalEval.comment = '';
          this.finalFound = false;
        }
        this.finalEval.loaded = true;
      },
      error: _ => {
        this.finalEval.score = null;
        this.finalEval.comment = '';
        this.finalEval.loaded = true;
        this.finalFound = false;
      }
    });
  }

  // Carrega avaliação final do coordenador para visualização por PRECEPTOR/ADMIN
  private fetchStaffFinalEval() {
    if (!this.alunoId || !this.disciplineId) return;
    this.finalEval.loaded = false;
    this.preceptorService.finalEvaluation(this.alunoId, this.disciplineId).subscribe({
      next: res => {
        if (res && res.found) {
          this.finalEval.score = (res as any).score ?? null;
          this.finalEval.comment = ((res as any).comment as any) ?? '';
          this.finalFound = true;
        } else {
          this.finalEval.score = null;
          this.finalEval.comment = '';
          this.finalFound = false;
        }
        this.finalEval.loaded = true;
      },
      error: _ => {
        this.finalEval.score = null;
        this.finalEval.comment = '';
        this.finalEval.loaded = true;
        this.finalFound = false;
      }
    });
  }

  // Disciplina é considerada "fechada" quando há avaliação final do coordenador encontrada
  isDisciplineFinalized(): boolean {
    return !!this.finalFound;
  }

  // Impedir caracteres inválidos no campo numérico (ex.: 'e', 'E', '+', '-')
  preventInvalidNumberInput(event: KeyboardEvent) {
    // Para inteiros: também bloquear '.' e ','
    const invalid = ['e','E','+','-','. ', ',', '.'];
    if (invalid.includes(event.key)) {
      event.preventDefault();
      return;
    }
  }

  // Sanitiza digitação/colar: remove caracteres inválidos e atualiza o modelo
  onFinalScoreInput(evt: any) {
    const input = evt?.target as HTMLInputElement;
    if (!input) return;
    // Inteiro: remove expoente/sinais e quaisquer separadores decimais
    const cleaned = input.value.replace(/[eE\+\-]/g, '').replace(/[\.,]/g, '');
    if (cleaned !== input.value) input.value = cleaned;
    let n = parseFloat(cleaned);
    if (isNaN(n)) {
      this.finalEval.score = null;
      return;
    }
    // Clamp imediato 0..10 para evitar valores fora da faixa durante a digitação
    if (n < 0) n = 0;
    if (n > 10) n = 10;
    // Inteiro apenas
    n = Math.round(n);
    this.finalEval.score = n;
    // Reflete o valor clamped no campo (evita exibir >10 visualmente)
    input.value = String(n);
  }

  // Garante faixa 0..10 e força inteiro
  sanitizeFinalScore() {
    let v: any = this.finalEval.score;
    if (typeof v === 'string') v = v.replace(/[\.,]/g, '');
    let n = parseFloat(v);
    if (isNaN(n)) { this.finalEval.score = null; return; }
    if (n < 0) n = 0;
    if (n > 10) n = 10;
    n = Math.round(n); // inteiro
    this.finalEval.score = n;
  }

  // Trata colagem: aceita decimais com vírgula ou ponto, e impede valores fora de faixa
  handleFinalScorePaste(e: ClipboardEvent) {
    const input = e.target as HTMLInputElement;
    const raw = (e.clipboardData?.getData('text') || '').trim();
    if (!raw) return; // deixa esvaziar normalmente
    // Inteiro: remove espaços, expoente, sinais e separadores decimais
    const normalized = raw.replace(/[\s,eE\+\-\.,]/g, '');
    let n = parseFloat(normalized);
    if (isNaN(n)) { e.preventDefault(); return; }
    // clamp 0..10
    if (n < 0) n = 0;
    if (n > 10) n = 10;
    // Inteiro
    n = Math.round(n);
    // aplica no modelo e no input; evita caracteres rejeitados
    this.finalEval.score = n;
    if (input) input.value = String(n);
    e.preventDefault();
  }

  private fetchDisciplineDetail() {
    if (!this.disciplineId) return;
    this.disciplineService.get(this.disciplineId).subscribe({
      next: detail => {
        // Atualiza label padronizado (garante consistência mesmo se outras fontes não vierem)
        if (detail?.code && detail?.name) {
          this.disciplineLabel = `CURSO DE MEDICINA - ${detail.code} - ${detail.name}`;
        }
        // Preencher preceptorName caso esteja vazio e haja preceptores vinculados
        if (detail?.preceptors?.length) {
          // Se houver múltiplos, concatenar
          const names = detail.preceptors.map(p => p.name).filter(Boolean);
          if (names.length) this.student.preceptorName = names.join(', ');
        }
        this.lastDisciplineDetail = detail;
      },
      error: _ => { /* silencioso */ }
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
        return { weekday, date, periods, preceptors: [] };
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
          dayRows.push({ weekday, date: d, periods: [], preceptors: [] });
        }
      }
      // --- FILTRO DE ATIVIDADES (Incompleto/Cumprido ou Justificativa APROVADA) ---
      // Estratégia: consultar status diário via endpoint /calendar/month para os meses abrangidos por esta semana.
      // Limitamos a filtragem em nível de DIA por ausência de metadados de status por turno/intervalo.
      const allDates = dayRows.map(r => r.date.toISOString().substring(0,10));
      const monthKeys = Array.from(new Set(allDates.map(d => d.substring(0,7)))); // YYYY-MM
      const monthCalls = monthKeys.map(key => {
        const [y,m] = key.split('-').map(x => parseInt(x,10));
        return this.calApi.getMonth(y, m, this.alunoId, this.disciplineId).pipe(catchError(() => of(null)));
      });
      if (monthCalls.length === 0) {
        this.applyWeekData(wk, dayRows);
        return;
      }
      forkJoin(monthCalls).subscribe(monthResponses => {
        const statusMap: Record<string,{status:string; justificationStatus?:string}> = {};
        for (const mr of monthResponses) {
          if (!mr || !Array.isArray((mr as any).days)) continue;
            for (const d of (mr as any).days) {
              statusMap[d.date] = { status: d.status, justificationStatus: d.justificationStatus };
            }
        }
        const filtered = dayRows.filter(row => {
          const iso = row.date.toISOString().substring(0,10);
          const st = statusMap[iso];
          if (!st) return false;
          if (st.status === 'YELLOW' || st.status === 'GREEN') return true; // Incompleto ou Cumprido
          if (st.status === 'ORANGE' && st.justificationStatus === 'APPROVED') return true; // Justificativa aprovada
          return false;
        });
        if (filtered.length === 0) { this.applyWeekData(wk, filtered); return; }
        // Buscar sessões (check-ins) no intervalo da semana para mapear preceptores por dia
        const datesIso = filtered.map(r => r.date.toISOString().substring(0,10));
        const startIso = datesIso[0];
        const endIso = datesIso[datesIso.length - 1];
        this.calApi.getSessions(startIso, endIso, this.alunoId, this.disciplineId).subscribe({
          next: (sessions: any[]) => {
            const byDatePreceptors: Record<string, Set<string>> = {};
            // Cache de nomes por id a partir do detalhe da disciplina (se disponível)
            const precIdToName: Record<string,string> = {};
            try {
              const preceptors: any[] = this.lastDisciplineDetail?.preceptors || [];
              for (const p of preceptors) {
                if (p?.id && p?.name) precIdToName[String(p.id)] = p.name;
              }
            } catch {}
            const getDateIso = (s: any): string | undefined => {
              const t = s?.check_in_time || s?.checkInTime || s?.check_in || s?.checkIn || s?.createdAt || s?.date || s?.checkInDate || s?.check_in_date;
              if (typeof t === 'string' && t.length >= 10) return t.substring(0,10);
              return undefined;
            };
            const getPrecName = (s: any): string | undefined => {
              const byName = s?.preceptor?.name || s?.preceptorName || s?.preceptor_name || s?.preceptor_full_name;
              if (byName) return byName;
              const pid = s?.preceptor?.id || s?.preceptorId || s?.preceptor_id;
              if (pid != null && precIdToName[String(pid)]) return precIdToName[String(pid)];
              return undefined;
            };
            for (const s of Array.isArray(sessions) ? sessions : []) {
              const iso = getDateIso(s);
              const name = getPrecName(s);
              if (!iso || !name) continue;
              if (!byDatePreceptors[iso]) byDatePreceptors[iso] = new Set<string>();
              byDatePreceptors[iso].add(name);
            }
            for (const row of filtered) {
              const iso = row.date.toISOString().substring(0,10);
              const set = byDatePreceptors[iso];
              row.preceptors = set ? Array.from(set).sort((a,b)=>a.localeCompare(b)) : [];
            }
            this.applyWeekData(wk, filtered);
          },
          error: _ => {
            // Em caso de erro, prosseguir sem preencher preceptores
            this.applyWeekData(wk, filtered);
          }
        });
      });
    });
  }

  private applyWeekData(wk: WeekData, dayRows: WeekDayRow[]) {
    wk.days = dayRows;
    wk.loaded = true;
    this.updateRotationPeriodSummary(wk);
    if (wk.number === this.selectedWeek.number) {
      this.student.rotationPeriod = wk.rotationPeriod;
    }
    this.loadEvaluationForWeek(wk.number);
    if (this.alunoId) this.fetchStudentInfo();
  }

  private loadEvaluationForWeek(_weekNumberIgnored: number) {
    // Força uso de weekNumber=1 como chave global de avaliação
    const alunoRef = this.alunoId || this.auth.getUser()?.id;
    if (!alunoRef) return;
    this.evalService.get(alunoRef, 1, this.disciplineId).subscribe(res => {
      // Novo formato: { items: [...] }
      let items: any[] = [];
      if (res && Array.isArray(res.items)) {
        items = res.items;
      } else if (res && res.found) {
        // Compatibilidade com formato antigo (única avaliação)
        items = [res];
      }
      const mapped: any[] = [];
      for (const it of items) {
        let parsed: any = null;
        if (it.details) {
          try { parsed = typeof it.details === 'string' ? JSON.parse(it.details) : it.details; } catch { parsed = null; }
        }
        const enriched: any = {
          id: it.id,
          score: it.score,
          comment: it.comment,
          preceptorId: it.preceptorId,
          preceptorName: it.preceptorName
        };
        if (parsed?.dimensions) {
          enriched.details = { dimensions: parsed.dimensions.map((d: any) => {
            const answers = d.answers || {};
            const known = this.questionTexts[d.id] ? Object.keys(this.questionTexts[d.id]) : Object.keys(answers);
            const questions = known
              .filter(qId => answers[qId] != null)
              .map(qId => ({ id: qId, text: this.fullQuestionText(d.id, qId), answer: answers[qId] }));
            return { id: d.id, name: d.id, questions };
          }) };
        }
        mapped.push(enriched);
      }
      this.preceptorEvaluations = mapped;
      // Se ainda não há detalhe selecionado, usar o primeiro como padrão
      if (!this.evaluationDetails && this.preceptorEvaluations.length > 0) {
        this.evaluationDetails = this.preceptorEvaluations[0];
      }
      // Preenche campo legado de score em semanas (não mais exibido diretamente)
      const fallbackScore = this.preceptorEvaluations.length ? this.preceptorEvaluations[0].score : null;
      for (const w of this.weeks) { w.evaluation = fallbackScore; }
    });
  }

  openEvaluationDetails() { this.showEvalModal = true; }
  openEvaluationDetailsFor(item: any) { this.evaluationDetails = item; this.showEvalModal = true; }
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
  // debug temporário (pode remover depois)
  // console.debug('[Report] Semana', week.number, 'period summary =', week.rotationPeriod);
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

  // Indica se o usuário logado é ALUNO (usado para ocultar seletor de disciplinas na visão de relatório)
  get isAlunoUser(): boolean {
    const u = this.auth.getUser();
    return !!u && u.role === 'ALUNO';
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

  // Retorna nomes únicos de preceptores vinculados em uma semana (com base nas presenças da própria semana)
  preceptorsForWeek(week: WeekData | undefined | null): string[] {
    if (!week || !Array.isArray(week.days)) return [];
    const set = new Set<string>();
    for (const d of week.days) {
      if (d?.preceptors?.length) {
        for (const n of d.preceptors) if (n) set.add(n);
      }
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }

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
  get hasGlobalEvaluation(): boolean { return Array.isArray(this.preceptorEvaluations) && this.preceptorEvaluations.length > 0; }

  showDeleteEvalConfirm = false;
  deletingEval = false;

  openDeleteEvaluationConfirm() {
    if (!this.isPreceptorViewingStudent()) return;
    if (!this.hasGlobalEvaluation || !this.evaluationDetails) return;
    this.showDeleteEvalConfirm = true;
  }

  cancelDeleteEvaluation() {
    if (this.deletingEval) return; // evita fechar durante request
    this.showDeleteEvalConfirm = false;
  }

  confirmDeleteEvaluation() {
    if (this.deletingEval) return;
    const alunoRef = this.alunoId || this.auth.getUser()?.id;
    if (!alunoRef) return;
    this.deletingEval = true;
    this.evalService.delete(alunoRef, 1, this.disciplineId).subscribe({
      next: (_res: any) => {
        this.toast.show('success','Avaliação excluída com sucesso.');
        this.evaluationDetails = null;
        this.weeks.forEach(w => w.evaluation = null);
        this.deletingEval = false;
        this.showDeleteEvalConfirm = false;
      },
      error: (_err: any) => {
        this.toast.show('error','Falha ao excluir avaliação.');
        this.deletingEval = false;
      }
    });
  }

  // Geração de PDF consolidando TODAS as semanas + avaliação global (dinâmico / browser only)
  async onGeneratePdf() {
    if (!isPlatformBrowser(this.platformId)) {
      return; // evita executar em ambiente SSR
    }
    // Observação: podemos gerar o PDF mesmo sem avaliação registrada.
    // Se não houver avaliação, apenas as folhas de presença semanais serão exportadas (o formulário final é omitido).
    // Evita múltiplos cliques rápidos
    if (this.generatingPdf) return;
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
    this.generatingPdf = true;
    try {
      await new Promise(r => setTimeout(r, 50));
      const root = this.fullReportRoot?.nativeElement;
      if (!root) { alert('Estrutura completa ainda não pronta para exportar.'); return; }
      let jsPDFMod: any; let html2canvasMod: any;
      try {
        [jsPDFMod, html2canvasMod] = await Promise.all([
          import('jspdf'),
          import('html2canvas')
        ]);
      } catch (e) {
        console.error('Falha ao carregar libs PDF/canvas', e); alert('Erro ao carregar bibliotecas para exportar PDF.'); return; }
      const jsPDF = jsPDFMod.default || jsPDFMod;
      const html2canvas = html2canvasMod.default || html2canvasMod;
      const pdf = new jsPDF('p','pt','a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 20;
      const usableWidth = pageWidth - marginX*2;

    // Selecionar todos os blocos semanais, formulário do preceptor e página final simples
      const blocks: HTMLElement[] = Array.from(root.querySelectorAll('.weekly-sheet')) as HTMLElement[];
      const evalForms = Array.from(root.querySelectorAll('.evaluation-form-print')) as HTMLElement[];
      if (evalForms && evalForms.length) {
        blocks.push(...evalForms);
      }
    const finalSummary = root.querySelector('.final-summary-print') as HTMLElement | null;
    if (finalSummary) blocks.push(finalSummary);

      // Ajustar largura para render (off-screen, sem flicker)
      const originalWidth = root.style.width;
      root.style.width = '1100px';
      for (let i=0;i<blocks.length;i++) {
        const b = blocks[i];
        await new Promise(r => setTimeout(r, 25));
        const canvas = await html2canvas(b, { scale: 2, useCORS: true, backgroundColor:'#ffffff' });
        const imgWidth = usableWidth;
        const imgHeight = canvas.height * (imgWidth / canvas.width);
        if (i>0) pdf.addPage();
        const yStart = 20;
        let drawWidth = imgWidth;
        let drawHeight = imgHeight;
        const maxHeight = pageHeight - 40;
        if (drawHeight > maxHeight) {
          const ratio = maxHeight / drawHeight;
          drawHeight = maxHeight;
          drawWidth = drawWidth * ratio;
        }
        const xCentered = marginX + (usableWidth - drawWidth)/2;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xCentered, yStart, drawWidth, drawHeight, undefined, 'FAST');
      }
      root.style.width = originalWidth;
      // Nome do arquivo: Relatorio_[codigoDisciplina]_[Aluno].pdf
      const label = (this.disciplineLabel || '').trim();
      let code = '';
      const strictMatch = label.match(/\b([A-Za-z]{3,}\d{2,})\b/);
      if (strictMatch) {
        code = strictMatch[1];
      } else {
        const fallbackMatch = label.match(/\b([A-Za-z]{2,}\d{2,})\b/);
        if (fallbackMatch) code = fallbackMatch[1];
      }
      if (!code) code = 'INTERNATO';
      const slug = (v: string) => v
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu,'')
        .replace(/[^A-Za-z0-9_-]/g,'')
        .trim();
      const normCode = slug(code);
      const normAluno = slug(this.student.name.replace(/\s+/g,'_'));
      pdf.save(`Relatorio_${normCode}_${normAluno}.pdf`);
    } finally {
      this.generatingPdf = false;
    }
  }
  
  // Nome simples da disciplina para uso em títulos de impressão
  get disciplineNameOnly(): string {
    try {
      if (this.lastDisciplineDetail?.name) return this.lastDisciplineDetail.name;
      const label = this.disciplineLabel || '';
      const parts = label.split(' - ');
      const last = parts[parts.length - 1]?.trim();
      return last || (label || 'CURSO DE MEDICINA');
    } catch {
      return this.disciplineLabel || 'CURSO DE MEDICINA';
    }
  }
  isPreceptorViewingStudent(): boolean {
    const u = this.auth.getUser();
    // ADMIN não deve avaliar interno: somente PRECEPTOR (e futuramente COORDENADOR se aplicável)
    return !!(u && u.role === 'PRECEPTOR' && this.alunoId);
  }

  shouldShowEvalDetailsButton(): boolean {
    const u = this.auth.getUser();
    if (!u) return false;
    // Mostrar para:
    // - Aluno (sempre pode ver detalhes)
    // - Coordenador visualizando aluno
    // - Admin visualizando aluno
    if (u.role === 'ALUNO') return true;
    if (!this.alunoId) return true; // contexto próprio aluno
    if (u.role === 'COORDENADOR') return true;
    if (u.role === 'ADMIN') return true;
    return false;
  }

  goToEvaluation() {
    // Navega para avaliação global (sem parâmetro de semana)
    const queryParams: any = { alunoId: this.alunoId || '' };
    if (this.disciplineId) queryParams.disciplineId = this.disciplineId;
  this.router.navigate(['/evaluation'], { queryParams });
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('mc:aluno-changed', this.alunoChangedHandler as any);
    }
  }
}
