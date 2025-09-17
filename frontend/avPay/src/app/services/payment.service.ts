import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AddBankAccountRequest, BankAccountResponse, BankAccountValidation, ValidationResponse } from '../components/account-management/account-management.component';
// import { BankAccount } from '../components/payment/payment.component';

export interface PaymentRequest {
  amount: number;
  currency: string;
  recipient_name: string;
  recipient_address: string;
  swift_code?: string; // Optional for bank transfers
  recipient_email?: string; // Optional for bank transfers
  purpose_details?: string; // Optional for bank transfers
  recipient_account: string;
  recipient_bank: string;
  purpose: string;
}

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  routing_number: string;
  bank_name: string;
  account_type: 'checking' | 'savings';
  is_primary?: boolean;
  masked_account?: string;
  created_at?: string;
  updated_at?: string;
  balance?: number;
  is_verified?: boolean;
  verification_status?: 'pending' | 'verified' | 'failed';
}



/**
 * Backend response interface for saved card (standardized name)
 * This should match exactly what your Python backend returns
 */
export interface SaveCardResponse {
  /** Unique identifier for the saved card */
  id: string;
  
  /** Last four digits of the card number */
  last_four: string;
  
  /** Card brand (e.g., 'Visa', 'Mastercard', 'American Express') */
  brand: string;
  
  /** Expiry month (1-12) */
  expiry_month: number;
  
  /** Expiry year (4 digits) */
  expiry_year: number;
  
  /** Cardholder's name */
  holder_name: string;
  
  /** When the card was saved (ISO date string or Date object) */
  created_at: string | Date;
  
  /** Whether this is the primary payment method (optional) */
  is_primary?: boolean;
}

// Keep SavedCardResponse as an alias for backward compatibility
export type SavedCardResponse = SaveCardResponse;

/**
 * Frontend SavedCard interface - extends the backend response
 */
export interface SavedCard extends SaveCardResponse {
  /** Last updated timestamp */
  updated_at: string;
  
  /** Whether this card is currently selected in the UI */
  selected?: boolean;
  
  /** Card status for UI display */
  status?: 'active' | 'expired' | 'disabled';
}

// Update your interfaces to match the backend
export interface CardDetails {
  number: string;
  expiry_month: number;
  expiry_year: number;
  cvv: string;
  holder_name: string;
  is_primary?: boolean;
}


export interface CardValidationRequest {
  number: string;
  expiry_month: number;
  expiry_year: number;
  cvv: string;
}

export interface ExchangeRate {
  rate: number;
  timestamp: string;
  source: string;
  target: string;
  margin?: number;
}

export interface HSBCPaymentConsent {
  ConsentId: string;
  CreationDateTime: string;
  Status: string;
  StatusUpdateDateTime: string;
  Permission: string;
  Authorisation?: {
    AuthorisationType: string;
    CompletionDateTime?: string;
  };
}

export interface InternationalPaymentRequest {
  Data: {
    ConsentId: string;
    Initiation: {
      InstructionIdentification: string;
      EndToEndIdentification: string;
      InstructedAmount: {
        Amount: string;
        Currency: string;
      };
      ExchangeRateInformation?: {
        UnitCurrency: string;
        ExchangeRate?: string;
        RateType: 'ACTUAL' | 'AGREED' | 'INDICATIVE';
        ContractIdentification?: string;
      };
      DebtorAccount?: {
        SchemeName: string;
        Identification: string;
        Name?: string;
      };
      CreditorAccount: {
        SchemeName: string;
        Identification: string;
        Name: string;
      };
      CreditorAgent?: {
        SchemeName: string;
        Identification: string;
      };
      RemittanceInformation?: {
        Unstructured?: string;
        Reference?: string;
      };
      SupplementaryData?: any;
    };
  };
  Risk?: {
    PaymentContextCode?: string;
    MerchantCategoryCode?: string;
    MerchantCustomerIdentification?: string;
    DeliveryAddress?: {
      AddressLine?: string[];
      StreetName?: string;
      BuildingNumber?: string;
      PostCode?: string;
      TownName?: string;
      CountrySubDivision?: string;
      Country?: string;
    };
  };
}

export interface CardValidationResponse {
  valid: boolean;
  errors: string[];
  card_brand?: string;
  last_four?: string;
}

export interface PaymentAuthRequest {
  images_data: string[];
  payment_data: PaymentRequest;
  timestamp: string;
}

export interface PaymentResponse {
  success: boolean;
  transaction_id?: string;
  status?: string;
  message?: string;
  receipt_url?: string;
  confidence_score?: number;
  angles_verified?: number;
}

