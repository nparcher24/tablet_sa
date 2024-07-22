import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { AircraftGenerator, AircraftData } from './aircraft-generator';
import { environment } from '../../environments/environment';
export interface HostAircraftData {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
}

@Injectable({
  providedIn: 'root'
})
export class HostAircraftService {
  private webSocket: WebSocket | null = null;
  private aircraftSubject = new BehaviorSubject<HostAircraftData | null>(null);

  constructor(
    private http: HttpClient,
    private aircraftGenerator: AircraftGenerator
  ) {
    if (environment.useLocalGenerator) {
      timer(0, 100).subscribe(() => this.updateLocalAircraftData());
    } else {
      this.initWebSocket();
    }
  }

  private initWebSocket() {
    this.webSocket = new WebSocket(environment.hostAircraftWsUrl);
    this.webSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.updateAircraftData(data);
    };
  }

  private updateLocalAircraftData() {
    const allAircraft = this.aircraftGenerator.getData();
    const hostAircraft = allAircraft.find(a => a.id === 'host');
    if (hostAircraft) {
      this.updateAircraftData(hostAircraft);
    }
  }

  private updateAircraftData(data: any) {
    this.aircraftSubject.next({
      latitude: data.latitude || data.lat,
      longitude: data.longitude || data.lon,
      heading: data.heading,
      speed: data.speed
    });
  }

  getAircraftData(): Observable<HostAircraftData | null> {
    return this.aircraftSubject.asObservable();
  }

  resetPosition() {
    if (environment.useLocalGenerator) {
      this.aircraftGenerator.reset();
      return new Observable(observer => {
        observer.next({ message: "Host aircraft position reset" });
        observer.complete();
      });
    } else {
      return this.http.post(environment.hostAircraftResetUrl, {}, { responseType: 'json' });
    }
  }
}