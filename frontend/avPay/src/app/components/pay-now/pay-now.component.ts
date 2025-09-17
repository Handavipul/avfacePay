// pay-now.component.ts - Payment Processing Component with Mollie Integration
import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { PaymentService, SavedCard } from '../../services/payment.service';
import { MollieService } from '../../services/mollie.service'; // NEW: Mollie service
import { Subscription } from 'rxjs';

interface PaymentCard {
  id: string;
  holder_name: string;
  last_four: string;
  brand: string;
  expiry_month: string;
  expiry_year: string;
  is_primary: boolean;
  type?: string;
}

interface RecipientDetails {
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  accountNumber?: string;
  routingNumber?: string;
  memo: string;
  category?: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_type: string;
  masked_account: string;
  routing_number: string;
  is_primary: boolean;
  type?: string;
}

interface ExternalBankDetails {
  name: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode?: string;
  iban?: string;
  country?: string;
}

interface HSBCAccount {
  id: string;
  account_name: string;
  last_four: string;
  currency: string;
  balance: number;
  type: string;
}

interface ExchangeRate {
  rate: number;
  timestamp: string;
  source: string;
  target: string;
}

interface PaymentMethod extends PaymentCard, BankAccount {
  type: 'card' | 'bank';
}

interface PaymentProviderMethod {
  id: string;
  name: string;
  icon: string;
  provider: 'mollie' | 'stripe';
  type: string;
  enabled?: boolean;
  fee?: number; // Fee percentage
  minAmount?: number;
  maxAmount?: number;
  countries?: string[]; // Supported countries
}

// NEW: Mollie-specific interfaces
interface MolliePayment {
  id: string;
  amount: {
    currency: string;
    value: string;
  };
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  metadata?: any;
  method?: string;
  locale?: string;
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


interface MolliePaymentStatus {
  id: string;
  status: 'open' | 'paid' | 'canceled' | 'expired' | 'failed' | 'pending';
  amount: any;
  description: string;
  createdAt: string;
  paidAt?: string;
  method?: string;
}

@Component({
  selector: 'app-pay-now',
  standalone: false,
  templateUrl: './pay-now.component.html',
  styleUrls: ['./pay-now.component.css']
})
export class PayNowComponent implements OnInit {
  @Output() onGoBack = new EventEmitter<void>();
  @Output() onPaymentComplete = new EventEmitter<any>();
  mollieCustomerId: string | null = null;
  isLoadingStoredMethods: boolean = false
  currentUser: any = null;
  shouldSaveRecipient: boolean = false;
  recipientDetails: RecipientDetails = {
    name: '',
    email: '',
    phone: '',
    memo: '',
    category: 'personal'
  };

  convertedAmount: number = 0;
  
  // Payment Type Selection (UPDATED with 'others')
  paymentType: 'card' | 'bank' | 'others' | null = null;
  
  // Third-party payment providers (NEW)
  selectedPaymentProvider: 'mollie' | 'stripe' | null = null;
  selectedProviderMethod: string | null = null;
  
  // NEW: Mollie-specific properties
  molliePaymentId: string | null = null;
  mollieCheckoutUrl: string | null = null;
  molliePaymentStatus: string | null = null;
  molliePaymentPolling: boolean = false;
  mollieRedirectPending: boolean = false;

  customerMandates: MollieMandate[] = [];
  selectedMandateId: string | null = null;
  selectedMandate: MollieMandate | null = null;
  useStoredMethod: boolean = true;
  hasValidMandates: boolean = false;
  loadingMandates: boolean = false;
  
  // Transfer Type (only for Bank Transfers)
  transferType: 'domestic' | 'international' | null = null;
  
  // Recipient Account (only for Bank Transfers)
  recipientAccountType: 'hsbc' | 'external' | null = null;
  selectedRecipientAccount: string | null = null;
  externalBankDetails: ExternalBankDetails = {
    name: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: '',
    iban: '',
    country: ''
  };

  exchangeRate: ExchangeRate | null = null;
  sourceCurrency: string = 'USD';
  targetCurrency: string = 'USD';

  recipientHSBCAccounts: HSBCAccount[] = [
    {
      id: 'acc1',
      account_name: 'Primary Checking',
      last_four: '1234',
      currency: 'USD',
      balance: 12500.00,
      type: 'checking'
    },
    {
      id: 'acc2',
      account_name: 'Savings Account',
      last_four: '5678',
      currency: 'USD',
      balance: 34200.00,
      type: 'savings'
    }
  ];

