import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WeekSelectionService {
  // Semana global selecionada (1..10)
  private _week = signal<number>(1);

  get week() { return this._week.asReadonly(); }

  setWeek(n: number) {
    if (n >= 1 && n <= 10) this._week.set(n);
  }
}
