// mollie.service.ts - Fixed Mollie Payment Service
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { of } from 'rxjs';

// Mollie API interfaces
interface MollieAmount {
  currency: string;
  value: string;
}

interface MolliePaymentRequest {
  id?: string;
  amount: MollieAmount;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata?: any;
  method?: string;
  locale?: string;
  sequenceType?: 'oneoff' | 'first' | 'recurring';
  customerId?: string;
  mandateId?: string;
  billingAddress?: MollieAddress;
  shippingAddress?: MollieAddress;
  consumerName?: string;
  consumerAccount?: string;
  issuer?: string;
}

interface MollieAddress {
  streetAndNumber: string;
  postalCode: string;
  city: string;
  country: string;
  organizationName?: string;
  title?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
}

interface MolliePaymentResponse {
  id: string;
  mode: 'live' | 'test';
  createdAt: string;
  status: 'open' | 'paid' | 'canceled' | 'expired' | 'failed' | 'pending';
  amount: MollieAmount;
  description: string;
  method?: string;
  metadata?: any;
  details?: any;
  profileId: string;
  sequenceType?: string;
  redirectUrl?: string;
  webhookUrl?: string;
  _links: {
    self: { href: string; type: string };
    checkout?: { href: string; type: string };
    dashboard?: { href: string; type: string };
    documentation: { href: string; type: string };
  };
  customerId:any;
}

interface MollieMethod {
  id: string;
  description: string;
  minimumAmount: MollieAmount;
  maximumAmount: MollieAmount;
  image: {
    size1x: string;
    size2x: string;
    svg: string;
  };
  status: 'activated' | 'pending-onboarding' | 'pending-review' | 'pending-external' | 'rejected';
  pricing?: Array<{
    description: string;
    fixed: MollieAmount;
    variable: string;
  }>;
}

interface MollieMethodsResponse {
  count: number;
  _embedded: {
    methods: MollieMethod[];
  };
  _links: {
    self: { href: string; type: string };
    documentation: { href: string; type: string };
  };
}

interface MollieRefund {
  id: string;
  amount: MollieAmount;
  status: 'queued' | 'pending' | 'processing' | 'refunded' | 'failed';
  createdAt: string;
  description?: string;
  paymentId: string;
  settlementAmount?: MollieAmount;
  _links: any;
}

interface MollieCustomer {
  id: string;
  mode: 'live' | 'test';
  name?: string;
  email?: string;
  locale?: string;
  metadata?: any;
  createdAt: string;
  _links: any;
}

interface MollieMandate {
  id: string;
  mode: 'live' | 'test';
  status: 'valid' | 'invalid' | 'pending';
  method: string;
  customerId: string;
  details: any;
  mandateReference?: string;
  signatureDate?: string;
  createdAt: string;
  _links: any;
}

@Injectable({
  providedIn: 'root'
})
export class MollieService {

  // FIXED: Proper URL construction with validation
  private readonly baseApiUrl: string;
  private readonly apiUrl: string;
  private readonly version = 'v2';

  // Mollie configuration
  private mollieConfig = {
    testMode: !environment.production,
    apiKey: environment.mollieApiKey || '',
    profileId: environment.mollieProfileId || '',
    webhookUrl: environment.mollieWebhookUrl || '/mollie/webhook',
    redirectBaseUrl: environment.mollieRedirectUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200')
  };

  constructor(
    private http: HttpClient,
    private apiService: ApiService
  ) {
    // FIXED: Validate and construct URLs properly
    this.baseApiUrl = this.validateAndCleanUrl(environment.apiUrl || 'http://localhost:8000/');
    this.apiUrl = `${this.baseApiUrl}/mollie`;
    
    // Validate configuration on initialization
    this.validateConfiguration();
  }

  /**
   * FIXED: Validate and clean URL to ensure proper format
   */
  private validateAndCleanUrl(url: string): string {
    if (!url) {
      throw new Error('API URL is required');
    }

    // Remove trailing slash
    const cleanUrl = url.replace(/\/$/, '');
    
    // Validate URL format
    try {
      new URL(cleanUrl);
    } catch (error) {
      throw new Error(`Invalid API URL format: ${cleanUrl}`);
    }

    return cleanUrl;
  }

  /**
   * FIXED: Enhanced configuration validation
   */
  private validateConfiguration(): void {
    console.group('🔧 Mollie Service Configuration');
    
    if (!environment.apiUrl) {
      console.warn('⚠️ API URL not configured in environment, using default');
    } else {
      console.log('✅ API URL configured:', this.baseApiUrl);
    }
    
    if (!environment.mollieApiKey) {
      console.warn('⚠️ Mollie API Key not configured in environment');
    } else {
      console.log('✅ Mollie API Key configured');
    }

    console.log('📍 Final API URL:', this.apiUrl);
    console.log('🧪 Test Mode:', this.mollieConfig.testMode);
    console.log('🔄 Redirect Base URL:', this.mollieConfig.redirectBaseUrl);
    console.log('🪝 Webhook URL:', this.mollieConfig.webhookUrl);
    
    console.groupEnd();
  }

