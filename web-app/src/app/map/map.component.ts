import { Component, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { fromLonLat } from 'ol/proj';
import { apply } from 'ol-mapbox-style';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, AfterViewInit {
  private map!: Map;

  constructor(private elementRef: ElementRef) { }

  ngOnInit(): void {
    // Initialization logic, if needed
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  private initializeMap(): void {
    console.log('Initializing map...');

    const layer = new VectorTileLayer({
      source: new VectorTileSource({
        format: new MVT(),
        url: 'https://basemaps.arcgis.com/v1/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf'
      })
    });

    this.map = new Map({
      target: this.elementRef.nativeElement.querySelector('.map-container'),
      layers: [layer],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2
      })
    });

    // Apply a style to the vector tiles
    apply(this.map, 'https://basemaps.arcgis.com/b2/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/styles/root.json');

    console.log('Map initialized:', this.map);
  }
}