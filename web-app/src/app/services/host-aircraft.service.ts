import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AircraftData {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
}

@Injectable({
  providedIn: 'root'
})
export class HostAircraftService {
  private webSocket!: WebSocket;
  private lastPosition: [number, number] | null = null;
  private aircraftSubject = new BehaviorSubject<AircraftData | null>(null);

  constructor(private http: HttpClient) {
    this.initWebSocket();
  }

  private initWebSocket() {
    this.webSocket = new WebSocket('ws://localhost:8080');
    this.webSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.updateAircraftData(data);
    };
  }

  private updateAircraftData(data: any) {
    const newPosition: [number, number] = [data.longitude, data.latitude];
    let heading = data.heading;
    let speed = data.speed;

    if (this.lastPosition) {
      heading = this.calculateHeading(this.lastPosition, newPosition);
      speed = this.calculateSpeed(this.lastPosition, newPosition, data.timestamp);
    }

    this.lastPosition = newPosition;

    this.aircraftSubject.next({
      latitude: data.latitude,
      longitude: data.longitude,
      heading,
      speed
    });
  }

  private calculateHeading(from: [number, number], to: [number, number]): number {
    const fromLat = from[1] * Math.PI / 180;
    const fromLon = from[0] * Math.PI / 180;
    const toLat = to[1] * Math.PI / 180;
    const toLon = to[0] * Math.PI / 180;

    const y = Math.sin(toLon - fromLon) * Math.cos(toLat);
    const x = Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLon - fromLon);
    let heading = Math.atan2(y, x);
    heading = heading * 180 / Math.PI; // Convert to degrees
    return (heading + 360) % 360; // Normalize to 0-360
  }

  private calculateSpeed(from: [number, number], to: [number, number], timestamp: string): number {
    // Implement speed calculation based on distance and time difference
    // This is a placeholder and should be replaced with actual calculation
    return 0;
  }

  getAircraftData(): Observable<AircraftData | null> {
    return this.aircraftSubject.asObservable();
  }

  resetPosition() {
    return this.http.post('http://localhost:8090/reset', {}, { responseType: 'json' });
  }
}