  countries = [
    { code: 'US', name: 'United States' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' }
  ];
  
  supportedCurrencies: string[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
  
  // UPDATED: Payment provider methods with Mollie-specific details
  paymentProviderMethods: { [key: string]: PaymentProviderMethod[] } = {
    mollie: [
      { 
        id: 'creditcard', 
        name: 'Credit Card', 
        icon: '💳', 
        provider: 'mollie', 
        type: 'card',
        enabled: true,
        fee: 2.8,
        minAmount: 0.01,
        maxAmount: 10000,
        countries: ['US', 'CA', 'EU', 'UK', 'AU']
      },
      { 
        id: 'paypal', 
        name: 'PayPal', 
        icon: '🅿️', 
        provider: 'mollie', 
        type: 'wallet',
        enabled: true,
        fee: 3.4,
        minAmount: 0.01,
        maxAmount: 8000
      },
      { 
        id: 'applepay', 
        name: 'Apple Pay', 
        icon: '🍎', 
        provider: 'mollie', 
        type: 'wallet',
        enabled: true,
        fee: 2.8,
        minAmount: 0.01,
        maxAmount: 10000
      },
      { 
        id: 'googlepay', 
        name: 'Google Pay', 
        icon: '🌐', 
        provider: 'mollie', 
        type: 'wallet',
        enabled: true,
        fee: 2.8,
        minAmount: 0.01,
        maxAmount: 10000
      },
      { 
        id: 'ideal', 
        name: 'iDEAL', 
        icon: '🇳🇱', 
        provider: 'mollie', 
        type: 'bank',
        enabled: true,
        fee: 0.29,
        minAmount: 0.01,
        maxAmount: 50000,
        countries: ['NL']
      },
      { 
        id: 'sepadirectdebit', 
        name: 'SEPA Direct Debit', 
        icon: '🏦', 
        provider: 'mollie', 
        type: 'bank',
        enabled: true,
        fee: 0.25,
        minAmount: 0.01,
        maxAmount: 100000,
        countries: ['EU']
      },
      { 
        id: 'bancontact', 
        name: 'Bancontact', 
        icon: '🇧🇪', 
        provider: 'mollie', 
        type: 'bank',
        enabled: true,
        fee: 0.25,
        minAmount: 0.01,
        maxAmount: 10000,
        countries: ['BE']
      },
      { 
        id: 'sofort', 
        name: 'SOFORT Banking', 
        icon: '🏦', 
        provider: 'mollie', 
        type: 'bank',
        enabled: true,
        fee: 0.25,
        minAmount: 0.10,
        maxAmount: 5000,
        countries: ['DE', 'AT', 'CH', 'BE', 'IT', 'NL']
      },
      { 
        id: 'eps', 
        name: 'EPS', 
        icon: '🇦🇹', 
        provider: 'mollie', 
        type: 'bank',
        enabled: true,
        fee: 0.25,
        minAmount: 1.00,
        maxAmount: 50000,
        countries: ['AT']
      },
      { 
        id: 'giropay', 
        name: 'Giropay', 
        icon: '🇩🇪', 
        provider: 'mollie', 
        type: 'bank',
        enabled: true,
        fee: 0.25,
        minAmount: 0.01,
        maxAmount: 10000,
        countries: ['DE']
      }
    ],
    stripe: [
      { id: 'card', name: 'Credit/Debit Card', icon: '💳', provider: 'stripe', type: 'card', enabled: true, fee: 2.9 },
      { id: 'apple-pay', name: 'Apple Pay', icon: '🍎', provider: 'stripe', type: 'wallet', enabled: true, fee: 2.9 },
      { id: 'google-pay', name: 'Google Pay', icon: '🌐', provider: 'stripe', type: 'wallet', enabled: true, fee: 2.9 },
      { id: 'ach', name: 'ACH Bank Transfer', icon: '🏦', provider: 'stripe', type: 'bank', enabled: true, fee: 0.8 },
      { id: 'klarna', name: 'Klarna', icon: '🛍️', provider: 'stripe', type: 'bnpl', enabled: true, fee: 3.5 },
      { id: 'afterpay', name: 'Afterpay', icon: '📅', provider: 'stripe', type: 'bnpl', enabled: true, fee: 4.0 }
    ]
  };
  
  // Recipient fields
  recipientName: string = '';
  recipientEmail: string = '';
  recipientPhone: string = '';
  paymentNote: string = '';
  recipientCategory: string = 'personal';
  isRecipientRequired: boolean = false;
  recipientCategories: string[] = ['personal', 'business', 'bill', 'donation', 'other'];
  showAdvancedRecipient: boolean = false;
  savedRecipients: RecipientDetails[] = [];
  showRecipientSearch: boolean = false;
  recipientSearchTerm: string = '';
  loadingStoredMandates: boolean = false;
  
  private subscriptions: Subscription[] = [];

  // Payment State
  paymentAmount: number = 0;
  paymentAmountDisplay: string = '';
  processingFee: number = 0;
  
  // Payment Methods
  availableCards: PaymentCard[] = [];
  availableBankAccounts: BankAccount[] = [];
  selectedPaymentMethod: PaymentMethod | null = null;
  selectedBankAccount: BankAccount | null = null;
  showMethodSelection: boolean = false;
  showBankSelection: boolean = false;
  isVerified = false; 
  
  // Quick amounts
  quickAmountOptions: number[] = [25, 50, 100, 200];
  
  // UI States
  isLoading: boolean = false;
  loadingText: string = '';
  successMessage: string = '';
  errorMessage: string = '';
  isRecipientOpen = false;
  
  // Camera verification
  showCameraVerification: boolean = false;
  
  // Success animation
  showSuccessAnimation: boolean = false;
  transactionId: string = '';
  
  // Focus states
  isAmountFocused: boolean = false;

  constructor(
    private authService: AuthService,
    private paymentService: PaymentService,
    private mollieService: MollieService // NEW: Inject Mollie service
  ) {}

  ngOnInit() {
    const userSub = this.authService.currentUser$.subscribe(
      (user) => {
        this.currentUser = user;
      }
    );
    this.subscriptions.push(userSub);
    this.initializeComponent();
  }



  initializeComponent() {
    debugger;
    if (!this.currentUser?.email) {
        this.showError('Please complete your profile before making payments');
        return;
    }
    this.loadPaymentMethods();
    this.loadSupportedCurrencies();
    this.initializeMollie(); // NEW: Initialize Mollie
  }

  // NEW: Initialize Mollie
  private initializeMollie() {
    this.mollieService.initialize().subscribe({
      next: (config) => {
        console.log('Mollie initialized successfully', config);
      },
      error: (error) => {
        console.error('Failed to initialize Mollie:', error);
        this.showError('Failed to initialize payment provider');
      }
    });
  }

  // UPDATED: Payment Type Selection Methods
  setPaymentType(type: 'card' | 'bank' | 'others') {
    this.paymentType = type;
    // Reset related selections when switching payment types
    this.transferType = null;
    this.recipientAccountType = null;
    this.selectedRecipientAccount = null;
    this.selectedPaymentProvider = null;
    this.selectedProviderMethod = null;
    this.resetExternalBankDetails();
    this.resetMollieState(); // NEW: Reset Mollie state
    
    // Set appropriate payment method based on type
    if (type === 'card') {
      this.setDefaultCardMethod();
    } else if (type === 'bank') {
      this.setDefaultBankMethod();
    } else if (type === 'others') {
      // No default method for others, user must select provider
    }
    
    this.setRecipientRequirements();
  }

  // NEW: Reset Mollie state
  private resetMollieState() {
    this.molliePaymentId = null;
    this.mollieCheckoutUrl = null;
    this.molliePaymentStatus = null;
    this.molliePaymentPolling = false;
    this.mollieRedirectPending = false;
  }

  loadCustomerMandates() {
    if (!this.mollieCustomerId) {
      console.warn('No Mollie customer ID available');
      this.isLoadingStoredMethods = false;
      return;
    }
    
    this.loadingMandates = true;
    this.loadingStoredMandates = true;
    this.mollieService.getCustomerMandates(this.mollieCustomerId).subscribe({
      next: (response) => {
        // Handle both array response and embedded response
        const res: any = response;
        const mandates =  Array.isArray(res) ? res : res._embedded?.mandates || [];
        
        this.customerMandates = mandates.filter((m: any) => m.status === 'valid');
        this.hasValidMandates = this.customerMandates.length > 0;
        this.loadingStoredMandates = false;
        if (this.hasValidMandates) {
          this.selectedMandate = this.customerMandates[0];
          this.selectedMandateId = this.selectedMandate.id;
          this.useStoredMethod = true;
          console.log('✅ Valid mandates found:', this.customerMandates.length);
        } else {
          this.useStoredMethod = false;
          console.log('ℹ️ No valid mandates found');
        }
        
        this.loadingMandates = false;
        this.isLoadingStoredMethods = false;
      },
      error: (error) => {
        console.error('Failed to load customer mandates:', error);
        this.loadingMandates = false;
        this.isLoadingStoredMethods = false;
        this.hasValidMandates = false;
        this.useStoredMethod = false;
      }
    });
  }

selectStoredMandate(mandate: MollieMandate) {
  this.selectedMandate = mandate;
  this.selectedMandateId = mandate.id;
  this.useStoredMethod = true;
}

setUseStoredMethod(useStored: boolean) {
  this.useStoredMethod = useStored && this.hasValidMandates;
  
  if (!this.useStoredMethod) {
    this.selectedMandate = null;
    this.selectedMandateId = null;
  }
}


getMandateDisplayName(mandate: MollieMandate): string {
  if (mandate.method === 'creditcard' && mandate.details?.cardNumber) {
    const brand = mandate.details.cardLabel || 'Card';
    const lastFour = mandate.details.cardNumber.slice(-4);
    return `${brand} ••••${lastFour}`;
  }
  
  return mandate.method.charAt(0).toUpperCase() + mandate.method.slice(1);
}



  // UPDATED: Payment Provider Methods
  setPaymentProvider(provider: 'mollie' | 'stripe') {
    this.selectedPaymentProvider = provider;
    this.selectedProviderMethod = null;
    this.resetMollieState();
    this.isLoading = true; // show loader at start
    if (provider === 'mollie') {
debugger;
      // Load Mollie-specific configuration
      this.loadMollieConfiguration();
      this.loadOrCreateMollieCustomer(); 
    }
    this.isLoading=false;
    this.calculateProcessingFee();
  }

  // NEW: Load Mollie configuration
  private loadMollieConfiguration() {
    this.mollieService.getEnabledMethods(this.paymentAmount, this.sourceCurrency).subscribe({
      next: (methods) => {
        // Update available methods based on Mollie's response
        this.updateMollieMethodsAvailability(methods);
      },
      error: (error) => {
        console.error('Failed to load Mollie methods:', error);
        this.showError('Failed to load payment methods');
      }
    });
  }

   private loadOrCreateMollieCustomer() {
    if (!this.currentUser?.email) return;
    this.isLoadingStoredMethods = true;
    
    // First, try to get existing customer
    this.mollieService.getOrCreateCustomer({
      name: this.currentUser.name || this.currentUser.email.split('@')[0],
      email: this.currentUser.email,
      phone: this.currentUser.phone
    }).subscribe({
      next: (customer:any) => {
        this.mollieCustomerId = customer.id;
        this.loadCustomerMandates();
      },
      error: (error:any) => {
        console.error('Failed to load/create customer:', error);
        this.isLoadingStoredMethods = false;
        this.hasValidMandates = false;
        this.useStoredMethod = false;
      }
    });
  }

  

  // NEW: Update Mollie methods availability
  private updateMollieMethodsAvailability(enabledMethods: string[]) {
    this.paymentProviderMethods['mollie'].forEach(method => {
      method.enabled = enabledMethods.includes(method.id);
    });
  }

  getAvailableProviderMethods(): PaymentProviderMethod[] {
    if (!this.selectedPaymentProvider) return [];
    const methods = this.paymentProviderMethods[this.selectedPaymentProvider] || [];
    
    // Filter methods based on amount and availability
    return methods.filter(method => {
      if (!method.enabled) return false;
      if (method.minAmount && this.paymentAmount < method.minAmount) return false;
      if (method.maxAmount && this.paymentAmount > method.maxAmount) return false;
      return true;
    });
  }

  selectProviderMethod(method: PaymentProviderMethod) {
    this.selectedProviderMethod = method.id;
    this.calculateProcessingFee();
  }

  getProviderDisplayName(): string {
    if (!this.selectedPaymentProvider) return '';
    
    const providerNames = {
      mollie: 'Mollie',
      stripe: 'Stripe'
    };
    
    return providerNames[this.selectedPaymentProvider];
  }

  getSelectedProviderMethod(): PaymentProviderMethod | null {
    if (!this.selectedPaymentProvider || !this.selectedProviderMethod) return null;
    
    const methods = this.paymentProviderMethods[this.selectedPaymentProvider];
    return methods.find(m => m.id === this.selectedProviderMethod) || null;
  }

  private setDefaultCardMethod() {
    const primaryCard = this.availableCards.find(card => card.is_primary);
    if (primaryCard) {
      this.selectedPaymentMethod = { ...primaryCard, type: 'card' } as PaymentMethod;
    } else if (this.availableCards.length > 0) {
      this.selectedPaymentMethod = { ...this.availableCards[0], type: 'card' } as PaymentMethod;
    }
  }

  private setDefaultBankMethod() {
    const primaryBank = this.availableBankAccounts.find(account => account.is_primary);
    if (primaryBank) {
      this.selectedBankAccount = primaryBank;
    } else if (this.availableBankAccounts.length > 0) {
      this.selectedBankAccount = this.availableBankAccounts[0];
    }
  }

  // Transfer Type Methods (for Bank Transfers)
  setTransferType(type: 'domestic' | 'international') {
    this.transferType = type;
    this.calculateProcessingFee();
    
    if (type === 'international') {
      this.isRecipientRequired = true;
      this.fetchExchangeRate();
    } else {
      this.exchangeRate = null;
      this.targetCurrency = this.sourceCurrency;
      this.convertedAmount = 0;
    }
  }

  setRecipientAccountType(type: 'hsbc' | 'external') {
    this.recipientAccountType = type;
    this.resetExternalBankDetails();
  }

  resetExternalBankDetails() {
    this.externalBankDetails = {
      name: '',
      accountNumber: '',
      routingNumber: '',
      swiftCode: '',
      iban: '',
      country: '',
    };
  }

  // Bank Account Selection Methods
  showBankAccounts() {
    this.showBankSelection = true;
    this.loadBankAccounts();
  }

  hideBankAccounts() {
    this.showBankSelection = false;
  }

  selectBankAccount(account: BankAccount) {
    this.selectedBankAccount = account;
    this.showBankSelection = false;
  }

  isBankAccountSelected(account: BankAccount): boolean {
    return this.selectedBankAccount?.id === account.id;
  }

  addBankAccount() {
    // Navigate to add bank account
    this.onGoBack.emit();
  }

  private loadBankAccounts() {
    // Load bank accounts from service
    // const bankSub = this.paymentService.getBankAccounts().subscribe({
    //   next: (accounts: BankAccount[]) => {
    //     this.availableBankAccounts = accounts;
    //   },
    //   error: (error: any) => {
    //     console.error('Failed to load bank accounts:', error);
    //     this.showError('Failed to load bank accounts');
    //   }
    // });
    
    // this.subscriptions.push(bankSub);
  }

  // UPDATED: Calculate processing fee with provider-specific rates
  calculateProcessingFee() {
    if (this.paymentAmount > 0) {
      if (this.paymentType === 'bank') {
        this.processingFee = this.paymentService.calculateTransferFee(
          this.paymentAmount, 
          this.transferType ?? "domestic",
          this.sourceCurrency
        );
        return;
      } else if (this.paymentType === 'others') {
        const selectedMethod = this.getSelectedProviderMethod();
        if (selectedMethod?.fee) {
          // Use method-specific fee rate
          const feeRate = selectedMethod.fee / 100;
          this.processingFee = Math.round(this.paymentAmount * feeRate * 100) / 100;
          
          // Add fixed fee for some methods
          if (selectedMethod.id === 'ideal' || selectedMethod.id === 'sepadirectdebit') {
            this.processingFee = Math.max(this.processingFee, 0.29); // Minimum fee
          }
        } else {
          // Default fee for third-party providers
          const feeRate = this.selectedPaymentProvider === 'mollie' ? 0.025 : 0.029;
          this.processingFee = Math.round(this.paymentAmount * feeRate * 100) / 100;
        }
        return;
      } else {
        // Default card fee
        const feeRate = 0.029;
        this.processingFee = Math.round(this.paymentAmount * feeRate * 100) / 100;
      }
    } else {
      this.processingFee = 0;
    }
  }

  private loadSupportedCurrencies() {
    const currencySub = this.paymentService.getSupportedCurrencies().subscribe({
      next: (currencies) => {
        this.supportedCurrencies = currencies;
      },
      error: (error) => {
        console.error('Failed to load supported currencies:', error);
      }
    });
    
    this.subscriptions.push(currencySub);
  }

  toggleRecipient() {
    this.isRecipientOpen = !this.isRecipientOpen;
    
    if (this.isRecipientOpen && this.savedRecipients.length === 0) {
      this.loadSavedRecipients();
    }
  }

  onSourceCurrencyChange() {
    if (this.transferType === 'international' && this.targetCurrency !== this.sourceCurrency) {
      this.fetchExchangeRate();
    }
    this.calculateProcessingFee();
    
    // NEW: Reload Mollie methods for new currency
    if (this.selectedPaymentProvider === 'mollie') {
      this.loadMollieConfiguration();
    }
  }

  onTargetCurrencyChange() {
    if (this.transferType === 'international') {
      this.fetchExchangeRate();
    }
  }

  fetchExchangeRate() {
    if (this.sourceCurrency === this.targetCurrency) {
      this.exchangeRate = null;
      this.convertedAmount = this.paymentAmount;
      return;
    }

    this.isLoading = true;
    this.loadingText = 'Fetching exchange rate...';
    
    const rateSub = this.paymentService.getExchangeRate(this.sourceCurrency, this.targetCurrency)
      .subscribe({
        next: (rate) => {
          this.exchangeRate = rate;
          this.updateConvertedAmount();
          this.isLoading = false;
          this.loadingText = '';
        },
        error: (error) => {
          console.error('Failed to fetch exchange rate:', error);
          this.isLoading = false;
          this.loadingText = '';
          this.showError('Failed to fetch current exchange rate. Please try again.');
        }
      });
    
    this.subscriptions.push(rateSub);
  }

  getExchangeRateDisplay(): string {
    if (!this.exchangeRate) return '';
    return `1 ${this.sourceCurrency} = ${this.exchangeRate.rate.toFixed(4)} ${this.targetCurrency}`;
  }

  getConvertedAmountDisplay(): string {
    if (this.convertedAmount > 0 && this.targetCurrency !== this.sourceCurrency) {
      return this.formatCurrency(this.convertedAmount, this.targetCurrency);
    }
    return '';
  }

  shouldShowExchangeRate(): boolean {
    return !!(this.transferType === 'international' && 
              this.exchangeRate && 
              this.sourceCurrency !== this.targetCurrency);
  }

  toggleAdvancedRecipient() {
    this.showAdvancedRecipient = !this.showAdvancedRecipient;
  }

  onRecipientNameInput(event: any) {
    this.recipientName = event.target.value;
    
    if (this.recipientName.length > 2 && this.savedRecipients.length > 0) {
      this.showRecipientSearch = true;
      this.recipientSearchTerm = this.recipientName;
    } else {
      this.showRecipientSearch = false;
    }
  }

  selectSavedRecipient(recipient: RecipientDetails) {
    this.recipientName = recipient.name;
    this.recipientEmail = recipient.email || '';
    this.recipientPhone = recipient.phone || '';
    this.paymentNote = recipient.memo || '';
    this.recipientCategory = recipient.category || 'personal';
    this.showRecipientSearch = false;
  }

  clearRecipientDetails() {
    this.recipientName = '';
    this.recipientEmail = '';
    this.recipientPhone = '';
    this.paymentNote = '';
    this.recipientCategory = 'personal';
    this.showRecipientSearch = false;
  }

  saveRecipientForFuture() {
    if (this.recipientName.trim()) {
      const newRecipient: RecipientDetails = {
        name: this.recipientName,
        email: this.recipientEmail,
        phone: this.recipientPhone,
        memo: this.paymentNote,
        category: this.recipientCategory
      };

      const existingIndex = this.savedRecipients.findIndex(
        r => r.name.toLowerCase() === this.recipientName.toLowerCase()
      );
      
      if (existingIndex >= 0) {
        this.savedRecipients[existingIndex] = newRecipient;
      } else {
        this.savedRecipients.push(newRecipient);
      }
      
      this.saveSavedRecipients();
      this.showSuccess('Recipient saved for future payments');
    }
  }

  private saveSavedRecipients() {
    console.log('Saving recipients:', this.savedRecipients);
  }

  getFilteredRecipients(): RecipientDetails[] {
    if (!this.recipientSearchTerm) return this.savedRecipients;
    
    return this.savedRecipients.filter(recipient =>
      recipient.name.toLowerCase().includes(this.recipientSearchTerm.toLowerCase()) ||
      recipient.email?.toLowerCase().includes(this.recipientSearchTerm.toLowerCase())
    );
  }

  validateRecipientDetails(): boolean {
    if (this.isRecipientRequired && !this.recipientName.trim()) {
      return false;
    }

    if (this.recipientEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.recipientEmail)) {
        return false;
      }
    }

    if (this.recipientPhone) {
      const phoneRegex = /^[\+]?[(]?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(this.recipientPhone)) {
        return false;
      }
    }

    return true;
  }

  private loadSavedRecipients() {
    this.savedRecipients = [
      {
        name: 'John Smith',
        email: 'john@example.com',
        phone: '+1-555-0123',
        memo: 'Monthly rent payment',
        category: 'bill'
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        memo: 'Birthday gift',
        category: 'personal'
      }
    ];
  }

  // Amount Handling
  onAmountInput(event: any) {
    const value = event.target.value;
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      return;
    }
    
    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }
    
    const formattedValue = parts.join('.');
    this.paymentAmountDisplay = formattedValue;
    this.paymentAmount = parseFloat(formattedValue) || 0;
    
    this.calculateProcessingFee();
    this.updateConvertedAmount();
    this.setRecipientRequirements();
    
    // NEW: Reload Mollie methods when amount changes
    if (this.selectedPaymentProvider === 'mollie' && this.paymentAmount > 0) {
      this.loadMollieConfiguration();
    }
  }

  goBack() {
    this.onGoBack.emit();
  }

  onAmountFocus() {
    this.isAmountFocused = true;
  }

  onAmountBlur() {
    this.isAmountFocused = false;
    if (this.paymentAmount > 0) {
      this.paymentAmountDisplay = this.paymentAmount.toFixed(2);
    }
  }

  setQuickAmount(amount: number) {
    this.paymentAmount = amount;
    this.paymentAmountDisplay = amount.toFixed(2);
    this.calculateProcessingFee();
    this.updateConvertedAmount();
    this.setRecipientRequirements();
    
    // NEW: Reload Mollie methods when amount changes
    if (this.selectedPaymentProvider === 'mollie' && this.paymentAmount > 0) {
      this.loadMollieConfiguration();
    }
  }

  updateConvertedAmount() {
    if (this.exchangeRate && this.paymentAmount > 0) {
      this.convertedAmount = this.paymentService.convertCurrency(this.paymentAmount, this.exchangeRate.rate);
    } else {
      this.convertedAmount = this.paymentAmount;
    }
  }

  // Card Payment Methods
  showPaymentMethods() {
    this.showMethodSelection = true;
  }

  hidePaymentMethods() {
    this.showMethodSelection = false;
  }

  selectPaymentMethod(method: PaymentCard, type: 'card') {
    this.selectedPaymentMethod = { ...method, type } as PaymentMethod;
    this.showMethodSelection = false;
  }

  isMethodSelected(method: PaymentCard): boolean {
    return this.selectedPaymentMethod?.id === method.id;
  }

  addPaymentMethod() {
    this.onGoBack.emit();
  }

  // UPDATED: Payment Validation with Mollie checks
