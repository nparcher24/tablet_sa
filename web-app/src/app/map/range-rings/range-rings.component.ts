import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Feature, Map } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, LineString, Point } from 'ol/geom';
import { Style, Stroke, Text, Fill, Icon } from 'ol/style';
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

      // Add tick marks for the outer ring
      if (index === 1) {
        for (let i = 0; i < 360; i += 30) { // Tick every 30 degrees
          const radians = (i * Math.PI) / 180;
          const [x, y] = this.hostPosition!;
          const centerPoint = [
            x + Math.cos(radians) * range * 1852,
            y + Math.sin(radians) * range * 1852
          ];
          const tickLength = range * 1852 * 0.04; // 4% of the radius
          const startPoint = [
            centerPoint[0] - Math.cos(radians) * tickLength / 2,
            centerPoint[1] - Math.sin(radians) * tickLength / 2
          ];
          const endPoint = [
            centerPoint[0] + Math.cos(radians) * tickLength / 2,
            centerPoint[1] + Math.sin(radians) * tickLength / 2
          ];
          const tickFeature = new Feature({
            geometry: new LineString([startPoint, endPoint]),
            isTick: true
          });
          source?.addFeature(tickFeature);
        }
      }
    });

    this.addHeadingMarkers(outerRange);

    this.rangeRingsLayer.changed();
    this.map.render();
  }


  private rangeRingStyle(feature: any): Style | Style[] {
    if (feature.get('isHeadingMarker')) {
      return this.headingMarkerStyle(feature);
    }

    if (feature.get('isTick')) {
      return new Style({
        stroke: new Stroke({
          color: 'rgba(255, 255, 255, 0.7)',
          width: 1,
        }),
      });
    }

    const range = feature.get('range');
    const isOuter = feature.get('isOuter');
    const geometry = feature.getGeometry() as Circle;
    const center = geometry.getCenter();
    const radius = geometry.getRadius();

    const angle = Math.PI / 2 - this.rotation;
    const textPosition = [
      center[0] + Math.cos(angle) * radius * 0.9,
      center[1] + Math.sin(angle) * radius * 0.9
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
          textBaseline: 'middle',
          rotation: -this.rotation,
        }),
        geometry: new Point(textPosition)
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
      const feature = new Feature({
        geometry: new Point(endPoint),
        heading: heading,
        isHeadingMarker: true
      });
      source?.addFeature(feature);
    }
  }

  private headingMarkerStyle(feature: any): Style {
    const heading = feature.get('heading');
    const point = feature.getGeometry() as Point;
    const coordinates = point.getCoordinates();

    // Calculate the angle for text rotation and positioning
    const [startX, startY] = this.hostPosition!;
    const [endX, endY] = coordinates;
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);

    // Calculate the distance from center to the tick mark
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate text position (3% further out than the tick mark)
    const textDistance = distance * 1.07;
    const textX = startX + Math.cos(angle) * textDistance;
    const textY = startY + Math.sin(angle) * textDistance;

    return new Style({
      image: new Icon({
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAKCAYAAAB10jRKAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5AoTECERxyh2pwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAFklEQVQI12P4//8/AwMDAwMDAwMDAwAkBgMBvR7jugAAAABJRU5ErkJggg==',
        anchor: [0.5, 1],
        rotateWithView: true,
        rotation: -this.rotation,
        scale: [1, distance * 0.02]  // Scale tick mark to 2% of the radius
      }),
      text: new Text({
        text: heading.toString().padStart(3, '0'),
        font: '12px sans-serif',
        fill: new Fill({ color: 'white' }),
        stroke: new Stroke({ color: 'black', width: 2 }),
        textAlign: 'center',
        textBaseline: 'middle',
      }),
      geometry: new Point([textX, textY])
    });
  }

}