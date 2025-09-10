import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'medcheckapp';

  constructor(private authService: AuthService, private router: Router) {
    // Auto redirect if already authenticated and user is on public auth routes
    setTimeout(() => {
      const authRoutes = ['/login', '/signup', '/'];
      if (this.authService.isAuthenticated() && authRoutes.includes(this.router.url)) {
        this.router.navigate(['/intern-home']);
      }
    });
  }
}
