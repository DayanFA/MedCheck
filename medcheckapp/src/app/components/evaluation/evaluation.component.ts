import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EvaluationService } from '../../services/evaluation.service';
import { PreceptorService } from '../../services/preceptor.service';

interface DimensionDef { id: string; title: string; questions: { id: string; text: string }[]; }

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './evaluation.component.html',
  styleUrls: ['./evaluation.component.scss']
})
export class EvaluationComponent {
  alunoId!: number; disciplineId?: number; // avaliação global única
  loading = signal(true);
  saving = signal(false);
  score: number | null = null;
  comment = '';
  preloaded = false;
  studentName = '—';
  preceptorName = '—';
  disciplineLabel = 'CCSD459 - Internato em Medicina de Família e Comunidade';
  rotationPeriod: string = '—';
  // Removidas semanas: avaliação não segmentada por week.

  // Escala 1..5 - emojis
  faces = [ '😞','🙁','😐','🙂','😃' ];

  dimensions: DimensionDef[] = [
    { id: 'dim1', title: 'Dimensão 1: Clínica da APS', questions: [
      { id: 'q1', text: 'Atua com empatia e busca criar vínculo com as pessoas?' },
      { id: 'q2', text: 'Utiliza o tempo de forma adequada no atendimento às necessidades apresentadas?' },
      { id: 'q3', text: 'Sabe conduzir a entrevista clínica abordando os diversos problemas relatados?' },
      { id: 'q4', text: 'Sabe conduzir o exame clínico com base nas informações da entrevista?' },
      { id: 'q5', text: 'Busca a compreensão do processo de adoecimento de forma ampla?' },
      { id: 'q6', text: 'Oportuniza contato para explorar condições de vida e saúde de membros da família?' },
      { id: 'q7', text: 'Estabelece diálogo acessível à compreensão dos pacientes?' },
      { id: 'q8', text: 'Dedica-se à explicação detalhada da condição de saúde acolhendo dúvidas?' },
      { id: 'q9', text: 'Confecciona lista de problemas com propostas de encaminhamentos?' },
      { id: 'q10', text: 'Compreende os ciclos de vida das famílias e aplica no entendimento do adoecimento?' },
      { id: 'q11', text: 'Domina a clínica da APS, principais temas e manejo clínico adequado?' }
    ] },
    { id: 'dim2', title: 'Dimensão 2: Atuação comunitária', questions: [
      { id: 'q1', text: 'Dispõe-se, havendo indicação, a realizar visita domiciliar de reconhecimento, seguimento ou busca ativa?' },
      { id: 'q2', text: 'É permeável ao contato e vínculo com outros equipamentos e representações sociais no território (escolas, igrejas, associações comunitárias etc.)?' },
      { id: 'q3', text: 'Propõe e realiza atividades nos ambientes comunitários citados (escolas, associações, espaços coletivos)?' }
    ] },
    { id: 'dim3', title: 'Dimensão 3: Vínculo com a equipe e processo de trabalho', questions: [
      { id: 'q1', text: 'Tem bom vínculo com a equipe de saúde?' },
      { id: 'q2', text: 'Atua de forma integrada e solidária junto à equipe buscando melhorar o processo de trabalho?' },
      { id: 'q3', text: 'Compreende a necessidade de fortalecimento e legitimação da equipe junto à comunidade?' },
      { id: 'q4', text: 'Compreende as limitações do local onde atua e procura adequar suas condutas aos recursos disponíveis sem prejuízo ao tratamento?' },
      { id: 'q5', text: 'É proativo na coordenação do cuidado (acompanhamento, resgate de faltosos por telefone, mensagem ou visita domiciliar)?' },
      { id: 'q6', text: 'Frequenta todas as atividades programadas com assiduidade?' },
      { id: 'q7', text: 'Chega e sai nos horários adequados, cumprindo sua carga horária?' },
      { id: 'q8', text: 'Mostra pró-atividade na resolução dos problemas do serviço?' },
      { id: 'q9', text: 'Desenvolve as tarefas determinadas pela preceptoria diariamente, demonstrando comprometimento com a rotina da equipe?' },
      { id: 'q10', text: 'Traz aspectos novos e contribuições criativas para as soluções de problemas da equipe ou dos pacientes?' }
    ] },
    { id: 'dim4', title: 'Dimensão 4: Conhecimento sobre o sistema de saúde e políticas públicas', questions: [
      { id: 'q1', text: 'Conhece o sistema de saúde loco-regional, reconhece os diversos pontos de atenção e direciona os pacientes adequadamente (integralidade)?' },
      { id: 'q2', text: 'Compreende processos de gestão e gerenciamento como fundamentais para garantir melhor cuidado às pessoas e trabalhadores (organização, condições de trabalho, remuneração)?' },
      { id: 'q3', text: 'É capaz de elaborar e ter visão crítica e propositiva sobre as políticas de saúde?' },
      { id: 'q4', text: 'Busca continuamente conhecimentos teóricos para aprimorar o cuidado?' },
      { id: 'q5', text: 'Estuda diariamente as patologias dos casos sob sua responsabilidade?' },
      { id: 'q6', text: 'Estuda os artigos e materiais indicados pela preceptoria?' },
      { id: 'q7', text: 'Estuda e realiza com afinco os procedimentos médicos necessários ao tratamento de seus pacientes?' }
    ] }
  ];

