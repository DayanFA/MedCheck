import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CpfPipe } from '../../pipes/cpf.pipe';
import { InputMaskDirective } from '../../directives/input-masks.directive';
import { ReferenceDataService } from '../../services/reference-data.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, CpfPipe, InputMaskDirective],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent {
  private http = inject(HttpClient);
  private refData = inject(ReferenceDataService);
  private toast = inject(ToastService);

  loading = false;
  users: any[] = [];
  roles = ['ALUNO','PRECEPTOR','COORDENADOR','ADMIN'];
  nacionalidades: string[] = [];
  estados = [
    'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins','Outro'
  ];
  // Flags de validação
  cpfInvalid = false;
  birthDateInvalid = false;
  phoneInvalid = false;
  matriculaInvalid = false;

  msg = '';
  // Filtros
  disciplines: any[] = [];
  disciplineId: number | '' = '';
  q: string = '';
  // Paginação
  page = 0; size = 25; totalPages = 0; totalItems = 0;

  // Edição
  editingUser: any = null;
  savingEdit = false;
  confirmSave = false; // modal confirmação
  pendingSubmit: any = null; // payload aguardando confirmação
  // Exclusão
  confirmDelete = false;
  deletingUser: any = null;
  deleting = false;

  ngOnInit() { this.fetchDisciplines(); this.load(); }

  load(resetPage: boolean = false) {
    if (resetPage) this.page = 0;
    this.loading = true;
    const params: any = { page: this.page, size: this.size };
    if (this.disciplineId) params.disciplineId = this.disciplineId;
    if (this.q && this.q.trim()) params.q = this.q.trim();
    this.http.get<any>('/api/admin/users', { params }).subscribe({
      next: data => {
        this.users = data.items || [];
        this.page = data.page;
        this.size = data.size;
        this.totalPages = data.totalPages;
        this.totalItems = data.totalItems;
        this.loading = false;
      },
      error: _ => { this.msg = 'Falha ao carregar usuários'; this.loading = false; }
    });
  }

  fetchDisciplines() {
    this.http.get<any[]>('/api/admin/disciplines').subscribe({
      next: list => { this.disciplines = list || []; },
      error: _ => { /* silencioso */ }
    });
  }

  onChangeDiscipline() { this.load(true); }
  onSearchEnter(ev: KeyboardEvent) { if (ev.key === 'Enter') this.load(true); }
  clearSearch() { this.q=''; this.load(true); }
  nextPage() { if (this.page + 1 < this.totalPages) { this.page++; this.load(); } }
  prevPage() { if (this.page > 0) { this.page--; this.load(); } }
  firstPage() { if (this.page!==0) { this.page=0; this.load(); } }
  lastPage() { if (this.page+1 < this.totalPages) { this.page = this.totalPages -1; this.load(); } }

  changeRole(u: any, role: any) {
    const value = String(role);
    this.http.put(`/api/admin/users/${u.id}/role`, { role: value }).subscribe({
  next: _ => { this.toast.show('success','Role atualizada'); u.role = role; },
  error: _ => { this.toast.show('error','Falha ao atualizar role'); }
    });
  }

  deleteUser(u: any) {
    // Abre modal de confirmação custom
    this.deletingUser = u;
    this.confirmDelete = true;
  }

  confirmDeleteCancel() {
    this.confirmDelete = false;
    this.deletingUser = null;
    this.deleting = false;
  }

  confirmDeleteProceed() {
    if (!this.deletingUser) return;
    this.deleting = true;
    const id = this.deletingUser.id;
    this.http.delete(`/api/admin/users/${id}`).subscribe({
      next: _ => {
        this.users = this.users.filter(x => x.id !== id);
        this.toast.show('success','Usuário excluído');
        this.deleting = false;
        this.confirmDelete = false;
        this.deletingUser = null;
      },
      error: _ => {
        this.toast.show('error','Falha ao excluir');
        this.deleting = false;
      }
    });
  }

  openEdit(u: any) {
    this.http.get<any>(`/api/admin/users/${u.id}`).subscribe({
      next: data => {
        this.ensureNacionalidades();
        this.editingUser = { ...data };
        if (!this.editingUser.nacionalidade) this.editingUser.nacionalidade = 'Brasil';
        // Máscaras iniciais
        if (this.editingUser.cpf) {
          const digits = String(this.editingUser.cpf).replace(/\D/g,'').substring(0,11);
            this.editingUser.cpf = this.maskCpf(digits);
            this.cpfInvalid = digits.length === 11 ? !this.isCpfValid(digits) : false;
        }
        if (this.editingUser.phone) {
          const digits = String(this.editingUser.phone).replace(/\D/g,'').substring(0,11);
          this.editingUser.phone = this.maskPhone(digits);
          this.phoneInvalid = digits.length>0 && digits.length < 10;
        }
      },
  error: _ => { this.toast.show('error','Falha ao carregar detalhes do usuário'); }
    });
  }
  cancelEdit() {
    this.editingUser = null;
    this.confirmSave = false;
    this.pendingSubmit = null;
  }

  saveEdit() {
    if (!this.editingUser) return;
    this.validateAll();
    if (this.cpfInvalid || this.birthDateInvalid || this.phoneInvalid || this.matriculaInvalid) {
  this.toast.show('error','Corrija os campos inválidos antes de salvar.');
      return;
    }
    const payload = {
      name: this.editingUser.name?.trim(),
      cpf: (this.editingUser.cpf || '').replace(/\D/g, ''),
      email: this.editingUser.email?.trim(),
      phone: (this.editingUser.phone || '').replace(/\D/g, ''),
      matricula: this.editingUser.matricula?.trim() || null,
      birthDate: this.editingUser.birthDate || null,
      naturalidade: this.editingUser.naturalidade || null,
      nacionalidade: this.editingUser.nacionalidade || 'Brasil'
    };
    this.pendingSubmit = payload;
    this.confirmSave = true;
  }

  confirmSaveCancel() {
    this.confirmSave = false;
    this.pendingSubmit = null;
  }

  confirmSaveProceed() {
    if (!this.editingUser || !this.pendingSubmit) return;
    this.savingEdit = true;
    const id = this.editingUser.id;
    const payload = this.pendingSubmit;
    this.http.put(`/api/admin/users/${id}`, payload).subscribe({
      next: () => {
        // Atualiza lista local
        const idx = this.users.findIndex(x => x.id === id);
        if (idx >= 0) this.users[idx] = { ...this.users[idx], ...payload };
  this.toast.show('success','Usuário atualizado com sucesso');
        this.savingEdit = false;
        this.confirmSave = false;
        this.pendingSubmit = null;
        this.editingUser = null;
      },
      error: err => {
        console.error(err);
  this.toast.show('error','Falha ao atualizar usuário');
        this.savingEdit = false;
      }
    });
  }

  formatCpfInput(value: string) {
    if (!this.editingUser) return;
    if (value == null) { this.editingUser.cpf=''; this.cpfInvalid=false; return; }
    const digits = value.replace(/\D/g,'');
    this.cpfInvalid = digits.length === 11 ? !this.isCpfValid(digits) : false;
  }

  onBirthDateChange() {
    if (!this.editingUser) return;
    this.birthDateInvalid = this.isBirthDateInvalid(this.editingUser.birthDate);
  }

  onPhoneInput() {
    if (!this.editingUser) return;
    const raw = this.editingUser.phone || '';
    const digits = raw.replace(/\D/g,'');
    this.phoneInvalid = digits.length>0 && digits.length < 10;
  }

  onMatriculaInput() {
    if (!this.editingUser) return;
    const m = (this.editingUser.matricula||'').trim();
    this.matriculaInvalid = m.length>0 && !/^[A-Za-z0-9]{3,40}$/.test(m);
  }

  private validateAll() {
    if (!this.editingUser) return;
    this.onBirthDateChange();
    this.onPhoneInput();
    this.onMatriculaInput();
    if (this.editingUser?.cpf) this.formatCpfInput(this.editingUser.cpf);
  }

  private ensureNacionalidades() {
    if (!this.nacionalidades.length) {
      try {
        this.nacionalidades = this.refData.getCountries();
        if (!this.nacionalidades.includes('Brasil')) this.nacionalidades.unshift('Brasil');
        if (!this.nacionalidades.includes('Outro')) this.nacionalidades.push('Outro');
      } catch { this.nacionalidades = ['Brasil']; }
    }
  }

  private isBirthDateInvalid(raw: string): boolean {
    if (!raw) return false; // permitir vazio
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return true;
    const date = new Date(raw + 'T00:00:00');
    if (isNaN(date.getTime())) return true;
    const today = new Date();
    if (date > today) return true;
    const min = new Date(); min.setFullYear(min.getFullYear() - 16); if (date > min) return true;
    const max = new Date(); max.setFullYear(max.getFullYear() - 120); if (date < max) return true;
    return false;
  }

  private isCpfValid(cpf: string): boolean {
    if (!cpf || cpf.length !== 11 || /(\d)\1{10}/.test(cpf)) return false;
    const calc = (factorStart: number) => {
      let total = 0;
      for (let i=0;i<factorStart-1;i++) total += parseInt(cpf[i],10)*(factorStart-i);
      const rest = (total*10)%11; return rest===10?0:rest;
    };
    const d1 = calc(10), d2 = calc(11);
    return d1 === parseInt(cpf[9],10) && d2 === parseInt(cpf[10],10);
  }

  private maskCpf(d: string): string {
    if (!d) return '';
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  private maskPhone(d: string): string {
    if (!d) return '';
    if (d.length <= 10) {
      return d
        .replace(/(\d{2})(\d)/, '($1)$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return d
      .replace(/(\d{2})(\d)/, '($1)$2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
}
