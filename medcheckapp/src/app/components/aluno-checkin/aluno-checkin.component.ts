import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationModalComponent } from '../location-modal/location-modal.component';
import { CheckInService } from '../../services/checkin.service';
import { todayAcreISODate } from '../../util/date-utils';
import { HttpClient } from '@angular/common/http';
// Nota: Para leitura de QR sem lib pesada, usamos um placeholder que pode ser trocado depois por 'jsqr'
// ou outra lib. Aqui fica apenas estrutura inicial (captura de vídeo) para integração posterior.

@Component({
  selector: 'app-aluno-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationModalComponent],
  templateUrl: './aluno-checkin.component.html',
  styleUrls: ['./aluno-checkin.component.scss']
})
export class AlunoCheckinComponent implements OnInit, OnDestroy, AfterViewInit {
  preceptorId: number | null = null;
  code = '';
  status: any = null;
  history: any[] = [];
  // Paginação
  pageSize = 10;
  currentPage = 1;
  loadingStatus = false;
  loadingHistory = false;
  submitting = false;
  message = '';
  filterMessage = '';
  startDate = todayAcreISODate();
  endDate = todayAcreISODate();
  private timerId?: any;
  scanning = false;
  videoStream: MediaStream | null = null;
  videoDevices: MediaDeviceInfo[] = [];
  selectedDeviceId: string | null = null;
  @ViewChild('qrVideo') qrVideoRef?: ElementRef<HTMLVideoElement>;
  private pendingAttach = false; // se stream chegou antes do elemento
  private scanRaf: number | null = null;
  private scanCanvas?: HTMLCanvasElement;
  private scanCtx?: CanvasRenderingContext2D | null;
  private jsqrFn: any = null; // armazenará função jsQR carregada dinamicamente
  private barcodeDetector: any = null; // fallback nativo
  private browserReady = typeof window !== 'undefined' && typeof document !== 'undefined';
  private jsqrLoadingPromise: Promise<void> | null = null; // evita múltiplos loads
  showCheckoutConfirm = false;
  // Baseline retornado pela API (segundos já contabilizados até o último refresh)
  private baselineWorkedSeconds = 0;
  private baselineCaptureTs = 0; // timestamp em ms de quando baseline foi definido
  private todayDate = todayAcreISODate();
  private cacheKey = 'mc_worked_cache_home'; // será ajustado após primeira resposta de status (CPF não está aqui diretamente)
  private LOCAL_DISC_KEY = 'mc_current_discipline_id';
  disciplineId?: number;
  disciplines: { id:number; code?:string; name?:string }[] = [];
  disciplineLoading = false;
  // Modal de localização
  showLocModal = false;
  locLat?: number; locLng?: number;
  // showDayMap removido (Mapa do Dia não requerido)

  get workedToday(): string {
    if (!this.status && (this as any)._initialWorkedDisplay) return (this as any)._initialWorkedDisplay;
    return this.formatSecs(this.computeTotalWorked());
  }

  // Futuro: integrar decodificação real de QR (ex: jsQR). Por enquanto, placeholder para mostrar câmera.

  constructor(private check: CheckInService, private http: HttpClient) {}

  ngOnInit(): void {
    this.readDisciplineFromLocal();
    window.addEventListener('mc:discipline-changed', this.onDisciplineChanged as any);
    this.loadWorkedCache();
    this.refreshStatus();
    this.loadDisciplines();
    this.loadHistory('today');
    this.timerId = setInterval(()=> this.tick(), 1000);
  }
  ngOnDestroy(): void { if (this.timerId) clearInterval(this.timerId); this.stopScan(); try { window.removeEventListener('mc:discipline-changed', this.onDisciplineChanged as any);} catch {} }

  ngAfterViewInit(): void {
    // Caso stream já exista quando o template aparecer
    if (this.pendingAttach) {
      this.attachVideoStream();
    }
  }

  tick() {
    // O getter workedToday recalcula baseado em baseline + elapsed.
    // No changes needed in tick method as it is now handled by workedToday.
  }

  formatSecs(s: number): string { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }

