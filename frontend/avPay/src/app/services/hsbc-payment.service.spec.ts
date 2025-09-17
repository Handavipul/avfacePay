import { TestBed } from '@angular/core/testing';

import { HsbcPaymentService } from './hsbc-payment.service';

describe('HsbcPaymentService', () => {
  let service: HsbcPaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HsbcPaymentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
