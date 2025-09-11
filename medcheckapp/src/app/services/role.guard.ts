import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  const expected = route.data?.['roles'] as string[] | undefined;
  if (expected && expected.length) {
    const role = auth.getRole();
    if (!role || !expected.includes(role)) {
      router.navigate(['/home']);
      return false;
    }
  }
  return true;
};