  activeDimIndex = signal(0);
  answers = signal<Record<string, Record<string, number>>>({}); // dimensionId -> { qId:score }
  private draftSaveTimer: any;
  private activeDimFromDraft = false;
  private autoAdvancedDims = new Set<string>();

  constructor(private route: ActivatedRoute,
              private evalApi: EvaluationService,
              private preceptorService: PreceptorService,
              private router: Router) {
    this.route.queryParamMap.subscribe(p => {
      this.alunoId = Number(p.get('alunoId'));
      const d = p.get('disciplineId');
      this.disciplineId = d ? Number(d) : undefined;
      this.loadDraft();
      this.loadStudentInfo();
      this.fetchExisting();
      this.loadRotationPeriod();
    });
  }

  setFace(dimId: string, qId: string, score: number) {
    const cur = { ...this.answers() };
    cur[dimId] = { ...(cur[dimId]||{}) , [qId]: score };
    this.answers.set(cur);
    this.saveDraftDebounced();
    // Auto-avançar se completou dimensão atual e não é a última
    const idx = this.activeDimIndex();
    const dim = this.dimensions[idx];
    if (this.dimensionComplete(idx) && !this.isLastDim() && dim && !this.autoAdvancedDims.has(dim.id)) {
      this.autoAdvancedDims.add(dim.id);
      setTimeout(() => {
        if (this.activeDimIndex() === idx) this.nextDim();
      }, 120);
    }
  }

  setActiveDim(i: number) {
    if (i < 0 || i >= this.dimensions.length) return;
    // Bloquear navegar para dimensão futura se anteriores não completas
    for (let idx = 0; idx < i; idx++) {
      if (!this.dimensionComplete(idx)) return;
    }
    this.activeDimIndex.set(i);
  }

  faceSelected(dimId: string, qId: string, idx: number) {
    const cur = this.answers();
    return cur[dimId] && cur[dimId][qId] === (idx+1);
  }

  fetchExisting() {
    if (!this.alunoId) return;
    this.loading.set(true);
    this.evalApi.get(this.alunoId, 1, this.disciplineId).subscribe(res => {
      if (res && res.found) {
        this.preloaded = true;
        if (res.score !== undefined && res.score !== null) this.score = res.score;
        if (res.comment) this.comment = res.comment;
        if (res.details) {
          try {
            const parsed = typeof res.details === 'string' ? JSON.parse(res.details) : res.details;
            if (parsed?.dimensions) {
              const map: Record<string, Record<string, number>> = {};
              for (const d of parsed.dimensions) map[d.id] = d.answers || {};
              this.answers.set(map);
            }
          } catch { /* ignore */ }
        }
        // Merge com draft local (caso tenhamos adicionado novas dimensões após primeira submissão)
        this.mergeDraftAnswers();
      }
      this.loading.set(false);
    }, _ => this.loading.set(false));
  }

  dimensionComplete(idx: number): boolean {
    const dim = this.dimensions[idx];
    if (!dim) return false;
    const a = this.answers()[dim.id] || {};
    return !dim.questions.some(q => a[q.id] == null);
  }

  allDimensionsComplete(): boolean {
    return this.dimensions.every((_, i) => this.dimensionComplete(i));
  }

  completedCount(): number { return this.dimensions.filter((_,i)=> this.dimensionComplete(i)).length; }
  progressPercent(): number { return Math.round((this.completedCount() / this.dimensions.length) * 100); }

  dimensionProgressTooltip(i: number): string {
    const dim = this.dimensions[i];
    if (!dim) return '';
    const a = this.answers()[dim.id] || {};
    const answered = dim.questions.filter(q => a[q.id] != null).length;
    return `${answered}/${dim.questions.length} questões` + (this.dimensionComplete(i) ? ' (completa)' : '');
  }

  isLastDim(): boolean { return this.activeDimIndex() === this.dimensions.length - 1; }

  canGoNext(): boolean { return this.dimensionComplete(this.activeDimIndex()); }

  canSubmit(): boolean {
    if (!this.isLastDim()) return false;
    if (this.saving()) return false;
    if (!this.allDimensionsComplete()) return false;
    if (this.score == null || this.score < 0 || this.score > 10) return false;
    return true;
  }

  nextDim() {
    if (!this.canGoNext()) return;
    if (!this.isLastDim()) {
      this.activeDimIndex.set(this.activeDimIndex() + 1);
    }
  }

  submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    const details = { dimensions: this.dimensions.map(d => ({ id: d.id, answers: this.answers()[d.id] || {} })) };
    this.evalApi.save({ alunoId: this.alunoId, weekNumber: 1, disciplineId: this.disciplineId, score: this.score!, comment: this.comment, details }).subscribe(_ => {
      this.saving.set(false);
      this.clearDraft();
      // voltar ao relatório
  this.router.navigate(['/report'], { queryParams: { alunoId: this.alunoId, disciplineId: this.disciplineId }, state: { refreshEval: true, ts: Date.now() } });
    }, _ => this.saving.set(false));
  }

  private loadStudentInfo() {
    if (!this.alunoId) return;
    this.preceptorService.studentInfo(this.alunoId, this.disciplineId).subscribe(info => {
      if (info?.name) this.studentName = info.name;
      if (info?.preceptor?.name) this.preceptorName = info.preceptor.name;
      if (info?.discipline) {
        this.disciplineLabel = `${info.discipline.code} - ${info.discipline.name}`;
      }
    });
  }

  // Removidas funções de seleção/paginação de semanas.

  // ===== Cálculo Período do Rodízio =====
  private loadRotationPeriod() {
    if (!this.alunoId) { this.rotationPeriod = '—'; return; }
    const used = new Set<string>();
    const order = ['Manhã','Tarde','Noite'];
    let currentWeek = 1;
    const loadWeek = () => {
      if (currentWeek > 10) {
        const list = order.filter(o => used.has(o));
        this.rotationPeriod = list.length ? list.join(', ') : '—';
        return;
      }
      this.preceptorService.weekReport(currentWeek, this.alunoId, this.disciplineId).subscribe(res => {
        const plans = res?.plans || [];
        for (const p of plans) {
          if (p.startTime) used.add(this.classifyShift(p.startTime));
        }
        currentWeek++;
        loadWeek();
      }, _ => { currentWeek++; loadWeek(); });
    };
    loadWeek();
  }

  private classifyShift(startTime: string): 'Manhã'|'Tarde'|'Noite' {
    const [hStr, mStr] = startTime.split(':');
    const h = parseInt(hStr, 10); const m = parseInt(mStr||'0',10);
    const minutes = h*60 + m;
    if (minutes >= 4*60 && minutes <= 12*60 + 59) return 'Manhã';
    if (minutes >= 13*60 && minutes <= 17*60 + 59) return 'Tarde';
    return 'Noite';
  }

  // ===== Persistência local (draft) =====
  private draftKey(): string {
    const aluno = this.alunoId || 0;
    const disc = this.disciplineId || 0;
    return `evalDraft:${aluno}:${disc}:GLOBAL`;
  }

  private saveDraftDebounced() {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => this.saveDraft(), 300);
  }

  private saveDraft() {
    try {
      const payload = {
        answers: this.answers(),
        score: this.score,
        comment: this.comment,
        activeDim: this.activeDimIndex()
      };
      localStorage.setItem(this.draftKey(), JSON.stringify(payload));
    } catch { /* ignore quota errors */ }
  }

  private loadDraft() {
    try {
      const raw = localStorage.getItem(this.draftKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.answers) this.answers.set(parsed.answers);
      if (parsed.score != null) this.score = parsed.score;
      if (parsed.comment) this.comment = parsed.comment;
      if (parsed.activeDim != null && parsed.activeDim >=0 && parsed.activeDim < this.dimensions.length) {
        this.activeDimIndex.set(parsed.activeDim);
        this.activeDimFromDraft = true;
      }
    } catch { /* ignore */ }
  }

  private clearDraft() {
    try { localStorage.removeItem(this.draftKey()); } catch { /* ignore */ }
  }

  private mergeDraftAnswers() {
    try {
      const raw = localStorage.getItem(this.draftKey());
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.answers) return;
      const merged = { ...this.answers() };
      let changed = false;
      for (const dimId of Object.keys(draft.answers)) {
        const draftDim = draft.answers[dimId] || {};
        merged[dimId] = { ...(merged[dimId] || {}) };
        for (const qId of Object.keys(draftDim)) {
          if (merged[dimId][qId] == null) {
            merged[dimId][qId] = draftDim[qId];
            changed = true;
          }
        }
      }
      if (changed) {
        this.answers.set(merged);
        this.saveDraft(); // atualizar draft com merge
      }
      // Se não havia activeDim salvo no draft, calcular última dimensão tocada
      if (!this.activeDimFromDraft) this.selectLastTouchedDimension();
    } catch { /* ignore */ }
  }

  private selectLastTouchedDimension() {
    const ans = this.answers();
    let last = 0;
    this.dimensions.forEach((dim, idx) => {
      const dimAns = ans[dim.id] || {};
      // Tocada se existe pelo menos uma resposta
      if (Object.keys(dimAns).length > 0) last = idx;
    });
    this.activeDimIndex.set(last);
  }
}
