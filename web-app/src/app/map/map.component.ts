
import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { Map as OLMap, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { defaults as defaultControls } from 'ol/control';
import { Style, Stroke, Fill, Icon } from 'ol/style';
import { CommonModule } from '@angular/common';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Geometry, GeometryCollection, LineString, Polygon } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { Subscription } from 'rxjs';
import { HostAircraftData, HostAircraftService } from '../services/host-aircraft.service';
import { OtherAircraftData, OtherAircraftService } from '../services/other-aircraft.service';
import { Coordinate } from 'ol/coordinate';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RangeRingsComponent } from './range-rings/range-rings.component';
import { SettingsMenuComponent } from './settings-menu/settings-menu.component';
import CircleStyle from 'ol/style/Circle';
import { BullseyeService } from '../services/bullseye.service';
import { TrackInfoComponent } from './track-info/track-info.component';


enum CenteringMode {
  None,
  CenterWithHeading,
  CenterWithHeadingOffset
}


@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RangeRingsComponent, SettingsMenuComponent, TrackInfoComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {

  public map!: OLMap;
  private vectorLayer!: VectorLayer<Feature<Geometry>>;
  public CenteringMode = CenteringMode;

  // private hostAircraftLayer!: VectorLayer<Feature<Geometry>>;
  private hostAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private otherAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private hostSubscription!: Subscription;
  private otherSubscription!: Subscription;
  private firstHostUpdate = true;
  public lastHostPosition: Coordinate | null = null;
  private lastHostHeading: number | null = null;
  // private hostFeature: Feature<Point> | null = null;
  public isCentered: boolean = true;
  public centeringMode: CenteringMode = CenteringMode.CenterWithHeadingOffset;
  public centeringIcon: string = 'gps_off';
  public centerPosition: 'middle' | 'third' = 'third';
  private breadcrumbLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  public breadcrumbCount = 0; // Default to off
  private smoothFactor = 1; // Adjust this value to change smoothing (0-1)
  private currentPosition: Coordinate | null = null;
  private isIntentionalUpdate: boolean = false;
  public mapRotation: number = 0;
  private bullseyeFeature: Feature | null = null;
  private bullseyeLayer: VectorLayer<Feature<Geometry>> | null = null;
  selectedTrack: any | null = null;
  trackInfoPosition: { top: string, left: string, zIndex: string } | null = null;
  bullseyePosition: Coordinate | null = null;



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
    private otherAircraftService: OtherAircraftService,
    private bullseyeService: BullseyeService
  ) {
  }

  ngOnInit() {
    this.resetPositions();
    this.initMap();
    this.subscribeToAircraftData();
    this.initBullseyeLayer();
    this.loadAndDisplayBullseye();
    this.bullseyeService.bullseyeUpdated$.subscribe(() => {
      this.loadAndDisplayBullseye();
    });
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
        'icon-rotation': ['get', 'heading'],
        'icon-displacement': [0, 9],
      },
      disableHitDetection: false,
    });

    this.map.addLayer(this.otherAircraftLayer);


    // Ensure WebGL is initialized
    this.map.once('postrender', () => {
      this.map.renderSync();
    });


    this.map.getView().on('change:rotation', (event) => {
      if (!this.isIntentionalUpdate && this.centeringMode !== CenteringMode.None && event.oldValue !== undefined) {
        this.disableAutoCentering();
      }
      if (this.bullseyeFeature) {
        const mapRotation = this.map.getView().getRotation();
        this.bullseyeFeature.setStyle(this.getBullseyeStyle(mapRotation));
        this.map.render();
      }
    });

    this.map.on('pointerdrag', () => {
      if (!this.isIntentionalUpdate && this.centeringMode !== CenteringMode.None) {
        this.disableAutoCentering();
      }
    });

    this.map.on('click', (event) => {
      let featureClicked = false;
      this.map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (layer === this.otherAircraftLayer && feature.get('isOtherAircraft')) {
          this.selectedTrack = feature.getProperties();

          const geometry = feature.getGeometry();
          if (geometry instanceof Point) {
            const pixel = this.map.getPixelFromCoordinate(geometry.getCoordinates());
            this.trackInfoPosition = { top: `${pixel[1]}px`, left: `${pixel[0]}px`, zIndex: '1000' };
          }
          console.log("Position: ", this.trackInfoPosition)
          featureClicked = true;
          return true; // Stop iterating over features
        }
        return false; // Continue to the next feature
      }, {
        hitTolerance: 1000,
        layerFilter: (layer) => layer === this.otherAircraftLayer
      });

      if (!featureClicked) {
        this.selectedTrack = null;
        this.trackInfoPosition = null;
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

  private updateHostAircraft(data: HostAircraftData) {
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


    this.lastHostPosition = newPosition;
    this.lastHostHeading = data.heading;


    this.updateMapView();


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
          breadcrumbs: aircraft.breadcrumbs,
          speed: aircraft.speed,
          lastUpdateTime: Date.now()
        });
        feature.set('isOtherAircraft', true);
        feature.setId(id);
        source.addFeature(feature);
      } else {
        const geometry = feature.getGeometry() as Point;
        geometry.setCoordinates(fromLonLat([aircraft.longitude, aircraft.latitude]));
        feature.set('heading', (aircraft.heading) * Math.PI / 180, true);
        feature.set('breadcrumbs', aircraft.breadcrumbs, true);
        feature.set('speed', aircraft.speed, true);
        feature.set('lastUpdateTime', Date.now(), true);
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
        this.centeringMode = CenteringMode.CenterWithHeading;
        this.centerPosition = 'middle';
        this.centeringIcon = 'navigation';
        break;
      case CenteringMode.CenterWithHeading:
      case CenteringMode.CenterWithHeadingOffset:
        this.centeringMode = CenteringMode.None;
        this.centeringIcon = 'gps_off';
        break;
    }
    this.updateMapView();
  }

  toggleBreadcrumbs() {
    const counts = [0, 5, 10, 20, 50];
    const currentIndex = counts.indexOf(this.breadcrumbCount);
    this.breadcrumbCount = counts[(currentIndex + 1) % counts.length];
    this.otherAircraftService.setBreadcrumbCount(this.breadcrumbCount);

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
    if (this.centeringMode !== CenteringMode.None) {
      this.centeringMode = CenteringMode.None;
      this.centeringIcon = 'gps_off';
      console.log('Auto-centering disabled');
    }
  }

  toggleCenterPosition() {
    if (this.centeringMode === CenteringMode.CenterWithHeading) {
      this.centeringMode = CenteringMode.CenterWithHeadingOffset;
      this.centerPosition = 'third';
    } else if (this.centeringMode === CenteringMode.CenterWithHeadingOffset) {
      this.centeringMode = CenteringMode.CenterWithHeading;
      this.centerPosition = 'middle';
    }
    this.updateMapView();
  }

  private updateMapView() {
    if (this.lastHostPosition && this.lastHostHeading !== null) {
      const view = this.map.getView();
      const mapSize = this.map.getSize();

      if (this.centeringMode !== CenteringMode.None) {
        this.isIntentionalUpdate = true;


        const rotation = -this.lastHostHeading * Math.PI / 180;
        view.setRotation(rotation);
        this.mapRotation = rotation; // Add this line


        if (this.centeringMode === CenteringMode.CenterWithHeadingOffset && mapSize) {
          const offsetDistance = mapSize[1] / 3; // 1/3 of the map height
          const resolution = view.getResolution();
          if (resolution) {
            const distance = offsetDistance * resolution;
            const offsetCoord = this.calculateOffsetCoordinate(
              this.lastHostPosition,
              this.lastHostHeading,
              distance * 0.7
            );
            view.setCenter(offsetCoord);
          }
        } else {
          view.setCenter(this.lastHostPosition);
        }


        this.map.render();
        setTimeout(() => {
          this.isIntentionalUpdate = false;
        }, 0);
      }
    }
  }

  private calculateOffsetCoordinate(startCoord: Coordinate, bearing: number, distance: number): Coordinate {
    const [lon, lat] = startCoord;
    const bearingRad = (bearing * Math.PI) / 180;

    // Calculate the offsets
    const dx = distance * Math.sin(bearingRad);
    const dy = distance * Math.cos(bearingRad);

    // Apply the offsets to the starting coordinate
    return [lon + dx, lat + dy];
  }

  private initBullseyeLayer() {
    this.bullseyeLayer = new VectorLayer({
      source: new VectorSource(),
      style: (feature) => {
        const mapRotation = this.map.getView().getRotation();
        return this.getBullseyeStyle(mapRotation);
      },
    });
    this.map.addLayer(this.bullseyeLayer);
  }

  private getBullseyeStyle(rotation: number = 0): Style {
    return new Style({
      image: new Icon({
        src: 'assets/bullseye.svg',
        scale: 1.5,
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        rotation: rotation  // Negative to counter the map rotation
      })
    });
  }

  loadAndDisplayBullseye() {
    const latitude = localStorage.getItem('bullseyeLatitude');
    const longitude = localStorage.getItem('bullseyeLongitude');
    const latDirection = localStorage.getItem('bullseyeLatDirection');
    const lonDirection = localStorage.getItem('bullseyeLonDirection');

    console.log('Bullseye data:', { latitude, longitude, latDirection, lonDirection });

    if (latitude && longitude && latDirection && lonDirection) {
      const lat = this.parseCoordinate(latitude, latDirection);
      const lon = this.parseCoordinate(longitude, lonDirection);

      console.log('Parsed coordinates:', { lat, lon });

      if (lat !== null && lon !== null) {
        const coordinates = fromLonLat([lon, lat]);
        console.log('Transformed coordinates:', coordinates);
        this.updateBullseyePosition(coordinates);
      } else {
        console.error('Failed to parse coordinates');
      }
    } else {
      console.log('Bullseye data missing');
    }
  }

  private parseCoordinate(coord: string, direction: string): number | null {
    const parts = coord.split(' ');
    if (parts.length < 2 || parts.length > 3) return null;

    const degrees = parseFloat(parts[0]);
    var minutes = parseFloat(parts[1]);
    let seconds = 0;

    if (parts.length === 3) {
      seconds = parseFloat(parts[2]);
    } else if (parts[1].includes('.')) {
      // Handle decimal minutes
      const decimalMinutes = parseFloat(parts[1]);
      minutes = Math.floor(decimalMinutes);
      seconds = (decimalMinutes - minutes) * 60;
    }

    if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) return null;

    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }

    console.log(`Parsed ${coord} ${direction} to ${decimal}`);
    return decimal;
  }

  private updateBullseyePosition(coordinates: Coordinate) {
    console.log('Updating bullseye position:', coordinates);
    const mapRotation = this.map.getView().getRotation();
    const bullseyeStyle = this.getBullseyeStyle(mapRotation);

    if (!this.bullseyeFeature) {
      this.bullseyeFeature = new Feature(new Point(coordinates));
      this.bullseyeFeature.setStyle(bullseyeStyle);
      this.bullseyeLayer?.getSource()?.addFeature(this.bullseyeFeature);
      console.log('Bullseye feature added');
    } else {
      (this.bullseyeFeature.getGeometry() as Point).setCoordinates(coordinates);
      this.bullseyeFeature.setStyle(bullseyeStyle);
      console.log('Bullseye feature updated');
    }
    this.bullseyeLayer?.changed();
    this.map.render();

    // Update the bullseyePosition property
    this.bullseyePosition = coordinates;
  }

}