  /**
   * FIXED: Initialize Mollie service with comprehensive error handling
   */
  initialize(): Observable<any> {
    console.group('🚀 Mollie Service Initialization');
    
    // Validate URLs before making request
    if (!this.baseApiUrl) {
      const error = new Error('Base API URL not configured');
      console.error('❌ Initialization failed:', error.message);
      console.groupEnd();
      return throwError(() => error);
    }

    const configUrl = `${this.apiUrl}/config`;
    
    // Additional URL validation
    try {
      const urlObj = new URL(configUrl);
      console.log('✅ URL validation passed:', configUrl);
      console.log('🌐 Protocol:', urlObj.protocol);
      console.log('🏠 Host:', urlObj.host);
      console.log('📁 Pathname:', urlObj.pathname);
    } catch (urlError) {
      console.error('❌ Invalid URL format:', configUrl, urlError);
      console.groupEnd();
      return throwError(() => new Error(`Invalid URL format: ${configUrl}`));
    }
    
    console.log('📞 Making request to:', configUrl);
    console.log('⚙️ Mollie Config:', {
      ...this.mollieConfig,
      apiKey: this.mollieConfig.apiKey ? '***configured***' : 'not configured'
    });
    
    return this.http.get<any>(configUrl).pipe(
      map((response: any) => {
        console.log('✅ Mollie initialization successful:', response);
        // Update config with server response if available
        if (response && typeof response === 'object') {
          if (response.webhookUrl) {
            this.mollieConfig.webhookUrl = response.webhookUrl;
            console.log('🔄 Updated webhook URL from server:', response.webhookUrl);
          }
          if (response.redirectUrl) {
            this.mollieConfig.redirectBaseUrl = response.redirectUrl;
            console.log('🔄 Updated redirect URL from server:', response.redirectUrl);
          }
        }
        
        console.groupEnd();
        return response;
      }),
      catchError(error => {
        console.error('❌ Mollie initialization failed:', error);
        
        // Enhanced error logging
        if (error.status === 0) {
          console.error('🌐 Network Error: Could not connect to server');
          console.error('🔍 Check if the server is running and the URL is correct');
        } else {
          console.error('📊 HTTP Status:', error.status);
          console.error('📝 Error Details:', error.error);
        }
        
        console.groupEnd();
        return this.handleError(error);
      })
    );
  }

