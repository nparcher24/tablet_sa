import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { AircraftGenerator, AircraftData } from './aircraft-generator';
import { environment } from '../../environments/environment';
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
  private webSocket: WebSocket | null = null;
  private aircraftSubject = new BehaviorSubject<OtherAircraftData[]>([]);
  private breadcrumbCount = 0;
  private breadcrumbMap = new Map<string, [number, number][]>();
  private lastUpdateTime = 0;

  constructor(
    private http: HttpClient,
    private aircraftGenerator: AircraftGenerator
  ) {
    if (environment.useLocalGenerator) {
      timer(0, 1000).subscribe(() => this.updateLocalAircraftData());
    } else {
      this.initWebSocket();
    }
  }

  private initWebSocket() {
    this.webSocket = new WebSocket(environment.otherAircraftWsUrl);
    this.webSocket.onmessage = (event) => {
      const currentTime = Date.now();
      if (currentTime - this.lastUpdateTime >= 1000) {
        const data = JSON.parse(event.data);
        this.updateAircraftData(data);
        this.lastUpdateTime = currentTime;
      }
    };
  }

  private updateLocalAircraftData() {
    const allAircraft = this.aircraftGenerator.getData();
    const otherAircraft = allAircraft.filter(a => a.id !== 'host');
    this.updateAircraftData(otherAircraft);
  }


  private updateAircraftData(data: any[]) {
    const updatedAircraft: OtherAircraftData[] = data.map(aircraft => {
      const newPosition: [number, number] = [aircraft.longitude || aircraft.lon, aircraft.latitude || aircraft.lat];
      let breadcrumbs = this.breadcrumbMap.get(aircraft.id) || [];
      breadcrumbs = [newPosition, ...breadcrumbs.slice(0, this.breadcrumbCount - 1)];
      this.breadcrumbMap.set(aircraft.id, breadcrumbs);

      return {
        id: aircraft.id,
        latitude: aircraft.latitude || aircraft.lat,
        longitude: aircraft.longitude || aircraft.lon,
        heading: aircraft.heading,
        speed: aircraft.speed,
        breadcrumbs
      };
    });

    this.aircraftSubject.next(updatedAircraft);
  }

  setBreadcrumbCount(count: number) {
    this.breadcrumbCount = count;
    if (count === 0) {
      this.breadcrumbMap.clear();
    } else {
      this.breadcrumbMap.forEach((breadcrumbs, id) => {
        this.breadcrumbMap.set(id, breadcrumbs.slice(0, count));
      });
    }
  }

  getAircraftData(): Observable<OtherAircraftData[]> {
    return this.aircraftSubject.asObservable();
  }

  resetPositions() {
    if (environment.useLocalGenerator) {
      this.aircraftGenerator.reset();
      this.breadcrumbMap.clear();
      return new Observable(observer => {
        observer.next({ message: "Other aircraft positions reset" });
        observer.complete();
      });
    } else {
      return this.http.post(environment.otherAircraftResetUrl, {}, { responseType: 'json' });
    }
  }
}