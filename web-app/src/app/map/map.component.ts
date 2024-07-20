
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
  // private hostAircraftLayer!: VectorLayer<Feature<Geometry>>;
  private hostAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private otherAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private hostSubscription!: Subscription;
  private otherSubscription!: Subscription;
  private firstHostUpdate = true;
  private lastHostPosition: Coordinate | null = null;
  private lastHostHeading: number | null = null;
  // private hostFeature: Feature<Point> | null = null;
  public isCentered: boolean = true;
  private centeringMode: CenteringMode = CenteringMode.CenterWithHeading;
  public centeringIcon: string = 'navigation';
  private breadcrumbLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  public breadcrumbCount = 0;
  private vectorSource110m = new VectorSource({
    url: 'assets/maps/ne_110m_admin_0_countries.json',
    format: new GeoJSON(),
  });

  private vectorSource50m = new VectorSource({
    url: 'assets/maps/ne_50m_admin_0_countries.json',
    format: new GeoJSON(),
  });

  private vectorSource10m = new VectorSource({
    url: 'assets/maps/ne_10m_admin_0_countries.json',
    format: new GeoJSON(),
  });

  private mapMoveEndListener: any;
  private mapPostRenderListener: any;


  constructor(
    private hostAircraftService: HostAircraftService,
    private otherAircraftService: OtherAircraftService
  ) {
  }

  ngOnInit() {
    this.resetPositions();
    this.initMap();
    this.subscribeToAircraftData();
    this.toggleBreadcrumbs();
  }

  ngOnDestroy() {
    this.hostSubscription.unsubscribe();
    this.otherSubscription.unsubscribe();
    this.map.un('moveend', this.mapMoveEndListener);
  }

  private initMap() {

    let previousZoom = -1; // Holds the previous zoom level


    this.vectorLayer = new VectorLayer({
      source: this.vectorSource110m,
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

    // this.mapPostRenderListener = this.map.on('postrender', () => {
    //   const source = this.hostAircraftLayer.getSource() as VectorSource;
    //   const hostFeature = source.getFeatureById('host-aircraft');
    //   if (hostFeature && this.lastHostHeading !== null) {
    //     const mapRotation = this.map.getView().getRotation();
    //     hostFeature.set('heading', this.lastHostHeading * Math.PI / 180 + mapRotation, true);
    //     this.hostAircraftLayer.changed();
    //     this.map.render();
    //   }
    // });

    // Add event listener for when the map stops moving
    this.mapMoveEndListener = this.map.on('moveend', () => {

      const currentZoom = this.map.getView().getZoom();

      if (currentZoom !== previousZoom) {
        previousZoom = currentZoom!;

        // Determine which resolution to show based on the zoom level
        if (currentZoom! <= 6) {
          this.vectorLayer.setSource(this.vectorSource110m);
        } else if (currentZoom! > 6 && currentZoom! <= 10) {
          this.vectorLayer.setSource(this.vectorSource50m);
        } else if (currentZoom! > 10) {
          this.vectorLayer.setSource(this.vectorSource10m);
        }
      }
    });

    // this.hostAircraftLayer = new VectorLayer({
    //   source: new VectorSource(),
    // });

    // this.map.addLayer(this.hostAircraftLayer);

    this.hostAircraftLayer = new WebGLPointsLayer({
      source: new VectorSource(),
      style: {
        'icon-src': 'assets/host-aircraft.svg',
        'icon-width': 50,
        'icon-height': 50,
        'icon-size': 0.5,
        'icon-rotate-with-view': true,
        'icon-rotation': ['get', 'heading'],
        'icon-displacement': [0, 9],
      },
      disableHitDetection: true,
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

    // Add event listeners for user interactions
    this.map.on('pointerdrag', () => {
      this.disableAutoCentering();
    });

    this.map.getView().on('change:rotation', () => {
      if (this.centeringMode === CenteringMode.CenterWithHeading) {
        this.disableAutoCentering();
      }
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


  private smoothFactor = 1; // Adjust this value to change smoothing (0-1)
  private currentPosition: Coordinate | null = null;

  private updateHostAircraft(data: AircraftData) {
    const source = this.hostAircraftLayer.getSource() as VectorSource;
    const newPosition = fromLonLat([data.longitude, data.latitude]);

    if (!this.currentPosition) {
      this.currentPosition = newPosition;
    } else {
      // Interpolate between current and new position
      this.currentPosition = [
        this.currentPosition[0] + (newPosition[0] - this.currentPosition[0]) * this.smoothFactor,
        this.currentPosition[1] + (newPosition[1] - this.currentPosition[1]) * this.smoothFactor
      ];
    }

    let feature = source.getFeatureById('host-aircraft') as Feature<Point> | null;
    if (!feature) {
      feature = new Feature({
        geometry: new Point(this.currentPosition),
        heading: data.heading * Math.PI / 180,
      });
      feature.setId('host-aircraft');
      source.addFeature(feature);
    } else {
      const geometry = feature.getGeometry() as Point;
      geometry.setCoordinates(this.currentPosition);
      feature.set('heading', data.heading * Math.PI / 180, true);
    }

    // Use smoothed position for map centering only if auto-centering is enabled
    if (this.centeringMode !== CenteringMode.None) {
      this.map.getView().setCenter(this.currentPosition);
      if (this.centeringMode === CenteringMode.CenterWithHeading) {
        this.map.getView().setRotation(-data.heading * Math.PI / 180);
      }
    }

    this.lastHostPosition = newPosition;
    this.lastHostHeading = data.heading;

    if (this.firstHostUpdate) {
      this.map.getView().setZoom(7);
      this.firstHostUpdate = false;
    }

    this.hostAircraftLayer.changed();
    this.map.render();
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
          breadcrumbs: aircraft.breadcrumbs
        });
        feature.setId(id);
        source.addFeature(feature);
      } else {
        const geometry = feature.getGeometry() as Point;
        geometry.setCoordinates(fromLonLat([aircraft.longitude, aircraft.latitude]));
        feature.set('heading', (aircraft.heading) * Math.PI / 180, true);
        feature.set('breadcrumbs', aircraft.breadcrumbs, true);
      }

      existingIds.delete(id);
    });

    // Remove aircraft that are no longer present
    existingIds.forEach(id => {
      const feature = source.getFeatureById(id as string);
      if (feature) source.removeFeature(feature);
    });

    // Force re-render of the layer
    this.updateBreadcrumbs();
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
        this.disableAutoCentering();
        return; // Exit the method early as centering is now disabled
    }

    // This block will only execute if centering mode was changed to a non-None value
    if (this.lastHostPosition) {
      this.map.getView().setCenter(this.lastHostPosition);
      if (this.centeringMode === CenteringMode.CenterWithHeading) {
        this.map.getView().setRotation(-this.lastHostHeading! * Math.PI / 180);
      }
    }
  }

  toggleBreadcrumbs() {
    const counts = [0, 5, 10, 20];
    this.breadcrumbCount = counts[(counts.indexOf(this.breadcrumbCount) + 1) % counts.length];
    this.otherAircraftService.setBreadcrumbCount(this.breadcrumbCount);

    console.log(`Breadcrumb count set to: ${this.breadcrumbCount}`);

    if (!this.map) {
      console.warn('Map not initialized yet');
      return;
    }

    if (this.breadcrumbCount > 0) {
      if (!this.breadcrumbLayer) {
        this.initBreadcrumbLayer();
      }
      this.updateBreadcrumbs();
    } else {
      this.removeBreadcrumbLayer();
    }
  }

  private removeBreadcrumbLayer() {
    if (this.map && this.breadcrumbLayer) {
      this.map.removeLayer(this.breadcrumbLayer);
      this.breadcrumbLayer = undefined!;
    }
  }

  private initBreadcrumbLayer() {
    this.breadcrumbLayer = new WebGLPointsLayer({
      source: new VectorSource(),
      style: {
        'circle-radius': 3,
        'circle-fill-color': 'rgba(255, 255, 255, 0.7)',
      },
      disableHitDetection: true,
    });
    this.map.addLayer(this.breadcrumbLayer);
    console.log('Breadcrumb layer initialized');
  }

  private updateBreadcrumbs() {
    if (this.breadcrumbCount === 0 || !this.breadcrumbLayer) {
      this.removeBreadcrumbLayer();
      return;
    }

    if (!this.otherAircraftLayer) {
      console.warn('Other aircraft layer not initialized yet');
      return;
    }

    const source = this.otherAircraftLayer.getSource() as VectorSource<Feature<Geometry>>;
    const breadcrumbSource = this.breadcrumbLayer.getSource() as VectorSource<Feature<Geometry>>;
    const existingFeatures = new Map(breadcrumbSource.getFeatures().map(f => [f.getId(), f]));

    source.getFeatures().forEach(aircraft => {
      const properties = aircraft.getProperties() as OtherAircraftData;
      if (properties.breadcrumbs && properties.breadcrumbs.length > 0) {
        properties.breadcrumbs.forEach((coords: [number, number], index: number) => {
          const id = `${aircraft.getId()}-${index}`;
          let feature = existingFeatures.get(id) as Feature<Point> | undefined;
          if (!feature) {
            feature = new Feature({
              geometry: new Point(fromLonLat(coords)),
              properties: { opacity: 1 - index / this.breadcrumbCount }
            });
            feature.setId(id);
            breadcrumbSource.addFeature(feature);
          } else {
            (feature.getGeometry() as Point).setCoordinates(fromLonLat(coords));
            feature.set('properties', { opacity: 1 - index / this.breadcrumbCount });
            existingFeatures.delete(id);
          }
        });
      }
    });

    // Remove outdated features
    existingFeatures.forEach(feature => breadcrumbSource.removeFeature(feature));

    this.breadcrumbLayer.changed();
  }

  private disableAutoCentering() {
    this.centeringMode = CenteringMode.None;
    this.centeringIcon = 'gps_off';
  }
}
