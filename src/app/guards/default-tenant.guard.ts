import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';

@Injectable({ providedIn: 'root' })
export class DefaultTenantGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const hasId = route.queryParamMap.has('id');

    if (!hasId) {
      // No ?id=... -> redirect to default tenant
      this.router.navigate([], {
        queryParams: { id: 'local-contact-forms' },  // 👈 your default tenant id
        replaceUrl: true
      });
      return false; // Cancel current activation; new navigation will start
    }

    return true; // We have an id -> proceed to component
  }
}
