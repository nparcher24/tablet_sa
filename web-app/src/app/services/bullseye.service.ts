import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BullseyeService {
  private bullseyeUpdatedSource = new Subject<void>();
  bullseyeUpdated$ = this.bullseyeUpdatedSource.asObservable();

  notifyBullseyeUpdated() {
    this.bullseyeUpdatedSource.next();
  }
}