export interface Transaction {
  transaction_id: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CardPaymentRequest {
  amount: number;
  currency: string;
  card_id?: string; // For saved cards
  card_details?: {
    number: string;
    expiry_month: number;
    expiry_year: number;
    cvv: string;
    holder_name: string;
  };
  save_card?: boolean;
  purpose?: string;
}

export interface SaveCardResponse {
  success: boolean;
  card_id?: string;
  message?: string;
}

export interface CardPaymentAuthRequest {
  images_data: string[];
  card_payment_data: CardPaymentRequest;
  timestamp: string;
}

export interface ExchangeRateResponse {
  rates: { [key: string]: number };
  result: string;
  base: string;
}


export interface DeleteCardResponse {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  // BehaviorSubject to track bank accounts state
  private bankAccountsSubject = new BehaviorSubject<BankAccount[]>([]);
  public bankAccounts$ = this.bankAccountsSubject.asObservable();

  private readonly apiUrl = 'https://sandbox.ob.business.hsbc.co.uk/mock/obie/open-banking'; // Replace with actual HSBC API URL
  private readonly apiVersion = 'v4.0';
  
  private exchangeRateSubject = new BehaviorSubject<ExchangeRate | null>(null);
  public exchangeRate$ = this.exchangeRateSubject.asObservable();
  
  constructor(private apiService: ApiService, private http: HttpClient) {}

  authorizePaymentWithFace(imagesData: string[], paymentData: PaymentRequest): Observable<PaymentResponse> {
    const request: PaymentAuthRequest = {
      images_data: imagesData,
      payment_data: paymentData,
      timestamp: new Date().toISOString()
    };

    return this.apiService.post<PaymentResponse>('/payment/authorize-multi-angle', request);
  }

  processPayment(paymentData: PaymentRequest): Observable<PaymentResponse> {
    return this.apiService.post<PaymentResponse>('/payment/process', paymentData);
  }

  // getExchangeRate(baseCurrency: string, targetCurrency: string): Observable<ExchangeRateResponse> {
  //     return this.http.get<ExchangeRateResponse>(`https://open.er-api.com/v6/latest/${baseCurrency}`);
  // }

  getPaymentStatus(transactionId: string): Observable<Transaction> {
    return this.apiService.get<Transaction>(`/payment/status/${transactionId}`);
  }

  getTransactionHistory(): Observable<Transaction[]> {
    return this.apiService.get<Transaction[]>('/payment/history');
  }

  validateCard(cardData: CardValidationRequest): Observable<CardValidationResponse> {
    return this.apiService.post<CardValidationResponse>('/payment/validate-card', cardData);
  }

   updateCard(cardId: string, updates: any): Observable<any> {
    console.log('PaymentService: Updating card', cardId, updates);
    return this.http.patch(
      `/payment/cards/${cardId}`, updates
    );
  }

  setPrimaryCard(cardId: string): Observable<any> {
    console.log('PaymentService: Setting primary card', cardId);
    return this.apiService.put(
      `/payment/${cardId}/primary`,
      {}
    );
  }
  

   getTransactionById(transactionId: string): Observable<Transaction> {
    return this.apiService.get<Transaction>(`/payment/transaction/${transactionId}`);
  }

  // Card Payment Methods
  processCardPayment(cardPaymentData: CardPaymentRequest, verificationData?: any): Observable<PaymentResponse> {
    const payload = {
      ...cardPaymentData,
      verification_data: verificationData
    };
    return this.apiService.post<PaymentResponse>('/payment/card/process', payload);
  }

  authorizeCardPaymentWithFace(imagesData: string[], cardPaymentData: CardPaymentRequest): Observable<PaymentResponse> {
    const request: CardPaymentAuthRequest = {
      images_data: imagesData,
      card_payment_data: cardPaymentData,
      timestamp: new Date().toISOString()
    };

    return this.apiService.post<PaymentResponse>('/payment/authorize-card-payment', request);
  }

  // Saved Cards Management
  getSavedCards(): Observable<SavedCard[]> {
    return this.apiService.get<SavedCard[]>('/payment/cards');
  }

  getSavedBankAccounts(): Observable<AddBankAccountRequest[]> {
    return this.apiService.get<AddBankAccountRequest[]>('/payment/bank-accounts');
  }

  saveCard(cardDetails: {
    number: string;
    expiry_month: number;
    expiry_year: number;
    holder_name: string;
    set_as_default?: boolean;
  }): Observable<SaveCardResponse> {
    return this.apiService.post<SaveCardResponse>('/payment/save-card', cardDetails);
  }

