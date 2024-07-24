import { TestBed } from '@angular/core/testing';

import { BullseyeService } from './bullseye.service';

describe('BullseyeService', () => {
  let service: BullseyeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BullseyeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
