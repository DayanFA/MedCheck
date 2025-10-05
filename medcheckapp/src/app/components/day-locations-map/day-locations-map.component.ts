import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

// Componente que recebe lista de sessões do dia e plota todos os pontos (check-in e check-out) em um único mapa.
// Leaflet carregado dinamicamente para evitar peso inicial.
@Component({
  selector: 'app-day-locations-map',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="dlm-wrapper card mb-3">
    <div class="card-header d-flex justify-content-between align-items-center py-2">
      <strong>Mapa das Localizações do Dia</strong>
      <button class="btn btn-sm btn-outline-secondary" (click)="refresh()" [disabled]="loading">Atualizar</button>
    </div>
    <div class="card-body p-0">
      <div *ngIf="loading" class="p-3 small text-muted">Carregando mapa...</div>
      <div id="dayMapContainer" class="day-map" *ngIf="!loading"></div>
      <div *ngIf="!loading && totalMarkers===0" class="p-3 small text-muted">Sem coordenadas para exibir.</div>
    </div>
  </div>
  `,
  styles: [`
    .day-map{width:100%;height:360px;}
  `]
})
export class DayLocationsMapComponent implements OnChanges {
  @Input() sessions: any[] = [];
  private leafletLoaded = false;
  private map: any;
  private markersLayer: any;
  loading = true;
  totalMarkers = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessions']) {
      this.init();
    }
  }

  private async init(){
    await this.ensureLeaflet();
    this.initMapIfNeeded();
    this.plotPoints();
  }

  refresh(){
    this.plotPoints();
  }

  private ensureLeaflet(): Promise<void> {
    if (this.leafletLoaded) return Promise.resolve();
    return new Promise(resolve => {
      const existing = (window as any).L;
      if (existing) { this.leafletLoaded=true; resolve(); return; }
      const linkId = 'leaflet-css';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId; link.rel='stylesheet';
        link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const scriptId = 'leaflet-js';
      if (document.getElementById(scriptId)) {
        const check = () => { (window as any).L ? (this.leafletLoaded=true, resolve()) : setTimeout(check,60); };
        check();
        return;
      }
      const s = document.createElement('script');
      s.id = scriptId; s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.async = true;
      s.onload = () => { this.leafletLoaded=true; resolve(); };
      s.onerror = () => { resolve(); };
      document.body.appendChild(s);
    });
  }

  private initMapIfNeeded(){
    const L = (window as any).L;
    if (!L) { this.loading=false; return; }
    if (!this.map) {
      this.map = L.map('dayMapContainer').setView([0,0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.map);
      this.markersLayer = L.layerGroup().addTo(this.map);
    }
    this.loading=false;
  }

  private plotPoints(){
    const L = (window as any).L;
    if (!L || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    const bounds: any[] = [];
    this.totalMarkers = 0;
    for (const s of this.sessions) {
      if (s.checkInLat!=null && s.checkInLng!=null) {
        this.addMarker(L, s.checkInLat, s.checkInLng, 'Entrada', s);
        bounds.push([s.checkInLat, s.checkInLng]);
      }
      if (s.checkOutLat!=null && s.checkOutLng!=null) {
        this.addMarker(L, s.checkOutLat, s.checkOutLng, 'Saída', s, true);
        bounds.push([s.checkOutLat, s.checkOutLng]);
      }
    }
    if (bounds.length) {
      try { this.map.fitBounds(bounds, { padding: [20,20] }); } catch {}
    }
  }

  private addMarker(L:any, lat:number, lng:number, label:string, session:any, checkout=false){
    const icon = L.divIcon({
      className: 'mc-marker',
      html: `<div style="background:${checkout?'#198754':'#0d6efd'};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`
    });
    const m = L.marker([lat,lng], { icon }).addTo(this.markersLayer);
    const tt = `${label}<br>Lat: ${lat}<br>Lng: ${lng}<br>` + (session.checkInTime ? `In: ${session.checkInTime}`:'');
    m.bindPopup(tt);
    this.totalMarkers++;
  }
}
