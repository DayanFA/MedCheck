import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// Leaflet será carregado dinamicamente para evitar peso inicial.
@Component({
  selector: 'app-location-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="loc-modal-backdrop" (click)="close()"></div>
  <div class="loc-modal-wrapper" role="dialog" aria-modal="true" aria-label="Modal de Localização">
    <div class="loc-modal-card animate-pop">
      <div class="loc-modal-head d-flex align-items-center justify-content-between">
        <h6 class="mb-0 fw-semibold d-flex align-items-center gap-2">
          <i class="bi bi-geo-alt text-primary"></i>
          <span>Localização</span>
        </h6>
        <button type="button" class="btn btn-sm btn-outline-secondary close-btn" (click)="close()">
          <i class="bi bi-x"></i>
        </button>
      </div>
      <div class="loc-modal-body position-relative">
        <iframe class="map-frame" allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          [src]="googleEmbedSafeUrl" loading="lazy"></iframe>
        <div *ngIf="loading" class="map-loading-overlay d-flex flex-column align-items-center justify-content-center">
          <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
          <div class="small text-muted">Carregando mapa...</div>
        </div>
      </div>
      <div class="loc-modal-footer small">
        <div *ngIf="address; else coordsTpl" class="address-line">{{ address }}</div>
        <ng-template #coordsTpl>
          <div class="coords-line">
            Lat: {{ lat | number:'1.6-6' }} · Lng: {{ lng | number:'1.6-6' }}
          </div>
        </ng-template>
        <div class="links d-flex gap-2 flex-wrap mt-2">
          <a class="btn btn-outline-primary btn-sm" target="_blank" [href]="googleMapsUrl"><i class="bi bi-box-arrow-up-right"></i> Google</a>
          <a class="btn btn-outline-secondary btn-sm" target="_blank" [href]="openStreetMapUrl"><i class="bi bi-box-arrow-up-right"></i> OSM</a>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
  .loc-modal-backdrop{position:fixed; inset:0; background:rgba(15,20,30,.55); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); z-index:1098; animation:fadeIn .35s ease;}
  .loc-modal-wrapper{position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:1.25rem; z-index:1100;}
  .loc-modal-card{width:580px; max-width:100%; background:rgba(255,255,255,.86); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-radius:22px; box-shadow:0 8px 32px -8px rgba(0,0,0,.35),0 2px 6px -2px rgba(0,0,0,.12); overflow:hidden; border:1px solid rgba(255,255,255,.45);}
  .loc-modal-head{padding:1rem 1.25rem; border-bottom:1px solid rgba(0,0,0,.08);}
  .close-btn{border-radius:10px;}
  .loc-modal-body{position:relative;}
  .map-frame{display:block; width:100%; height:340px; border:0;}
  .map-loading-overlay{position:absolute; inset:0; background:linear-gradient(140deg,rgba(255,255,255,.9),rgba(255,255,255,.75));}
  .loc-modal-footer{padding:1rem 1.25rem 1.25rem; background:linear-gradient(180deg,rgba(255,255,255,.0),rgba(255,255,255,.55));}
  .address-line,.coords-line{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.3;}
  .links a{display:inline-flex; align-items:center; gap:.35rem;}
  @keyframes fadeIn{from{opacity:0} to{opacity:1}}
  @media (max-width: 575.98px){
    .loc-modal-card{border-radius:16px;}
    .map-frame{height:300px;}
  }
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
