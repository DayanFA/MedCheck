import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternHomeComponent } from './intern-home.component';

describe('InternHomeComponent', () => {
  let component: InternHomeComponent;
  let fixture: ComponentFixture<InternHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternHomeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InternHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
