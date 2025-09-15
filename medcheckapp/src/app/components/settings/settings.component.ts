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

  ngOnInit() {
    this.loadMe();
    // Tenta carregar a foto sempre no browser; se não houver, fica no ícone
    if (isPlatformBrowser(this.platformId)) {
      // atraso mínimo para garantir token em storage
      setTimeout(() => this.loadPhoto(), 0);
    }
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
        this.loading = false;
      },
      error: _ => { this.loading = false; this.msg = 'Falha ao carregar dados'; }
    });
  }

  private loadPhoto() {
    this.http.get('/api/users/me/photo', { headers: this.headers(), responseType: 'blob' }).subscribe({
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
    if (file.size > 2_000_000) { this.msg = 'Arquivo muito grande (máx 2MB)'; return; }
    const form = new FormData();
    form.append('file', file);
    this.saving = true; this.msg='';
    this.http.post('/api/users/me/photo', form, { headers: this.headers() }).subscribe({
      next: _ => { this.saving=false; this.msg='Foto atualizada'; this.loadPhoto(); this.refreshCachedUser(true); },
      error: _ => { this.saving=false; this.msg='Falha ao enviar foto'; }
    });
  }

  removePhoto() {
    this.saving = true; this.msg='';
    this.http.delete('/api/users/me/photo', { headers: this.headers() }).subscribe({
      next: _ => { this.saving=false; this.msg='Foto removida'; this.clearPhotoUrl(); this.refreshCachedUser(true); },
      error: _ => { this.saving=false; this.msg='Falha ao remover foto'; }
    });
  }

  private refreshCachedUser(force?: boolean) {
    // optionally update local cached user with new phone
    try {
      this.auth.me().subscribe(u => this.auth.setUser(u, true));
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
