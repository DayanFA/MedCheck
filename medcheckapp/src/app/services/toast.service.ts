import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
  timeout?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private _messages$ = new Subject<ToastMessage[]>();
  private messages: ToastMessage[] = [];

  messages$ = this._messages$.asObservable();

  constructor(){
    if (typeof window === 'undefined') return; // SSR skip
    try {
      const stored = window.localStorage?.getItem('pending_toasts');
      if (stored) {
        this.messages = JSON.parse(stored);
        this.emit();
        this.messages.forEach(m => setTimeout(()=>this.dismiss(m.id), m.timeout || 3000));
      }
    } catch {}
  }

  // (removed non-persisting versions)

  private emit() { this._messages$.next([...this.messages]); }
  private persist() {
    if (typeof window === 'undefined') return;
    try { window.localStorage?.setItem('pending_toasts', JSON.stringify(this.messages)); } catch {}
  }
  private emitAndPersist(){ this.emit(); this.persist(); }
  // Persisting versions
  show(type: ToastMessage['type'], text: string, timeout = 3500) {
    const msg: ToastMessage = { id: ++this.counter, type, text, timeout };
    this.messages.push(msg);
    this.emitAndPersist();
    if (timeout) {
      setTimeout(() => this.dismiss(msg.id), timeout);
    }
  }
  dismiss(id: number) {
    this.messages = this.messages.filter(m => m.id !== id);
    this.emitAndPersist();
  }
}
