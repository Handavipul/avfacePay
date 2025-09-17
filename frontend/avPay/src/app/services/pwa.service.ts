import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PWAService {
  public promptEvent: any;
  private isInstallableSubject = new BehaviorSubject<boolean>(false);
  public isInstallable$ = this.isInstallableSubject.asObservable();

  constructor(private swUpdate: SwUpdate) {}

  initPWA() {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.promptEvent = e;
      this.isInstallableSubject.next(true);
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      this.promptEvent = null;
      this.isInstallableSubject.next(false);
      console.log('PWA was installed');
    });

    // Check for service worker updates
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(event => {
        if (event.type === 'VERSION_READY') {
          if (confirm('New version available. Load?')) {
            window.location.reload();
          }
        }
      });
    }
  }

  async installPWA() {
    if (this.promptEvent) {
      this.promptEvent.prompt();
      const result = await this.promptEvent.userChoice;
      if (result.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      this.promptEvent = null;
      this.isInstallableSubject.next(false);
    }
  }

  dismissPrompt() {
    this.promptEvent = null;
    this.isInstallableSubject.next(false);
  }

  isStandalone(): boolean {
    return (window.matchMedia('(display-mode: standalone)').matches) ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }
}