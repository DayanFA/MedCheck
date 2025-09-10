import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  strength = 0;
  submitting = false;
  done = false;
  showPassword = false;
  showConfirm = false;

  constructor(private route: ActivatedRoute, private auth: AuthService, private toast: ToastService, private router: Router) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.toast.show('error', 'Token ausente.');
    }
  }

  calcStrength(p: string): number {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s += 20;
    if (p.length >= 10) s += 20;
    if (/[a-z]/.test(p)) s += 15;
    if (/[A-Z]/.test(p)) s += 15;
    if (/[0-9]/.test(p)) s += 15;
    if (/[^\w\s]/.test(p)) s += 15;
    return Math.min(100, s);
  }

  onPasswordInput() { this.strength = this.calcStrength(this.password); }

  toggleShow(which: 'p' | 'c') {
    if (which === 'p') this.showPassword = !this.showPassword;
    else this.showConfirm = !this.showConfirm;
  }

  submit() {
    if (!this.token) { this.toast.show('error', 'Token inválido.'); return; }
    if (this.password !== this.confirmPassword) { this.toast.show('warning', 'Senhas não conferem'); return; }
    if (this.strength < 70) { this.toast.show('warning', 'Senha muito fraca'); return; }
    this.submitting = true;
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: (res) => {
        this.submitting = false;
        this.done = true;
        this.toast.show('success', res?.message || 'Senha redefinida');
        setTimeout(()=> this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.submitting = false;
        const msg = (err?.error?.message) ? err.error.message : 'Falha ao redefinir';
        this.toast.show('error', msg);
      }
    });
  }
}
