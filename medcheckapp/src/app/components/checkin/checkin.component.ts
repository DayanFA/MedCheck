import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckInService } from '../../services/checkin.service';
import { todayAcreISODate } from '../../util/date-utils';
import { LocationModalComponent } from '../location-modal/location-modal.component';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationModalComponent],
  templateUrl: './checkin.component.html',
  styleUrl: './checkin.component.scss'
})
export class CheckInComponent implements OnInit {
  code = '';
  preceptorId: number | null = null;
  history: any[] = [];
  message = '';
  loadingHistory = false;
  submitting = false;
  disciplineName?: string;
  disciplines: { id:number; code?:string; name?:string; hours?:number; ciclo?:number }[] = [];
  private LOCAL_DISC_KEY = 'mc_current_discipline_id';
  disciplineId: number | undefined; // público para binding no template
  // Última localização capturada (apenas para debug visual se quisermos mostrar no futuro)
  lastLat: number | null = null;
  lastLng: number | null = null;
  locating = false;
  showLocModal = false;
  modalLat: number | null = null;
  modalLng: number | null = null;
  checkingOut = false;

  constructor(private check: CheckInService) {}

  ngOnInit(): void {
    this.readDisciplineFromLocal();
    window.addEventListener('mc:discipline-changed', this.onDisciplineChanged as any);
    this.loadDisciplines();
    this.resolveDisciplineName();
    this.loadHistory();
  }

  private onDisciplineChanged = (e: CustomEvent) => {
    if (e?.detail?.id != null) {
      this.disciplineId = e.detail.id;
    } else {
      this.readDisciplineFromLocal();
    }
    this.resolveDisciplineName();
    this.loadHistory();
  };

  private readDisciplineFromLocal() {
    try {
      const stored = localStorage.getItem(this.LOCAL_DISC_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        this.disciplineId = Number.isNaN(parsed) ? undefined : parsed;
      } else {
        this.disciplineId = undefined;
      }
    } catch { this.disciplineId = undefined; }
  }

  private resolveDisciplineName() {
    // Estratégia simples: se houver cache em outra parte poderíamos injetar um serviço.
    // Agora monta rótulo codificado (code - name) com fallbacks.
    if (this.disciplineId) {
      const found = this.disciplines.find(d => d.id === this.disciplineId);
      if (found) {
        const parts = [] as string[];
        if (found.code) parts.push(found.code);
        if (found.name) parts.push(found.name);
        this.disciplineName = parts.length ? parts.join(' - ') : `ID ${this.disciplineId}`;
      } else {
        this.disciplineName = `ID ${this.disciplineId}`;
      }
    } else {
      this.disciplineName = undefined;
    }
  }

  private loadDisciplines() {
    this.check.myDisciplines().subscribe({
      next: (list) => {
        this.disciplines = list || [];
        // Se não houver disciplina selecionada ainda, selecionar a primeira
        if (!this.disciplineId && this.disciplines.length) {
          this.setDiscipline(this.disciplines[0].id, false);
        } else {
          // garantir que a atual ainda existe; se não, escolher primeira
          if (this.disciplineId && !this.disciplines.some(d => d.id === this.disciplineId)) {
            if (this.disciplines.length) this.setDiscipline(this.disciplines[0].id, false);
            else this.setDiscipline(undefined, false);
          }
        }
        this.resolveDisciplineName();
      },
      error: _ => {}
    });
  }

  onSelectDiscipline(ev: Event) {
    const val = (ev.target as HTMLSelectElement).value;
    const id = val ? parseInt(val,10) : undefined;
    this.setDiscipline(id, true);
  }

  private setDiscipline(id: number | undefined, fireEvent: boolean) {
    this.disciplineId = id;
    if (id != null) localStorage.setItem(this.LOCAL_DISC_KEY, String(id)); else localStorage.removeItem(this.LOCAL_DISC_KEY);
    if (fireEvent) {
      window.dispatchEvent(new CustomEvent('mc:discipline-changed', { detail: { id } }));
    }
    this.resolveDisciplineName();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    try { window.removeEventListener('mc:discipline-changed', this.onDisciplineChanged as any); } catch {}
  }

