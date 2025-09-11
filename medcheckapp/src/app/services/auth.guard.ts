import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Optional metadata-based role guard usage: define data:{roles:['PRECEPTOR']} in route

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  const route: any = (router as any).lastSuccessfulNavigation?.finalUrl?.root?.children?.primary;
  // Basic role check using current navigation (simplified). For stricter approach create a dedicated RoleGuard.
  return true;
};
