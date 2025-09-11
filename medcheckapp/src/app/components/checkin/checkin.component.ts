import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckInService } from '../../services/checkin.service';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkin.component.html',
  styleUrl: './checkin.component.scss'
})
export class CheckInComponent implements OnInit {
  code = '';
  preceptorId: number | null = null;
  history: any[] = [];
  message = '';
  loadingHistory = false;

  constructor(private check: CheckInService) {}

  ngOnInit(): void {
    // default date range today
    this.loadHistory();
  }

  submit() {
    if (!this.preceptorId || !this.code) { this.message = 'Informe preceptor e código'; return; }
    this.message = 'Validando...';
    this.check.checkIn(this.preceptorId, this.code.trim()).subscribe({
      next: _ => { this.message = 'Check-In realizado'; this.code = ''; this.loadHistory(); },
      error: err => { this.message = err?.error?.error || 'Falha ao validar'; }
    });
  }

  loadHistory() {
    this.loadingHistory = true;
    const today = new Date().toISOString().substring(0,10);
    this.check.sessions(today, today).subscribe({
      next: list => { this.history = list; this.loadingHistory = false; },
      error: _ => { this.loadingHistory = false; }
    });
  }
}
