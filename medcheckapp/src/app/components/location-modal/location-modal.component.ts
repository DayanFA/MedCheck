import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// Leaflet será carregado dinamicamente para evitar peso inicial.
@Component({
  selector: 'app-location-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="modal-backdrop fade show" (click)="close()"></div>
  <div class="loc-modal card shadow-lg">
    <div class="card-header d-flex align-items-center justify-content-between py-2">
      <h6 class="mb-0">Localização</h6>
      <button type="button" class="btn-close btn-sm" (click)="close()"></button>
    </div>
    <div class="card-body p-0 position-relative">
      <iframe class="map-container border-0" allowfullscreen
        referrerpolicy="no-referrer-when-downgrade"
        [src]="googleEmbedSafeUrl" loading="lazy"></iframe>
      <div *ngIf="loading" class="map-loading-overlay d-flex flex-column align-items-center justify-content-center">
        <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
        <div class="small text-muted">Carregando mapa...</div>
      </div>
      <div class="p-3 border-top small">
        <div *ngIf="address; else coordsTpl">{{ address }}</div>
        <ng-template #coordsTpl>
          <div>
            Lat: {{ lat | number:'1.6-6' }}<br>
            Lng: {{ lng | number:'1.6-6' }}
          </div>
        </ng-template>
        <div class="mt-2 d-flex gap-2 flex-wrap">
          <a class="btn btn-outline-primary btn-sm" target="_blank" [href]="googleMapsUrl">Google Maps</a>
          <a class="btn btn-outline-secondary btn-sm" target="_blank" [href]="openStreetMapUrl">OpenStreetMap</a>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .loc-modal{position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:520px; max-width:95vw; z-index:1060; border-radius:14px;}
    .modal-backdrop{z-index:1055; background:rgba(33,37,41,.55);}
  .map-container{width:100%; height:320px; border-top-left-radius:0; border-top-right-radius:0;}
  .map-loading-overlay{position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,.85);}
  `]
})
export class LocationModalComponent implements OnInit, OnDestroy {
  @Input() lat!: number;
  @Input() lng!: number;
  @Input() onClose?: () => void;
  address: string | null = null;
  loading = true;
  // Apenas Google
  googleEmbedSafeUrl!: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {}

  get googleMapsUrl(){
    return `https://www.google.com/maps?q=${this.lat},${this.lng}`;
  }

  get openStreetMapUrl(){
    return `https://www.openstreetmap.org/?mlat=${this.lat}&mlon=${this.lng}#map=18/${this.lat}/${this.lng}`;
  }
  private buildGoogleUrl(){
    return `https://www.google.com/maps?q=${this.lat},${this.lng}&hl=pt&z=16&output=embed`;
  }

  ngOnInit(): void {
    try {
      this.googleEmbedSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.buildGoogleUrl());
    } catch {}
    this.init();
  }
  ngOnDestroy(): void {
    // Nenhum recurso adicional para limpar agora que Leaflet foi removido.
  }

  close(){ if (this.onClose) this.onClose(); }

  private async init(){
    // Simples delay para garantir carregamento visual do iframe
    setTimeout(()=> { this.loading = false; }, 600);
    this.reverseGeocode();
  }

  // Fallback removido

  private reverseGeocode(){
    const cacheKey = `mc_revgeo_${this.lat.toFixed(5)}_${this.lng.toFixed(5)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { this.address = cached; return; }
    } catch {}
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${this.lat}&lon=${this.lng}`)
      .then(r => r.json())
      .then(j => {
        const display = j?.display_name || null;
        this.address = display;
        try { if (display) localStorage.setItem(cacheKey, display); } catch {}
      })
      .catch(_ => { this.address = null; });
  }
}