isPaymentValid(): boolean {
  const basicValid = this.paymentAmount > 0;
  const recipientValid = this.validateRecipientDetails();
  if (this.paymentType === 'card') {
    return basicValid && this.selectedPaymentMethod !== null;
  } else if (this.paymentType === 'bank') {
    const transferValid = this.validateTransferDetails();
    const bankValid = this.selectedBankAccount !== null;
    return basicValid && recipientValid && transferValid && bankValid;
  } else if (this.paymentType === 'others') {
    const providerValid = this.selectedPaymentProvider !== null && this.selectedProviderMethod !== null;
    
    if (this.selectedPaymentProvider === 'mollie') {
      const mollieValid = this.validateMolliePayment();
      // const storedMethodValid = this.validateStoredMethodPayment();
      return basicValid && providerValid && mollieValid ;
    }
    
    return basicValid && providerValid;
  }
  
  return false;
}

// Enhanced validation for stored methods
private validateStoredMethodPayment(): boolean {
  debugger;
  if (!this.useStoredMethod) return true;
  if (!this.mollieCustomerId) {
    this.showError('Customer information is missing');
    return false;
  }
  
  if (!this.selectedMandate || !this.selectedMandateId) {
    this.showError('Please select a saved payment method');
    return false;
  }
  
  if (this.selectedMandate.status !== 'valid') {
    this.showError('Selected payment method is no longer valid');
    return false;
  }
  
  return true;
}

