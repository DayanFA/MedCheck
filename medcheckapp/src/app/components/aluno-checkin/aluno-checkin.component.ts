import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckInService } from '../../services/checkin.service';
// Nota: Para leitura de QR sem lib pesada, usamos um placeholder que pode ser trocado depois por 'jsqr'
// ou outra lib. Aqui fica apenas estrutura inicial (captura de vídeo) para integração posterior.

@Component({
  selector: 'app-aluno-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aluno-checkin.component.html',
  styleUrls: ['./aluno-checkin.component.scss']
})
export class AlunoCheckinComponent implements OnInit, OnDestroy, AfterViewInit {
  preceptorId: number | null = null;
  code = '';
  status: any = null;
  history: any[] = [];
  loadingStatus = false;
  loadingHistory = false;
  submitting = false;
  message = '';
  filterMessage = '';
  startDate = new Date().toISOString().substring(0,10);
  endDate = new Date().toISOString().substring(0,10);
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

  // Futuro: integrar decodificação real de QR (ex: jsQR). Por enquanto, placeholder para mostrar câmera.

  constructor(private check: CheckInService) {}

  ngOnInit(): void {
    this.refreshStatus();
    this.loadHistory('today');
    this.timerId = setInterval(()=> this.tick(), 1000);
  }
  ngOnDestroy(): void { if (this.timerId) clearInterval(this.timerId); this.stopScan(); }

  ngAfterViewInit(): void {
    // Caso stream já exista quando o template aparecer
    if (this.pendingAttach) {
      this.attachVideoStream();
    }
  }

  tick() {
    if (this.status?.inService && this.status?.openSession?.checkInTime) {
      // recompute workedSeconds dynamically (optimistic updating)
      const start = new Date(this.status.openSession.checkInTime).getTime();
      const now = Date.now();
      const secsExtra = Math.floor((now - start)/1000);
      const base = this.status.baseWorkedSeconds || 0;
      this.status.dynamicWorked = base + secsExtra;
    }
  }

  formatSecs(s: number): string { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }

  refreshStatus() {
    this.loadingStatus = true;
    this.check.status().subscribe({
      next: st => { this.status = st; this.status.baseWorkedSeconds = st.workedSeconds || 0; this.loadingStatus=false; },
      error: _ => this.loadingStatus=false
    });
  }

  submitCheckIn() {
    if (this.submitting) return;
    if (!this.preceptorId || !this.code) { this.message='Informe Preceptor e Código'; return; }
    this.submitting=true; this.message='Validando...';
    this.check.checkIn(this.preceptorId, this.code.trim()).subscribe({
      next: _ => { this.message='Check-In realizado'; this.code=''; this.refreshStatus(); this.loadHistory('today'); this.submitting=false; },
      error: err => { this.message = err?.error?.error || 'Falha no Check-In'; this.submitting=false; }
    });
  }

  doCheckOut() {
    if (this.submitting) return;
    this.submitting=true; this.message='Encerrando...';
    this.check.checkOut().subscribe({
      next: _ => { this.message='Check-Out realizado'; this.refreshStatus(); this.loadHistory('today'); this.submitting=false; },
      error: err => { this.message = err?.error?.error || 'Falha no Check-Out'; this.submitting=false; }
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
      sStr = start.toISOString().substring(0,10);
      eStr = end.toISOString().substring(0,10);
      // mantém campos do formulário alinhados
      this.startDate = sStr; this.endDate = eStr;
    } else {
      sStr = customStart!; eStr = customEnd!;
    }
    this.check.sessions(sStr, eStr).subscribe({
      next: list => { this.history = list; this.loadingHistory=false; this.filterMessage = `Período: ${sStr} a ${eStr} (${list.length} registro(s))`; },
      error: _ => { this.loadingHistory=false; this.filterMessage='Falha ao buscar histórico'; }
    });
  }

  applyDateFilter() {
    if (!this.startDate || !this.endDate) { this.filterMessage = 'Informe datas inicial e final'; return; }
    if (this.startDate > this.endDate) { this.filterMessage = 'Data inicial maior que a final'; return; }
    this.filterMessage = 'Filtrando...';
    this.loadHistory(null, this.startDate, this.endDate);
  }

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
}
