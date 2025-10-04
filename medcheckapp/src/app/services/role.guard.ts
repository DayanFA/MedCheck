import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  const role = auth.getRole();
  const target = state.url || '';
  if (role === 'COORDENADOR') {
    // Normaliza URL removendo query e fragment para comparação simples
    const normalized = target.split('?')[0].split('#')[0];
    if (normalized === '/home' || normalized === '/home/' || normalized === '/' || normalized === '') {
      // Redireciona sempre coordenador para a home específica
      return router.parseUrl('/coordenador/home');
    }
  }
  const expected = route.data?.['roles'] as string[] | undefined;
  if (expected && expected.length) {
    if (!role || !expected.includes(role)) {
      if (role === 'COORDENADOR') {
        return router.parseUrl('/coordenador/home');
      } else {
        return router.parseUrl('/home');
      }
    }
  }
  return true;
};