revokeMandate(mandate: MollieMandate): void {
  if (!this.mollieCustomerId) return;
  
  const revokeSub = this.mollieService.revokeMandate(this.mollieCustomerId, mandate.id).subscribe({
    next: () => {
      this.showSuccess('Payment method removed successfully');
      // Remove from local array
      this.customerMandates = this.customerMandates.filter(m => m.id !== mandate.id);
      
      // Update state if this was the selected mandate
      if (this.selectedMandateId === mandate.id) {
        this.selectedMandate = null;
        this.selectedMandateId = null;
        
        // Select another mandate if available
        if (this.customerMandates.length > 0) {
          this.selectStoredMandate(this.customerMandates[0]);
        } else {
          this.hasValidMandates = false;
          this.useStoredMethod = false;
        }
      }
    },
    error: (error) => {
      console.error('Failed to revoke mandate:', error);
      this.showError('Failed to remove payment method. Please try again.');
    }
  });
  
  this.subscriptions.push(revokeSub);
}



formatMandateDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString();
  } catch {
    return 'recently';
  }
}

getMandateDetails(mandate: MollieMandate): string {
  if (!mandate.details) return `${mandate.method} payment method`;
  
  const method = mandate.method.toLowerCase();
  if (method === 'creditcard' && mandate.details.cardNumber) {
    const brand = mandate.details.cardLabel || 'Card';
    const lastFour = mandate.details.cardNumber.slice(-4);
    return `${brand} ending in ${lastFour}`;
  }
  
  if (method === 'sepadirectdebit' && mandate.details.consumerAccount) {
    return `SEPA account ${mandate.details.consumerAccount}`;
  }
  
  if (method === 'paypal' && mandate.details.consumerAccount) {
    return `PayPal account ${mandate.details.consumerAccount}`;
  }
  
  return `${mandate.method} payment method`;
}


trackByMandateId(index: number, mandate: MollieMandate): string {
  return mandate.id;
}

getMandateIcon(mandate: MollieMandate): string {
  const iconMap: { [key: string]: string } = {
    'creditcard': '💳',
    'sepadirectdebit': '🏦',
    'ideal': '🇳🇱',
    'paypal': '🅿️',
    'bancontact': '🇧🇪',
    'sofort': '🏦',
    'applepay': '🍎',
    'googlepay': '🌐',
    'directdebit': '🏦'
  };
  return iconMap[mandate.method] || '💳';
}


