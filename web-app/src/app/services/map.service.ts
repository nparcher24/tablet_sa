// map.service.ts
import { Injectable } from '@angular/core';
import { Map as OLMap, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { defaults as defaultControls } from 'ol/control';
import { Style, Stroke, Fill, Icon } from 'ol/style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Geometry } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { Coordinate } from 'ol/coordinate';

enum CenteringMode {
  None,
  CenterWithHeading,
  CenterWithHeadingOffset
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: OLMap;
  private vectorLayer!: VectorLayer<Feature<Geometry>>;
  private hostAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private otherAircraftLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;
  private bullseyeLayer: VectorLayer<Feature<Geometry>> | null = null;
  private bullseyeFeature: Feature | null = null;
  private selectionLayer!: WebGLPointsLayer<VectorSource<FeatureLike>>;



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

  initMap(target: string): OLMap {
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
      target: target,
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

    this.initLayers();
    this.addMapListeners();

    return this.map;


  }

  private initLayers() {
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

    this.otherAircraftLayer = new WebGLPointsLayer({
      source: new VectorSource(),
      style: {
        'icon-src': 'assets/other-aircraft.png',
        'icon-width': 50,
        'icon-height': 50,
        'icon-rotate-with-view': true,
        'icon-rotation': ['get', 'heading'],
        'icon-displacement': [0, 6],
        'circle-radius': [
          'case',
          ['get', 'selected'], 15,
          0
        ],
        'circle-fill-color': 'rgba(255, 255, 255, 0.1)',
        'circle-stroke-width': [
          'case',
          ['get', 'selected'], 2,
          0
        ],
        'circle-stroke-color': 'white',
      },
      disableHitDetection: false,
    });

    this.selectionLayer = new WebGLPointsLayer({
      source: new VectorSource(),
      style: {
        'circle-radius': 20,
        'circle-fill-color': 'rgba(255, 255, 255, 0.1)',
        'circle-stroke-width': 2,
        'circle-stroke-color': 'white',
      },
      zIndex: 1
    });

    this.map.addLayer(this.selectionLayer);
    this.map.addLayer(this.hostAircraftLayer);
    this.map.addLayer(this.otherAircraftLayer);
  }

  private addMapListeners() {
    this.map.on('moveend', () => {
      const currentZoom = this.map.getView().getZoom();
      if (currentZoom! <= 6) {
        this.vectorLayer.setSource(this.vectorSource110m);
      } else if (currentZoom! > 6 && currentZoom! <= 10) {
        this.vectorLayer.setSource(this.vectorSource50m);
      } else if (currentZoom! > 10) {
        this.vectorLayer.setSource(this.vectorSource10m);
      }
    });

    this.map.getView().on('change:rotation', () => {
      if (this.bullseyeFeature) {
        const mapRotation = this.map.getView().getRotation();
        this.bullseyeFeature.setStyle(this.getBullseyeStyle(mapRotation));
        this.map.render();
      }
    });
  }

  selectTrack(feature: Feature<Geometry>) {
    const source = this.selectionLayer.getSource();
    source?.clear();
    const selectionFeature = new Feature(feature.getGeometry()?.clone());
    selectionFeature.setId('selected-track');
    source?.addFeature(selectionFeature);
  }

  deselectTrack() {
    this.selectionLayer.getSource()?.clear();
  }

  updateMapView(lastHostPosition: Coordinate, lastHostHeading: number, centeringMode: CenteringMode) {
    if (lastHostPosition && lastHostHeading !== null) {
      const view = this.map.getView();
      const mapSize = this.map.getSize();

      if (centeringMode !== CenteringMode.None) {
        const rotation = -lastHostHeading * Math.PI / 180;
        view.setRotation(rotation);

        if (centeringMode === CenteringMode.CenterWithHeadingOffset && mapSize) {
          const offsetDistance = mapSize[1] / 3;
          const resolution = view.getResolution();
          if (resolution) {
            const distance = offsetDistance * resolution;
            const offsetCoord = this.calculateOffsetCoordinate(
              lastHostPosition,
              lastHostHeading,
              distance * 0.7
            );
            view.setCenter(offsetCoord);
          }
        } else {
          view.setCenter(lastHostPosition);
        }

        this.map.render();
      }
    }
  }

  private calculateOffsetCoordinate(startCoord: Coordinate, bearing: number, distance: number): Coordinate {
    const [lon, lat] = startCoord;
    const bearingRad = (bearing * Math.PI) / 180;
    const dx = distance * Math.sin(bearingRad);
    const dy = distance * Math.cos(bearingRad);
    return [lon + dx, lat + dy];
  }

  initBullseyeLayer() {
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
        rotation: rotation
      })
    });
  }

  getBullseyePosition(): Coordinate | null {
    if (this.bullseyeFeature) {
      return (this.bullseyeFeature.getGeometry() as Point).getCoordinates();
    }
    return null;
  }

  loadAndDisplayBullseye() {
    const latitude = localStorage.getItem('bullseyeLatitude');
    const longitude = localStorage.getItem('bullseyeLongitude');
    const latDirection = localStorage.getItem('bullseyeLatDirection');
    const lonDirection = localStorage.getItem('bullseyeLonDirection');

    if (latitude && longitude && latDirection && lonDirection) {
      const lat = this.parseCoordinate(latitude, latDirection);
      const lon = this.parseCoordinate(longitude, lonDirection);

      if (lat !== null && lon !== null) {
        const coordinates = fromLonLat([lon, lat]);
        this.updateBullseyePosition(coordinates);
      }
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
    const mapRotation = this.map.getView().getRotation();

    if (!this.bullseyeFeature) {
      this.bullseyeFeature = new Feature(new Point(coordinates));
      this.bullseyeLayer?.getSource()?.addFeature(this.bullseyeFeature);
    } else {
      (this.bullseyeFeature.getGeometry() as Point).setCoordinates(coordinates);
    }

    // Update the style with the current map rotation
    this.bullseyeFeature.setStyle(this.getBullseyeStyle(mapRotation));

    this.bullseyeLayer?.changed();
    this.map.render();
  }

  getMap(): OLMap {
    return this.map;
  }

  getHostAircraftLayer(): WebGLPointsLayer<VectorSource<FeatureLike>> {
    return this.hostAircraftLayer;
  }

  getOtherAircraftLayer(): WebGLPointsLayer<VectorSource<FeatureLike>> {
    return this.otherAircraftLayer;
  }

  registerClickHandler(handler: (event: any) => void) {
    this.map.on('click', handler);
  }

  registerPanHandler(handler: () => void) {
    this.map.on('pointerdrag', handler);
  }
}