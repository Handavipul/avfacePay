// hsbc-card-processor.service.ts - HSBC as Card Payment Gateway
import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from, of } from 'rxjs';
import { map, catchError, switchMap, retry } from 'rxjs/operators';

export interface HSBCCardProcessorConfig {
  merchantId: string;
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  enabled: boolean;
}

export interface HSBCCardPaymentRequest {
  amount: number;
  currency: string;
  card: {
    number: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
    holder_name: string;
  };
  billing_address?: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  customer: {
    email: string;
    phone?: string;
    name: string;
  };
  merchant_reference: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface HSBCCardPaymentResponse {
  payment_id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  fees: {
    processing_fee: number;
    total_fee: number;
  };
  card_details: {
    last_four: string;
    brand: string;
    type: string;
  };
  authorization_code?: string;
  processor_response: {
    code: string;
    message: string;
    avs_result?: string;
    cvv_result?: string;
  };
  risk_score?: number;
  created_at: string;
  updated_at: string;
}

export interface StoredCard {
  card_id: string;
  last_four: string;
  brand: string;
  holder_name: string;
  expiry_month: string;
  expiry_year: string;
  is_primary: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class HSBCCardProcessorService {
  private config: HSBCCardProcessorConfig = {
    merchantId: process.env['HSBC_MERCHANT_ID'] || '',
    apiKey: process.env['HSBC_API_KEY'] || '',
    secretKey: process.env['HSBC_SECRET_KEY'] || '',
    baseUrl: 'https://api.hsbc.com/payments/v1', // Production
    // baseUrl: 'https://sandbox-api.hsbc.com/payments/v1', // Sandbox
    enabled: true
  };

  constructor(private http: HttpClient) {}

  // Check if HSBC card processor is configured
  isConfigured(): boolean {
    return !!(this.config.enabled && 
             this.config.merchantId && 
             this.config.apiKey && 
             this.config.secretKey);
  }

  // Generate HSBC authentication headers
  private getAuthHeaders(): HttpHeaders {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp);
    
    return new HttpHeaders({
      'Authorization': `HSBC-HMAC-SHA256 ${this.config.apiKey}`,
      'X-HSBC-Timestamp': timestamp,
      'X-HSBC-Signature': signature,
      'X-HSBC-Merchant-ID': this.config.merchantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  // Generate HMAC signature for HSBC API
  private generateSignature(timestamp: string): string {
    // In a real implementation, you would use crypto to generate HMAC-SHA256
    // This is a placeholder - implement proper HMAC signing
    const payload = `${this.config.merchantId}${timestamp}`;
    return btoa(payload + this.config.secretKey); // Simplified for demo
  }

  // Process card payment via HSBC
  processCardPayment(paymentData: any, verificationData?: any): Observable<any> {
    if (!this.isConfigured()) {
      return throwError(() => new Error('HSBC card processor not configured'));
    }

    // Transform your payment data to HSBC card payment format
    const hsbcPaymentRequest: HSBCCardPaymentRequest = {
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      card: {
        number: paymentData.card_number || '', // This would come from secure tokenization
        expiry_month: paymentData.expiry_month,
        expiry_year: paymentData.expiry_year,
        cvv: paymentData.cvv || '', // This would come from secure form
        holder_name: paymentData.holder_name
      },
      customer: {
        email: verificationData?.email || paymentData.recipient?.email || '',
        phone: paymentData.recipient?.phone,
        name: paymentData.recipient?.name || paymentData.holder_name
      },
      merchant_reference: `REF_${Date.now()}`,
      description: paymentData.description || 'Payment',
      metadata: {
        verification_token: verificationData?.verification_token,
        user_id: verificationData?.user_id,
        payment_type: 'card',
        processor: 'HSBC'
      }
    };

    // Add billing address if available
    if (paymentData.billing_address) {
      hsbcPaymentRequest.billing_address = paymentData.billing_address;
    }

    const headers = this.getAuthHeaders();

    return this.http.post<HSBCCardPaymentResponse>(
      `${this.config.baseUrl}/payments`, 
      hsbcPaymentRequest, 
      { headers }
    ).pipe(
      map(response => {
        console.log('HSBC Card Payment Response:', response);
        
        return {
          success: response.status === 'completed',
          transaction_id: response.payment_id,
          status: response.status,
          message: response.status === 'completed' 
            ? 'Payment processed successfully via HSBC' 
            : response.processor_response.message,
          amount: response.amount,
          currency: response.currency,
          fees: response.fees,
          card_details: response.card_details,
          authorization_code: response.authorization_code,
          processor: 'HSBC Card Gateway',
          processor_response: response.processor_response,
          risk_score: response.risk_score,
          created_at: response.created_at
        };
      }),
      retry(1), // Retry once on failure
      catchError(this.handlePaymentError)
    );
  }

  // Process payment using stored card via HSBC
  processStoredCardPayment(cardId: string, paymentData: any, verificationData?: any): Observable<any> {
    if (!this.isConfigured()) {
      return throwError(() => new Error('HSBC card processor not configured'));
    }

    // Use stored card token instead of card details
    const hsbcPaymentRequest = {
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      card_token: cardId, // Use stored card token
      customer: {
        email: verificationData?.email || paymentData.recipient?.email || '',
        phone: paymentData.recipient?.phone,
        name: paymentData.recipient?.name || 'Customer'
      },
      merchant_reference: `REF_${Date.now()}`,
      description: paymentData.description || 'Payment',
      cvv: paymentData.cvv, // Still need CVV for stored cards
      metadata: {
        verification_token: verificationData?.verification_token,
        user_id: verificationData?.user_id,
        payment_type: 'stored_card',
        processor: 'HSBC'
      }
    };

    const headers = this.getAuthHeaders();

    return this.http.post<HSBCCardPaymentResponse>(
      `${this.config.baseUrl}/payments/stored-card`, 
      hsbcPaymentRequest, 
      { headers }
    ).pipe(
      map(response => ({
        success: response.status === 'completed',
        transaction_id: response.payment_id,
        status: response.status,
        message: response.status === 'completed' 
          ? 'Payment processed successfully via HSBC' 
          : response.processor_response.message,
        amount: response.amount,
        currency: response.currency,
        fees: response.fees,
        card_details: response.card_details,
        authorization_code: response.authorization_code,
        processor: 'HSBC Card Gateway',
        processor_response: response.processor_response,
        created_at: response.created_at
      })),
      catchError(this.handlePaymentError)
    );
  }

  // Get stored cards from HSBC
  getStoredCards(customerId: string): Observable<StoredCard[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    const headers = this.getAuthHeaders();

    return this.http.get<{cards: StoredCard[]}>(
      `${this.config.baseUrl}/customers/${customerId}/cards`, 
      { headers }
    ).pipe(
      map(response => response.cards || []),
      catchError(error => {
        console.error('Failed to load HSBC stored cards:', error);
        return of([]);
      })
    );
  }

  // Store card with HSBC for future use
  storeCard(cardData: any, customerId: string): Observable<StoredCard> {
    const headers = this.getAuthHeaders();
    
    const storeCardRequest = {
      customer_id: customerId,
      card: {
        number: cardData.number,
        expiry_month: cardData.expiry_month,
        expiry_year: cardData.expiry_year,
        holder_name: cardData.holder_name
      },
      billing_address: cardData.billing_address
    };

    return this.http.post<StoredCard>(
      `${this.config.baseUrl}/cards/store`, 
      storeCardRequest, 
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Failed to store card with HSBC:', error);
        return throwError(() => error);
      })
    );
  }

  // Verify card via HSBC (for card validation)
  verifyCard(cardData: any): Observable<{valid: boolean, card_type: string, issuer: string}> {
    const headers = this.getAuthHeaders();
    
    const verifyRequest = {
      card_number: cardData.number,
      expiry_month: cardData.expiry_month,
      expiry_year: cardData.expiry_year
    };

    return this.http.post<any>(
      `${this.config.baseUrl}/cards/verify`, 
      verifyRequest, 
      { headers }
    ).pipe(
      map(response => ({
        valid: response.valid,
        card_type: response.card_type,
        issuer: response.issuer
      })),
      catchError(() => of({valid: false, card_type: 'unknown', issuer: 'unknown'}))
    );
  }

  // Get payment status from HSBC
  getPaymentStatus(paymentId: string): Observable<any> {
    const headers = this.getAuthHeaders();

    return this.http.get<HSBCCardPaymentResponse>(
      `${this.config.baseUrl}/payments/${paymentId}`, 
      { headers }
    ).pipe(
      map(response => ({
        payment_id: response.payment_id,
        status: response.status,
        amount: response.amount,
        currency: response.currency,
        card_details: response.card_details,
        created_at: response.created_at,
        updated_at: response.updated_at
      })),
      catchError(error => {
        console.error('Failed to get payment status:', error);
        return throwError(() => error);
      })
    );
  }

  // Refund payment via HSBC
  refundPayment(paymentId: string, amount?: number, reason?: string): Observable<any> {
    const headers = this.getAuthHeaders();
    
    const refundRequest = {
      payment_id: paymentId,
      amount: amount, // Partial refund if specified
      reason: reason || 'Customer request'
    };

    return this.http.post<any>(
      `${this.config.baseUrl}/payments/${paymentId}/refund`, 
      refundRequest, 
      { headers }
    ).pipe(
      map(response => ({
        success: true,
        refund_id: response.refund_id,
        status: response.status,
        amount: response.amount,
        message: 'Refund processed successfully via HSBC'
      })),
      catchError(this.handlePaymentError)
    );
  }

  // Get transaction fees from HSBC
  calculateFees(amount: number, cardType: string): Observable<{processing_fee: number, total_fee: number}> {
    const headers = this.getAuthHeaders();
    
    return this.http.post<any>(
      `${this.config.baseUrl}/fees/calculate`, 
      { amount, card_type: cardType }, 
      { headers }
    ).pipe(
      map(response => ({
        processing_fee: response.processing_fee,
        total_fee: response.total_fee
      })),
      catchError(() => of({
        processing_fee: amount * 0.029 + 0.30, // Default fee calculation
        total_fee: amount * 0.029 + 0.30
      }))
    );
  }

  // Error handling
  private handlePaymentError = (error: HttpErrorResponse): Observable<never> => {
    console.error('HSBC Card Payment Error:', error);
    
    let errorMessage = 'Card payment processing failed';
    let errorCode = 'HSBC_PAYMENT_ERROR';
    
    if (error.status === 400) {
      errorMessage = 'Invalid payment request or card details';
      errorCode = 'HSBC_BAD_REQUEST';
    } else if (error.status === 401) {
      errorMessage = 'HSBC authentication failed';
      errorCode = 'HSBC_AUTH_FAILED';
    } else if (error.status === 402) {
      errorMessage = 'Payment declined by card issuer';
      errorCode = 'HSBC_PAYMENT_DECLINED';
    } else if (error.status === 403) {
      errorMessage = 'Payment forbidden by HSBC fraud detection';
      errorCode = 'HSBC_FORBIDDEN';
    } else if (error.status === 429) {
      errorMessage = 'Too many payment requests. Please try again later.';
      errorCode = 'HSBC_RATE_LIMIT';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
      errorCode = error.error.code || 'HSBC_CUSTOM_ERROR';
    }

    return throwError(() => ({
      success: false,
      message: errorMessage,
      error_code: errorCode,
      processor: 'HSBC Card Gateway',
      error: error
    }));
  };

  // Update configuration (useful for switching environments)
  updateConfig(newConfig: Partial<HSBCCardProcessorConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  // Health check for HSBC service
  healthCheck(): Observable<boolean> {
    if (!this.isConfigured()) {
      return of(false);
    }

    const headers = this.getAuthHeaders();

    return this.http.get(`${this.config.baseUrl}/health`, { headers }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}