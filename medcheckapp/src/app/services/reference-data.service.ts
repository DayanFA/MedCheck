import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  // Lista simplificada; pode ser substituída por chamada HTTP futura
  private countries = [
    'Brasil','Argentina','Bolívia','Chile','Colômbia','Equador','Guiana','Paraguai','Peru','Suriname','Uruguai','Venezuela',
    'Estados Unidos','Canadá','México','Portugal','Espanha','França','Alemanha','Itália','Japão','China'
  ];

  getCountries() { return this.countries; }
}
