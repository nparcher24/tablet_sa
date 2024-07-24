import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Feature, Map } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, LineString } from 'ol/geom';
import { Style, Stroke, Text, Fill } from 'ol/style';
import { Coordinate } from 'ol/coordinate';
import { FeatureLike } from 'ol/Feature';

@Component({
  selector: 'app-range-rings',
  standalone: true,
  imports: [CommonModule],
  template: '',
  styles: []
})
export class RangeRingsComponent implements OnChanges, OnInit {
  @Input() map!: Map;
  @Input() hostPosition!: Coordinate;
  @Input() rotation!: number;
  @Input() rangeRings: number[] = [2, 5, 10, 20, 50, 100, 200, 500, 1000];

  private rangeRingsLayer!: VectorLayer<FeatureLike>;

  ngOnInit() {
    if (this.map) {
      this.map.getView().on('change:resolution', () => this.updateRangeRings());
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['map'] && changes['map'].firstChange) {
      this.initializeLayer();
    }
    if (changes['hostPosition'] || changes['rotation']) {
      this.updateRangeRings();
    }
  }

  private initializeLayer() {
    this.rangeRingsLayer = new VectorLayer({
      source: new VectorSource(),
      style: (feature) => this.rangeRingStyle(feature),
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    this.map.addLayer(this.rangeRingsLayer);
  }

  private updateRangeRings() {
    if (!this.hostPosition) return;

    const view = this.map.getView();
    const extent = view.calculateExtent(this.map.getSize());
    const [minLon, minLat, maxLon, maxLat] = extent;

    const widthMeters = Math.sqrt(Math.pow(maxLon - minLon, 2) + Math.pow(maxLat - minLat, 2));
    const widthNM = widthMeters / 1852;

    const outerRange = this.rangeRings.find(range => range > widthNM / 7) || this.rangeRings[this.rangeRings.length - 1];
    const innerRange = outerRange / 2;

    const source = this.rangeRingsLayer.getSource();
    source?.clear();

    [innerRange, outerRange].forEach((range, index) => {
      const circle = new Circle(this.hostPosition!, range * 1852);
      const feature = new Feature({
        geometry: circle,
        range: range,
        isOuter: index === 1
      });
      source?.addFeature(feature);
    });

    this.addHeadingMarkers(outerRange);

    this.rangeRingsLayer.changed();
    this.map.render();
  }


  private rangeRingStyle(feature: any): Style | Style[] {
    if (feature.get('isHeadingMarker')) {
      return this.headingMarkerStyle(feature);
    }

    const range = feature.get('range');
    const isOuter = feature.get('isOuter');
    const geometry = feature.getGeometry() as Circle;
    const center = geometry.getCenter();
    const radius = geometry.getRadius();

    const angle = Math.PI / 2 - this.rotation;
    const textPosition = [
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius
    ];

    return [
      new Style({
        stroke: new Stroke({
          color: 'rgba(255, 255, 255, 0.5)',
          width: isOuter ? 2 : 1,
        }),
      }),
      new Style({
        text: new Text({
          text: `${range} nm`,
          font: '12px sans-serif',
          fill: new Fill({ color: 'white' }),
          stroke: new Stroke({ color: 'black', width: 2 }),
          textAlign: 'center',
          textBaseline: 'bottom',
          offsetY: -5,
        }),
        geometry: new Circle(textPosition, 0)
      })
    ];
  }

  private addHeadingMarkers(range: number) {
    const source = this.rangeRingsLayer.getSource();
    for (let heading = 0; heading < 360; heading += 30) {
      const radians = (90 - heading) * Math.PI / 180;  // Adjust to start from North
      const [x, y] = this.hostPosition!;
      const endPoint = [
        x + Math.cos(radians) * range * 1852,
        y + Math.sin(radians) * range * 1852
      ];
      const line = new LineString([this.hostPosition!, endPoint]);
      const feature = new Feature({
        geometry: line,
        heading: heading,
        isHeadingMarker: true
      });
      source?.addFeature(feature);
    }
  }
  private headingMarkerStyle(feature: any): Style {
    const heading = feature.get('heading');
    const line = feature.getGeometry() as LineString;
    const endPoint = line.getLastCoordinate();

    // Calculate the angle for text rotation
    const [startX, startY] = this.hostPosition!;
    const [endX, endY] = endPoint;
    const dx = endX - startX;
    const dy = endY - startY;

    // Calculate the angle in radians, then convert to degrees
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Adjust the angle to match the heading orientation
    angleDeg = (180 - angleDeg) % 360;

    return new Style({
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.5)',
        width: 1,
      }),
      text: new Text({
        text: heading.toString().padStart(3, '0'),
        font: '12px sans-serif',
        fill: new Fill({ color: 'white' }),
        stroke: new Stroke({ color: 'black', width: 2 }),
        textAlign: 'center',
        textBaseline: 'bottom',
        rotation: (angleDeg * Math.PI) / 180,  // Convert back to radians for rotation
        offsetY: -5,
      }),
      geometry: new Circle(endPoint, 0)
    });
  }

}