  deleteCard(cardId: string): Observable<DeleteCardResponse> {
    return this.apiService.delete<DeleteCardResponse>(`/payment/${cardId}`);
  }

  setDefaultCard(cardId: string): Observable<SaveCardResponse> {
    return this.apiService.put<SaveCardResponse>(`/payment/cards/${cardId}/default`, {});
  }

   // Receipt Methods
  downloadReceipt(transactionId: string): Observable<Blob> {
    return this.apiService.get<Blob>(`/payment/receipt/${transactionId}`);
  }

  

  emailReceipt(transactionId: string, email: string): Observable<{success: boolean; message: string}> {
    return this.apiService.post<{success: boolean; message: string}>(`/payment/receipt/${transactionId}/email`, {
      email: email
    });
  }

  // Payment Limits and Validation
  getPaymentLimits(): Observable<{
    daily_limit: number;
    monthly_limit: number;
    per_transaction_limit: number;
    remaining_daily: number;
    remaining_monthly: number;
  }> {
    return this.apiService.get('/payment/limits');
  }

   validateBankAccount(validationData: BankAccountValidation): Observable<ValidationResponse> {
    return this.apiService.post<ValidationResponse>(
      `/bank-accounts/validate`,
      validationData,
    ).pipe(
      catchError(this.handleError<ValidationResponse>('validateBankAccount'))
    );
  }

 private mapResponseToBankAccount = (response: BankAccountResponse): BankAccount => {
    return {
      id: response.id,
      account_name: response.account_name,
      account_number: response.masked_account,
      routing_number: response.routing_number,
      bank_name: response.bank_name,
      account_type: response.account_type as 'checking' | 'savings',
      is_primary: response.is_primary,
      masked_account: response.masked_account,
      created_at: response.created_at,
      updated_at: response.updated_at,
      balance: response.balance,
      is_verified: response.is_verified,
      verification_status: response.verification_status as 'pending' | 'verified' | 'failed'
    };
  };

  setPrimaryBankAccount(accountId: string): Observable<BankAccount> {
    return this.http.patch<BankAccountResponse>(
      `/bank-accounts/${accountId}/set-primary`,
      {},
    ).pipe(
      map(this.mapResponseToBankAccount),
      map(primaryAccount => {
        // Update local state - set all to non-primary except the selected one
        const currentAccounts = this.bankAccountsSubject.value;
        const updatedAccounts = currentAccounts.map(account => ({
          ...account,
          is_primary: account.id === accountId
        }));
        this.bankAccountsSubject.next(updatedAccounts);
        return primaryAccount;
      }),
      catchError(this.handleError<BankAccount>('setPrimaryBankAccount'))
    );
  }

    /**
   * Delete a bank account
   */
  deleteBankAccount(accountId: string): Observable<void> {
    return this.apiService.delete<void>(
      `/bank-accounts/${accountId}`,
    ).pipe(
      map(() => {
        // Update local state
        const currentAccounts = this.bankAccountsSubject.value;
        const filteredAccounts = currentAccounts.filter(account => account.id !== accountId);
        this.bankAccountsSubject.next(filteredAccounts);
      }),
      catchError(this.handleError<void>('deleteBankAccount'))
    );
  }
    /**
   * Add a new bank account
   */
addBankAccount(accountData: AddBankAccountRequest): Observable<BankAccount> {
    return this.apiService.post<BankAccountResponse>(`/bank-accounts`,  accountData).pipe(
      map(this.mapResponseToBankAccount),
      map(newAccount => {
        // Update local state
        const currentAccounts = this.bankAccountsSubject.value;
        
        // If this is primary, make others non-primary
        if (newAccount.is_primary) {
          currentAccounts.forEach(account => account.is_primary = false);
        }
        
        this.bankAccountsSubject.next([...currentAccounts, newAccount]);
        return newAccount;
      }),
      catchError(this.handleError<BankAccount>('addBankAccount'))
    );
  }

 

  // Utility Methods
  getBankList(): Observable<{
    code: string;
    name: string;
    country: string;
  }[]> {
    return this.apiService.get('/payment/banks');
  }

    private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      
      // You could add user-friendly error messages here
      // or integrate with a notification service
      
