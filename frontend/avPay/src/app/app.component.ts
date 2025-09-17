import { Component, OnInit } from '@angular/core';
import { PWAService } from './services/pwa.service';
import { AuthService } from './services/auth.service';
import { IdleTimeoutService } from './services/IdleTimeoutService';

@Component({
  selector: 'app-root',
  standalone: false,
 templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  
  constructor(
    public pwaService: PWAService,
    public authService: AuthService,
    public idleTimeoutService: IdleTimeoutService,
  ) {}

  ngOnInit() {
    this.pwaService.initPWA();
  }
}
