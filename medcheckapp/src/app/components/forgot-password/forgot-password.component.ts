import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  email = '';
  submitted = false;
  loading = false;
  currentYear = new Date().getFullYear();

  constructor(private auth: AuthService, private toast: ToastService, private router: Router) {}

  submit() {
    if (!this.email) {
      this.toast.show('warning', 'Informe o e-mail.');
      return;
    }
    this.loading = true;
    // Chamada futura ao backend /api/auth/forgot-password
    this.auth.requestPasswordReset(this.email).subscribe({
      next: _ => {
        this.loading = false;
        this.submitted = true;
        this.toast.show('success', 'Se o e-mail existir, enviaremos instruções.');
      },
      error: _ => {
        this.loading = false;
        this.submitted = true; // mesmo comportamento para evitar enumeração
        this.toast.show('success', 'Se o e-mail existir, enviaremos instruções.');
      }
    });
  }

  goBack() {
    this.router.navigate(['/login']);
  }
}
