import { TestBed } from '@angular/core/testing';

import { HsbcCardProcessorService } from './hsbc-card-processor.service';

describe('HsbcCardProcessorService', () => {
  let service: HsbcCardProcessorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HsbcCardProcessorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
