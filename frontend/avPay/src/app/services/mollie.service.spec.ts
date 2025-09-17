import { TestBed } from '@angular/core/testing';

import { MollieService } from './mollie.service';

describe('MollieService', () => {
  let service: MollieService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MollieService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