  /**
   * FIXED: Get available payment methods with proper error handling
   */
  getPaymentMethods(amount?: number, currency: string = 'EUR'): Observable<MollieMethod[]> {
    let params: any = {};

    if (amount && amount > 0) {
      params.amount = {
        currency: currency.toUpperCase(),
        value: amount.toFixed(2)
      };
    }

    const url = `${this.apiUrl}/methods`;
    console.log('📋 Fetching payment methods from:', url, 'with params:', params);

    return this.http.post<MollieMethodsResponse>(url, params).pipe(
      map(response => {
        if (response && response._embedded && response._embedded.methods) {
          console.log('✅ Payment methods retrieved:', response._embedded.methods.length, 'methods');
          return response._embedded.methods;
        }
        console.warn('⚠️ No payment methods found in response');
        return [];
      }),
      catchError(error => {
        console.error('❌ Failed to fetch payment methods:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Get enabled payment methods for specific amount and currency
   */
  getEnabledMethods(amount: number, currency: string = 'EUR'): Observable<string[]> {
    return this.getPaymentMethods(amount, currency).pipe(
      map(methods => methods
        .filter(method => method.status === 'activated')
        .map(method => method.id)
      ),
      catchError(error => {
        console.error('❌ Failed to get enabled methods:', error);
        // Return default methods on error
        return new Observable<string[]>(subscriber => {
          subscriber.next(['creditcard', 'paypal', 'ideal']);
          subscriber.complete();
        });
      })
    );
  }

  /**
   * FIXED: Create a new payment with comprehensive error handling
   */
  createPayment(paymentData: MolliePaymentRequest): Observable<MolliePaymentResponse> {
    console.group('💳 Creating Mollie Payment');
    debugger;
    // FIXED: Ensure required fields with fallbacks
    const payload: MolliePaymentRequest = {
      ...paymentData,
      redirectUrl: paymentData.redirectUrl || this.getRedirectUrl('success'),
      webhookUrl: `https://1e966c8c8417.ngrok-free.app${this.mollieConfig.webhookUrl || this.getAbsoluteWebhookUrl()}`
    };

    // Enhanced validation
    const validationErrors: string[] = [];

    if (!payload.amount || !payload.amount.value || !payload.amount.currency) {
      validationErrors.push('Invalid payment amount');
    }

    if (!payload.description || payload.description.trim().length === 0) {
      validationErrors.push('Payment description is required');
    }

    if (!payload.redirectUrl) {
      validationErrors.push('Redirect URL is required');
    }

    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      console.groupEnd();
      return throwError(() => new Error(`Validation failed: ${validationErrors.join(', ')}`));
    }

    const url = `/mollie/payments`;
    console.log('📤 Creating payment at:', url);
    console.log('📋 Payment payload:', {
      ...payload,
      webhookUrl: payload.webhookUrl ? '***configured***' : 'not configured'
    });

    return this.apiService.post<any>(url, payload).pipe(
      map(response => {
        console.log('✅ Payment created successfully:', {
          id: response.id,
          status: response.status,
          amount: response.amount,
          checkoutUrl: response._links.checkout?.href
        });
        console.groupEnd();
        return response;
      }),
      catchError(error => {
        console.error('❌ Payment creation failed:', error);
        console.groupEnd();
        return this.handleError(error);
      })
    );
  }

  

  /**
   * FIXED: Get payment status with proper error handling
   */
  getPaymentStatus(paymentId: string): Observable<MolliePaymentResponse> {
    if (!paymentId || paymentId.trim().length === 0) {
      return throwError(() => new Error('Payment ID is required'));
    }

    const url = `${this.apiUrl}/payments/${paymentId}`;
    console.log('🔍 Fetching payment status from:', url);

    return this.http.get<MolliePaymentResponse>(url).pipe(
      map(response => {
        console.log('✅ Payment status retrieved:', {
          id: response.id,
          status: response.status,
          amount: response.amount
        });
        return response;
      }),
      catchError(error => {
        console.error('❌ Failed to get payment status:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Cancel a payment
   */
  cancelPayment(paymentId: string): Observable<MolliePaymentResponse> {
    if (!paymentId) {
      return throwError(() => new Error('Payment ID is required'));
    }

    const url = `${this.apiUrl}/payments/${paymentId}`;
    return this.apiService.delete<MolliePaymentResponse>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create a refund
   */
  createRefund(paymentId: string, amount?: MollieAmount, description?: string): Observable<MollieRefund> {
    if (!paymentId) {
      return throwError(() => new Error('Payment ID is required'));
    }

    const payload: any = {};

    if (amount) {
      payload.amount = amount;
    }

    if (description) {
      payload.description = description;
    }

    const url = `${this.apiUrl}/payments/${paymentId}/refunds`;
    return this.apiService.post<MollieRefund>(url, payload).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get refund details
   */
  getRefund(paymentId: string, refundId: string): Observable<MollieRefund> {
    if (!paymentId || !refundId) {
      return throwError(() => new Error('Payment ID and Refund ID are required'));
    }

    const url = `${this.apiUrl}/payments/${paymentId}/refunds/${refundId}`;
    return this.apiService.get<MollieRefund>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create a customer
   */
  createCustomer(customerData: Partial<MollieCustomer>): Observable<MollieCustomer> {
    const url = `/mollie/customers`;
    debugger
    return this.apiService.post<MollieCustomer>(url, customerData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get customer details
   */
  getCustomer(customerId: string): Observable<MollieCustomer> {
    if (!customerId) {
      return throwError(() => new Error('Customer ID is required'));
    }

    const url = `${this.apiUrl}/customers/${customerId}`;
    return this.apiService.get<MollieCustomer>(url).pipe(
      catchError(this.handleError)
    );
  }

createCustomerAndPayment(
  customerData: { name: string; email: string; phone?: string },
  paymentData: {
    amount: number;
    description: string;
    currency?: string;
    method?: string;
    redirectUrl?: string;
    metadata?: any;
    useStoredMethod?: boolean;
    customerId?: string;
    mandateId?: string;
  }
): Observable<MolliePaymentResponse> {
  console.group('👤💳 Creating Customer and Payment (Enhanced)');

  // If using stored method and we have customer/mandate IDs, create recurring payment
  if (paymentData.useStoredMethod && paymentData.customerId && paymentData.mandateId) {
    console.log('🔄 Using stored method, creating recurring payment');
    console.groupEnd();
    debugger;
    return this.createRecurringPayment({
      amount: paymentData.amount,
      description: paymentData.description,
      currency: paymentData.currency,
      customerId: paymentData.customerId,
      mandateId: paymentData.mandateId,
      metadata: paymentData.metadata
    });
  }

  // Otherwise, use the original customer + payment creation logic
  const mollieCustomerData = {
    name: customerData.name,
    email: customerData.email,
    metadata: {
      phone: customerData.phone,
      source: 'payment_component',
      createdAt: new Date().toISOString()
    }
  };

  return this.createCustomer(mollieCustomerData).pipe(
    switchMap(customer => {
      console.log('✅ Customer created:', customer.id);

      // Create payment with customer
      const payment: MolliePaymentRequest = {
        amount: this.formatAmount(paymentData.amount, paymentData.currency || 'EUR'),
        description: paymentData.description,
        customerId: customer.id,
        sequenceType: 'first', // First payment to register card/method
        redirectUrl: paymentData.redirectUrl || this.getRedirectUrl('success'),
        webhookUrl: this.mollieConfig.webhookUrl
          ? `https://1e966c8c8417.ngrok-free.app${this.mollieConfig.webhookUrl}`
          : this.getAbsoluteWebhookUrl(),
        metadata: {
          ...paymentData.metadata,
          customerEmail: customer.email,
          customerName: customer.name
        },
        ...(paymentData.method ? { method: paymentData.method } : {})
      };

      console.log('💳 Creating first payment to register payment method');
      return this.createPayment(payment);
    }),
    map(payment => {
      console.log('✅ Customer and payment created successfully');
      console.groupEnd();
      return payment;
    }),
    catchError(error => {
      console.error('❌ Failed to create customer and payment:', error);
      console.groupEnd();
      return this.handleError(error);
    })
  );
}






hasValidPaymentMethods(customerId: string): Observable<boolean> {
  return this.getCustomerMandates(customerId).pipe(
    map(mandates => mandates.some(mandate => mandate.status === 'valid')),
    catchError(() => {
      // Return false on error
      return new Observable<boolean>(subscriber => {
        subscriber.next(false);
        subscriber.complete();
      });
    })
  );
}


// Add these methods to your MollieService

/**
 * Wait for mandate creation after payment
 * This should be called after the user returns from Mollie's checkout
 */

/**
 * Create customer and payment with proper mandate handling
 */
createCustomerAndPaymentWithMandate(
  customerData: { name: string; email: string; phone?: string },
  paymentData: {
    amount: number;
    description: string;
    currency?: string;
    method?: string;
    redirectUrl?: string;
    metadata?: any;
  }
): Observable<{ payment: MolliePaymentResponse; customerId: string }> {
  console.group('👤💳 Creating Customer and Payment for Mandate');

  // First, get or create the customer
  return this.getOrCreateCustomer(customerData).pipe(
    switchMap(customer => {
      console.log('✅ Customer ready:', customer.id);

      // Create payment with sequenceType: 'first' to register payment method
      const payment: MolliePaymentRequest = {
        amount: this.formatAmount(paymentData.amount, paymentData.currency || 'EUR'),
        description: paymentData.description,
        customerId: customer.id,
        sequenceType: 'first', // This is crucial for mandate creation
        redirectUrl: paymentData.redirectUrl || this.getRedirectUrl('success', customer.id),
        webhookUrl: this.getWebhookUrl(),
        metadata: {
          ...paymentData.metadata,
          customerEmail: customer.email,
          customerName: customer.name,
          customerId: customer.id // Store customer ID in metadata for webhook processing
        },
        ...(paymentData.method ? { method: paymentData.method } : {})
      };

      console.log('💳 Creating first payment for mandate registration');
      return this.createPayment(payment).pipe(
        map(paymentResponse => ({
          payment: paymentResponse,
          customerId: customer.id
        }))
      );
    }),
    map(result => {
      console.log('✅ Payment created, mandate will be created after successful payment');
      console.log('Payment ID:', result.payment.id);
      console.log('Customer ID:', result.customerId);
      console.log('Checkout URL:', result.payment._links.checkout?.href);
      console.groupEnd();
      return result;
    }),
    catchError(error => {
      console.error('❌ Failed to create customer and payment:', error);
      console.groupEnd();
      return this.handleError(error);
    })
  );
}

/**
 * Process payment completion and check for mandate
 */
processPaymentCompletion(paymentId: string): Observable<{
  payment: MolliePaymentResponse;
  mandate?: MollieMandate;
}> {
  console.group('🔄 Processing payment completion');
  
  return this.getPaymentStatus(paymentId).pipe(
    switchMap(payment => {
      console.log('Payment status:', payment.status);
      
      if (payment.status === 'paid' && payment.customerId) {
        // Payment successful, check for mandate
        console.log('Payment successful, checking for mandate...');
        
        return this.waitForMandateCreation(payment.customerId, 5, 1000).pipe(
          map(mandates => ({
            payment,
            mandate: mandates.find(m => m.status === 'valid')
          }))
        );
      } else {
        // ✅ FIX: return correct typed observable
        return of({ payment });
      }
    }),
    catchError(error => {
      console.error('❌ Error processing payment completion:', error);
      console.groupEnd();
      return this.handleError(error);
    })
  );
}

/**
 * Get webhook URL with proper configuration
 */
private getWebhookUrl(): string {
  // For development with ngrok
  if (this.mollieConfig.webhookUrl.startsWith('https://')) {
    return this.mollieConfig.webhookUrl;
  }
  
  // For production
  const baseUrl = this.mollieConfig.webhookUrl.startsWith('http') 
    ? this.mollieConfig.webhookUrl 
    : `https://1e966c8c8417.ngrok-free.app${this.mollieConfig.webhookUrl}`;
    
  console.log('🪝 Webhook URL:', baseUrl);
  return baseUrl;
}

/**
 * Handle webhook for payment status updates
 * This should be implemented in your backend
 */
handlePaymentWebhook(paymentId: string): Observable<any> {
  const url = `/mollie/webhook/payment/${paymentId}`;
  
  return this.apiService.post(url, {}).pipe(
    map(response => {
      console.log('✅ Webhook processed:', response);
      return response;
    }),
    catchError(this.handleError)
  );
}


/**
 * Get customer's preferred payment method
 */
getPreferredPaymentMethod(customerId: string): Observable<MollieMandate | null> {
  return this.getCustomerMandates(customerId).pipe(
    map(mandates => {
      const validMandates = mandates.filter(m => m.status === 'valid');
      // Return the most recent valid mandate
      return validMandates.length > 0 ? validMandates[0] : null;
    }),
    catchError(() => {
      return new Observable<MollieMandate | null>(subscriber => {
        subscriber.next(null);
        subscriber.complete();
      });
    })
  );
}


getCustomerPayments(customerId: string): Observable<MolliePaymentResponse[]> {
  if (!customerId) {
    return throwError(() => new Error('Customer ID is required'));
  }

  const url = `/mollie/customers/${customerId}/payments`;
  return this.apiService.get<{ _embedded: { payments: MolliePaymentResponse[] } }>(url).pipe(
    map(response => response._embedded?.payments || []),
    catchError(this.handleError)
  );
}


getCustomerMandates(customerId: string): Observable<MollieMandate[]> {
  debugger;
  if (!customerId) {
    return throwError(() => new Error('Customer ID is required'));
  }
  
  console.log('🔍 Fetching mandates for customer:', customerId);
  
  const url = `/mollie/customers/${customerId}/mandates`;
  return this.apiService.get<{ _embedded?: { mandates: MollieMandate[] }; mandates?: MollieMandate[] }>(url).pipe(
    map(response => {
      // Handle different response formats
      let mandates: MollieMandate[] = [];
      debugger;
      if (response._embedded?.mandates) {
        mandates = response._embedded.mandates;
      } else if (response.mandates) {
        mandates = response.mandates;
      } else if (Array.isArray(response)) {
        mandates = response as any;
      }
      
      console.log('✅ Mandates retrieved:', mandates.length, 'mandates');
      return mandates;
    }),
    catchError(error => {
      console.error('❌ Failed to get customer mandates:', error);
      // Return empty array instead of throwing error to allow graceful degradation
      if (error.status === 404) {
        console.log('ℹ️ No mandates found, returning empty array');
        return new Observable<MollieMandate[]>(subscriber => {
          subscriber.next([]);
          subscriber.complete();
        });
      }
      return this.handleError(error);
    })
  );
}

  /**
   * Delete customer
   */
  deleteCustomer(customerId: string): Observable<any> {
    if (!customerId) {
      return throwError(() => new Error('Customer ID is required'));
    }

    const url = `${this.apiUrl}/customers/${customerId}`;
    return this.apiService.delete(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create mandate for recurring payments
   */
  createMandate(customerId: string, mandateData: any): Observable<MollieMandate> {
    if (!customerId) {
      return throwError(() => new Error('Customer ID is required'));
    }

    const url = `/customers/${customerId}/mandates`;
    return this.apiService.post<MollieMandate>(url, mandateData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get mandate details
   */
  getMandate(customerId: string, mandateId: string): Observable<MollieMandate> {
    if (!customerId || !mandateId) {
      return throwError(() => new Error('Customer ID and Mandate ID are required'));
    }

    const url = `${this.apiUrl}/customers/${customerId}/mandates/${mandateId}`;
    return this.apiService.get<MollieMandate>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Revoke a mandate
   */
  revokeMandate(customerId: string, mandateId: string): Observable<any> {
    if (!customerId || !mandateId) {
      return throwError(() => new Error('Customer ID and Mandate ID are required'));
    }

    const url = `${this.apiUrl}/customers/${customerId}/mandates/${mandateId}`;
    return this.apiService.delete(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create recurring payment
   */
 createRecurringPayment(paymentData: {
  amount: number;
  description: string;
  currency?: string;
  customerId?: string;
  mandateId?: string;
  metadata?: any;
}): Observable<MolliePaymentResponse> {
  console.group('🔄 Creating Recurring Payment');
  
  if (!paymentData.customerId || !paymentData.mandateId) {
    const error = new Error('Customer ID and Mandate ID are required for recurring payments');
    console.error('❌ Missing required fields:', error.message);
    console.groupEnd();
    return throwError(() => error);
  }
  
  const url = `/mollie/payments/recurring`;
  
  const payload = {
    amount: paymentData.amount,
    description: paymentData.description,
    currency: paymentData.currency || 'EUR',
    customerId: paymentData.customerId,
    mandateId: paymentData.mandateId,
    metadata: {
      ...paymentData.metadata,
      recurringPayment: true,
      timestamp: new Date().toISOString()
    }
  };
  debugger;
  console.log('📤 Recurring payment payload:', {
    ...payload,
    customerId: '***',
    mandateId: '***'
  });
  
  return this.apiService.post<MolliePaymentResponse>(url, payload).pipe(
    map(response => {
      console.log('✅ Recurring payment created:', {
        id: response.id,
        status: response.status,
        amount: response.amount
      });
      console.groupEnd();
      return response;
    }),
    catchError(error => {
      console.error('❌ Recurring payment creation failed:', error);
      console.groupEnd();
      return this.handleError(error);
    })
  );
}

  /**
   * Get payment methods for customer
   */
  getCustomerPaymentMethods(customerId: string): Observable<MollieMethod[]> {
    if (!customerId) {
      return throwError(() => new Error('Customer ID is required'));
    }

    const url = `${this.apiUrl}/customers/${customerId}/methods`;
    return this.apiService.get<MollieMethodsResponse>(url).pipe(
      map(response => response._embedded?.methods || []),
      catchError(this.handleError)
    );
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(body: string, signature: string): Observable<boolean> {
    const url = `${this.apiUrl}/webhook/validate`;
    return this.apiService.post<{valid: boolean}>(url, {
      body,
      signature
    }).pipe(
      map(response => response.valid),
      catchError(this.handleError)
    );
  }

  /**
   * Handle webhook payload
   */
  handleWebhook(payload: any): Observable<MolliePaymentResponse> {
    const url = `${this.apiUrl}/webhook/handle`;
    return this.apiService.post<MolliePaymentResponse>(url, payload).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get payment link for existing payment
   */
  getPaymentLink(paymentId: string): Observable<string> {
    return this.getPaymentStatus(paymentId).pipe(
      map(payment => payment._links.checkout?.href || ''),
      catchError(this.handleError)
    );
  }

  /**
   * Check if payment method is available
   */
  isMethodAvailable(methodId: string, amount: number, currency: string = 'EUR'): Observable<boolean> {
    return this.getEnabledMethods(amount, currency).pipe(
      map(methods => methods.includes(methodId)),
      catchError(() => {
        // Return false on error
        return new Observable<boolean>(subscriber => {
          subscriber.next(false);
          subscriber.complete();
        });
      })
    );
  }

  /**
   * Get payment method limits
   */
  getMethodLimits(methodId: string): Observable<{min: number, max: number, currency: string}> {
    return this.getPaymentMethods().pipe(
      map(methods => {
        const method = methods.find(m => m.id === methodId);
        if (!method) {
          throw new Error(`Payment method ${methodId} not found`);
        }
        return {
          min: parseFloat(method.minimumAmount.value),
          max: parseFloat(method.maximumAmount.value),
          currency: method.minimumAmount.currency
        };
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Create payment with specific method requirements
   */

  waitForMandateCreation(customerId: string, maxAttempts: number = 10, delayMs: number = 2000): Observable<MollieMandate[]> {
  console.group('⏳ Waiting for mandate creation');
  console.log('Customer ID:', customerId);
  
  return new Observable<MollieMandate[]>(subscriber => {
    let attempts = 0;
    
    const checkForMandates = () => {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts} to fetch mandates`);
      
      this.getCustomerMandates(customerId).subscribe({
        next: (mandates) => {
          if (mandates && mandates.length > 0) {
            console.log('✅ Mandates found:', mandates.length);
            console.groupEnd();
            subscriber.next(mandates);
            subscriber.complete();
          } else if (attempts >= maxAttempts) {
            console.warn('⚠️ Max attempts reached, no mandates found');
            console.groupEnd();
            subscriber.next([]);
            subscriber.complete();
          } else {
            console.log('No mandates yet, retrying...');
            setTimeout(checkForMandates, delayMs);
          }
        },
        error: (error) => {
          console.error('❌ Error checking mandates:', error);
          if (attempts >= maxAttempts) {
            console.groupEnd();
            subscriber.error(error);
          } else {
            setTimeout(checkForMandates, delayMs);
          }
        }
      });
    };
    
    checkForMandates();
  });
}

  createMethodSpecificPayment(paymentData: MolliePaymentRequest, methodId: string): Observable<MolliePaymentResponse> {
    const payload = { ...paymentData };

    // Method-specific configurations
    switch (methodId) {
      case 'ideal':
        payload.locale = payload.locale || 'nl_NL';
        break;
      case 'bancontact':
        payload.locale = payload.locale || 'nl_BE';
        break;
      case 'sofort':
        payload.locale = payload.locale || 'de_DE';
        break;
      case 'eps':
        payload.locale = payload.locale || 'de_AT';
        break;
      case 'giropay':
        payload.locale = payload.locale || 'de_DE';
        break;
      case 'sepadirectdebit':
        // SEPA requires customer for recurring payments
        if (!payload.customerId) {
          return throwError(() => new Error('SEPA Direct Debit requires a customer ID'));
        }
        payload.sequenceType = payload.sequenceType || 'first';
        break;
      case 'paypal':
        // PayPal specific configurations can be added here
        break;
      case 'applepay':
      case 'googlepay':
        // Digital wallet configurations
        break;
    }

    payload.method = methodId;

    return this.createPayment(payload);
  }

  /**
   * Get localized method name
   */
  getLocalizedMethodName(methodId: string, locale: string = 'en'): string {
    const methodNames: { [key: string]: { [locale: string]: string } } = {
      'ideal': {
        'en': 'iDEAL',
        'nl': 'iDEAL',
        'de': 'iDEAL'
      },
      'sepadirectdebit': {
        'en': 'SEPA Direct Debit',
        'nl': 'SEPA Incasso',
        'de': 'SEPA-Lastschrift',
        'fr': 'Prélèvement SEPA'
      },
      'bancontact': {
        'en': 'Bancontact',
        'nl': 'Bancontact',
        'fr': 'Bancontact'
      },
      'sofort': {
        'en': 'SOFORT Banking',
        'de': 'SOFORT Überweisung',
        'nl': 'SOFORT Banking'
      },
      'eps': {
        'en': 'EPS',
        'de': 'EPS'
      },
      'giropay': {
        'en': 'Giropay',
        'de': 'Giropay'
      },
      'creditcard': {
        'en': 'Credit Card',
        'nl': 'Creditcard',
        'de': 'Kreditkarte',
        'fr': 'Carte de crédit'
      },
      'paypal': {
        'en': 'PayPal',
        'nl': 'PayPal',
        'de': 'PayPal',
        'fr': 'PayPal'
      },
      'applepay': {
        'en': 'Apple Pay',
        'nl': 'Apple Pay',
        'de': 'Apple Pay',
        'fr': 'Apple Pay'
      },
      'googlepay': {
        'en': 'Google Pay',
        'nl': 'Google Pay',
        'de': 'Google Pay',
        'fr': 'Google Pay'
      }
    };

    const methodLocales = methodNames[methodId];
    if (!methodLocales) return methodId;

    return methodLocales[locale] || methodLocales['en'] || methodId;
  }

  /**
   * Format amount for Mollie API
   */
  formatAmount(amount: number, currency: string = 'EUR'): MollieAmount {
    return {
      currency: currency.toUpperCase(),
      value: amount.toFixed(2)
    };
  }

  /**
   * Parse amount from Mollie format
   */
  parseAmount(mollieAmount: MollieAmount): number {
    return parseFloat(mollieAmount.value);
  }

  /**
   * Check if currency is supported
   */
  isCurrencySupported(currency: string): boolean {
    const supportedCurrencies = [
      'AED', 'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CZK', 'DKK',
      'EUR', 'GBP', 'HKD', 'HRK', 'HUF', 'ILS', 'ISK', 'JPY',
      'NOK', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TWD',
      'USD', 'ZAR'
    ];

    return supportedCurrencies.includes(currency.toUpperCase());
  }

  /**
   * Get transaction fee estimation
   */
  estimateTransactionFee(amount: number, methodId: string, currency: string = 'EUR'): Observable<number> {
    // This would typically call your backend to get accurate fee calculations
    // For now, we'll use estimated values
    const feeRates: { [methodId: string]: number } = {
      'creditcard': 0.028, // 2.8% + €0.25
      'paypal': 0.034,     // 3.4%
      'ideal': 0.0029,     // €0.29 fixed
      'sepadirectdebit': 0.0025, // €0.25 fixed
      'bancontact': 0.0025,      // €0.25 fixed
      'sofort': 0.0025,          // €0.25 fixed
      'eps': 0.0025,             // €0.25 fixed
      'giropay': 0.0025,         // €0.25 fixed
      'applepay': 0.028,         // 2.8% + €0.25
      'googlepay': 0.028         // 2.8% + €0.25
    };

    const rate = feeRates[methodId] || 0.029;

    // Fixed fee methods
    if (['ideal', 'sepadirectdebit', 'bancontact', 'sofort', 'eps', 'giropay'].includes(methodId)) {
      return new Observable(subscriber => {
        subscriber.next(rate);
        subscriber.complete();
      });
    }

    // Percentage-based methods
    const fee = amount * rate + (methodId === 'creditcard' || methodId === 'applepay' || methodId === 'googlepay' ? 0.25 : 0);

    return new Observable(subscriber => {
      subscriber.next(fee);
      subscriber.complete();
    });
  }

  /**
   * FIXED: Get absolute webhook URL with better validation
   */
  private getAbsoluteWebhookUrl(): string {
    const webhookPath = this.mollieConfig.webhookUrl;
    
    // If webhook URL is already absolute, return it
    if (webhookPath.startsWith('http://') || webhookPath.startsWith('https://')) {
      return webhookPath;
    }
    
    // Construct absolute URL based on base API URL
    let baseUrl = this.baseApiUrl;
    
    // If webhook path starts with /api, use the root domain
    if (webhookPath.startsWith('/api') && this.baseApiUrl.includes('/api')) {
      baseUrl = this.baseApiUrl.replace('/api', '');
    }
    
    // Ensure proper path joining
    const cleanWebhookPath = webhookPath.startsWith('/') ? webhookPath : '/' + webhookPath;
    const finalUrl = `${baseUrl}${cleanWebhookPath}`;
    
    console.log('🪝 Webhook URL constructed:', finalUrl);
    return finalUrl;
  }

  /**
   * FIXED: Enhanced error handling with better error categorization
   */
  private handleError = (error: any): Observable<never> => {
    console.group('❌ Mollie Service Error');
    console.error('Original error:', error);

    let errorMessage = 'An unknown error occurred';
    let errorDetails = '';
    let errorCategory = 'unknown';

    // Handle different error types
    if (error.error) {
      if (typeof error.error === 'string') {
        errorMessage = error.error;
        errorCategory = 'api_error';
      } else if (error.error.detail) {
        errorMessage = error.error.detail;
        errorDetails = error.error.title || '';
        errorCategory = 'validation_error';
      } else if (error.error.message) {
        errorMessage = error.error.message;
        errorCategory = 'api_error';
      }
    } else if (error.message) {
      errorMessage = error.message;
      errorCategory = 'client_error';
    }

    // Handle specific HTTP errors
    if (error.status !== undefined) {
      switch (error.status) {
        case 0:
          errorMessage = 'Network error - please check your connection and server availability';
          errorCategory = 'network_error';
          errorDetails = `Unable to connect to ${this.apiUrl}`;
          break;
        case 400:
          errorMessage = 'Invalid request data - please check your parameters';
          errorCategory = 'validation_error';
          break;
        case 401:
          errorMessage = 'Unauthorized - check API credentials';
          errorCategory = 'auth_error';
          break;
        case 403:
          errorMessage = 'Forbidden - insufficient permissions';
          errorCategory = 'auth_error';
          break;
        case 404:
          errorMessage = 'Resource not found - check the endpoint URL';
          errorCategory = 'not_found_error';
          break;
        case 422:
          errorMessage = 'Validation failed - check request parameters';
          errorCategory = 'validation_error';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded - please try again later';
          errorCategory = 'rate_limit_error';
          break;
        case 500:
          errorMessage = 'Internal server error - please try again';
          errorCategory = 'server_error';
          break;
        case 502:
          errorMessage = 'Bad gateway - server is temporarily unavailable';
          errorCategory = 'server_error';
          break;
        case 503:
          errorMessage = 'Service unavailable - please try again later';
          errorCategory = 'server_error';
          break;
        case 504:
          errorMessage = 'Gateway timeout - request took too long';
          errorCategory = 'server_error';
          break;
      }
      console.error('📊 HTTP Status:', error.status);
    }

    // Handle XMLHttpRequest specific errors
    if (error.name === 'HttpErrorResponse' && error.status === 0) {
      errorMessage = 'Network error - could not connect to server';
      errorCategory = 'network_error';
      console.error('🌐 Possible causes:');
      console.error('  - Server is not running');
      console.error('  - CORS policy blocking the request');
      console.error('  - Invalid URL format');
      console.error('  - Network connectivity issues');
    }

    // Log error details
    console.error('🏷️ Error Category:', errorCategory);
    console.error('💬 Error Message:', errorMessage);
    if (errorDetails) {
      console.error('📝 Error Details:', errorDetails);
    }
    
    // Log additional debugging info
    console.error('🔧 Service Configuration:', this.getConfiguration());
    console.groupEnd();

    const finalError = new Error(errorMessage);
    (finalError as any).category = errorCategory;
    (finalError as any).details = errorDetails;
    (finalError as any).originalError = error;
    (finalError as any).httpStatus = error.status;

    return throwError(() => finalError);
  };

  /**
   * Get test mode status
   */
  isTestMode(): boolean {
    return this.mollieConfig.testMode;
  }

  /**
   * Set test mode
   */
  setTestMode(testMode: boolean): void {
    this.mollieConfig.testMode = testMode;
    console.log('🧪 Test mode updated:', testMode);
  }

  /**
   * FIXED: Get redirect URL for success/failure with proper base URL handling
   */
  getRedirectUrl(type: 'success' | 'failure' | 'cancel', paymentId?: string): string {
    const baseUrl = this.mollieConfig.redirectBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200');
    const params = paymentId ? `?payment_id=${paymentId}` : '';
    debugger;
    let path: string;
    switch (type) {
      case 'success':
        path = '/payment/success';
        break;
      case 'failure':
        path = '/payment/failure';
        break;
      case 'cancel':
        path = '/payment/cancel';
        break;
      default:
        path = '';
    }

    const fullUrl = `${baseUrl}${path}${params}`;
    console.log(`🔗 ${type} redirect URL:`, fullUrl);
    return fullUrl;
  }

  /**
   * FIXED: Get current configuration for debugging
   */
  getConfiguration(): any {
    return {
      baseApiUrl: this.baseApiUrl,
      apiUrl: this.apiUrl,
      version: this.version,
      config: { 
        ...this.mollieConfig, 
        apiKey: this.mollieConfig.apiKey ? '***configured***' : 'not configured'
      }
    };
  }

  /**
   * Test connection to Mollie API
   */
  testConnection(): Observable<{success: boolean, message: string, details?: any}> {
    console.group('🧪 Testing Mollie Connection');
    
    const testUrl = `${this.apiUrl}/test`;
    console.log('📡 Testing connection to:', testUrl);

    return this.http.get<any>(testUrl).pipe(
      map(response => {
        console.log('✅ Connection test successful:', response);
        console.groupEnd();
        return {
          success: true,
          message: 'Connection to Mollie API successful',
          details: response
        };
      }),
      catchError(error => {
        console.error('❌ Connection test failed:', error);
        console.groupEnd();
        
        return new Observable<{success: boolean, message: string, details?: any}>(subscriber => {
          subscriber.next({
            success: false,
            message: `Connection failed: ${error.message || 'Unknown error'}`,
            details: {
              status: error.status,
              url: testUrl,
              error: error.error
            }
          });
          subscriber.complete();
        });
      })
    );
  }

  /**
   * Get service health status
   */
  getHealthStatus(): Observable<{healthy: boolean, issues: string[]}> {
    const issues: string[] = [];
    
    // Check configuration
    if (!this.mollieConfig.apiKey) {
      issues.push('Mollie API key not configured');
    }
    
    if (!this.baseApiUrl) {
      issues.push('Base API URL not configured');
    }
    
    // Check URL validity
    try {
      new URL(this.apiUrl + '/test');
    } catch {
      issues.push('Invalid API URL format');
    }

    const healthy = issues.length === 0;
    
    return new Observable(subscriber => {
      subscriber.next({ healthy, issues });
      subscriber.complete();
    });
  }

  /**
   * Debug method to log current state
   */
  debug(): void {
    console.group('🐛 Mollie Service Debug Information');
    console.log('📋 Configuration:', this.getConfiguration());
    console.log('🧪 Test Mode:', this.isTestMode());
    console.log('🔗 Sample URLs:');
    console.log('  - Config:', `${this.apiUrl}/config`);
    console.log('  - Methods:', `${this.apiUrl}/methods`);
    console.log('  - Payments:', `${this.apiUrl}/payments`);
    console.log('🪝 Webhook URL:', this.getAbsoluteWebhookUrl());
    console.log('🔄 Redirect URLs:');
    console.log('  - Success:', this.getRedirectUrl('success'));
    console.log('  - Failure:', this.getRedirectUrl('failure'));
    console.log('  - Cancel:', this.getRedirectUrl('cancel'));
    console.groupEnd();
  }

  getOrCreateCustomer(customerData: { name: string; email: string; phone?: string }): Observable<MollieCustomer> {
  console.group('👤 Getting or Creating Customer');
  console.log('Customer data:', { ...customerData, email: '***' });
  
  const url = `/mollie/customers/get-or-create`;
  
  const payload = {
    name: customerData.name,
    email: customerData.email,
    metadata: {
      phone: customerData.phone,
      source: 'payment_component',
      createdAt: new Date().toISOString()
    }
  };
  
  return this.apiService.post<MollieCustomer>(url, payload).pipe(
    map(response => {
      console.log('✅ Customer retrieved/created:', {
        id: response.id,
        name: response.name,
        email: '***'
      });
      console.groupEnd();
      return response;
    }),
    catchError(error => {
      console.error('❌ Failed to get/create customer:', error);
      console.groupEnd();
      return this.handleError(error);
    })
  );
}


getCustomerByUserId(userId: number): Observable<MollieCustomer> {
  const url = `/mollie/customers/by-user/${userId}`;
  return this.apiService.get<MollieCustomer>(url).pipe(
    catchError(this.handleError)
  );
}

  
}