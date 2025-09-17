import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from, of } from 'rxjs';
import { map, catchError, switchMap, retry, delay } from 'rxjs/operators';
import { HSBC_CONFIG, HSBCConfig } from '../tokens/hsbc.token';


export interface HSBCAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface HSBCPaymentRequest {
  instructionIdentification: string;
  endToEndIdentification: string;
  instructedAmount: {
    amount: string;
    currency: string;
  };
  debtorAccount: {
    identification: string;
    schemeName: string;
  };
  creditorAccount: {
    name: string;
    identification: string;
    schemeName?: string;
  };
  remittanceInformation: {
    unstructured: string;
  };
  requestedExecutionDate: string;
}

export interface HSBCPaymentResponse {
  Data: {
    DomesticCreditTransferID: string;
    ConsentID: string;
    Status: string;
    CreationDateTime: string;
    Initiation: HSBCPaymentRequest;
  };
  Links: {
    Self: string;
  };
  Meta: {
    TotalPages: number;
    FirstAvailableDateTime: string;
    LastAvailableDateTime: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class HSBCPaymentService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private http: HttpClient,
    @Inject(HSBC_CONFIG) private config: HSBCConfig
  ) {}

  // Check if HSBC is properly configured
  isConfigured(): boolean {
    return !!(this.config.enabled && 
             this.config.clientId && 
             this.config.clientSecret && 
             this.config.corporateAccountId);
  }