  refreshStatus() {
    this.loadingStatus = true;
    this.check.status().subscribe({
      next: st => {
        this.status = st;
        const nowTs = Date.now();
        const localTotal = this.computeTotalWorked();
        const serverTotal = st.workedSeconds || 0;
        let chosen: number;
        if (!st.inService) {
          chosen = serverTotal; // nenhuma sessão aberta: confia totalmente no backend
        } else {
          chosen = Math.max(serverTotal, localTotal);
          if (serverTotal + 300 < localTotal) { // diferença grande sugere reinício
            chosen = serverTotal;
          }
        }
        this.baselineWorkedSeconds = chosen;
        this.baselineCaptureTs = nowTs;
        this.loadingStatus=false;
        this.persistWorkedCache(chosen, nowTs);
      },
      error: _ => this.loadingStatus=false
    });
  }
  
  private computeTotalWorked(): number {
    let total = this.baselineWorkedSeconds;
    if (this.status?.inService) {
      const elapsed = Math.floor((Date.now() - this.baselineCaptureTs)/1000);
      total += elapsed;
    }
    if (total % 15 === 0) this.persistWorkedCache(total, Date.now());
    return total;
  }

  private loadWorkedCache() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.date !== this.todayDate) return;
      if (typeof obj.secs === 'number' && typeof obj.ts === 'number') {
        this.baselineWorkedSeconds = obj.secs;
        this.baselineCaptureTs = obj.ts;
        (this as any)._initialWorkedDisplay = this.formatSecs(this.computeTotalWorked());
      }
    } catch {}
  }

  private persistWorkedCache(totalSecs: number, ts: number) {
    try { localStorage.setItem(this.cacheKey, JSON.stringify({ secs: totalSecs, ts, date: this.todayDate })); } catch {}
  }

  submitCheckIn() {
    if (this.submitting) return;
    if (!this.disciplineId) { this.message = 'Selecione uma disciplina antes.'; return; }
    if (!this.preceptorId || !this.code) { this.message='Informe Preceptor e Código'; return; }
    this.submitting=true; this.message='Obtendo localização...';
    this.getLocation().then(pos => {
      const { lat, lng } = pos || {} as any;
      this.message='Validando...';
      this.check.checkIn(this.preceptorId!, this.code.trim().toUpperCase(), this.disciplineId, lat, lng).subscribe({
      next: _ => {
        this.message='Check-In realizado';
        this.code='';
        this.refreshStatus();
        this.loadHistory('today');
        this.submitting=false;
        this.updateCachedUserStatus(true);
        this.broadcastServiceStatus(true);
      },
      error: err => { this.message = err?.error?.error || 'Falha no Check-In'; this.submitting=false; }
      });
    });
  }

  openCheckoutConfirm() {
    if (!this.status?.inService) return; // nada a confirmar
    this.showCheckoutConfirm = true;
  }
  cancelCheckout() { this.showCheckoutConfirm = false; }
  confirmCheckout() {
    if (this.submitting) return;
    this.submitting = true; this.message = 'Obtendo localização...';
    this.getLocation().then(pos => {
      const { lat, lng } = pos || {} as any;
      this.message = 'Encerrando...';
      this.check.checkOut(lat, lng).subscribe({
      next: _ => {
        this.message='Check-Out realizado';
        this.showCheckoutConfirm=false;
        this.refreshStatus();
        this.loadHistory('today');
        this.submitting=false;
        this.updateCachedUserStatus(false);
        this.broadcastServiceStatus(false);
      },
      error: err => { this.message = err?.error?.error || 'Falha no Check-Out'; this.showCheckoutConfirm=false; this.submitting=false; }
      });
    });
  }

  loadHistory(range: 'today'|'3d'|'3w'|'all'|null, customStart?: string, customEnd?: string) {
    this.loadingHistory = true;
    let sStr: string; let eStr: string;
    if (range) {
      const end = new Date();
      let start = new Date();
      if (range==='3d') start = new Date(Date.now()-3*24*3600*1000);
      else if (range==='3w') start = new Date(Date.now()-21*24*3600*1000);
      else if (range==='all') start = new Date(Date.now()-180*24*3600*1000); // 6 meses arbitrário
  // Converte cada Date para dia Acre (garante coerência com backend)
  sStr = todayAcreISODate(start);
  eStr = todayAcreISODate(end);
      // mantém campos do formulário alinhados
      this.startDate = sStr; this.endDate = eStr;
    } else {
      sStr = customStart!; eStr = customEnd!;
    }
    this.check.sessions(sStr, eStr, this.disciplineId).subscribe({
      next: list => {
        this.history = list;
        this.currentPage = 1; // reset página a cada novo carregamento
        this.loadingHistory=false;
        this.filterMessage = `Período: ${sStr} a ${eStr} (${list.length} registro(s))`;
      },
      error: _ => { this.loadingHistory=false; this.filterMessage='Falha ao buscar histórico'; }
    });
  }

  private readDisciplineFromLocal() {
    try {
      const stored = localStorage.getItem(this.LOCAL_DISC_KEY);
      if (stored) {
        const v = parseInt(stored,10); if (!Number.isNaN(v)) this.disciplineId = v;
      }
    } catch {}
  }

  private onDisciplineChanged = (e: CustomEvent) => {
    if (e?.detail?.id != null) this.disciplineId = e.detail.id; else this.readDisciplineFromLocal();
    this.loadHistory('today');
  };

  onSelectDiscipline(ev: Event) {
    const val = (ev.target as HTMLSelectElement).value;
    const id = val ? parseInt(val,10) : undefined;
    this.setDiscipline(id);
  }

  private setDiscipline(id?: number) {
    this.disciplineId = id;
    if (id != null) localStorage.setItem(this.LOCAL_DISC_KEY, String(id)); else localStorage.removeItem(this.LOCAL_DISC_KEY);
    window.dispatchEvent(new CustomEvent('mc:discipline-changed', { detail: { id } }));
    this.loadHistory('today');
  }

  private loadDisciplines() {
    this.disciplineLoading = true;
    this.http.get<any[]>('/api/users/me/disciplines').subscribe({
      next: list => {
        let arr = Array.isArray(list) ? list : [];
        if (!arr.length) {
          // fallback para endpoint antigo
          this.check.myDisciplines().subscribe({
            next: legacy => { this.applyLoadedDisciplines(Array.isArray(legacy) ? legacy : []); },
            error: _ => { this.applyLoadedDisciplines([]); }
          });
          return;
        }
        this.applyLoadedDisciplines(arr);
      },
      error: _ => {
        // fallback direto
        this.check.myDisciplines().subscribe({
          next: legacy => { this.applyLoadedDisciplines(Array.isArray(legacy) ? legacy : []); },
          error: _2 => { this.applyLoadedDisciplines([]); }
        });
      }
    });
  }

  private applyLoadedDisciplines(arr: any[]) {
    this.disciplines = arr || [];
    if (!this.disciplineId && this.disciplines.length) {
      this.setDiscipline(this.disciplines[0].id);
    } else if (this.disciplineId && !this.disciplines.some(d => d.id === this.disciplineId)) {
      if (this.disciplines.length) this.setDiscipline(this.disciplines[0].id); else this.setDiscipline(undefined);
    }
    this.disciplineLoading = false;
  }

  applyDateFilter() {
    if (!this.startDate || !this.endDate) { this.filterMessage = 'Informe datas inicial e final'; return; }
    if (this.startDate > this.endDate) { this.filterMessage = 'Data inicial maior que a final'; return; }
    this.filterMessage = 'Filtrando...';
    this.loadHistory(null, this.startDate, this.endDate);
  }

  // Helpers de paginação
  get totalPages(): number { return Math.max(1, Math.ceil(this.history.length / this.pageSize)); }
  get pagedHistory(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.history.slice(start, start + this.pageSize);
  }
  get pages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }
  setPage(p: number) { if (p < 1 || p > this.totalPages) return; this.currentPage = p; }
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  prevPage() { if (this.currentPage > 1) this.currentPage--; }

  async toggleScan() {
    if (this.scanning) {
      this.stopScan();
      return;
    }
    this.scanning = true; // garante que o elemento de vídeo exista antes de iniciar stream
    setTimeout(async () => {
      try {
        await this.ensureDevices();
  await this.startStream(this.selectedDeviceId || undefined);
  this.startDecodingLoop();
      } catch (e) {
        this.message = 'Não foi possível acessar a câmera';
        this.scanning = false;
      }
    });
  }

  private async ensureDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    this.videoDevices = list.filter(d => d.kind === 'videoinput');
    if (!this.selectedDeviceId && this.videoDevices.length) {
      // tenta escolher traseira (environment) se label indicar
      const env = this.videoDevices.find(d => /back|rear|environment/i.test(d.label));
      this.selectedDeviceId = env?.deviceId || this.videoDevices[0].deviceId;
    }
  }

  async startStream(deviceId?: string) {
    // não chamar stopScan() aqui porque apagaria scanning=true antes do elemento existir
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    const baseConstraints: any = { video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' } };
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia(baseConstraints);
    } catch (err) {
      // fallback: tenta sem facingMode específico
      if (!deviceId) {
        try {
          this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e2) {
          throw e2;
        }
      } else {
        throw err;
      }
    }
    this.attachVideoStream();
  }

  private async attachVideoStream() {
    const videoEl = this.qrVideoRef?.nativeElement;
    if (!videoEl) { this.pendingAttach = true; return; }
    this.pendingAttach = false;
    if (this.videoStream) {
      videoEl.srcObject = this.videoStream;
      try { await videoEl.play(); } catch {}
      if (videoEl.readyState < 2) {
        await new Promise(res => {
          const handler = () => { videoEl.removeEventListener('loadeddata', handler); res(null); };
          videoEl.addEventListener('loadeddata', handler);
          setTimeout(()=>res(null), 1200);
        });
      }
      setTimeout(()=> {
        if (this.scanning && videoEl.videoWidth === 0) {
          this.message = 'Câmera sem imagem: verifique permissões ou tente outra câmera.';
        }
      }, 1500);
    }
  }

  async onChangeDevice() {
    if (!this.selectedDeviceId) return;
    try { await this.startStream(this.selectedDeviceId); } catch { this.message = 'Falha ao trocar câmera'; }
  }

  stopScan() {
    this.scanning = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    if (this.scanRaf) { cancelAnimationFrame(this.scanRaf); this.scanRaf = null; }
  }

  private startDecodingLoop() {
    if (!this.scanCanvas) {
      this.scanCanvas = document.createElement('canvas');
      this.scanCtx = this.scanCanvas.getContext('2d');
    }
    const loop = async () => {
      if (!this.scanning) return;
      const videoEl = this.qrVideoRef?.nativeElement;
      if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
        const w = videoEl.videoWidth;
        const h = videoEl.videoHeight;
        if (this.scanCanvas && this.scanCtx) {
          this.scanCanvas.width = w; this.scanCanvas.height = h;
          try {
            this.scanCtx.drawImage(videoEl, 0, 0, w, h);
            const imgData = this.scanCtx.getImageData(0,0,w,h);
            let decoded: string | null = null;
            // 1) Tenta BarcodeDetector nativo se disponível e ainda não tentamos jsQR
            if (this.browserReady && 'BarcodeDetector' in window) {
              try {
                if (!this.barcodeDetector) {
                  // @ts-ignore
                  this.barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                }
                const barcodes = await this.barcodeDetector.detect(videoEl);
                if (barcodes && barcodes.length) {
                  decoded = barcodes[0].rawValue || barcodes[0].rawData || null;
                }
              } catch { /* ignora e tenta jsQR */ }
            }
            // 2) Se não decodificou e jsQR disponível / pode carregar
            if (!decoded) {
              // Carrega script jsQR via CDN somente se BarcodeDetector não resolveu
              if (this.browserReady && !this.jsqrFn) {
                await this.ensureJsQrLoaded();
              }
              if (this.jsqrFn) {
                try {
                  const result = this.jsqrFn(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
                  if (result && result.data) decoded = result.data;
                } catch {/* ignora */}
              }
            }
            if (decoded) {
              this.handleQrPayload(decoded);
              this.stopScan();
            }
          } catch {}
        }
      }
      this.scanRaf = requestAnimationFrame(loop);
    };
    this.scanRaf = requestAnimationFrame(loop);
  }

  private ensureJsQrLoaded(): Promise<void> {
    if (!this.browserReady) return Promise.resolve();
    if (this.jsqrFn) return Promise.resolve();
    if (this.jsqrLoadingPromise) return this.jsqrLoadingPromise;
    this.jsqrLoadingPromise = new Promise<void>((resolve) => {
      // tenta pegar global existente
      const existing = (window as any).jsQR;
      if (existing) { this.jsqrFn = existing; resolve(); return; }
      const scriptId = 'jsqr-cdn-script';
      if (document.getElementById(scriptId)) {
        // já injetado, aguarda próximo tick
        setTimeout(()=> { this.jsqrFn = (window as any).jsQR || null; resolve(); }, 50);
        return;
      }
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.async = true;
      s.onload = () => { this.jsqrFn = (window as any).jsQR || null; resolve(); };
      s.onerror = () => { /* falha silenciosa: ficaremos só com BarcodeDetector */ resolve(); };
      document.head.appendChild(s);
    });
    return this.jsqrLoadingPromise;
  }

  private handleQrPayload(raw: string) {
    // Espera payload JSON {code:"...", preceptorId:123}
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        if (obj.preceptorId && !isNaN(Number(obj.preceptorId))) {
          this.preceptorId = Number(obj.preceptorId);
        }
        if (obj.code && typeof obj.code === 'string') {
          this.code = obj.code;
        }
        // opcional: auto-submit se não estiver em serviço
        if (!this.status?.inService && this.preceptorId && this.code) {
          this.submitCheckIn();
        }
        this.message = 'QR lido com sucesso';
      }
    } catch {
      // Caso seja texto simples (não JSON), tenta interpretar como CODE-preceptorId (ex: ABC123-45)
      const m = raw.match(/^([A-Z0-9]{4,10})[-:](\d{1,6})$/i);
      if (m) {
        this.code = m[1];
        this.preceptorId = Number(m[2]);
        if (!this.status?.inService && this.preceptorId && this.code) {
          this.submitCheckIn();
        }
        this.message = 'QR lido';
      }
    }
  }
  /* ===================== REAL-TIME STATUS BROADCAST ===================== */
  private broadcastServiceStatus(inService: boolean) {
    try {
      const payload = { ts: Date.now(), inService };
      localStorage.setItem('mc:last-service-status', JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('mc:service-status-updated', { detail: payload }));
    } catch {}
  }
  private updateCachedUserStatus(inService: boolean){
    try {
      const raw = localStorage.getItem('mc_user') || sessionStorage.getItem('mc_user');
      if (!raw) return;
      const obj = JSON.parse(raw);
      obj.status = inService ? 'Em serviço' : 'Fora de serviço';
      const str = JSON.stringify(obj);
      if (localStorage.getItem('mc_user')) localStorage.setItem('mc_user', str); else sessionStorage.setItem('mc_user', str);
      window.dispatchEvent(new CustomEvent('mc:user-updated', { detail: obj }));
    } catch {}
  }
  /* ===================== GEOLOCALIZAÇÃO ===================== */
  private getLocation(): Promise<{lat:number,lng:number}|null> {
    return new Promise(resolve => {
      if (!('geolocation' in navigator)) { console.debug('[geo] geolocation API indisponível'); resolve(null); return; }
      const opts: PositionOptions = { enableHighAccuracy: false, maximumAge: 20000, timeout: 5000 };
      navigator.geolocation.getCurrentPosition(
        p => {
          const lat = +p.coords.latitude.toFixed(7);
          const lng = +p.coords.longitude.toFixed(7);
          console.debug('[geo] sucesso', lat, lng);
          resolve({ lat, lng });
        },
        err => { console.debug('[geo] falha', err?.code, err?.message); resolve(null); },
        opts
      );
    });
  }
  openLocation(lat:number,lng:number){ this.locLat = lat; this.locLng = lng; this.showLocModal = true; }
  closeLocation = () => { this.showLocModal = false; };
  // toggleDayMap removido
}