revokeMandateConfirm(mandate: MollieMandate, event: Event): void {
  event.stopPropagation(); // Prevent card selection
  
  if (confirm(`Are you sure you want to remove this payment method?\n\n${this.getMandateDisplayName(mandate)}\n\nThis action cannot be undone.`)) {
    this.revokeMandate(mandate);
  }
}

  // NEW: Validate Mollie payment requirements
  private validateMolliePayment(): boolean {
    const selectedMethod = this.getSelectedProviderMethod();
    if (!selectedMethod || !selectedMethod.enabled) return false;
    
    // Check amount limits
    if (selectedMethod.minAmount && this.paymentAmount < selectedMethod.minAmount) return false;
    if (selectedMethod.maxAmount && this.paymentAmount > selectedMethod.maxAmount) return false;
    
    // Method-specific validations
    if (selectedMethod.id === 'sepadirectdebit' && !this.recipientEmail) {
      return false; // SEPA requires email
    }
    
    return true;
  }

  validateTransferDetails(): boolean {
    if (!this.transferType) return false;
    
    if (this.recipientAccountType === 'hsbc') {
      return !!this.selectedRecipientAccount;
    } else if (this.recipientAccountType === 'external') {
      const valid = !!this.externalBankDetails.name && 
                  !!this.externalBankDetails.accountNumber;
      
      if (this.transferType === 'international') {
        return valid && !!this.externalBankDetails.swiftCode && 
              !!this.externalBankDetails.country;
      }
      
      return valid && !!this.externalBankDetails.routingNumber;
    }
    
    return false;
  }

  getTotalAmount(): number {
    return this.paymentAmount + this.processingFee;
  }

  setRecipientRequirements() {
    if (this.paymentAmount > 1000) {
      this.isRecipientRequired = true;
    }
    
    if (this.paymentType === 'bank') {
      this.isRecipientRequired = true;
    }
    
    // NEW: Mollie-specific recipient requirements
    if (this.paymentType === 'others' && this.selectedPaymentProvider === 'mollie') {
      const selectedMethod = this.getSelectedProviderMethod();
      if (selectedMethod?.id === 'sepadirectdebit' || selectedMethod?.id === 'paypal') {
        this.isRecipientRequired = true;
      }
    }
  }

  getRecipientSummary(): string {
    const parts = [];
    if (this.recipientName) parts.push(this.recipientName);
    if (this.recipientEmail) parts.push(this.recipientEmail);
    if (this.recipientCategory) parts.push(`(${this.recipientCategory})`);
    
    return parts.join(' • ') || 'Click to add recipient details';
  }

  isRecipientComplete(): boolean {
    return !!(this.recipientName && 
            (this.recipientEmail || this.recipientPhone));
  }

  getRecipientDisplayName(): string {
    if (!this.recipientName) return 'No recipient specified';
    return this.recipientName;
  }

  // NEW: Payment Type Icon and Button Text Methods
  getPaymentTypeIcon(): string {
    switch (this.paymentType) {
      case 'card': return '💳';
      case 'bank': return '🏦';
      case 'others': return '🌐';
      default: return '💳';
    }
  }

  getPayButtonText(): string {
    if (this.mollieRedirectPending) return 'Redirecting...';
    
    switch (this.paymentType) {
      case 'card': return 'Pay with Card';
      case 'bank': return 'Transfer';
      case 'others': 
        if (this.selectedPaymentProvider === 'mollie') {
          const method = this.getSelectedProviderMethod();
          return `Pay with ${method?.name || 'Mollie'}`;
        }
        return this.selectedPaymentProvider ? `Pay via ${this.getProviderDisplayName()}` : 'Pay';
      default: return 'Pay';
    }
  }

  // UPDATED: Payment Processing
  initiatePayment() {
    if (!this.isPaymentValid()) {
      this.showError('Please complete all required fields');
      return;
    }
    this.clearMessages();

    if (this.paymentType === 'others') {
      if (this.selectedPaymentProvider === 'mollie') {
        this.processMolliePayment();
      } else {
        this.processThirdPartyPayment();
      }
    } else {
      this.showCameraVerification = true;
    }
  }

  processMolliePayment() {
    this.isLoading = true;
    if (this.useStoredMethod && this.selectedMandate && this.mollieCustomerId) {
      this.loadingText = 'Processing payment with stored method...';
      this.processStoredMethodPayment(true);
    } else {
      this.loadingText = 'Creating new payment method...';
      this.processStoredMethodPayment(false);
    }
  }

  processStoredMethodPayment(useStoredMethod: boolean) {
      this.isLoading = true;
      const selectedMethod = this.getSelectedProviderMethod();
      if (!selectedMethod) {
        this.showError('Please select a payment method');
        this.isLoading = false;
        return;
      }

      // Ensure current user has required fields
      if (this.currentUser && this.currentUser.email) {
        this.currentUser.name = this.currentUser.name || this.currentUser.email.split('@')[0];
      }

      if (!this.currentUser?.name || !this.currentUser?.email) {
        this.showError('Customer information missing. Please ensure you are logged in.');
        this.isLoading = false;
        return;
      }

      const customerData = {
        name: this.currentUser.name,
        email: this.currentUser.email,
        phone: this.currentUser.phone || undefined
      };

      const paymentData = {
        amount: this.getTotalAmount(),
        description: this.getPaymentDescription(),
        useStoredMethod: useStoredMethod,
        currency: this.sourceCurrency,
        method: !useStoredMethod && selectedMethod.id !== 'creditcard' ? selectedMethod.id : undefined,
        redirectUrl: `${window.location.origin}/`,
        customerId: useStoredMethod ? this.mollieCustomerId  ?? undefined : undefined,
        mandateId: useStoredMethod ? this.selectedMandateId ?? undefined : undefined,
        sequenceType: useStoredMethod ? 'recurring' : 'first',
        metadata: {
          userId: this.currentUser?.id,
          paymentMethod: selectedMethod.id,
          originalAmount: this.paymentAmount,
          fee: this.processingFee,
          componentSource: 'pay_now_component',
          recipientName: this.recipientName,
          recipientEmail: this.recipientEmail,
          recipientPhone: this.recipientPhone,
          recipientCategory: this.recipientCategory,
          paymentNote: this.paymentNote,
          transferType: this.transferType,
          sourceCurrency: this.sourceCurrency,
          targetCurrency: this.targetCurrency,
          useStoredMethod: useStoredMethod
        }
      };

      // Use different service method based on whether customer exists
      const paymentObservable = useStoredMethod && this.mollieCustomerId ? 
        this.mollieService.createRecurringPayment(paymentData) :
        this.mollieService.createCustomerAndPayment(customerData, paymentData);

      paymentObservable.subscribe({
        next: (payment: any) => {
          console.log('✅ Payment created:', payment);
          this.molliePaymentId = payment.id;

          // this.storePaymentIdForReturn(payment.id, payment.customerId);
          
          if (payment._links?.checkout?.href) {
            // First-time payment - redirect needed
            this.mollieCheckoutUrl = payment._links.checkout.href;
            this.loadingText = 'Redirecting to secure payment page...';
            setTimeout(() => this.redirectToMollieCheckout(), 1500);
            
          } else {
            // Stored method used - payment completed
            this.molliePaymentStatus = payment.status;
            if (payment.status === 'paid') {
              this.handleMolliePaymentSuccess(payment);
            } else {
              // Start polling for payment status
              this.checkMolliePaymentStatus();
            }
          }
        },
        error: (error: any) => {
          console.error('❌ Payment creation failed:', error);
          this.isLoading = false;
          this.loadingText = '';
          this.handleMollieError(error);
        }
      });
    }


private storePaymentIdForReturn(paymentId: string, customerId?: string) {
  console.log('💾 Storing payment ID for return:', paymentId);
  
  // Store in multiple places for reliability
  localStorage.setItem('mollie_pending_payment_id', paymentId);
  sessionStorage.setItem('mollie_payment_id', paymentId);
  
  if (customerId) {
    localStorage.setItem('mollie_customer_id', customerId);
  }
  
  // Store with timestamp for cleanup
  const paymentData = {
    paymentId,
    customerId,
    timestamp: Date.now(),
    amount: this.getTotalAmount(),
    description: this.getPaymentDescription()
  };
  
  localStorage.setItem('mollie_payment_data', JSON.stringify(paymentData));
}


private getPaymentDescription(): string {
  const methodName = this.useStoredMethod && this.selectedMandate ? 
    `stored ${this.selectedMandate.method}` : 
    this.getSelectedProviderMethod()?.name || 'payment method';
    
  const recipientPart = this.recipientName ? ` to ${this.recipientName}` : '';
  const notePart = this.paymentNote ? ` - ${this.paymentNote}` : '';
  const methodType = this.useStoredMethod ? ' (recurring)' : ' (new)';
  
  return `Payment via ${methodName}${methodType}${recipientPart}${notePart}`.substring(0, 255);
}
  // Add method to check if stored methods should be shown
  shouldShowStoredMethods(): boolean {
    return this.paymentType === 'others' && 
           this.selectedPaymentProvider === 'mollie' && 
           this.hasValidMandates &&
           !this.isLoadingStoredMethods;
  }

  // Add method to get stored method display
  getStoredMethodsDisplay(): string {
    if (this.isLoadingStoredMethods) return 'Loading saved methods...';
    if (!this.hasValidMandates) return 'No saved payment methods';
    return `${this.customerMandates.length} saved method(s) available`;
  }

