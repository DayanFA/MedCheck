import { Component, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarServiceApi, CalendarDay, InternshipPlanDto } from '../../services/calendar.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class UserCalendarComponent {
  private api = inject(CalendarServiceApi);
  today = new Date();
  year = signal(this.today.getFullYear());
  month = signal(this.today.getMonth() + 1); // 1-12
  data = signal<{ days: CalendarDay[]; plans:any[]; justifications:any[] }|null>(null);
  loading = signal(false);
  // day history
  selectedDate = signal<string>('');
  sessionsForDay = signal<any[]|null>(null);
  plansForDay = computed(() => {
    const date = this.selectedDate();
    const plans = this.data()?.plans || [];
    return date ? plans.filter((p: any) => p.date === date) : [];
  });

  // plan form
  formDate = signal<string>('');
  formId = signal<number|undefined>(undefined);
  formStart = signal<string>('08:00');
  formEnd = signal<string>('12:00');
  formLocation = signal<string>('');
  formNote = signal<string>('');

  // justification form
  justDate = signal<string>('');
  justReason = signal<string>('');
  justPlanId = signal<number|undefined>(undefined);
  justType = signal<string>('GENERAL');
  existingJust = computed(() => {
    const d = this.selectedDate();
    const js = this.data()?.justifications || [];
    return d ? js.find((j: any) => j.date === d) : undefined;
  });

  weeks = computed(() => {
    const ds = this.data()?.days ?? [];
    const ymFirst = new Date(this.year(), this.month()-1, 1);
    const startDay = ymFirst.getDay() || 7; // 1..7 (Mon..Sun)? We'll keep Sun=0 adjusted -> 7
    const daysInMonth = new Date(this.year(), this.month(), 0).getDate();
    const cells: { date?: string; day?: number; d?: CalendarDay }[] = [];
    for (let i=1; i<startDay; i++) cells.push({});
    for (let d=1; d<=daysInMonth; d++) {
      const iso = `${this.year()}-${String(this.month()).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ date: iso, day: d, d: ds.find(x => x.date === iso) });
    }
    while (cells.length % 7 !== 0) cells.push({});
    const weeks: any[] = [];
    for (let i=0; i<cells.length; i+=7) weeks.push(cells.slice(i, i+7));
    return weeks;
  });

  constructor() {
    this.load();
  }

  pickDate(dateIso: string) {
    if (!dateIso) return;
    // Parse YYYY-MM-DD
    const [y, m, d] = dateIso.split('-').map(Number);
    if (!y || !m || !d) return;
    const prevYear = this.year();
    const prevMonth = this.month();
    // If month/year differ, update and reload, then open day
    if (y !== prevYear || m !== prevMonth) {
      this.year.set(y);
      this.month.set(m);
      // Load month, then open the day after data arrives
      this.loading.set(true);
      this.api.getMonth(y, m).subscribe(res => {
        this.data.set({ days: res.days, plans: res.plans, justifications: res.justifications });
        this.loading.set(false);
        this.openPlan(dateIso);
      }, _ => this.loading.set(false));
    } else {
      // Same month: just open the day
      this.openPlan(dateIso);
    }
  }

  autoGrow(ev: Event) {
    const el = ev.target as HTMLTextAreaElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }

  load() {
    this.loading.set(true);
    this.api.getMonth(this.year(), this.month()).subscribe(res => {
      this.data.set({ days: res.days, plans: res.plans, justifications: res.justifications });
      this.loading.set(false);
    }, _ => this.loading.set(false));
  }

  nextMonth(delta: number) {
    let y = this.year(); let m = this.month() + delta;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    this.year.set(y); this.month.set(m); this.load();
  }

  statusClass(d?: CalendarDay) {
    if (!d) return '';
    switch (d.status) {
      case 'BLUE': return 'status-blue';
      case 'RED': return 'status-red';
      case 'YELLOW': return 'status-yellow';
      case 'GREEN': return 'status-green';
      case 'ORANGE': return 'status-orange';
      default: return '';
    }
  }

  openPlan(dateIso: string) {
    this.formDate.set(dateIso);
    this.formId.set(undefined);
    this.selectedDate.set(dateIso);
    // reset panels state to avoid needing a second click
    this.sessionsForDay.set(null);
    this.justDate.set(dateIso);
    this.formStart.set('08:00');
    this.formEnd.set('12:00');
    this.formLocation.set('');
    this.formNote.set('');
    // load day sessions
    this.loadDaySessions(dateIso);
    // preload justification state if exists
    const ej = this.existingJust();
    if (ej) {
      this.justType.set(ej.type || 'GENERAL');
      this.justReason.set(ej.reason || '');
      this.justPlanId.set(ej.planId);
    } else {
      this.justType.set('GENERAL');
      this.justReason.set('');
      this.justPlanId.set(undefined);
    }
  }

  savePlan() {
    const payload: InternshipPlanDto = {
      id: this.formId(),
      date: this.formDate(),
      startTime: this.formStart(),
      endTime: this.formEnd(),
      location: this.formLocation(),
      note: this.formNote() || undefined,
    };
    this.api.upsertPlan(payload).subscribe((resp: any) => {
      const saved = resp?.plan || payload;
      const cur = this.data();
      if (cur) {
        const plans = [...(cur.plans || [])];
        const idx = plans.findIndex((p: any) => p.id === saved.id);
        if (idx >= 0) plans[idx] = saved; else plans.push(saved);
        this.data.set({ ...cur, plans });
      }
      this.formId.set(undefined);
      // Optional: reload from server to stay consistent
      this.load();
    });
  }

  editPlan(p: any) {
    this.formDate.set(p.date);
    this.formId.set(p.id);
    this.formStart.set(p.startTime);
    this.formEnd.set(p.endTime);
    this.formLocation.set(p.location || '');
    this.formNote.set(p.note || '');
  }

  deletePlan(id: number) {
    this.api.deletePlan(id).subscribe(() => {
      const cur = this.data();
      if (cur) {
        const plans = (cur.plans || []).filter((p: any) => p.id !== id);
        this.data.set({ ...cur, plans });
      }
      // Optional: reload to confirm server state
      this.load();
    });
  }

  refreshDay() {
    const d = this.selectedDate();
    if (!d) return;
    // Recarrega mês (plano/justificativa/status) e as sessões do dia
    this.load();
    this.loadDaySessions(d);
  }

  openJustify(dateIso: string, planId?: number) {
    this.justDate.set(dateIso);
    const ej = this.existingJust();
    if (ej) {
      // edit existing
      this.justType.set(ej.type || 'GENERAL');
      this.justReason.set(ej.reason || '');
      this.justPlanId.set(ej.planId);
    } else {
      this.justType.set('GENERAL');
      this.justReason.set('');
      this.justPlanId.set(planId);
    }
  }

  saveJustify() {
    this.api.justify({ date: this.justDate(), planId: this.justPlanId(), type: this.justType(), reason: this.justReason() })
      .subscribe(() => this.load());
  }

  deleteJustify(j: any) {
    if (j?.status !== 'PENDING') return; // guard
    const ok = typeof window !== 'undefined' ? window.confirm('Excluir justificativa?') : true;
    if (!ok) return;
    const dateIso = this.selectedDate();
    if (dateIso) {
      this.api.deleteJustificationByDate(dateIso).subscribe(() => this.load());
    } else if (j?.id) {
      this.api.deleteJustification(j.id).subscribe(() => this.load());
    }
  }

  private loadDaySessions(dateIso: string) {
    // backend expects start/end as YYYY-MM-DD
    this.api.getSessions(dateIso, dateIso).subscribe(list => {
      this.sessionsForDay.set(list);
    });
  }
}
