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
    const raw = input.value.replace(/\D/g, '');
    let formatted = raw;

    if (this.maskPattern) {
      formatted = this.applyPattern(raw, this.maskPattern);
      input.value = formatted;
      return;
    }
  if (this.maskType === 'cpf') {
      formatted = raw
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else if (this.maskType === 'phone') {
      // Supports 10 or 11 digits
      if (raw.length <= 10) {
        formatted = raw
          .slice(0, 10)
          .replace(/(\d{2})(\d)/, '($1)$2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        formatted = raw
          .slice(0, 11)
          .replace(/(\d{2})(\d)/, '($1)$2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    } else if (this.maskType === 'matricula') {
      formatted = raw.slice(0, 12); // limita a 12 dígitos
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
