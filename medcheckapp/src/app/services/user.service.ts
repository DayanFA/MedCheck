import { Injectable } from '@angular/core';

export interface CurrentUser {
  name: string;
  matricula: string;
  cpf: string;
  email: string;
  status: string;
  performedHours: string; // HH:mm:ss
}

@Injectable({ providedIn: 'root' })
export class UserService {
  // Fallback local (deprecated) - remover quando backend /me estiver estável
  getCurrentUser(): CurrentUser {
    return {
      name: 'Usuário',
      matricula: '',
      cpf: '',
      email: '',
      status: 'Em serviço',
      performedHours: '00:00:00'
    };
  }
}
