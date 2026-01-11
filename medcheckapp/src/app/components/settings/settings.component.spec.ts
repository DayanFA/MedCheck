import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should compute phoneDigitsCount correctly', () => {
    component.phone = '(11) 99999-0000';
    expect(component.phoneDigitsCount).toBe(11);
    component.phone = '(11) 9999-0000';
    expect(component.phoneDigitsCount).toBe(10);
    component.phone = '';
    expect(component.phoneDigitsCount).toBe(0);
  });

  it('should block save when phone is empty', () => {
    component.phone = '';
    component.save();
    // No HTTP call should be made
    httpMock.expectNone('/api/users/me');
    expect(component.msg).toContain('Informe um telefone válido');
  });

  it('should send digits-only phone on save', () => {
    // Simulate me() call on init
    const reqMe = httpMock.expectOne('/api/auth/me');
    reqMe.flush({ phone: '11987654321', hasAvatar: false });

    component.phone = '(11) 98765-4321';
    component.save();

    const req = httpMock.expectOne('/api/users/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.phone).toBe('11987654321');
    req.flush({ ok: true });
  });
});
