import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { AuthComponent } from './components/auth/auth.component';
import { PaymentComponent } from './components/payment/payment.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AuthGuard } from './guards/auth.guard';
import { AccountManagementComponent } from './components/account-management/account-management.component';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';

const routes: Routes = [
  // Public routes
  { path: '', component: HomeComponent },

  { path: 'home', component: HomeComponent },
  { path: 'auth', component: AuthComponent },
 {
    path: 'payment/success',
    component: PaymentSuccessComponent
  },
  // Protected routes (require authentication)
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'payment', 
    component: PaymentComponent,
    canActivate: [AuthGuard]
  },

  // Catch-all route for 404
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }