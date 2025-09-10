import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  constructor(private authService: AuthService, private router: Router, private toast: ToastService) {}

  logout() {
  this.authService.logout();
  this.toast.show('info', 'Sessão encerrada.');
    this.router.navigate(['/login']);
  }
}
