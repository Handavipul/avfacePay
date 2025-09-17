// idle-timeout.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService {
  private timeoutInMs = 15 * 60 * 1000; // 15 minutes
  private timeoutId: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.initListener();
    this.resetTimeout(); // start on load
  }

  private initListener(): void {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    events.forEach(event =>
      document.addEventListener(event, () => this.resetTimeout())
    );
  }

  private resetTimeout(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);

    this.ngZone.runOutsideAngular(() => {
      this.timeoutId = setTimeout(() => {
        this.ngZone.run(() => {
          this.logout();
        });
      }, this.timeoutInMs);
    });
  }

  private logout(): void {
    this.authService.logout();
     this.router.navigate(['']); // or use: window.location.href = 'http://localhost:4200/';
  }
}