private handleMollieError(error: any) {
  let errorMessage = 'Failed to process payment. Please try again.';
  
  if (error.category === 'validation_error') {
    errorMessage = 'Please check your payment details and try again.';
  } else if (error.category === 'network_error') {
    errorMessage = 'Network error. Please check your connection and try again.';
  } else if (error.category === 'auth_error') {
    errorMessage = 'Payment service authentication failed. Please contact support.';
  } else if (error.message?.includes('customer')) {
    errorMessage = 'Customer information is invalid. Please check your profile details.';
  } else if (error.message?.includes('amount')) {
    errorMessage = 'Invalid payment amount. Please check and try again.';
  }
  
  this.showError(errorMessage);
}




  // NEW: Redirect to Mollie checkout
  private redirectToMollieCheckout() {
    if (!this.mollieCheckoutUrl) return;
    
    this.mollieRedirectPending = true;
    this.loadingText = 'Redirecting to payment page...';
    
    // Save payment state before redirect
    this.saveMolliePaymentState();
    
    // Redirect to Mollie checkout
    window.location.href = this.mollieCheckoutUrl;
  }

  // NEW: Save Mollie payment state
  private saveMolliePaymentState() {
    const paymentState = {
      molliePaymentId: this.molliePaymentId,
      paymentAmount: this.paymentAmount,
      processingFee: this.processingFee,
      recipientName: this.recipientName,
      recipientEmail: this.recipientEmail,
      paymentNote: this.paymentNote,
      selectedMethod: this.selectedProviderMethod,
      timestamp: Date.now()
    };
    
    // Note: In a real implementation, you would save this to a backend service
    console.log('Saving Mollie payment state:', paymentState);
  }

  // NEW: Handle return from Mollie
  handleMollieReturn(paymentId: string) {
    if (!paymentId) return;
    
    this.molliePaymentId = paymentId;
    this.checkMolliePaymentStatus();
  }

  // NEW: Check Mollie payment status
  private checkMolliePaymentStatus() {
    if (!this.molliePaymentId) return;
    
    this.isLoading = true;
    this.loadingText = 'Verifying payment status...';
    this.molliePaymentPolling = true;
    
    const statusSub = this.mollieService.getPaymentStatus(this.molliePaymentId).subscribe({
      next: (status: MolliePaymentStatus) => {
        this.molliePaymentStatus = status.status;
        
        switch (status.status) {
          case 'paid':
            this.handleMolliePaymentSuccess(status);
            break;
          case 'failed':
          case 'canceled':
          case 'expired':
            this.handleMolliePaymentFailure(status);
            break;
          case 'open':
            // Continue polling
            setTimeout(() => this.checkMolliePaymentStatus(), 2000);
            break;
          default:
            this.showError('Unknown payment status: ' + status.status);
            this.isLoading = false;
            this.molliePaymentPolling = false;
        }
      },
      error: (error) => {
        console.error('Failed to check Mollie payment status:', error);
        this.isLoading = false;
        this.molliePaymentPolling = false;
        this.showError('Failed to verify payment status');
      }
    });

    this.subscriptions.push(statusSub);
  }

  isMandateExpiringSoon(mandate: MollieMandate): boolean {
  if (!mandate.details?.cardExpiryDate) return false;
  
  try {
    const expiryDate = new Date(mandate.details.cardExpiryDate);
    const now = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);
    
    return expiryDate <= threeMonthsFromNow;
  } catch {
    return false;
  }
}

  // NEW: Handle Mollie payment success
 private handleMolliePaymentSuccess(status: any) {
  this.isLoading = false;
  this.loadingText = '';
  this.molliePaymentPolling = false;
  
  this.transactionId = status.id;
  this.showSuccessAnimation = true;
  
  if (this.useStoredMethod) {
    this.showSuccess('Payment completed successfully using your saved method!');
  } else {
    this.showSuccess('Payment completed successfully! Your payment method has been saved for future use.');
    // Refresh mandates to include the newly created one
    if (this.mollieCustomerId) {
      this.loadCustomerMandates();
    }
  }
  
  // Save recipient if requested
  if (this.shouldSaveRecipient && this.recipientName) {
    this.saveRecipientForFuture();
  }
}

  // NEW: Handle Mollie payment failure
  private handleMolliePaymentFailure(status: MolliePaymentStatus) {
    this.isLoading = false;
    this.loadingText = '';
    this.molliePaymentPolling = false;
    this.mollieRedirectPending = false;
    
    let errorMessage = 'Payment was not completed.';
    
    switch (status.status) {
      case 'failed':
        errorMessage = 'Payment failed. Please try again or use a different payment method.';
        break;
      case 'canceled':
        errorMessage = 'Payment was canceled. You can try again if needed.';
        break;
      case 'expired':
        errorMessage = 'Payment session expired. Please start a new payment.';
        break;
    }
    
    this.showError(errorMessage);
    this.resetMollieState();
  }

  // NEW: Get Mollie method display info
  getMollieMethodInfo(methodId: string): { icon: string; description: string } {
    const methodInfoMap: { [key: string]: { icon: string; description: string } } = {
      'ideal': { icon: '🇳🇱', description: 'Dutch bank transfer' },
      'sepadirectdebit': { icon: '🏦', description: 'European bank transfer' },
      'bancontact': { icon: '🇧🇪', description: 'Belgian payment method' },
      'sofort': { icon: '🏦', description: 'European instant bank transfer' },
      'eps': { icon: '🇦🇹', description: 'Austrian bank transfer' },
      'giropay': { icon: '🇩🇪', description: 'German bank transfer' },
      'paypal': { icon: '🅿️', description: 'PayPal wallet' },
      'applepay': { icon: '🍎', description: 'Apple Pay wallet' },
      'googlepay': { icon: '🌐', description: 'Google Pay wallet' },
      'creditcard': { icon: '💳', description: 'Credit/Debit card' }
    };
    
    return methodInfoMap[methodId] || { icon: '💳', description: 'Payment method' };
  }

  // UPDATED: Third-party payment processing for non-Mollie providers
  processThirdPartyPayment() {
    this.isLoading = true;
    this.loadingText = `Processing payment with ${this.getProviderDisplayName()}...`;
    
    const selectedMethod = this.getSelectedProviderMethod();
    const paymentRequest = {
      amount: this.paymentAmount,
      currency: 'USD',
      provider: this.selectedPaymentProvider,
      method: selectedMethod?.id,
      methodType: selectedMethod?.type,
      description: this.paymentNote || 'Payment',
      fee: this.processingFee,
      recipient: this.recipientName ? {
        name: this.recipientName,
        email: this.recipientEmail,
        phone: this.recipientPhone,
        category: this.recipientCategory
      } : null
    };

    // Simulate third-party payment processing
    setTimeout(() => {
      this.isLoading = false;
      this.transactionId = this.generateTransactionId();
      this.showSuccessAnimation = true;
      this.showSuccess(`Payment processed successfully via ${this.getProviderDisplayName()}!`);
    }, 2000);
  }

  processTransfer() {
    this.isLoading = true;
    this.loadingText = 'Processing transfer...';
    
    const transferRequest = {
      amount: this.paymentAmount,
      currency: this.sourceCurrency,
      targetCurrency: this.targetCurrency,
      transferType: this.transferType,
      recipientType: this.recipientAccountType,
      recipientDetails: this.recipientAccountType === 'hsbc' ? 
        { accountId: this.selectedRecipientAccount } :
        this.externalBankDetails,
      notes: this.paymentNote,
      fee: this.processingFee,
      bankAccountId: this.selectedBankAccount?.id
    };

    this.paymentService.createInternationalPaymentConsent(transferRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.transactionId = this.generateTransactionId();
        this.showSuccessAnimation = true;
        this.showSuccess('Transfer processed successfully!');
      },
      error: (error) => {
        this.isLoading = false;
        this.showError('Failed to process transfer');
      }
    });
  }

  // Camera Verification
  handleVerificationSuccess(authResult: any) {
    const capturedImages = authResult.capturedImages || [];
    this.showCameraVerification = false;
    
    const verificationData = {
      verification_token: authResult.token,
      email: authResult.email,
      user_id: this.currentUser?.id,
      timestamp: new Date().toISOString(),
      auth_message: authResult.message,
      capturedImages: capturedImages,
      imageCount: capturedImages.length
    };
    
    this.showSuccess('Identity verified successfully!');
    
    setTimeout(() => {
      if (this.paymentType === 'bank') {
        this.processTransfer();
      } else if(this.paymentType === 'card') {
        this.processPaymentWithVerification(verificationData);
      } else {
        //mollie
        this.initiatePayment();
      }
    }, 1000);
  }

  startVerification() {
  // trigger <app-auth> verification UI
  debugger;
  this.isVerified = false;
  this.showCameraVerification=true;
  // you might toggle a flag like showAuth = true to display <app-auth>
}

  private processPaymentWithVerification(verificationData: any) {
    this.isLoading = true;
    this.loadingText = 'Processing payment...';
    this.clearMessages();
    
    if (!this.selectedPaymentMethod) {
      return;
    }

    const paymentRequest = {
      card_id: this.selectedPaymentMethod.id,
      amount: this.getTotalAmount(),
      currency: 'USD',
      description: this.paymentNote || 'Payment',
      verification_token: verificationData.verification_token,
      verified_email: verificationData.email,
      recipient: {
        name: this.recipientName,
        email: this.recipientEmail,
        phone: this.recipientPhone,
        category: this.recipientCategory
      }
    };

    const paymentObservable = this.paymentService.authorizeCardPaymentWithFace(
      verificationData.capturedImages, 
      paymentRequest
    );

    const subscription = paymentObservable.subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.loadingText = '';
        
        if (response.success === true) {
          this.transactionId = response.transaction_id || this.generateTransactionId();
          this.showSuccessAnimation = true;
          this.showSuccess('Payment processed successfully!');
        } else {
          this.showError('Payment authorization failed. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Payment error:', error);
        this.isLoading = false;
        this.loadingText = '';
        
        const errorMessage = error.error?.message || 
                            error.message || 
                            'Payment processing failed. Please try again.';
        this.showError(errorMessage);
      }
    });

    this.subscriptions.push(subscription);
  }

  handleVerificationError(error: string) {
    this.showError('Verification failed: ' + error);
  }

  cancelVerification() {
    this.showCameraVerification = false;
    this.clearMessages();
  }

  generateTransactionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'TXN';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  closeSuccessAnimation() {
    this.showSuccessAnimation = false;
    this.onPaymentComplete.emit({
      amount: this.paymentAmount,
      convertedAmount: this.convertedAmount,
      sourceCurrency: this.sourceCurrency,
      targetCurrency: this.targetCurrency,
      exchangeRate: this.exchangeRate,
      total: this.getTotalAmount(),
      paymentMethod: this.selectedPaymentMethod,
      bankAccount: this.selectedBankAccount,
      transactionId: this.transactionId,
      recipient: {
        name: this.recipientName,
        email: this.recipientEmail,
        phone: this.recipientPhone,
        category: this.recipientCategory
      },
      transferType: this.transferType,
      paymentType: this.paymentType,
      paymentProvider: this.selectedPaymentProvider,
      providerMethod: this.getSelectedProviderMethod(),
      note: this.paymentNote,
      // NEW: Mollie-specific data
      molliePaymentId: this.molliePaymentId,
      molliePaymentStatus: this.molliePaymentStatus
    });
  }

  // Success Animation Helpers
  getPaymentMethodIcon(): string {
    if (this.paymentType === 'card') return '💳';
    if (this.paymentType === 'bank') return '🏦';
    if (this.paymentType === 'others') return '🌐';
    return '💳';
  }

  getPaymentMethodText(): string {
    if (this.paymentType === 'card' && this.selectedPaymentMethod) {
      return `${this.selectedPaymentMethod.brand} ••${this.selectedPaymentMethod.last_four}`;
    } else if (this.paymentType === 'bank' && this.selectedBankAccount) {
      return `${this.selectedBankAccount.bank_name} ${this.selectedBankAccount.masked_account}`;
    } else if (this.paymentType === 'others' && this.selectedPaymentProvider) {
      const method = this.getSelectedProviderMethod();
      return `${this.getProviderDisplayName()} ${method ? method.name : ''}`;
    }
    return '';
  }

  // Card Styling
  getCardClass(brand: string): string {
    const brandLower = brand?.toLowerCase() || 'default';
    const validBrands = ['visa', 'mastercard', 'amex', 'discover'];
    return validBrands.includes(brandLower) ? brandLower : 'default';
  }

  // Utility Methods
  formatCurrency(amount: number, currency: string = 'USD'): string {
    if (isNaN(amount)) return this.paymentService.formatCurrency(0, currency);
    return this.paymentService.formatCurrency(amount, currency);
  }

  getInitials(value: string): string {
    if (!value) return '';
    const parts = value.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return value.substring(0, 2).toUpperCase();
  }

  // Message Handling
  showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.clearMessages(), 5000);
  }

  showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.clearMessages(), 5000);
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private loadPaymentMethods() {
    const cardsSub = this.paymentService.getSavedCards().subscribe({
      next: (cards: SavedCard[]) => {
        this.availableCards = cards.map(card => ({
          id: card.id,
          holder_name: card.holder_name,
          last_four: card.last_four,
          brand: card.brand,
          expiry_month: card.expiry_month.toString(),
          expiry_year: card.expiry_year.toString(),
          is_primary: card.is_primary ?? false,
          type: 'card'
        }));
        
        this.loadBankAccounts();
      },
      error: (error) => {
        console.error('Failed to load saved cards:', error);
        this.showError('Failed to load payment cards');
        this.loadBankAccounts();
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // NEW: Stop Mollie polling on destroy
    if (this.molliePaymentPolling) {
      this.molliePaymentPolling = false;
    }
  }
}