import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OtherAircraftData {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
}

@Injectable({
  providedIn: 'root'
})
export class OtherAircraftService {
  private webSocket!: WebSocket;
  private aircraftSubject = new BehaviorSubject<OtherAircraftData[]>([]);

  constructor(private http: HttpClient) {
    this.initWebSocket();
  }

  private initWebSocket() {
    this.webSocket = new WebSocket('ws://localhost:8081');
    this.webSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.updateAircraftData(data);
    };
  }

  private updateAircraftData(data: any[]) {
    const updatedAircraft = data.map(aircraft => ({
      id: aircraft.id,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      heading: (aircraft.heading + 270) % 360, // Adjust heading by 270 degrees
      speed: aircraft.speed
    }));
    this.aircraftSubject.next(updatedAircraft);
  }

  getAircraftData(): Observable<OtherAircraftData[]> {
    return this.aircraftSubject.asObservable();
  }

  resetPositions() {
    return this.http.post('http://localhost:8091/reset', {}, { responseType: 'json' });
  }
}