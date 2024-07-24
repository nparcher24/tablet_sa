import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { interval, Subscription } from 'rxjs';
import { Coordinate } from 'ol/coordinate';
import { Point } from 'ol/geom';
import { transform } from 'ol/proj';

@Component({
  selector: 'app-track-info',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <mat-card class="track-info">
      <mat-card-content>
        <p>Bullseye: {{ bearingRange }}</p>
        <p>HDG: {{ heading }}\u00B0</p>
        <p>SPEED: {{speed}} KTS</p>
        <p>Last update: {{ secondsSinceLastUpdate }}s ago</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .track-info {
      z-index: 9999;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px;
      border-radius: 5px;
      max-width: 200px;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    }
  `]
})
export class TrackInfoComponent implements OnInit, OnDestroy {
  @Input() track: any;
  @Input() bullseyePosition: Coordinate | null = null;

  secondsSinceLastUpdate: number = 0;
  bearingRange: string = '';
  speed: number = 0;
  heading: number = 0;
  trackId: string = '';

  private updateSubscription: Subscription | null = null;
  private lastKnownUpdate: number = 0;
  private lastKnownTrack: any = null;

  ngOnInit() {
    this.updateInfo();
    this.updateSubscription = interval(100).subscribe(() => this.updateInfo());
  }

  ngOnDestroy() {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  private updateInfo() {
    if (this.track && this.bullseyePosition) {
      const currentTime = Date.now();

      // Check if the track has been updated
      if (this.track !== this.lastKnownTrack) {
        this.lastKnownUpdate = currentTime;
        this.lastKnownTrack = this.track;
      }

      this.secondsSinceLastUpdate = Math.floor((currentTime - this.lastKnownUpdate) / 1000);

      this.speed = Math.round(this.track.speed);
      this.heading = Math.round(this.track.heading * 180 / Math.PI); // Convert radians to degrees
      this.trackId = this.track.id || 'Unknown';

      // Get the track's coordinates from the geometry
      const trackCoords = (this.track.geometry as Point).getCoordinates();

      // Transform both bullseye and track coordinates to geographic (EPSG:4326)
      const bullseyeGeo = transform(this.bullseyePosition, 'EPSG:3857', 'EPSG:4326');
      const trackGeo = transform(trackCoords, 'EPSG:3857', 'EPSG:4326');

      const [bearing, range] = this.calculateBearingAndRange(bullseyeGeo, trackGeo);
      this.bearingRange = `${bearing.toString().padStart(3, '0')}\u00B0/${range}`;
    } else {
      this.resetInfo();
    }
  }

  private resetInfo() {
    this.bearingRange = 'N/A';
    this.secondsSinceLastUpdate = 0;
    this.speed = 0;
    this.heading = 0;
    this.trackId = 'Unknown';
    this.lastKnownUpdate = 0;
    this.lastKnownTrack = null;
  }

  private calculateBearingAndRange(from: Coordinate, to: Coordinate): [number, number] {


    const R = 6371e3; // Earth's radius in meters
    const φ1 = from[1] * Math.PI / 180;
    const φ2 = to[1] * Math.PI / 180;
    const Δφ = (to[1] - from[1]) * Math.PI / 180;
    const Δλ = (to[0] - from[0]) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const bearing = (θ * 180 / Math.PI + 360) % 360;

    return [Math.round(bearing), Math.round(distance / 1852)]; // Convert meters to nautical miles
  }
}