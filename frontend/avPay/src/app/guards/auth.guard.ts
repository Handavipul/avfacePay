import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface User {
  role?: string;
  isAdmin?: boolean;
  permissions?: string[];
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    // 1.  Not logged in → redirect to root (e-commerce page)
    if (!this.authService.isAuthenticated()) {
      sessionStorage.setItem('returnUrl', route.url.toString());
      this.router.navigate(['']);
      return false;
    }

    // 2.  Admin area check
    const url = route.url.toString();
    if (url.startsWith('/admin')) {
      const user = this.authService.getCurrentUser() as User | null;
      if (!user || !this.isAdmin(user)) {
        this.router.navigate(['']);
        return false;
      }
    }

    return true;
  }

  private isAdmin(user: User): boolean {
    return user.role === 'admin' ||
           user.isAdmin === true ||
           user.permissions?.includes('admin') === true ||
           user.email?.endsWith('@avpay.com') === true;
  }
}