      // Return a safe result to keep the app running
      return new Observable(observer => {
        observer.error(error);
      });
    };
  }

  calculateFees(amount: number, paymentMethod: 'bank' | 'card'): Observable<{
    base_amount: number;
    fees: number;
    total_amount: number;
    fee_breakdown: {
      processing_fee: number;
      service_fee: number;
      tax: number;
    };
  }> {
    return this.apiService.post('/payment/calculate-fees', {
      amount: amount,
      payment_method: paymentMethod
    });
  }


  // Get current exchange rates
  getExchangeRate(fromCurrency: string, toCurrency: string): Observable<ExchangeRate> {
    const headers = this.getHeaders();
    
    return this.http.get<any>(`${this.apiUrl}/fx/rates`, {
      headers,
      params: {
        from: fromCurrency,
        to: toCurrency
      }
    }).pipe(
      map(response => ({
        rate: response.rate,
        timestamp: response.timestamp || new Date().toISOString(),
        source: fromCurrency,
        target: toCurrency,
        margin: response.margin || 0
      })),
      tap(rate => this.exchangeRateSubject.next(rate)),
      catchError(error => {
        console.error('Error fetching exchange rate:', error);
        // Return mock rate for development
        const mockRate: ExchangeRate = {
          rate: 0.85, // 1 USD = 0.85 EUR
          timestamp: new Date().toISOString(),
          source: fromCurrency,
          target: toCurrency,
          margin: 0.02
        };
        this.exchangeRateSubject.next(mockRate);
        return of(mockRate);
      })
    );
  }

  // Create payment consent for international transfers
  createInternationalPaymentConsent(paymentData: any): Observable<HSBCPaymentConsent> {
    const headers = this.getHeaders();
    
    const consentRequest = {
      Data: {
        Permission: 'Create',
        Initiation: {
          InstructionIdentification: this.generateInstructionId(),
          EndToEndIdentification: this.generateEndToEndId(),
          InstructedAmount: {
            Amount: paymentData.amount.toFixed(2),
            Currency: paymentData.currency
          },
          ExchangeRateInformation: paymentData.exchangeRate ? {
            UnitCurrency: paymentData.currency,
            ExchangeRate: paymentData.exchangeRate.rate.toString(),
            RateType: 'INDICATIVE'
          } : undefined,
          CreditorAccount: {
            SchemeName: paymentData.recipientDetails.accountType || 'IBAN',
            Identification: paymentData.recipientDetails.accountNumber,
            Name: paymentData.recipientDetails.name
          },
          CreditorAgent: paymentData.recipientDetails.swiftCode ? {
            SchemeName: 'BICFI',
            Identification: paymentData.recipientDetails.swiftCode
          } : undefined,
          RemittanceInformation: {
            Unstructured: paymentData.notes || 'International payment',
            Reference: paymentData.reference || this.generateReference()
          }
        }
      },
      Risk: {
        PaymentContextCode: 'TransferToSelf', // or 'TransferToThirdParty'
        DeliveryAddress: paymentData.recipientDetails.address ? {
          Country: paymentData.recipientDetails.country,
          TownName: paymentData.recipientDetails.city,
          PostCode: paymentData.recipientDetails.zipCode,
          AddressLine: [paymentData.recipientDetails.street]
        } : undefined
      }
    };

    return this.http.post<HSBCPaymentConsent>(
      `${this.apiUrl}/open-banking/${this.apiVersion}/pisp/international-payment-consents`,
      consentRequest,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error creating payment consent:', error);
        throw error;
      })
    );
  }


   // Utility methods
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.getAccessToken(),
      'x-fapi-financial-id': 'HSBC-OB', // HSBC Open Banking identifier
      'x-fapi-customer-last-logged-time': new Date().toISOString(),
      'x-fapi-interaction-id': this.generateInteractionId(),
      'x-idempotency-key': this.generateIdempotencyKey()
    });
  }
  // Execute international payment
  executeInternationalPayment(consentId: string, paymentData: any): Observable<any> {
    const headers = this.getHeaders();
    
    const paymentRequest: InternationalPaymentRequest = {
      Data: {
        ConsentId: consentId,
        Initiation: {
          InstructionIdentification: this.generateInstructionId(),
          EndToEndIdentification: this.generateEndToEndId(),
          InstructedAmount: {
            Amount: paymentData.amount.toFixed(2),
            Currency: paymentData.currency
          },
          ExchangeRateInformation: paymentData.exchangeRate ? {
            UnitCurrency: paymentData.currency,
            ExchangeRate: paymentData.exchangeRate.rate.toString(),
            RateType: 'ACTUAL'
          } : undefined,
          CreditorAccount: {
            SchemeName: paymentData.recipientDetails.accountType || 'IBAN',
            Identification: paymentData.recipientDetails.accountNumber,
            Name: paymentData.recipientDetails.name
          },
          CreditorAgent: paymentData.recipientDetails.swiftCode ? {
            SchemeName: 'BICFI',
            Identification: paymentData.recipientDetails.swiftCode
          } : undefined,
          RemittanceInformation: {
            Unstructured: paymentData.notes || 'International payment'
          }
        }
      }
    };

    return this.http.post<any>(
      `${this.apiUrl}/open-banking/${this.apiVersion}/pisp/international-payments`,
      paymentRequest,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error executing international payment:', error);
        throw error;
      })
    );
  }

   private getAccessToken(): string {
    // In a real app, this would come from your auth service
    return localStorage.getItem('access_token') || 'mock_token';
  }

  private generateInstructionId(): string {
    return 'INSTR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  private generateEndToEndId(): string {
    return 'E2E-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private generateReference(): string {
    return 'REF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  private generateInteractionId(): string {
    return 'INT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private generateIdempotencyKey(): string {
    return 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 10).toUpperCase();
  }

  private generateTransactionId(): string {
    return 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  // Format currency with proper symbols
  formatCurrency(amount: number, currency: string): string {
    const currencySymbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$'
    };

    const symbol = currencySymbols[currency] || currency;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

   // Get supported currencies for international transfers
  getSupportedCurrencies(): Observable<string[]> {
    return this.http.get<string[]>(`https://open.er-api.com/v6/latest/USD`)
      .pipe(
        catchError(error => {
          console.error('Error loading supported currencies:', error);
          return of(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK']);
        })
      );
  }

  // Get country-specific transfer requirements
  getCountryTransferRequirements(countryCode: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/countries/${countryCode}/transfer-requirements`)
      .pipe(
        catchError(error => {
          console.error('Error loading country requirements:', error);
          return of({
            requiresSwift: true,
            requiresIban: countryCode === 'US' ? false : true,
            maxAmount: 50000,
            requiredFields: ['name', 'accountNumber', 'address']
          });
        })
      );
  }

  convertCurrency(amount: number, rate: number): number {
    return parseFloat((amount * rate).toFixed(2));
  }

  // Process cross-border transfer with HSBC API
  processCrossBorderTransfer(transferData: any): Observable<any> {
    return new Observable(observer => {
      // Step 1: Create payment consent
      this.createInternationalPaymentConsent(transferData).subscribe({
        next: (consent) => {
          console.log('Payment consent created:', consent);
          
          // Step 2: Get user authorization (this would typically redirect to HSBC auth)
          // For now, we'll simulate the authorization
          setTimeout(() => {
            // Step 3: Execute the payment
            this.executeInternationalPayment(consent.ConsentId, transferData).subscribe({
              next: (paymentResult) => {
                observer.next({
                  success: true,
                  transaction_id: paymentResult.Data?.InternationalPaymentId || this.generateTransactionId(),
                  consent_id: consent.ConsentId,
                  status: paymentResult.Data?.Status || 'Pending',
                  message: 'Cross-border transfer initiated successfully'
                });
                observer.complete();
              },
              error: (error) => {
                observer.error({
                  success: false,
                  message: 'Failed to execute payment: ' + (error.error?.message || error.message),
                  error_code: error.error?.error_code || 'EXECUTION_FAILED'
                });
              }
            });
          }, 1000); // Simulate auth delay
        },
        error: (error) => {
          observer.error({
            success: false,
            message: 'Failed to create payment consent: ' + (error.error?.message || error.message),
            error_code: error.error?.error_code || 'CONSENT_FAILED'
          });
        }
      });
    });
  }

  // Calculate transfer fees
  calculateTransferFee(amount: number, transferType: 'domestic' | 'international', currency: string = 'USD'): number {
    if (transferType === 'domestic') {
      return 0; // Free domestic transfers
    } else {
      // Cross-border fees: flat fee + percentage
      const flatFee = currency === 'USD' ? 15 : 12; // Different fees for different currencies
      const percentageFee = amount * 0.01; // 1%
      return flatFee + percentageFee;
    }
  }

  // Validate international payment details
  validateInternationalPayment(details: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!details.recipientDetails?.name) {
      errors.push('Recipient name is required');
    }

    if (!details.recipientDetails?.accountNumber) {
      errors.push('Recipient account number is required');
    }

    if (!details.recipientDetails?.swiftCode && !details.recipientDetails?.iban) {
      errors.push('Either SWIFT/BIC code or IBAN is required for international transfers');
    }

    if (!details.recipientDetails?.country) {
      errors.push('Recipient country is required');
    }

    if (details.amount <= 0) {
      errors.push('Payment amount must be greater than zero');
    }

    // Additional validation for specific countries or regulations
    if (details.amount > 10000) {
      errors.push('Transfers over $10,000 require additional verification');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
