
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Map as OLMap, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { defaults as defaultControls } from 'ol/control';
import { Style, Icon, Stroke, Fill } from 'ol/style';
import { CommonModule } from '@angular/common';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Geometry } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { Subscription } from 'rxjs';
import { AircraftData, HostAircraftService } from '../services/host-aircraft.service';
import { OtherAircraftData, OtherAircraftService } from '../services/other-aircraft.service';
import { Coordinate } from 'ol/coordinate';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';


enum CenteringMode {
  None,
  Center,
  CenterWithHeading
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  private map!: OLMap;
  private vectorLayer!: VectorLayer<Feature<Geometry>>;
  private hostAircraftLayer!: VectorLayer<Feature<Geometry>>;
  private otherAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private hostSubscription!: Subscription;
  private otherSubscription!: Subscription;
  private firstHostUpdate = true;
  private lastHostPosition: Coordinate | null = null;
  private lastHostHeading: number | null = null;
  private hostFeature: Feature<Point> | null = null;
  public isCentered: boolean = true;
  private centeringMode: CenteringMode = CenteringMode.CenterWithHeading;
  public centeringIcon: string = 'navigation';

  constructor(
    private hostAircraftService: HostAircraftService,
    private otherAircraftService: OtherAircraftService
  ) { }

  ngOnInit() {
    this.resetPositions();
    this.initMap();
    this.subscribeToAircraftData();
  }

  ngOnDestroy() {
    this.hostSubscription.unsubscribe();
    this.otherSubscription.unsubscribe();
  }

