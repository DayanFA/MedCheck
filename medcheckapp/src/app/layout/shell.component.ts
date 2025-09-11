import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnInit {
  collapsed = false;
  userName = '';
  constructor(private userService: UserService, private auth: AuthService) {}

  ngOnInit(): void {
    // Restaura estado do sidebar (persistência após F5)
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved === '1') this.collapsed = true;
    } catch { /* ignore storage errors */ }
    // Tenta pegar usuário real do AuthService (cache de login)
    const cached: any = (this.auth as any).getUser?.();
    if (cached && cached.name) {
      this.userName = (cached.name || '').split(' ')[0];
    } else {
      // Fallback antigo
      const u = this.userService.getCurrentUser();
      this.userName = (u.name || '').split(' ')[0];
    }
  }
  toggleSidebar() {
    this.collapsed = !this.collapsed;
    try { localStorage.setItem('sidebarCollapsed', this.collapsed ? '1' : '0'); } catch {}
  }
}
