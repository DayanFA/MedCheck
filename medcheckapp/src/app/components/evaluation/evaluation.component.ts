import { Component, signal, computed, effect } from '@angular/core';
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
  alunoId!: number; week!: number; disciplineId?: number;
  loading = signal(true);
  saving = signal(false);
  score: number | null = null;
  comment = '';
  preloaded = false;

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
    ] }
  ];

  activeDimIndex = signal(0);
  answers = signal<Record<string, Record<string, number>>>({}); // dimensionId -> { qId:score }

  constructor(private route: ActivatedRoute,
              private evalApi: EvaluationService,
              private preceptorService: PreceptorService,
              private router: Router) {
    this.route.queryParamMap.subscribe(p => {
      this.alunoId = Number(p.get('alunoId'));
      this.week = Number(p.get('week'));
      const d = p.get('disciplineId');
      this.disciplineId = d ? Number(d) : undefined;
      this.fetchExisting();
    });
  }

  setFace(dimId: string, qId: string, score: number) {
    const cur = { ...this.answers() };
    cur[dimId] = { ...(cur[dimId]||{}) , [qId]: score };
    this.answers.set(cur);
  }

  faceSelected(dimId: string, qId: string, idx: number) {
    const cur = this.answers();
    return cur[dimId] && cur[dimId][qId] === (idx+1);
  }

  fetchExisting() {
    if (!this.alunoId || !this.week) return;
    this.loading.set(true);
    this.evalApi.get(this.alunoId, this.week, this.disciplineId).subscribe(res => {
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
      }
      this.loading.set(false);
    }, _ => this.loading.set(false));
  }

  canSubmit(): boolean {
    if (this.saving()) return false;
    if (this.score == null || this.score < 0 || this.score > 10) return false;
    // exige todas perguntas respondidas da dimensão ativa? ou todas? Vamos exigir todas da lista para protótipo
    for (const dim of this.dimensions) {
      const a = this.answers()[dim.id] || {};
      if (dim.questions.some(q => a[q.id] == null)) return false;
    }
    return true;
  }

  submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    const details = { dimensions: this.dimensions.map(d => ({ id: d.id, answers: this.answers()[d.id] || {} })) };
    this.evalApi.save({ alunoId: this.alunoId, weekNumber: this.week, disciplineId: this.disciplineId, score: this.score!, comment: this.comment, details }).subscribe(_ => {
      this.saving.set(false);
      // voltar ao relatório
      this.router.navigate(['/relatorio'], { queryParams: { alunoId: this.alunoId, disciplineId: this.disciplineId } });
    }, _ => this.saving.set(false));
  }
}