  private initMap() {

    let previousZoom = -1; // Holds the previous zoom level

    const vectorSource110m = new VectorSource({
      url: 'assets/maps/ne_110m_admin_0_countries.json',
      format: new GeoJSON(),
    });

    const vectorSource50m = new VectorSource({
      url: 'assets/maps/ne_50m_admin_0_countries.json',
      format: new GeoJSON(),
    });

    const vectorSource10m = new VectorSource({
      url: 'assets/maps/ne_10m_admin_0_countries.json',
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

    this.map = new OLMap({
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

    this.map.on('postrender', () => {
      if (this.hostFeature) {
        const mapRotation = this.map.getView().getRotation();
        const style = this.hostFeature.getStyle() as Style;
        (style.getImage() as Icon).setRotation(this.lastHostHeading! * Math.PI / 180 + mapRotation);
        this.map.render();
      }
    });

    // Add event listener for when the map stops moving
    this.map.on('moveend', () => {

      const currentZoom = this.map.getView().getZoom();

      if (currentZoom !== previousZoom) {
        previousZoom = currentZoom!;

        // Determine which resolution to show based on the zoom level
        if (currentZoom! <= 6) {
          this.vectorLayer.setSource(vectorSource110m);
        } else if (currentZoom! > 6 && currentZoom! <= 10) {
          this.vectorLayer.setSource(vectorSource50m);
        } else if (currentZoom! > 10) {
          this.vectorLayer.setSource(vectorSource10m);
        }
      }
    });

    this.hostAircraftLayer = new VectorLayer({
      source: new VectorSource(),
    });

    this.map.addLayer(this.hostAircraftLayer);


    this.otherAircraftLayer = new WebGLPointsLayer({
      source: new VectorSource(),
      style: {
        'icon-src': 'assets/other-aircraft.svg',
        'icon-width': 25,
        'icon-height': 25,
        'icon-size': ['interpolate', ['linear'], ['get', 'size'], 0, 0, 20, 28],
        'icon-rotate-with-view': true,
        'icon-rotation': ['get', 'heading'],  // This line sets the rotation
        'icon-displacement': [0, 9],
      },
      disableHitDetection: true,
    });

    this.map.addLayer(this.otherAircraftLayer);


    // Ensure WebGL is initialized
    this.map.once('postrender', () => {
      this.map.renderSync();
    });
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

  private updateHostAircraft(data: AircraftData) {
    const source = this.hostAircraftLayer.getSource()!;
    const newPosition = fromLonLat([data.longitude, data.latitude]);

    if (!this.hostFeature) {
      this.hostFeature = new Feature(new Point(newPosition));
      this.hostFeature.setStyle(new Style({
        image: new Icon({
          src: 'assets/host-aircraft.svg',
          scale: 0.5,
          rotation: 0  // We'll update this in the animation
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
      const duration = 100;
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
        if (headingDiff > 180) headingDiff -= 360;
        if (headingDiff < -180) headingDiff += 360;
        const currentHeading = startHeading + fraction * headingDiff;

        // Update icon rotation based on current heading and map rotation
        const mapRotation = this.map.getView().getRotation();
        const style = this.hostFeature!.getStyle() as Style;
        (style.getImage() as Icon).setRotation(currentHeading * Math.PI / 180 + mapRotation);

        if (fraction < 1) {
          requestAnimationFrame(animate);
        } else {
          this.lastHostPosition = endPosition;
          this.lastHostHeading = endHeading;

          // Only update map center after animation completes
          if (this.centeringMode !== CenteringMode.None) {
            this.smoothCenter(endPosition);
            if (this.centeringMode === CenteringMode.CenterWithHeading) {
              this.map.getView().setRotation(-endHeading * Math.PI / 180);
            }
          }
        }
        this.map.render();
      };

      requestAnimationFrame(animate);
    }

    if (this.centeringMode !== CenteringMode.None) {
      this.map.getView().setCenter(newPosition);
      if (this.centeringMode === CenteringMode.CenterWithHeading) {
        this.map.getView().setRotation(-data.heading * Math.PI / 180);
      }
    }

    // Update the host aircraft icon rotation even when not animating
    const mapRotation = this.map.getView().getRotation();
    const style = this.hostFeature!.getStyle() as Style;
    (style.getImage() as Icon).setRotation(data.heading * Math.PI / 180 + mapRotation);


    if (this.firstHostUpdate) {
      this.map.getView().setZoom(7);
      this.firstHostUpdate = false;
    }
  }

  private updateOtherAircraft(data: OtherAircraftData[]) {
    const source = this.otherAircraftLayer.getSource() as VectorSource;
    const existingIds = new Set(source.getFeatures().map(f => f.getId()));

    data.forEach(aircraft => {
      const id = `aircraft-${aircraft.id}`;
      let feature = source.getFeatureById(id) as Feature<Point> | null;

      if (!feature) {
        feature = new Feature({
          geometry: new Point(fromLonLat([aircraft.longitude, aircraft.latitude])),
          heading: (aircraft.heading) * Math.PI / 180,
        });
        feature.setId(id);
        source.addFeature(feature);
      } else {
        const geometry = feature.getGeometry() as Point;
        geometry.setCoordinates(fromLonLat([aircraft.longitude, aircraft.latitude]));
        feature.set('heading', (aircraft.heading) * Math.PI / 180, true);
      }

      existingIds.delete(id);
    });

    // Remove aircraft that are no longer present
    existingIds.forEach(id => {
      const feature = source.getFeatureById(id as string);
      if (feature) source.removeFeature(feature);
    });

    // Force re-render of the layer
    this.otherAircraftLayer.changed();
    this.map.render();
  }

  private smoothCenter(newCenter: Coordinate) {
    const view = this.map.getView();
    const currentCenter = view.getCenter()!;
    const duration = 100; // match this with the aircraft animation duration

    view.animate({
      center: newCenter,
      duration: duration
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

  toggleCentering() {
    switch (this.centeringMode) {
      case CenteringMode.None:
        this.centeringMode = CenteringMode.Center;
        this.centeringIcon = 'gps_fixed';
        break;
      case CenteringMode.Center:
        this.centeringMode = CenteringMode.CenterWithHeading;
        this.centeringIcon = 'navigation';
        break;
      case CenteringMode.CenterWithHeading:
        this.centeringMode = CenteringMode.None;
        this.centeringIcon = 'gps_off';
        this.map.getView().setRotation(0);
        break;
    }

    if (this.centeringMode !== CenteringMode.None && this.hostFeature) {
      const geometry = this.hostFeature.getGeometry() as Point;
      this.smoothCenter(geometry.getCoordinates());
      if (this.centeringMode === CenteringMode.CenterWithHeading) {
        const newRotation = -this.lastHostHeading! * Math.PI / 180;
        this.map.getView().setRotation(newRotation);

        // Update host aircraft icon rotation
        const style = this.hostFeature.getStyle() as Style;
        (style.getImage() as Icon).setRotation(this.lastHostHeading! * Math.PI / 180 + newRotation);
      } else {
        // Reset host aircraft icon rotation when not in CenterWithHeading mode
        const style = this.hostFeature.getStyle() as Style;
        (style.getImage() as Icon).setRotation(this.lastHostHeading! * Math.PI / 180);
      }
    }
  }


}
