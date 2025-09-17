import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaceCaptureComponent } from './face-capture.component';

describe('FaceCaptureComponent', () => {
  let component: FaceCaptureComponent;
  let fixture: ComponentFixture<FaceCaptureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FaceCaptureComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FaceCaptureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
