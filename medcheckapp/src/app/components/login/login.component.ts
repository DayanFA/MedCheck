import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputMaskDirective } from '../../directives/input-masks.directive';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink, InputMaskDirective],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  credentials = {
    cpf: '',
    password: ''
  };
  rememberMe = false;
  showPassword = false;
  loading = false;
  currentYear = new Date().getFullYear();

  constructor(private authService: AuthService, private router: Router, private toast: ToastService) { }

  onSubmit() {
    if (this.loading) return;
    const payload = {
      cpf: this.credentials.cpf ? this.credentials.cpf.replace(/\D/g,'') : '',
      password: this.credentials.password
    };
    if (!payload.cpf || !payload.password) {
      this.toast.show('warning', 'Informe CPF e senha');
      return;
    }
    this.loading = true;
    console.log('[LOGIN] Enviando payload', payload);
    this.authService.login(payload).subscribe({
      next: response => {
        console.log('[LOGIN] Resposta', response);
        const token = response.accessToken || response.token || response.jwt;
        if (!token) {
          this.loading = false;
          this.toast.show('error', 'Resposta sem token.');
          return;
        }
        if (token) this.authService.setToken(token, this.rememberMe);
        const userPayload = {
          id: response.id, // novo id numérico vindo do backend
          name: response.name,
          matricula: response.matricula,
          cpf: response.cpf,
          email: response.email,
          role: response.role
        };
        if (response.name) this.authService.setUser(userPayload, this.rememberMe);
        this.toast.show('success', 'Login realizado.');
        // pequena pausa para garantir storage
        setTimeout(()=> {
          const role = (response.role || userPayload.role || '').toUpperCase();
          const target = '/home'; // unified home dispatcher handles role-specific view
          this.router.navigate([target]).then(ok => {
            if (!ok) console.warn('[LOGIN] Navegação para', target, 'falhou');
          });
        }, 50);
        this.loading = false;
      },
      error: err => {
  console.error('Login failed', err);
  const message = this.extractFriendlyError(err);
  const level = /senha|cpf|credenciais/i.test(message) ? 'warning' : 'error';
  this.toast.show(level as any, message);
  this.loading = false;
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private extractFriendlyError(err: any): string {
    if (err instanceof HttpErrorResponse) {
      if (err.error instanceof SyntaxError || /Unexpected token|Http failure during parsing/i.test(err.message)) {
        return 'Erro ao processar resposta. Tente novamente.';
      }
    }
    let backendMsg = '';
    if (typeof err?.error === 'string') backendMsg = err.error;
    else if (err?.error?.message) backendMsg = err.error.message;
    backendMsg = backendMsg || '';
    if (/inval/i.test(backendMsg) && /cpf/i.test(backendMsg)) return 'CPF inválido';
    if (/senha/i.test(backendMsg) && /incorreta|errada|invalida/i.test(backendMsg)) return 'Senha incorreta';
    if (/credenciais|bad credentials|unauthorized/i.test(backendMsg)) return 'Credenciais inválidas';
    if (/usuario|user/i.test(backendMsg) && /nao encontrado|não encontrado|inexistente/i.test(backendMsg)) return 'Usuário não encontrado';
    if (!backendMsg) return 'Falha no login. Verifique seus dados.';
    if (/unexpected token|not valid json|syntaxerror/i.test(backendMsg)) return 'Erro ao processar resposta. Tente novamente.';
    return backendMsg.length > 120 ? 'Falha no login.' : backendMsg;
  }
}
