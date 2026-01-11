import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

// Unified role guard: simply checks auth and expected roles, redirecting unauthorized users to /home.
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  const role = auth.getRole();
  const expected = route.data?.['roles'] as string[] | undefined;
  if (expected && expected.length && (!role || !expected.includes(role))) {
    return router.parseUrl('/home');
  }
  return true;
};
