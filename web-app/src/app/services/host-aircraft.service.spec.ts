import { TestBed } from '@angular/core/testing';

import { HostAircraftService } from './host-aircraft.service';

describe('HostAircraftService', () => {
  let service: HostAircraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HostAircraftService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
