import { Component, OnDestroy, Inject, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { InputMaskDirective } from '../../directives/input-masks.directive';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InputMaskDirective],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  phone = '';
  loading = false;
  saving = false;
  msg = '';
  photoUrl = '';
  private photoObjectUrl: string | null = null;
  private hasAvatar = false;

  ngOnInit() {
    this.loadMe();
  }

  ngOnDestroy(): void {
    this.clearPhotoUrl();
  }

  private headers(): HttpHeaders | undefined {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined as any;
  }

  loadMe() {
    this.loading = true;
    this.auth.me().subscribe({
      next: (me: any) => {
        this.phone = this.formatPhoneNumber(me?.phone || '');
        this.hasAvatar = !!me?.hasAvatar;
        this.loading = false;
        // Carrega a foto apenas se existir, evitando 404 desnecessário
        if (isPlatformBrowser(this.platformId) && this.hasAvatar) {
          this.loadPhoto();
        } else if (!this.hasAvatar) {
          this.clearPhotoUrl();
        }
      },
      error: _ => { this.loading = false; this.msg = 'Falha ao carregar dados'; }
    });
  }

  private loadPhoto() {
    const ts = Date.now();
    this.http.get(`/api/users/me/photo?t=${ts}` as string, { headers: this.headers(), responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.clearPhotoUrl();
        const url = URL.createObjectURL(blob);
        this.photoObjectUrl = url;
        this.photoUrl = url;
      },
      error: _ => { /* Sem foto ou erro: deixa vazio */ this.clearPhotoUrl(); }
    });
  }

  private clearPhotoUrl() {
    if (this.photoObjectUrl) {
      try { URL.revokeObjectURL(this.photoObjectUrl); } catch {}
    }
    this.photoObjectUrl = null;
    this.photoUrl = '';
  }

  save() {
    const digitsOnly = (this.phone || '').replace(/\D/g, '');
    if (!digitsOnly) {
      this.msg = 'Informe um telefone válido';
      return;
    }
    this.saving = true; this.msg='';
    this.http.put('/api/users/me', { phone: digitsOnly }, { headers: this.headers() }).subscribe({
      next: _ => { this.saving = false; this.msg = 'Alterações salvas'; this.refreshCachedUser(); },
      error: _ => { this.saving = false; this.msg = 'Falha ao salvar'; }
    });
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
  if (file.size > 5_000_000) { this.msg = 'Arquivo muito grande (máx 5MB)'; return; }
    const form = new FormData();
    form.append('file', file);
    this.saving = true; this.msg='';
    this.http.post('/api/users/me/photo', form, { headers: this.headers() }).subscribe({
      next: _ => { this.saving=false; this.msg='Foto atualizada'; this.hasAvatar = true; this.loadPhoto(); this.refreshCachedUser(true); },
      error: _ => { this.saving=false; this.msg='Falha ao enviar foto'; }
    });
  }

  // Remoção de foto desabilitada por regra; usuário pode apenas trocar a foto

  private refreshCachedUser(force?: boolean) {
    // Atualiza imediatamente o cache do usuário com dados completos (inclui hasAvatar)
    try {
      const remember = this.auth.isRemembered();
      this.http.get('/api/users/me', { headers: this.headers() }).subscribe({
        next: (profile: any) => {
          try {
            const raw = localStorage.getItem('mc_user') || sessionStorage.getItem('mc_user') || '{}';
            const cached = JSON.parse(raw || '{}');
            const merged = { ...cached, ...profile };
            this.auth.setUser(merged, remember);
            this.hasAvatar = !!merged?.hasAvatar;
            if (this.hasAvatar) {
              this.loadPhoto();
            } else {
              this.clearPhotoUrl();
            }
          } catch { /* ignore parse errors */ }
        },
        error: _ => { /* ignore */ }
      });
    } catch {}
  }

  private formatPhoneNumber(v: string): string {
    if (!v) return '';
    const raw = v.replace(/\D/g, '');
    if (raw.length <= 10) {
      // (XX) XXXX-XXXX
      return raw
        .slice(0, 10)
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    // (XX) XXXXX-XXXX
    return raw
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }

  get phoneDigitsCount(): number {
    return (this.phone || '').replace(/\D/g, '').length;
  }
}
