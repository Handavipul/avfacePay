import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MollieService } from '../../services/mollie.service';
import { PaymentService } from '../../services/payment.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-payment-success',
  standalone: false,
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.css'
})
export class PaymentSuccessComponent implements OnInit {
  // Debug information
  debugInfo: any = {};
  
  // Loading states
  isLoading = true;
  loadingText = 'Verifying payment...';
  
  // Payment data
  paymentType: 'card' | 'bank' | 'others' | null = null;
  selectedPaymentMethod: any | null = null;
  transactionId: string = '';
  paymentAmount: number = 0;
  paymentStatus: string = '';
  
  // Success states
  showSuccessAnimation = false;
  successMessage = '';
  errorMessage = '';
  
  // Mandate information
  mandateCreated = false;
  mandateId: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mollieService: MollieService,
    private paymentService: PaymentService
  ) {}

  ngOnInit() {
    console.group('🔍 PaymentSuccessComponent Debug');
    
    // Capture all possible sources of payment ID
    this.debugCurrentState();
    
    // Method 1: Query Parameters (most common)
    this.route.queryParams.subscribe(params => {
      console.log('📋 Query Params:', params);
      this.debugInfo.queryParams = params;
      this.handleQueryParams(params);
    });

    // Method 2: Route Parameters (less common but possible)
    this.route.params.subscribe(params => {
      console.log('🛣️ Route Params:', params);
      this.debugInfo.routeParams = params;
      this.handleRouteParams(params);
    });

    // Method 3: Fragment (hash parameters)
    this.route.fragment.subscribe(fragment => {
      console.log('🔗 Fragment:', fragment);
      this.debugInfo.fragment = fragment;
      if (fragment) {
        this.handleFragment(fragment);
      }
    });

    // Method 4: Full URL analysis
    this.analyzeFullUrl();
    
    console.groupEnd();
  }

  private debugCurrentState() {
    const currentUrl = window.location.href;
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    const currentHash = window.location.hash;
    
    console.log('🌍 Current URL:', currentUrl);
    console.log('📍 Current Path:', currentPath);
    console.log('🔍 Current Search:', currentSearch);
    console.log('🔗 Current Hash:', currentHash);
    
    this.debugInfo = {
      ...this.debugInfo,
      fullUrl: currentUrl,
      pathname: currentPath,
      search: currentSearch,
      hash: currentHash,
      timestamp: new Date().toISOString()
    };
  }

  private analyzeFullUrl() {
    const url = new URL(window.location.href);
    
    console.log('🔬 URL Analysis:');
    console.log('  - Origin:', url.origin);
    console.log('  - Pathname:', url.pathname);
    console.log('  - Search:', url.search);
    console.log('  - Hash:', url.hash);
    
    // Check for parameters in different formats
    const searchParams = new URLSearchParams(url.search);
    console.log('  - URLSearchParams entries:');
    for (const [key, value] of searchParams.entries()) {
      console.log(`    ${key}: ${value}`);
    }
    
    // Store for debugging
    this.debugInfo.urlAnalysis = {
      searchParamsObject: Object.fromEntries(searchParams.entries()),
      hasParameters: searchParams.toString() !== '',
      parameterCount: Array.from(searchParams.keys()).length
    };
  }

  private handleQueryParams(params: any) {
    console.log('🎯 Processing Query Parameters');
    debugger;
    // Check all possible parameter names that Mollie might send
    const possiblePaymentIds = [
      params['payment_id'],    // Custom parameter
      params['id'],           // Mollie standard
      params['paymentId'],    // Alternative format
      params['payment'],      // Short form
      params['pid'],          // Abbreviated
      params['mollie_payment_id'] // Explicit format
    ];

    const possibleCustomerIds = [
      params['customer_id'],
      params['customerId'],
      params['customer'],
      params['cid'],
      params['mollie_customer_id']
    ];

    // Find the first non-empty payment ID
    const paymentId = possiblePaymentIds.find(id => id && id.trim() !== '');
    const customerId = possibleCustomerIds.find(id => id && id.trim() !== '');
    const raw = localStorage.getItem('mollie_payment_data');
    const paymentData = raw ? JSON.parse(raw) : null; 
    if (raw) {
      const paymentData = JSON.parse(raw);
      console.log("Payment ID:", paymentData.paymentId);
      console.log("Customer ID:", paymentData.customerId);
      console.log("Amount:", paymentData.amount);
      console.log("Description:", paymentData.description);
      this.processPaymentSuccess( paymentData.paymentId, paymentData.customerId);
    }
    console.log('💳 Payment ID candidates:', possiblePaymentIds);
    console.log('👤 Customer ID candidates:', possibleCustomerIds);

    this.debugInfo.parameterExtraction = {
      paymentIdCandidates: possiblePaymentIds,
      customerIdCandidates: possibleCustomerIds,
      selectedPaymentId: paymentId,
      selectedCustomerId: customerId
    };

    // if (paymentId) {
    //   this.processPaymentSuccess(paymentId, customerId);
    // } else {
    //   // Try alternative methods if query params are empty
    //   this.tryAlternativeParameterExtraction();
    // }
  }

  private handleRouteParams(params: any) {
    console.log('🛣️ Processing Route Parameters');
    
    if (Object.keys(params).length > 0) {
      const paymentId = params['id'] || params['payment_id'] || params['paymentId'];
      const customerId = params['customer_id'] || params['customerId'];
      
      if (paymentId) {
        console.log('✅ Found payment ID in route params:', paymentId);
        this.processPaymentSuccess(paymentId, customerId);
        return;
      }
    }
  }

  private handleFragment(fragment: string) {
    console.log('🔗 Processing Fragment:', fragment);
    
    // Parse fragment as query string
    try {
      const fragmentParams = new URLSearchParams(fragment);
      const params: any = {};
      
      for (const [key, value] of fragmentParams.entries()) {
        params[key] = value;
      }
      
      console.log('📋 Fragment Params:', params);
      
      if (Object.keys(params).length > 0) {
        this.handleQueryParams(params);
      }
    } catch (error) {
      console.warn('⚠️ Could not parse fragment as query string:', error);
    }
  }

  private tryAlternativeParameterExtraction() {
    console.log('🔄 Trying alternative parameter extraction methods');
    
    // Method 1: Check localStorage for stored payment ID
    const storedPaymentId = localStorage.getItem('mollie_pending_payment_id');
    const storedCustomerId = localStorage.getItem('mollie_customer_id');
    
    if (storedPaymentId) {
      console.log('💾 Found payment ID in localStorage:', storedPaymentId);
      this.processPaymentSuccess(storedPaymentId, storedCustomerId || undefined);
      // Clear the stored ID
      localStorage.removeItem('mollie_pending_payment_id');
      return;
    }

    // Method 2: Check sessionStorage
    const sessionPaymentId = sessionStorage.getItem('mollie_payment_id');
    if (sessionPaymentId) {
      console.log('📝 Found payment ID in sessionStorage:', sessionPaymentId);
      this.processPaymentSuccess(sessionPaymentId);
      sessionStorage.removeItem('mollie_payment_id');
      return;
    }

    // Method 3: Try to extract from referrer URL
    if (document.referrer) {
      console.log('🔙 Checking referrer URL:', document.referrer);
      try {
        const referrerUrl = new URL(document.referrer);
        if (referrerUrl.hostname.includes('mollie.com')) {
          // This came from Mollie, but we don't have the parameters
          console.warn('⚠️ Redirected from Mollie but no parameters found');
          this.handleMollieRedirectWithoutParams();
          return;
        }
      } catch (error) {
        console.warn('⚠️ Could not parse referrer URL:', error);
      }
    }

    // If all else fails, show debug information
    console.error('❌ No payment ID found through any method');
    this.handleNoPaymentId();
  }

  private handleMollieRedirectWithoutParams() {
    this.isLoading = false;
    this.errorMessage = 'Payment completed but details could not be retrieved. Please check your payment history.';
    
    // Still try to navigate to success after a delay
    setTimeout(() => {
      this.router.navigate(['/dashboard'], {
        queryParams: { paymentCompleted: true, needsVerification: true }
      });
    }, 3000);
  }

  private handleNoPaymentId() {
    this.isLoading = false;
    this.errorMessage = 'Payment ID not found. This may be due to a configuration issue.';
    
    // Show debug information in development
    if (!environment.production) {
      console.table(this.debugInfo);
    }
  }

  private processPaymentSuccess(paymentId: string, customerId?: string) {
    console.group('💳 Processing Payment Success');
    console.log('Payment ID:', paymentId);
    console.log('Customer ID:', customerId);

    this.transactionId = paymentId;
    this.loadingText = 'Verifying payment status...';

    // Clear any stored payment IDs since we found one
    localStorage.removeItem('mollie_pending_payment_id');
    sessionStorage.removeItem('mollie_payment_id');

    this.mollieService.processPaymentCompletion(paymentId).subscribe({
      next: (result) => {
        console.log('✅ Payment processing successful:', result);
        this.handlePaymentResult(result);
      },
      error: (error) => {
        console.error('❌ Error processing payment:', error);
        this.handlePaymentError(error);
      }
    });
    
    console.groupEnd();
  }

  private handlePaymentResult(result: any) {
    this.paymentStatus = result.payment.status;
    this.paymentAmount = parseFloat(result.payment.amount.value);
    
    switch (result.payment.status) {
      case 'paid':
        console.log('✅ Payment confirmed as paid');
        this.handleSuccessfulPayment(result);
        break;
      case 'pending':
        this.handlePendingPayment(result);
        break;
      case 'canceled':
        this.router.navigate(['/payment/canceled']);
        break;
      case 'expired':
        this.router.navigate(['/payment/expired']);
        break;
      case 'failed':
        this.router.navigate(['/payment/failed']);
        break;
      default:
        console.warn('⚠️ Unknown payment status:', result.payment.status);
        this.handleError(`Unknown payment status: ${result.payment.status}`);
    }
  }

  private handleSuccessfulPayment(result: any) {
    this.isLoading = false;
    this.successMessage = 'Payment completed successfully!';
    
    // Show success animation
    setTimeout(() => {
      this.showSuccessAnimation = true;
    }, 500);
    
    // Handle mandate creation if applicable
    if (result.mandate) {
      console.log('✅ Mandate created:', result.mandate.id);
      this.handleSuccessfulMandateCreation(result.mandate);
    } else if (result.payment.customerId) {
      this.checkForMandates(result.payment.customerId);
    }
    
    this.storePaymentInfo(result.payment);
  }

  private handlePendingPayment(result: any) {
    this.loadingText = 'Payment is being processed...';
    
    setTimeout(() => {
      this.processPaymentSuccess(this.transactionId);
    }, 3000);
  }

  private checkForMandates(customerId: string) {
    this.loadingText = 'Setting up future payments...';
    
    setTimeout(() => {
      this.mollieService.getCustomerMandates(customerId).subscribe({
        next: (mandates) => {
          if (mandates && mandates.length > 0) {
            console.log('✅ Mandates found:', mandates);
            const validMandate = mandates.find(m => m.status === 'valid');
            if (validMandate) {
              this.handleSuccessfulMandateCreation(validMandate);
            }
          }
        },
        error: (error) => {
          console.error('❌ Error fetching mandates:', error);
        }
      });
    }, 3000);
  }

  private handleSuccessfulMandateCreation(mandate: any) {
    this.mandateCreated = true;
    this.mandateId = mandate.id;
    
    localStorage.setItem('mollie_mandate_id', mandate.id);
    localStorage.setItem('mollie_customer_id', mandate.customerId);
    
    console.log('🎉 Payment method successfully stored for future use!');
  }

  private storePaymentInfo(payment: any) {
    const paymentInfo = {
      id: payment.id,
      amount: payment.amount.value,
      currency: payment.amount.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      method: payment.method
    };
    
    localStorage.setItem('last_payment', JSON.stringify(paymentInfo));
  }

  private handlePaymentError(error: any) {
    console.error('Payment error:', error);
    this.isLoading = false;
    this.errorMessage = 'There was an error processing your payment. Please contact support.';
  }

  private handleError(message: string) {
    this.isLoading = false;
    this.errorMessage = message;
  }

  // UI Methods
  closeSuccessAnimation() {
    this.showSuccessAnimation = false;
    
    setTimeout(() => {
      if (this.mandateCreated) {
        this.router.navigate(['/dashboard'], {
          queryParams: { mandateCreated: true }
        });
      } else {
        this.router.navigate(['/dashboard']);
      }
    }, 300);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  // Debug method - remove in production
  showDebugInfo() {
    console.log('🐛 Debug Info:', this.debugInfo);
    alert(JSON.stringify(this.debugInfo, null, 2));
  }

  // Utility Methods
  formatCurrency(amount: number, currency: string = 'EUR'): string {
    if (isNaN(amount)) return this.paymentService.formatCurrency(0, currency);
    return this.paymentService.formatCurrency(amount, currency);
  }

  getPaymentMethodIcon(): string {
    if (this.paymentType === 'card') return '💳';
    if (this.paymentType === 'bank') return '🏦';
    if (this.paymentType === 'others') return '🌐';
    return '💳';
  }

  getPaymentMethodText(): string {
    if (this.paymentStatus) {
      return `Payment via Mollie (${this.paymentStatus})`;
    }
    return 'Mollie Payment';
  }
}