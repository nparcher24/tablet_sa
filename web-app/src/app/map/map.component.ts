import { Component, OnInit, OnDestroy } from '@angular/core';
import { Map, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { defaults as defaultControls } from 'ol/control';
import { Style, Icon, Stroke, Fill } from 'ol/style';
import { CommonModule } from '@angular/common';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Geometry } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import { easeOut } from 'ol/easing';



import { Subscription } from 'rxjs';
import { AircraftData, HostAircraftService } from '../services/host-aircraft.service';
import { OtherAircraftData, OtherAircraftService } from '../services/other-aircraft.service';
import { unByKey } from 'ol/Observable';
import BaseEvent from 'ol/events/Event';
import { Coordinate } from 'ol/coordinate';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: '<div id="map" class="map"></div>',
  styles: [
    `
    .map {
      width: 100%;
      height: 100vh;
      background-color: #000033; /* Dark blue background for oceans */
    }
    `
  ]
})
export class MapComponent implements OnInit, OnDestroy {
  private map!: Map;
  private vectorLayer!: VectorLayer<Feature<Geometry>>;
  private hostAircraftLayer!: VectorLayer<Feature<Geometry>>;
  private otherAircraftLayer!: VectorLayer<Feature<Geometry>>;
  private hostSubscription!: Subscription;
  private otherSubscription!: Subscription;
  private firstHostUpdate = true;
  private lastHostPosition: Coordinate | null = null;
  private lastHostHeading: number | null = null;
  private hostFeature: Feature<Point> | null = null;

  constructor(
    private hostAircraftService: HostAircraftService,
    private otherAircraftService: OtherAircraftService
  ) { }

  ngOnInit() {
    this.resetPositions()
    this.initMap();
    this.subscribeToAircraftData();
  }

  ngOnDestroy() {
    this.hostSubscription.unsubscribe();
    this.otherSubscription.unsubscribe();
  }

  private initMap() {
    const vectorSource110m = new VectorSource({
      url: 'assets/maps/ne_110m_admin_0_countries.json',
      format: new GeoJSON(),
    });

    this.vectorLayer = new VectorLayer({
      source: vectorSource110m,
      renderBuffer: 10000,
      style: new Style({
        stroke: new Stroke({
          color: 'gray',
          width: 1,
        }),
        fill: new Fill({
          color: 'black',
        }),
      }),
    });

    this.map = new Map({
      target: 'map',
      layers: [this.vectorLayer],
      controls: defaultControls({
        attribution: false,
        rotate: false,
        zoom: false,
      }),
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
    });

    this.hostAircraftLayer = new VectorLayer({
      source: new VectorSource()
    });
    this.otherAircraftLayer = new VectorLayer({
      source: new VectorSource()
    });

    this.map.addLayer(this.hostAircraftLayer);
    this.map.addLayer(this.otherAircraftLayer);
  }

  private subscribeToAircraftData() {
    this.hostSubscription = this.hostAircraftService.getAircraftData().subscribe(data => {
      if (data) {
        this.updateHostAircraft(data);
      }
    });

    this.otherSubscription = this.otherAircraftService.getAircraftData().subscribe(data => {
      this.updateOtherAircraft(data);
    });
  }

  // private updateHostAircraft(data: AircraftData) {
  //   const source = this.hostAircraftLayer.getSource()!;
  //   source.clear();
  //   const feature = new Feature({
  //     geometry: new Point(fromLonLat([data.longitude, data.latitude]))
  //   });
  //   feature.setStyle(new Style({
  //     image: new Icon({
  //       src: 'assets/host-aircraft.svg',
  //       scale: 0.5,
  //       rotation: data.heading * Math.PI / 180
  //     })
  //   }));
  //   source.addFeature(feature);

  //   // Center map on host aircraft only for the first update
  //   if (this.firstHostUpdate) {
  //     this.map.getView().setCenter(fromLonLat([data.longitude, data.latitude]));
  //     this.map.getView().setZoom(7);
  //     this.firstHostUpdate = false;
  //   }
  // }

  private updateHostAircraft(data: AircraftData) {
    const source = this.hostAircraftLayer.getSource()!;
    const newPosition = fromLonLat([data.longitude, data.latitude]);

    if (!this.hostFeature) {
      this.hostFeature = new Feature(new Point(newPosition));
      this.hostFeature.setStyle(new Style({
        image: new Icon({
          src: 'assets/host-aircraft.svg',
          scale: 0.5,
          rotation: data.heading * Math.PI / 180
        })
      }));
      source.addFeature(this.hostFeature);
      this.lastHostPosition = newPosition;
      this.lastHostHeading = data.heading;
    } else {
      const startPosition = this.lastHostPosition!;
      const startHeading = this.lastHostHeading!;
      const endPosition = newPosition;
      const endHeading = data.heading;
      const duration = 1000; // Duration of animation in milliseconds
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const fraction = Math.min(elapsed / duration, 1);

        // Interpolate position
        const lon = startPosition[0] + fraction * (endPosition[0] - startPosition[0]);
        const lat = startPosition[1] + fraction * (endPosition[1] - startPosition[1]);
        (this.hostFeature!.getGeometry() as Point).setCoordinates([lon, lat]);

        // Interpolate heading
        let headingDiff = endHeading - startHeading;
        // Ensure we rotate the shorter way around
        if (headingDiff > 180) headingDiff -= 360;
        if (headingDiff < -180) headingDiff += 360;
        const currentHeading = startHeading + fraction * headingDiff;

        const style = this.hostFeature!.getStyle() as Style;
        (style.getImage() as Icon).setRotation(currentHeading * Math.PI / 180);

        if (fraction < 1) {
          requestAnimationFrame(animate);
        } else {
          this.lastHostPosition = endPosition;
          this.lastHostHeading = endHeading;
        }
        this.map.render();
      };

      requestAnimationFrame(animate);
    }

    // Center map on host aircraft only for the first update
    if (this.firstHostUpdate) {
      this.map.getView().setCenter(newPosition);
      this.map.getView().setZoom(7);
      this.firstHostUpdate = false;
    }
  }

  // private updateOtherAircraft(data: OtherAircraftData[]) {
  //   const source = this.otherAircraftLayer.getSource()!;
  //   source.clear();
  //   data.forEach(aircraft => {
  //     const feature = new Feature({
  //       geometry: new Point(fromLonLat([aircraft.longitude, aircraft.latitude]))
  //     });
  //     feature.setStyle(new Style({
  //       image: new Icon({
  //         src: 'assets/other-aircraft.svg',
  //         scale: 0.3,
  //         rotation: aircraft.heading * Math.PI / 180
  //       })
  //     }));
  //     source.addFeature(feature);
  //   });
  // }

  private updateOtherAircraft(data: OtherAircraftData[]) {
    const source = this.otherAircraftLayer.getSource()!;
    data.forEach(aircraft => {
      const id = `aircraft-${aircraft.id}`;
      let feature = source.getFeatureById(id) as Feature<Point> | null;
      if (!feature) {
        feature = new Feature(new Point(fromLonLat([aircraft.longitude, aircraft.latitude])));
        feature.setId(id);
        feature.setStyle(new Style({
          image: new Icon({
            src: 'assets/other-aircraft.svg',
            scale: 0.3,
            rotation: aircraft.heading * Math.PI / 180
          })
        }));
        source.addFeature(feature);
      } else {
        const geometry = feature.getGeometry() as Point;
        const start = geometry.getCoordinates();
        const end = fromLonLat([aircraft.longitude, aircraft.latitude]);
        const duration = 1000; // Duration of animation in milliseconds
        const startTime = performance.now();

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const fraction = Math.min(elapsed / duration, 1);
          const lon = start[0] + fraction * (end[0] - start[0]);
          const lat = start[1] + fraction * (end[1] - start[1]);
          geometry.setCoordinates([lon, lat]);

          const style = feature!.getStyle();
          if (style instanceof Style) {
            const image = style.getImage();
            if (image instanceof Icon) {
              image.setRotation(aircraft.heading * Math.PI / 180);
            }
          }

          if (fraction < 1) {
            requestAnimationFrame(animate);
          }
          this.map.render();
        };

        requestAnimationFrame(animate);
      }
    });
  }

  resetPositions() {
    this.hostAircraftService.resetPosition().subscribe(() => {
      console.log('Host aircraft reset');
    });
    this.otherAircraftService.resetPositions().subscribe(() => {
      console.log('Other aircraft reset');
    });
  }
}