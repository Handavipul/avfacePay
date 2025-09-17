import { TestBed } from '@angular/core/testing';

import { FallbackService } from './fallback.service';

describe('FallbackService', () => {
  let service: FallbackService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FallbackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
