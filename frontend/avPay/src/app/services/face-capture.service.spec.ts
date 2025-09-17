import { TestBed } from '@angular/core/testing';

import { FaceCaptureService } from './face-capture.service';

describe('FaceCaptureService', () => {
  let service: FaceCaptureService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceCaptureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
