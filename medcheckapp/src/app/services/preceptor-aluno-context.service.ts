import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PreceptorAlunoContextService {
  private ID_KEY = 'mc_preceptor_current_aluno_id';
  private NAME_KEY = 'mc_preceptor_current_aluno_name';

  setAluno(id: number, name: string) {
    try {
      localStorage.setItem(this.ID_KEY, String(id));
      localStorage.setItem(this.NAME_KEY, name || '');
    } catch {}
    this.dispatch(id, name);
  }

  clear() {
    try {
      localStorage.removeItem(this.ID_KEY);
      localStorage.removeItem(this.NAME_KEY);
    } catch {}
    this.dispatch(null, null);
  }

  getAluno(): { id: number | null; name: string | null } {
    let id: number | null = null; let name: string | null = null;
    try {
      const rawId = localStorage.getItem(this.ID_KEY);
      const rawName = localStorage.getItem(this.NAME_KEY);
      if (rawId) {
        const parsed = parseInt(rawId, 10);
        if (!Number.isNaN(parsed)) id = parsed; else id = null;
      }
      if (rawName) name = rawName || null;
    } catch {}
    return { id, name };
  }

  private dispatch(id: number | null, name: string | null) {
    try { window.dispatchEvent(new CustomEvent('mc:aluno-changed', { detail: { id, name } })); } catch {}
  }
}
