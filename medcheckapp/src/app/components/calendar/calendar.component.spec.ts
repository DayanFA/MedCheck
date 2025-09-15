import { TestBed } from '@angular/core/testing';
import { UserCalendarComponent } from './calendar.component';
import { CalendarServiceApi } from '../../services/calendar.service';

describe('UserCalendarComponent (unit)', () => {
  beforeEach(() => {
    const apiMock = {
      getMonth: () => ({ subscribe: (fn: any) => fn({ days: [], plans: [], justifications: [] }) })
    } as unknown as CalendarServiceApi;
    TestBed.configureTestingModule({
      imports: [UserCalendarComponent],
      providers: [{ provide: CalendarServiceApi, useValue: apiMock }]
    });
  });

  it('maps status to css class', () => {
    const fixture = TestBed.createComponent(UserCalendarComponent);
    const comp = fixture.componentInstance;
    const map: Record<string, string> = {
      BLUE: 'status-blue', RED: 'status-red', YELLOW: 'status-yellow', GREEN: 'status-green', ORANGE: 'status-orange'
    };
    for (const [status, cls] of Object.entries(map)) {
      const result = comp.statusClass({ date: '2024-01-01', plannedSeconds: 0, workedSeconds: 0, status } as any);
      expect(result).toBe(cls);
    }
    expect(comp.statusClass(undefined as any)).toBe('');
  });
});
