import { TestBed } from '@angular/core/testing';

import { OtherAircraftService } from './other-aircraft.service';

describe('OtherAircraftService', () => {
  let service: OtherAircraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OtherAircraftService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
