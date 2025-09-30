import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputMaskDirective } from '../../directives/input-masks.directive';
import { ReferenceDataService } from '../../services/reference-data.service';
import { ToastService } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, CommonModule, InputMaskDirective, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  userData = {
    name: '',
    cpf: '',
    institutionalEmail: '',
  password: '',
  matricula: '',
  dataNascimento: '',
  naturalidade: '',
  nacionalidade: 'Brasil',
    telefone: '',
    confirmPassword: ''
  };

  estados = [
    'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins','Outro'
  ];
  nacionalidades: string[] = [];
  showPass = false;
  showConfirm = false;
  errors: string[] = [];
  passwordStrength = 0; // 0 a 100
  cpfInvalid = false;
  birthDateInvalid = false;
  loading = false;
  private draftKey = 'signup_draft_v1';
  successModal = false;

  constructor(private authService: AuthService, private router: Router, private refData: ReferenceDataService, private toast: ToastService) {
    this.nacionalidades = this.refData.getCountries();
    if (!this.nacionalidades.includes('Outro')) this.nacionalidades.push('Outro');
  }

  ngOnInit() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.draftKey);
      if (raw) {
        const saved = JSON.parse(raw);
        // Restaura somente campos não sensíveis
        this.userData.name = saved.name || '';
        this.userData.cpf = saved.cpf || '';
        this.userData.institutionalEmail = saved.institutionalEmail || '';
        this.userData.matricula = saved.matricula || '';
        this.userData.dataNascimento = saved.dataNascimento || '';
        this.userData.naturalidade = saved.naturalidade || '';
        this.userData.nacionalidade = saved.nacionalidade || 'Brasil';
        this.userData.telefone = saved.telefone || '';
        // Recalcula força se houver senha (não armazenamos senha)
      }
    } catch {}
  }

  onSubmit() {
  // Ajustar payload conforme backend espera (adapte se necessário)
    this.errors = [];
    // Matrícula obrigatória (alfa-numérica 3-40)
    const matriculaTrim = (this.userData.matricula || '').trim();
    if (!matriculaTrim) {
      this.errors.push('Matrícula obrigatória.');
    } else if (!/^[A-Za-z0-9]{3,40}$/.test(matriculaTrim)) {
      this.errors.push('Matrícula inválida (use apenas letras e números, 3-40).');
    }
    // Data de nascimento
    if (this.isBirthDateInvalid()) {
      this.errors.push('Data de nascimento inválida.');
      this.birthDateInvalid = true;
    } else {
      this.birthDateInvalid = false;
    }
    if (this.passwordStrength < 70) {
      this.errors.push('Senha muito fraca (mínimo aceitável: forte).');
    }
    if (this.userData.password !== this.userData.confirmPassword) {
      this.errors.push('As senhas não conferem.');
    }
  const digitsCpf = this.userData.cpf.replace(/\D/g,'');
  if (!this.isCpfValid(this.userData.cpf)) this.errors.push('CPF inválido.');
    // Telefone 10 ou 11 dígitos
    const digitsPhone = this.userData.telefone.replace(/\D/g,'');
    if (digitsPhone.length < 10) this.errors.push('Telefone inválido.');

    if (this.errors.length) {
      console.debug('[SIGNUP_BLOCKED]', {
        reasons: this.errors,
        passwordStrength: this.passwordStrength,
        cpfInvalid: this.cpfInvalid,
        formSnapshot: { ...this.userData, password: this.userData.password ? '***' : '', confirmPassword: this.userData.confirmPassword ? '***': '' }
      });
      this.toast.show('error', 'Erros no formulário.');
      return; // não prossegue
    }

    // Normaliza data (yyyy-MM-dd)
    const birthDate = this.userData.dataNascimento ? new Date(this.userData.dataNascimento + 'T00:00:00') : null;
    const payload: any = {
      name: this.userData.name.trim(),
      birthDate: birthDate ? birthDate.toISOString().substring(0,10) : null,
      matricula: matriculaTrim || null,
      cpf: digitsCpf,
      naturalidade: this.userData.naturalidade,
      nacionalidade: this.userData.nacionalidade,
      phone: digitsPhone,
      institutionalEmail: this.userData.institutionalEmail,
      password: this.userData.password
    };
    console.debug('[SIGNUP_SUBMIT_PAYLOAD]', payload);
  this.loading = true;
  console.debug('[SIGNUP_REQUEST_OUT]', payload);
  this.authService.signup(payload).subscribe({
      next: response => {
        this.loading = false;
    console.debug('[SIGNUP_RESPONSE_OK]', response);
    this.successModal = true; // exibe modal; navega após confirmação
      },
      error: err => {
        this.loading = false;
        console.error('Signup failed', err);
        console.debug('[SIGNUP_RESPONSE_ERROR]', { status: err?.status, error: err?.error });
        const friendly = this.extractFriendlyError(err);
        this.errors.push(friendly);
        const level = /já cadastrado|cadastrado/i.test(friendly) ? 'warning' : 'error';
        this.toast.show(level as any, friendly);
      }
    });
  }

  toggleShowPass() { this.showPass = !this.showPass; }
  toggleShowConfirm() { this.showConfirm = !this.showConfirm; }

  onPasswordInput() {
    this.passwordStrength = this.computeStrength(this.userData.password);
  this.persistDraft();
  }

  onCpfInput() {
    const digits = this.userData.cpf.replace(/\D/g,'');
    if (digits.length === 11) {
      this.cpfInvalid = !this.isCpfValid(this.userData.cpf);
    } else {
      this.cpfInvalid = false; // ainda digitando
    }
  this.persistDraft();
  }

  private computeStrength(pwd: string): number {
    if (!pwd) return 0;
    let score = 0;
    const length = pwd.length;
    if (length >= 6) score += 15;
    if (length >= 10) score += 15;
    if (/[a-z]/.test(pwd)) score += 15;
    if (/[A-Z]/.test(pwd)) score += 15;
    if (/\d/.test(pwd)) score += 20;
    if (/[^\w\s]/.test(pwd)) score += 20;
    return Math.min(score, 100);
  }

  private isBirthDateInvalid(): boolean {
    const raw = this.userData.dataNascimento;
    if (!raw) return true; // required já trata, mas reforçamos
    // Espera formato yyyy-MM-dd do input date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return true;
    const date = new Date(raw + 'T00:00:00');
    if (isNaN(date.getTime())) return true;
    const today = new Date();
    // Não pode ser futura
    if (date > today) return true;
    // Idade mínima (ex: 16 anos) - ajuste se precisar
    const min = new Date();
    min.setFullYear(min.getFullYear() - 16);
    if (date > min) return true; // muito jovem
    // Idade máxima razoável ( >120 anos provavelmente erro )
    const max = new Date();
    max.setFullYear(max.getFullYear() - 120);
    if (date < max) return true;
    return false;
  }

  onBirthDateInput() {
    this.birthDateInvalid = this.isBirthDateInvalid();
  }

  private isCpfValid(cpfRaw: string): boolean {
    if (!cpfRaw) return false;
    const cpf = cpfRaw.replace(/\D/g,'');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const calc = (factorStart: number) => {
      let total = 0;
      for (let i = 0; i < factorStart - 1; i++) {
        total += parseInt(cpf[i], 10) * (factorStart - i);
      }
      const rest = (total * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    const d1 = calc(10);
    const d2 = calc(11);
    return d1 === parseInt(cpf[9],10) && d2 === parseInt(cpf[10],10);
  }

  private persistDraft() {
    if (typeof window === 'undefined') return;
    try {
      const draft = { ...this.userData };
      // remove campos sensíveis
      delete (draft as any).password;
      delete (draft as any).confirmPassword;
      window.localStorage.setItem(this.draftKey, JSON.stringify(draft));
    } catch {}
  }

  private clearDraft() {
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(this.draftKey); } catch {}
  }

  private extractFriendlyError(err: any): string {
    // Evita expor mensagens técnicas como "Unexpected token ..." ao usuário
    if (err instanceof HttpErrorResponse) {
      // Erro de parsing de JSON do Angular
      if (err.error instanceof SyntaxError || /Unexpected token|Http failure during parsing/i.test(err.message)) {
        return 'Erro ao processar resposta. Tente novamente.';
      }
    }
    let backendMsg = '';
    if (typeof err?.error === 'string') backendMsg = err.error;
    else if (err?.error?.message) backendMsg = err.error.message;
    backendMsg = backendMsg || '';
    if (/cpf.+cadastrado/i.test(backendMsg) || /já cadastrado/i.test(backendMsg)) return 'Usuário já cadastrado';
    if (/mail/i.test(backendMsg) && /cadastr/i.test(backendMsg)) return 'E-mail já cadastrado';
    if (/cpf/i.test(backendMsg) && /inv[aá]lido/i.test(backendMsg)) return 'CPF inválido';
    if (/telefone/i.test(backendMsg) && /inv[aá]lido/i.test(backendMsg)) return 'Telefone inválido';
    if (/senha/i.test(backendMsg) && /fraca/i.test(backendMsg)) return 'Senha muito fraca';
    if (/obrigat[oó]rio/i.test(backendMsg)) return backendMsg;
    if (!backendMsg) return 'Falha ao cadastrar. Tente novamente.';
    // Fallback genérico sem expor inglês ou stack
    if (/unexpected token|not valid json|syntaxerror/i.test(backendMsg)) return 'Erro ao processar resposta. Tente novamente.';
    return backendMsg.length > 120 ? 'Erro ao cadastrar.' : backendMsg;
  }

  confirmSuccess() {
    this.successModal = false;
    this.clearDraft();
    this.router.navigate(['/login']);
  }
}
