
import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { Map as OLMap, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { defaults as defaultControls } from 'ol/control';
import { Style, Icon, Stroke, Fill } from 'ol/style';
import { CommonModule } from '@angular/common';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Geometry, LineString } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { Subscription } from 'rxjs';
import { HostAircraftData, HostAircraftService } from '../services/host-aircraft.service';
import { OtherAircraftData, OtherAircraftService } from '../services/other-aircraft.service';
import { Coordinate } from 'ol/coordinate';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toLonLat } from 'ol/proj';
import { Circle } from 'ol/geom';
import { Text } from 'ol/style';
import { getDistance } from 'ol/sphere';


enum CenteringMode {
  None,
  Center,
  CenterWithHeading,
  CenterWithHeadingOffset
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
  public CenteringMode = CenteringMode;

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
  public centeringMode: CenteringMode = CenteringMode.CenterWithHeadingOffset;
  public centeringIcon: string = 'navigation';
  public centerPosition: 'middle' | 'third' = 'third';
  private breadcrumbLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  public breadcrumbCount = 0; // Default to off
  private smoothFactor = 1; // Adjust this value to change smoothing (0-1)
  private currentPosition: Coordinate | null = null;
  private isIntentionalUpdate: boolean = false;
  private compassRose: HTMLElement | null = null;
  private rangeRingsLayer!: VectorLayer<FeatureLike>;
  private rangeRings: number[] = [2, 5, 10, 20, 50, 100, 200, 500, 1000];



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
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {
  }

  ngOnInit() {
    this.resetPositions();
    this.initMap();
    this.subscribeToAircraftData();
    this.toggleBreadcrumbs();
    this.initCompassRose();

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
        'icon-rotation': ['get', 'heading'],  // This line sets the rotation
        'icon-displacement': [0, 9],
      },
      disableHitDetection: true,
    });

    this.map.addLayer(this.otherAircraftLayer);

    this.rangeRingsLayer = new VectorLayer({
      source: new VectorSource(),
      style: (feature) => this.rangeRingStyle(feature),
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    this.map.addLayer(this.rangeRingsLayer);


    // Ensure WebGL is initialized
    this.map.once('postrender', () => {
      this.map.renderSync();
    });


    this.map.getView().on('change:rotation', (event) => {
      if (!this.isIntentionalUpdate && this.centeringMode !== CenteringMode.None && event.oldValue !== undefined) {
        this.disableAutoCentering();
      }
    });

    this.map.on('pointerdrag', () => {
      if (!this.isIntentionalUpdate && this.centeringMode !== CenteringMode.None) {
        this.disableAutoCentering();
      }
    });

    this.map.getView().on('change:resolution', () => this.updateRangeRings());

    this.map.getView().on(['change:center', 'change:resolution', 'change:rotation'], () => {
      this.updateRangeRings();
    });


  }

  private initCompassRose() {
    this.compassRose = this.elementRef.nativeElement.querySelector('#compass-rose');
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
    this.updateRangeRings();


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
        this.centeringIcon = 'north';
        break;
      case CenteringMode.Center:
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

        if (this.centeringMode === CenteringMode.Center) {
          view.setRotation(0); // Keep the map oriented north
          view.setCenter(this.lastHostPosition);
          this.updateCompassRose(0); // Update compass rose for north-up
        } else {
          const rotation = -this.lastHostHeading * Math.PI / 180;
          view.setRotation(rotation);
          this.updateCompassRose(rotation);

          if (this.centeringMode === CenteringMode.CenterWithHeadingOffset && mapSize) {
            const offsetDistance = mapSize[1] / 3; // 1/3 of the map height
            const resolution = view.getResolution();
            if (resolution) {
              const distance = offsetDistance * resolution;
              const offsetCoord = this.calculateOffsetCoordinate(
                this.lastHostPosition,
                this.lastHostHeading,
                distance
              );
              view.setCenter(offsetCoord);
            }
          } else {
            view.setCenter(this.lastHostPosition);
          }
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

  private updateCompassRose(rotation: number) {
    if (this.compassRose) {
      if (this.centeringMode === CenteringMode.Center) {
        // For north-up mode, reset the compass rose to its original orientation
        this.renderer.setStyle(this.compassRose, 'transform', 'rotate(0rad)');
      } else {
        this.renderer.setStyle(
          this.compassRose,
          'transform',
          `rotate(${rotation}rad)`
        );
      }
    }
  }

  private updateRangeRings() {
    if (!this.lastHostPosition) return;

    const view = this.map.getView();
    const extent = view.calculateExtent(this.map.getSize());
    const [minLon, minLat, maxLon, maxLat] = extent;

    // Calculate width in meters
    const leftPoint = toLonLat([minLon, (minLat + maxLat) / 2]);
    const rightPoint = toLonLat([maxLon, (minLat + maxLat) / 2]);
    const widthMeters = getDistance(leftPoint, rightPoint);

    // Convert width to miles
    const widthMiles = widthMeters / 1609.34;

    // Slightly reduce the range selection
    const outerRange = this.rangeRings.find(range => range > widthMiles / 4) || this.rangeRings[this.rangeRings.length - 1];
    const innerRange = outerRange / 2;

    const source = this.rangeRingsLayer.getSource();
    source?.clear();

    [innerRange, outerRange].forEach((range, index) => {
      const circle = new Circle(this.lastHostPosition!, range * 1609.34);
      const feature = new Feature({
        geometry: circle,
        range: range,
        isOuter: index === 1
      });
      source?.addFeature(feature);
    });

    // Force update of text positions
    this.rangeRingsLayer.changed();
    this.map.render();
  }

  private rangeRingStyle(feature: FeatureLike): Style[] {
    const range = feature.get('range');
    const isOuter = feature.get('isOuter');
    const geometry = feature.getGeometry() as Circle;
    const center = geometry.getCenter();
    const radius = geometry.getRadius();

    // Get the current map rotation
    const rotation = this.map.getView().getRotation();

    // Calculate the position for the text (always at the top of the screen)
    const angle = Math.PI / 2 - rotation; // Subtract rotation to counteract map rotation
    const textPosition = [
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius
    ];

    const circleStyle = new Style({
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.5)',
        width: isOuter ? 2 : 1,
      }),
    });

    const textStyle = new Style({
      text: new Text({
        text: `${range} mi`,
        font: '12px sans-serif',
        fill: new Fill({ color: 'white' }),
        stroke: new Stroke({ color: 'black', width: 2 }),
        textAlign: 'center',
        textBaseline: 'bottom',
        offsetY: -5,
      }),
      geometry: new Point(textPosition)
    });

    return [circleStyle, textStyle];
  }
}
