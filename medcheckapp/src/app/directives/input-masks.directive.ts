import { Directive, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[appMask]',
  standalone: true
})
export class InputMaskDirective {
  @Input('appMask') maskType: 'cpf' | 'phone' | 'matricula' | '' = '';
  // Custom pattern ex: ###.###.###-## (use # para dígitos)
  @Input() maskPattern?: string;
  @Input() maskPlaceholder: string = '_';

  @HostListener('input', ['$event']) onInput(e: Event) {
    const input = e.target as HTMLInputElement;
  const value = input.value;
  // Para máscaras numéricas usamos apenas dígitos; para matrícula permitimos alfanumérico
  const rawDigits = value.replace(/\D/g, '');
  let formatted = rawDigits;

    if (this.maskPattern) {
      formatted = this.applyPattern(rawDigits, this.maskPattern);
      input.value = formatted;
      return;
    }
    if (this.maskType === 'cpf') {
      formatted = rawDigits
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else if (this.maskType === 'phone') {
      // Supports 10 or 11 digits
      if (rawDigits.length <= 10) {
        formatted = rawDigits
          .slice(0, 10)
          .replace(/(\d{2})(\d)/, '($1)$2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        formatted = rawDigits
          .slice(0, 11)
          .replace(/(\d{2})(\d)/, '($1)$2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    } else if (this.maskType === 'matricula') {
      // Permite letras e números; remove tudo que não for A-Z a-z 0-9, limita 40
      const alnum = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      formatted = alnum.slice(0, 40);
    }
    input.value = formatted;
  }

  private applyPattern(digits: string, pattern: string): string {
    let out = '';
    let di = 0;
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '#') {
        if (di < digits.length) {
          out += digits[di++];
        } else {
          break; // para não mostrar placeholders além do necessário
        }
      } else {
        if (di < digits.length) out += ch; else break;
      }
    }
    return out;
  }
}