  // Lista de histórico já formatada para exibição (nome do preceptor e duração)
  get historyProcessed() {
    return (this.history || []).map(h => {
      // Nome do preceptor (somente nome; sem fallback para ID)
      const preceptorName = h?.preceptor?.name || h?.preceptorName || h?.preceptor_name || h?.preceptor_full_name;
      let worked: string | undefined;
      if (h?.checkInTime && h?.checkOutTime) {
        try {
          const start = new Date(h.checkInTime).getTime();
          const end = new Date(h.checkOutTime).getTime();
          if (end > start) {
            const diff = Math.floor((end - start) / 1000);
            const hh = Math.floor(diff / 3600);
            const mm = Math.floor((diff % 3600) / 60);
            worked = hh ? `${hh}h ${mm.toString().padStart(2,'0')}m` : `${mm}m`;
          }
        } catch {}
      }
      return { ...h, _preceptorDisplay: preceptorName, _workedDisplay: worked };
    });
  }

  submit() {
    if (!this.disciplineId) { this.message = 'Selecione uma disciplina na Home antes.'; return; }
    if (!this.preceptorId || !this.code) { this.message = 'Informe ID do preceptor e código.'; return; }
    const normCode = this.code.trim().toUpperCase();
    if (!normCode) { this.message = 'Código inválido.'; return; }
    this.submitting = true;
    this.message = 'Capturando localização...';
    this.getLocation(3500).then(coords => {
      const { lat, lng } = coords || { lat: null, lng: null };
      this.lastLat = lat; this.lastLng = lng;
      this.message = 'Validando...';
      this.check.checkIn(this.preceptorId!, normCode, this.disciplineId, lat, lng).subscribe({
        next: _ => { this.message = 'Check-In realizado'; this.code = ''; this.loadHistory(); },
        error: err => { this.message = err?.error?.error || 'Falha ao validar'; },
        complete: () => { this.submitting = false; }
      });
    }).catch(_ => {
      // Falha silenciosa (perm denied / timeout) -> envia sem coordenadas
      this.message = 'Validando (sem localização)...';
      this.check.checkIn(this.preceptorId!, normCode, this.disciplineId).subscribe({
        next: _ => { this.message = 'Check-In realizado'; this.code = ''; this.loadHistory(); },
        error: err => { this.message = err?.error?.error || 'Falha ao validar'; },
        complete: () => { this.submitting = false; }
      });
    });
  }

  loadHistory() {
    this.loadingHistory = true;
  const today = todayAcreISODate();
    this.check.sessions(today, today, this.disciplineId).subscribe({
      next: list => { this.history = list; this.loadingHistory = false; },
      error: _ => { this.loadingHistory = false; }
    });
  }

  openLocation(lat?: number|null, lng?: number|null) {
    if (lat == null || lng == null) return;
    this.modalLat = lat; this.modalLng = lng; this.showLocModal = true;
  }
  closeLocationModal() { this.showLocModal = false; }

  doCheckout() {
    this.checkingOut = true;
    this.message = 'Capturando localização para Check-Out...';
    this.getLocation(3500).then(coords => {
      const { lat, lng } = coords || { lat: null, lng: null };
      this.lastLat = lat; this.lastLng = lng;
      this.message = 'Enviando Check-Out...';
      this.check.checkOut(lat, lng).subscribe({
        next: _ => { this.message = 'Check-Out realizado'; this.loadHistory(); },
        error: err => { this.message = err?.error?.error || 'Falha no Check-Out'; },
        complete: () => { this.checkingOut = false; }
      });
    }).catch(_ => {
      this.message = 'Enviando Check-Out (sem localização)...';
      this.check.checkOut().subscribe({
        next: _ => { this.message = 'Check-Out realizado'; this.loadHistory(); },
        error: err => { this.message = err?.error?.error || 'Falha no Check-Out'; },
        complete: () => { this.checkingOut = false; }
      });
    });
  }

  /** Obtém a localização atual (timeout curto) retornando null se indisponível */
  private getLocation(timeoutMs: number): Promise<{lat:number; lng:number}|null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
    this.locating = true;
    return new Promise(resolve => {
      const done = (val: {lat:number; lng:number}|null) => { this.locating = false; resolve(val); };
      let finished = false;
      const timer = setTimeout(() => { if (!finished) { finished = true; done(null); } }, timeoutMs);
      try {
        navigator.geolocation.getCurrentPosition(pos => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
            const lat = +(pos.coords.latitude.toFixed(7));
            const lng = +(pos.coords.longitude.toFixed(7));
          done({ lat, lng });
        }, _err => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          done(null);
        }, { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10000 });
      } catch {
        if (!finished) { finished = true; clearTimeout(timer); done(null); }
      }
    });
  }
}
