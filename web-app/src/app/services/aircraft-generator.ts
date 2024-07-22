import { Injectable } from '@angular/core';

export interface AircraftData {
    id: string;
    lat: number;
    lon: number;
    alt: number;
    speed: number;
    heading: number;
}

@Injectable({
    providedIn: 'root'
})
export class AircraftGenerator {
    private aircraft: AircraftData[];
    private lastHostUpdateTime: number;
    private lastOtherUpdateTime: number;
    private readonly hostUpdateInterval: number = 100; // 10Hz
    private readonly otherUpdateInterval: number = 1000; // 1Hz
    private readonly turnRate: number = 3 / 36; // 3 degrees per second, adjusted for 10Hz

    constructor() {
        this.aircraft = this.initAircraft();
        this.lastHostUpdateTime = performance.now();
        this.lastOtherUpdateTime = performance.now();
    }

    private initAircraft(): AircraftData[] {
        const host: AircraftData = {
            id: 'host',
            lat: 36.8529,
            lon: -76.9214,
            alt: 25000,
            speed: 347.5, // 400 MPH converted to knots
            heading: 270
        };

        return [
            host,
            ...Array.from({ length: 50 }, (_, i) => ({
                id: `AC${i + 1}`,
                lat: host.lat + (Math.random() - 0.5) * 12,
                lon: host.lon + (Math.random() - 0.5) * 12,
                alt: Math.floor(Math.random() * 35000) + 5000,
                speed: Math.floor(Math.random() * 173.75) + 173.75, // 200-400 MPH converted to knots
                heading: Math.floor(Math.random() * 360)
            }))
        ];
    }

    private updateAircraft(aircraft: AircraftData, elapsedSeconds: number): void {
        // Convert speed from knots to degrees per second
        // 1 knot = 1 nautical mile per hour = 1/60 nautical mile per minute = 1/3600 nautical mile per second
        // 1 nautical mile = 1/60 degree of latitude
        const speedDegPerSec = aircraft.speed / 3600 / 60;

        const headingRad = aircraft.heading * Math.PI / 180;
        const latRad = aircraft.lat * Math.PI / 180;

        // Update latitude
        aircraft.lat += speedDegPerSec * elapsedSeconds * Math.cos(headingRad);

        // Update longitude
        // The cos(latRad) factor adjusts for the fact that longitude lines converge at the poles
        aircraft.lon += (speedDegPerSec * elapsedSeconds * Math.sin(headingRad)) / Math.cos(latRad);

        // Normalize longitude to [-180, 180]
        aircraft.lon = ((aircraft.lon + 180) % 360) - 180;

        if (aircraft.id === 'host') {
            aircraft.heading = (aircraft.heading - this.turnRate * elapsedSeconds + 360) % 360;
        } else if (Math.random() < 0.005 * elapsedSeconds) { // Adjust for elapsed time
            aircraft.heading = (aircraft.heading + Math.random() * 60 - 30 + 360) % 360;
        }
    }

    getData(): AircraftData[] {
        const currentTime = performance.now();
        const hostElapsedTime = currentTime - this.lastHostUpdateTime;
        const otherElapsedTime = currentTime - this.lastOtherUpdateTime;

        if (hostElapsedTime >= this.hostUpdateInterval) {
            const hostElapsedSeconds = hostElapsedTime / 1000;
            const hostAircraft = this.aircraft.find(a => a.id === 'host');
            if (hostAircraft) {
                this.updateAircraft(hostAircraft, hostElapsedSeconds);
            }
            this.lastHostUpdateTime = currentTime;
        }

        if (otherElapsedTime >= this.otherUpdateInterval) {
            const otherElapsedSeconds = otherElapsedTime / 1000;
            this.aircraft.filter(a => a.id !== 'host').forEach(aircraft => {
                this.updateAircraft(aircraft, otherElapsedSeconds);
            });
            this.lastOtherUpdateTime = currentTime;
        }

        return this.aircraft;
    }

    reset(): void {
        this.aircraft = this.initAircraft();
        this.lastHostUpdateTime = performance.now();
        this.lastOtherUpdateTime = performance.now();
    }
}