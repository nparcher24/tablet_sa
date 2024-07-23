import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RangeRingsComponent } from './range-rings.component';

describe('RangeRingsComponent', () => {
  let component: RangeRingsComponent;
  let fixture: ComponentFixture<RangeRingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RangeRingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RangeRingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