  // Authentication with HSBC
  private authenticate(): Observable<HSBCAuthResponse> {
    const authPayload = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'payments accounts'
    });

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    });

    return this.http.post<HSBCAuthResponse>(
      `${this.config.baseUrl}/oauth2/token`, 
      authPayload.toString(), 
      { headers }
    ).pipe(
      map(response => {
        this.accessToken = response.access_token;
        this.tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000; // 1 min buffer
        console.log('HSBC Authentication successful');
        return response;
      }),
      retry(2), // Retry authentication up to 2 times
      catchError(this.handleAuthError)
    );
  }

  private handleAuthError = (error: HttpErrorResponse): Observable<never> => {
    console.error('HSBC Authentication failed:', error);
    let errorMessage = 'HSBC authentication failed';
    
    if (error.status === 401) {
      errorMessage = 'Invalid HSBC credentials';
    } else if (error.status === 403) {
      errorMessage = 'HSBC access forbidden';
    } else if (error.status === 0) {
      errorMessage = 'Network error connecting to HSBC';
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Get valid access token
  private getAccessToken(): Observable<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return of(this.accessToken);
    }
    
    return this.authenticate().pipe(
      map(response => response.access_token)
    );
  }

  // Transform payment data to HSBC format
  private transformPaymentData(paymentData: any): HSBCPaymentRequest {
    return {
      instructionIdentification: paymentData.card_id || paymentData.bank_account_id || paymentData.hsbc_account_id,
      endToEndIdentification: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      instructedAmount: {
        amount: paymentData.amount.toFixed(2),
        currency: paymentData.currency
      },
      debtorAccount: {
        identification: this.config.corporateAccountId,
        schemeName: "IBAN"
      },
      creditorAccount: {
        name: paymentData.recipient?.name || 'Unknown Recipient',
        identification: paymentData.recipient?.accountNumber || 'TEMP_ACCOUNT',
        schemeName: "IBAN"
      },
      remittanceInformation: {
        unstructured: paymentData.description || 'Payment'
      },
      requestedExecutionDate: new Date().toISOString().split('T')[0]
    };
  }

  // Create payment with HSBC
  processPayment(paymentData: any): Observable<any> {
    if (!this.isConfigured()) {
      return throwError(() => new Error('HSBC payment service not configured'));
    }

    return this.getAccessToken().pipe(
      switchMap(token => {
        const hsbc_payment_request = this.transformPaymentData(paymentData);
        
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId(),
          'X-Customer-IP-Address': '127.0.0.1',
          'X-Customer-User-Agent': navigator.userAgent,
          'Accept': 'application/json'
        });

        const payload = {
          Data: {
            Initiation: hsbc_payment_request
          },
          Risk: {
            PaymentContextCode: paymentData.recipient?.category || 'Other'
          }
        };

        console.log('Sending HSBC payment request:', payload);

        return this.http.post<HSBCPaymentResponse>(
          `${this.config.baseUrl}/payments/domestic-credit-transfers`, 
          payload, 
          { headers }
        );
      }),
      map(response => {
        console.log('HSBC Payment successful:', response);
        
        return {
          success: true,
          transaction_id: response.Data.DomesticCreditTransferID,
          status: response.Data.Status,
          message: 'Payment processed successfully via HSBC',
          hsbc_payment_id: response.Data.DomesticCreditTransferID,
          consent_id: response.Data.ConsentID,
          creation_time: response.Data.CreationDateTime,
          amount: paymentData.amount,
          currency: paymentData.currency,
          recipient: paymentData.recipient,
          provider: 'HSBC'
        };
      }),
      catchError(this.handlePaymentError)
    );
  }

  private handlePaymentError = (error: HttpErrorResponse): Observable<never> => {
    console.error('HSBC Payment failed:', error);
    
    let errorMessage = 'Payment processing failed';
    let errorCode = 'HSBC_GENERAL_ERROR';
    
    if (error.status === 400) {
      errorMessage = 'Invalid payment request data';
      errorCode = 'HSBC_BAD_REQUEST';
    } else if (error.status === 401) {
      errorMessage = 'Authentication failed with HSBC';
      errorCode = 'HSBC_AUTH_FAILED';
    } else if (error.status === 403) {
      errorMessage = 'Payment not authorized by HSBC';
      errorCode = 'HSBC_FORBIDDEN';
    } else if (error.status === 409) {
      errorMessage = 'Duplicate payment detected';
      errorCode = 'HSBC_DUPLICATE';
    } else if (error.status === 429) {
      errorMessage = 'Too many requests to HSBC. Please try again later.';
      errorCode = 'HSBC_RATE_LIMIT';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      success: false,
      message: errorMessage,
      error_code: errorCode,
      provider: 'HSBC',
      error: error
    }));
  }

  // Check payment status
  getPaymentStatus(paymentId: string): Observable<any> {
    return this.getAccessToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': this.generateRequestId(),
          'Accept': 'application/json'
        });

        return this.http.get(`${this.config.baseUrl}/payments/domestic-credit-transfers/${paymentId}`, { headers });
      }),
      map(response => ({
        success: true,
        status: response,
        provider: 'HSBC'
      })),
      catchError(error => {
        console.error('HSBC Status check failed:', error);
        return throwError(() => ({
          success: false,
          message: 'Failed to get payment status from HSBC',
          error: error
        }));
      })
    );
  }

  // Get available HSBC corporate accounts
  getAvailablePaymentMethods(): Observable<any[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    return this.getAccessToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': this.generateRequestId(),
          'Accept': 'application/json'
        });

        return this.http.get<any>(`${this.config.baseUrl}/accounts`, { headers });
      }),
      map(response => {
        if (!response.Data?.Account) {
          return [];
        }

        return response.Data.Account.map((account: any) => ({
          id: account.AccountId,
          account_name: account.Nickname || `HSBC ${account.AccountType}`,
          bank_name: 'HSBC',
          account_type: account.AccountType,
          masked_account: this.maskAccountNumber(account.AccountId),
          routing_number: account.SortCode || '',
          is_primary: account.AccountType === 'CurrentAccount',
          balance: account.Balance?.[0]?.Amount || '0.00',
          currency: account.Currency || 'USD',
          type: 'hsbc'
        }));
      }),
      catchError(error => {
        console.error('Failed to load HSBC accounts:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  // Validate recipient account
  validateRecipientAccount(accountNumber: string, sortCode?: string): Observable<boolean> {
    return this.getAccessToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId()
        });

        const payload = {
          accountNumber: accountNumber,
          sortCode: sortCode
        };

        return this.http.post<any>(`${this.config.baseUrl}/account-validation`, payload, { headers });
      }),
      map(response => response.valid === true),
      catchError(error => {
        console.error('Account validation failed:', error);
        return of(false); // Default to false if validation fails
      })
    );
  }

  // Cancel payment (if supported)
  cancelPayment(paymentId: string): Observable<any> {
    return this.getAccessToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId()
        });

        return this.http.delete(`${this.config.baseUrl}/payments/domestic-credit-transfers/${paymentId}`, { headers });
      }),
      map(response => ({
        success: true,
        message: 'Payment cancelled successfully',
        provider: 'HSBC'
      })),
      catchError(error => {
        console.error('Payment cancellation failed:', error);
        return throwError(() => ({
          success: false,
          message: 'Failed to cancel payment',
          error: error
        }));
      })
    );
  }

  // Get payment history
  getPaymentHistory(fromDate?: string, toDate?: string): Observable<any[]> {
    return this.getAccessToken().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': this.generateRequestId()
        });

        let url = `${this.config.baseUrl}/payments/domestic-credit-transfers`;
        const params = new URLSearchParams();
        
        if (fromDate) params.append('fromBookingDateTime', fromDate);
        if (toDate) params.append('toBookingDateTime', toDate);
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        return this.http.get<any>(url, { headers });
      }),
      map(response => {
        return response.Data?.DomesticCreditTransfer?.map((payment: any) => ({
          id: payment.DomesticCreditTransferID,
          amount: payment.InstructedAmount?.Amount || '0',
          currency: payment.InstructedAmount?.Currency || 'USD',
          status: payment.Status,
          recipient: payment.CreditorAccount?.Name || 'Unknown',
          date: payment.CreationDateTime,
          provider: 'HSBC'
        })) || [];
      }),
      catchError(error => {
        console.error('Failed to get payment history:', error);
        return of([]);
      })
    );
  }

  // Utility methods
  private generateRequestId(): string {
    return `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    return '••••' + accountNumber.slice(-4);
  }

  // Update configuration (useful for switching between sandbox and production)
  updateConfig(newConfig: Partial<HSBCConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  // Health check for HSBC service
  healthCheck(): Observable<boolean> {
    if (!this.isConfigured()) {
      return of(false);
    }

    return this.getAccessToken().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}