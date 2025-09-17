import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ServiceWorkerModule } from '@angular/service-worker';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './components/home/home.component';
import { AuthComponent } from './components/auth/auth.component';
import { PaymentComponent } from './components/payment/payment.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FaceCaptureComponent } from './components/face-capture/face-capture.component';

import { AuthService } from './services/auth.service';
import { PaymentService } from './services/payment.service';
import { FaceCaptureService } from './services/face-capture.service';
import { ApiService } from './services/api.service';
import { PWAService } from './services/pwa.service';
import { environment } from '../environments/environment';
import { AccountManagementComponent } from './components/account-management/account-management.component';
import { PayNowComponent } from './components/pay-now/pay-now.component';
import { HSBCPaymentService } from './services/hsbc-payment.service';
import { HSBC_CONFIG } from './tokens/hsbc.token';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AuthComponent,
    PaymentComponent,
    DashboardComponent,
    FaceCaptureComponent,
    AccountManagementComponent,
    PayNowComponent,
    PaymentSuccessComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    FormsModule ,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    AuthService,
    PaymentService,
    FaceCaptureService,
    ApiService,
    PWAService,
    HSBCPaymentService,
    {
      provide: HSBC_CONFIG,
      useValue: environment.hsbc
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

