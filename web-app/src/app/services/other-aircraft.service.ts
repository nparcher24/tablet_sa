import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OtherAircraftData {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  breadcrumbs: [number, number][];
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

  private breadcrumbCount = 0;

  private updateAircraftData(data: any[]) {
    const updatedAircraft: OtherAircraftData[] = data.map(aircraft => {
      const newPosition: [number, number] = [aircraft.longitude, aircraft.latitude];
      const existingAircraft = this.aircraftSubject.getValue().find(a => a.id === aircraft.id);
      let breadcrumbs: [number, number][] = [newPosition];

      if (existingAircraft && existingAircraft.breadcrumbs) {
        breadcrumbs = [newPosition, ...existingAircraft.breadcrumbs.slice(0, this.breadcrumbCount - 1)];
      }

      // console.log(`Aircraft ${aircraft.id}: Breadcrumbs count = ${breadcrumbs.length}, Breadcrumb limit = ${this.breadcrumbCount}`);

      return {
        id: aircraft.id,
        latitude: aircraft.latitude,
        longitude: aircraft.longitude,
        heading: (aircraft.heading + 270) % 360,
        speed: aircraft.speed,
        breadcrumbs
      };
    });

    this.aircraftSubject.next(updatedAircraft);
  }

  setBreadcrumbCount(count: number) {
    this.breadcrumbCount = count;
  }

  getAircraftData(): Observable<OtherAircraftData[]> {
    return this.aircraftSubject.asObservable();
  }

  resetPositions() {
    return this.http.post('http://localhost:8091/reset', {}, { responseType: 'json' });
  }
}