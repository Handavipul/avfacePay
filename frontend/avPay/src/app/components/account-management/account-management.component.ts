// account-management.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BankAccount, CardDetails, PaymentService, SavedCard, SavedCardResponse } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

export interface AddBankAccountRequest  {
  account_name: string;
  account_number: string;
  routing_number: string;
  bank_name: string;
  account_type: 'checking' | 'savings';
  is_primary?: boolean;
  masked_account?: string;
}

export interface BankAccountResponse {
  id: string;
  account_name: string;
  masked_account: string;
  routing_number: string;
  bank_name: string;
  account_type: string;
  is_primary: boolean;
  is_verified: boolean;
  verification_status: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface BankAccountValidation {
  routing_number: string;
  account_number: string;
}

export interface ValidationResponse {
  valid: boolean;
  bank_name?: string;
  errors?: string[];
}


@Component({
  selector: 'app-account-management',
  standalone: false,
  templateUrl: './account-management.component.html',
  styleUrls: ['./account-management.component.css']
})
export class AccountManagementComponent implements OnInit, OnDestroy {
  // State management
  currentView: 'overview' | 'cards' | 'bank-accounts' | 'add-card' | 'add-bank' = 'overview';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedBankAccount: any = null;
  selectedCard: any = null;

  isCardsExpanded: boolean = false;
  // Data
  savedCards: SavedCard[] = [];
  bankAccounts: BankAccount[] = [];
  currentUser: any = null;
  
   // Sample activity data
  recentActivities: any[] = [
    {
      id: 1,
      description: 'Payment to Amazon',
      amount: -79.99,
      date: new Date(),
      type: 'payment',
      icon: '💳'
    },
    {
      id: 2,
      description: 'Direct Deposit',
      amount: 3200.00,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      type: 'deposit',
      icon: '💰'
    },
    {
      id: 3,
      description: 'Grocery Store',
      amount: -156.34,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      type: 'payment',
      icon: '💳'
    }
  ];

  // Sample account balances
  accountBalances: { [key: string]: number } = {
    'bank-1': 12456.78,
    'bank-2': 8234.56,
    'bank-3': 3789.12
  };
  // Form data for adding new accounts
  newCard = {
    number: '',
    holder_name: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    is_primary: false
  };
  
  newBankAccount = {
    account_name: '',
    account_number: '',
    routing_number: '',
    bank_name: '',
    account_type: 'checking' as 'checking' | 'savings',
    is_primary: false
  };
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private paymentService: PaymentService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit() {
    debugger;
    this.loadUserData();
    this.loadSavedCards();
    this.loadBankAccounts();
    
    // Subscribe to current user
    const userSub = this.authService.currentUser$.subscribe(
      (user) => {
        this.currentUser = user;
      }
    );
    this.subscriptions.push(userSub);
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getDisplayedCards(): SavedCard[] {
    console.log(this.savedCards);
    return this.isCardsExpanded ? this.savedCards : this.savedCards.slice(0, 3);
  }

  onCardPreviewClick(event: Event): void {
    const target = event.target as HTMLElement;
    
    // Check if clicked on the arrow or close button
    if (this.isClickOnControlButton(event)) {
      event.stopPropagation();
      this.toggleCardPreview();
    }
  }

  private toggleCardPreview(): void {
    this.isCardsExpanded = !this.isCardsExpanded;
    
    if (this.isCardsExpanded) {
      // Add a slight delay and scroll to show more cards
      setTimeout(() => {
        const container = document.querySelector('.realistic-cards-preview') as HTMLElement;
        if (container) {
          // Scroll to show the 4th card
          container.scrollTo({
            left: 150, // Scroll enough to show there are more cards
            behavior: 'smooth'
          });
        }
      }, 100);
    } else {
      // When collapsing, scroll back to the beginning
      setTimeout(() => {
        const container = document.querySelector('.realistic-cards-preview') as HTMLElement;
        if (container) {
          container.scrollTo({
            left: 0,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }

  private isClickOnControlButton(event: Event): boolean {
    const containerElement = event.currentTarget as HTMLElement;
    if (!containerElement) return false;
    
    const rect = containerElement.getBoundingClientRect();
    const clickX = (event as MouseEvent).clientX - rect.left;
    const clickY = (event as MouseEvent).clientY - rect.top;
    
    if (this.isCardsExpanded) {
      // Check if clicked on close button (top-right)
      const buttonSize = 28;
      const buttonX = rect.width - 44; // 16px from right + 28px button
      const buttonY = 16;
      
      return clickX >= buttonX && clickX <= buttonX + buttonSize &&
             clickY >= buttonY && clickY <= buttonY + buttonSize;
    } else {
      // Check if clicked on expand arrow (center-right)
      const arrowSize = 36;
      const arrowX = rect.width - 44; // 8px from right + 36px button
      const arrowY = (rect.height - arrowSize) / 2;
      
      return clickX >= arrowX && clickX <= arrowX + arrowSize &&
             clickY >= arrowY && clickY <= arrowY + arrowSize;
    }
  }

  

  onCardClick(event: Event, card: SavedCard): void {
    event.stopPropagation();
    
    // If collapsed, expand and show all cards, then navigate
    if (!this.isCardsExpanded && this.savedCards.length > 3) {
      // Don't navigate immediately, let user see all cards first
      return;
    }
    
    // If expanded or 3 or fewer cards, navigate to cards view
    this.showCards();
  }
  
  private loadUserData() {
    // Get current user info if needed
    this.currentUser = this.authService.getCurrentUser();
  }
  
  private loadSavedCards() {
    this.isLoading = true;
    const cardsSub = this.paymentService.getSavedCards().subscribe({
      next: (cards) => {
        this.savedCards = cards;
        this.isLoading = false;
      },
      error: (error) => {
        this.showError('Failed to load saved cards');
        this.isLoading = false;
      }
    });
    this.subscriptions.push(cardsSub);
  }
  
  private loadBankAccounts() {
    // Mock data for now - replace with actual service call
    this.bankAccounts = [
      {
        id: '1',
        account_name: 'Primary Checking',
        account_number: '****1234',
        routing_number: '021000021',
        bank_name: 'Chase Bank',
        account_type: 'checking',
        is_primary: true,
        masked_account: '****1234'
      },
      {
        id: '2',
        account_name: 'Savings Account',
        account_number: '****5678',
        routing_number: '021000021',
        bank_name: 'Chase Bank',
        account_type: 'savings',
        is_primary: false,
        masked_account: '****5678'
      }
    ];
  }
  
  // Navigation methods
  showOverview() {
    this.isCardsExpanded = false; 
    this.currentView = 'overview';
    this.clearMessages();
  }
  
  showCards() {
    this.isCardsExpanded = false;
    this.currentView = 'cards';
    this.clearMessages();
  }
  
  showBankAccounts() {
    this.currentView = 'bank-accounts';
    this.clearMessages();
  }
  
  showAddCard() {
    this.currentView = 'add-card';
    this.clearMessages();
    this.resetCardForm();
  }
  
  showAddBank() {
    this.currentView = 'add-bank';
    this.clearMessages();
    this.resetBankForm();
  }
  
  // Card management
  addCard() {
  if (!this.isValidCardForm()) {
    this.showError('Please fill all required fields correctly');
    return;
  }
  this.isLoading = true;
  
  // Prepare card data for API
  const cardData: CardDetails = {
    number: this.newCard.number.replace(/\s/g, ''), // Remove spaces
    holder_name: this.newCard.holder_name.trim(),
    expiry_month: parseInt(this.newCard.expiry_month),
    expiry_year: parseInt(this.newCard.expiry_year),
    cvv: this.newCard.cvv,
    is_primary: this.newCard.is_primary || false
  };

  console.log('Saving card with data:', { 
    ...cardData, 
    number: '****' + cardData.number.slice(-4), // Log masked number
    cvv: '***' // Don't log CVV
  });

  // Call the real API endpoint
  const saveCardSub = this.paymentService.saveCard(cardData).subscribe({
    next: (response: SavedCardResponse) => {
      console.log('Card saved successfully:', response);
      
      // Create the card object to add to local array
      const newCard: SavedCard = {
        id: response.id,
        last_four: response.last_four,
        brand: response.brand,
        expiry_month: response.expiry_month,
        expiry_year: response.expiry_year,
        holder_name: response.holder_name,
        created_at: response.created_at.toString(),
        updated_at: response.created_at.toString(),
        success: true,
        is_primary: cardData.is_primary ?? false
      };
      
      // If this card is set as primary, update existing cards
      if (cardData.is_primary) {
        this.savedCards.forEach(card => card.is_primary = false);
      }
      
      // Add the new card to the beginning of the array (most recent first)
      this.savedCards.unshift(newCard);
      
      // Show success message and navigate back to cards view
      this.showSuccess('Card added successfully');
      this.currentView = 'cards';
      this.resetCardForm();
      this.isLoading = false;
    },
    error: (error) => {
      console.error('Error saving card:', error);
      this.isLoading = false;
      
      // Handle different types of errors
      let errorMessage = 'Failed to save card. Please try again.';
      
      if (error.error?.detail) {
        // Handle specific API error messages
        const detail = error.error.detail;
        if (detail.includes('Invalid card number')) {
          errorMessage = 'Invalid card number. Please check and try again.';
        } else if (detail.includes('expired')) {
          errorMessage = 'Card has expired. Please use a valid card.';
        } else if (detail.includes('already saved')) {
          errorMessage = 'This card is already saved to your account.';
        } else {
          errorMessage = detail;
        }
      } else if (error.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
        // Optionally redirect to login
        this.authService.logout();
        this.router.navigate(['/login']);
        return;
      } else if (error.status === 0) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      this.showError(errorMessage);
    }
  });
  
  // Add subscription to cleanup array
  this.subscriptions.push(saveCardSub);
}


  validateCardBeforeSave() {
    if (!this.isValidCardForm()) {
      return;
    }
    
    const validationData = {
      number: this.newCard.number.replace(/\s/g, ''),
      expiry_month: parseInt(this.newCard.expiry_month),
      expiry_year: parseInt(this.newCard.expiry_year),
      cvv: this.newCard.cvv
    };
    
    const validateSub = this.paymentService.validateCard(validationData).subscribe({
      next: (response:any) => {
        if (response.valid) {
          console.log('Card validation successful:', response);
          // Optionally show the detected card brand
          if (response.card_brand) {
            console.log('Detected card brand:', response.card_brand);
          }
        } else {
          console.log('Card validation failed:', response.errors);
          this.showError(response.errors.join(', '));
        }
      },
      error: (error:any) => {
        console.error('Card validation error:', error);
      }
    });
    
    this.subscriptions.push(validateSub);
  }



  // Card Methods
  selectCard(card: any): void {
    this.selectedCard = this.selectedCard?.id === card.id ? null : card;
  }
  
  removeCard(cardId: string,isPrimary: boolean) {
     if (isPrimary) {
      alert("Please select another card as primary before deleting this one.");
      return;
      }
    if (confirm('Are you sure you want to remove this card?')) {
      this.savedCards = this.savedCards.filter(card => card.id !== cardId);
      this.paymentService.deleteCard(cardId).subscribe({
        next: (cards:any) => {
          this.showSuccess('Card removed successfully');
          this.isLoading = false;
        },
        error: (error:any) => {
        this.showError('Failed to load saved cards');
        this.isLoading = false;
      }
    });
    }
  }

    formatCardNumberDisplay(brand: string, lastFour: string): string {
    if (brand.toLowerCase() === 'amex') {
      return `•••• ••••••• •${lastFour}`;
    }
    return `•••• •••• •••• ${lastFour}`;
  }
  
  closeCardDetails(): void {
    this.selectedCard = null;
  }

  setPrimaryCard(cardId: string) {
 
    this.savedCards.forEach(card => {
      card.is_primary = card.id === cardId;
    });
    this.paymentService.setPrimaryCard(cardId).subscribe({
      next: (cards) => {
        this.showSuccess('Primary card updated');
        this.isLoading = false;
      },
      error: (error) => {
        this.showError('Failed to load saved cards');
        this.isLoading = false;
      }
    });
  }
  
  // Bank account management
  addBankAccount() {
    if (!this.isValidBankForm()) {
      this.showError('Please fill all required fields');
      return;
    }
    
    this.isLoading = true;
    
    // First validate the bank account
    const validationData = {
      routing_number: this.newBankAccount.routing_number,
      account_number: this.newBankAccount.account_number
    };
    
    const validateSub = this.paymentService.validateBankAccount(validationData).subscribe({
      next: (validationResponse) => {
        if (validationResponse.valid) {
          // If bank name was detected, use it
          if (validationResponse.bank_name && !this.newBankAccount.bank_name) {
            this.newBankAccount.bank_name = validationResponse.bank_name;
          }
          
          // Proceed with adding the account
          this.createBankAccount();
        } else {
          this.isLoading = false;
          const errors = validationResponse?.errors || ['Invalid bank account details'];
          this.showError(errors.join(', '));
        }
      },
      error: (error) => {
        console.warn('Validation failed, proceeding anyway:', error);
        // Proceed even if validation fails (maybe the service is down)
        this.createBankAccount();
      }
    });
    
    this.subscriptions.push(validateSub);
  }

    private createBankAccount() {
    const addBankSub = this.paymentService.addBankAccount(this.newBankAccount).subscribe({
      next: (newAccount:any) => {
        this.showSuccess('Bank account added successfully');
        this.currentView = 'bank-accounts';
        this.resetBankForm();
        this.isLoading = false;
      },
      error: (error:any) => {
        this.isLoading = false;
        this.handleBankAccountError(error);
      }
    });
    
    this.subscriptions.push(addBankSub);
  }


  private handleBankAccountError(error: any) {
    let errorMessage = 'Failed to add bank account. Please try again.';
    
    if (error.error?.detail) {
      const detail = error.error.detail;
      if (detail.includes('already added')) {
        errorMessage = 'This bank account is already added to your profile.';
      } else if (detail.includes('Invalid routing number')) {
        errorMessage = 'Invalid routing number. Please check and try again.';
      } else {
        errorMessage = detail;
      }
    } else if (error.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
      return;
    } else if (error.status === 0) {
      errorMessage = 'Network error. Please check your connection.';
    }
    
    this.showError(errorMessage);
  }

  getInitials(value: string): string {
    if (!value) return '';
    const parts = value.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase(); // e.g. "John Doe" -> "JD"
    }
    return value.substring(0, 2).toUpperCase(); // e.g. email or single name
  }
  
  
  removeBankAccount(accountId: string, isPrimary: boolean) {
      if (isPrimary && this.bankAccounts.length > 1) {
        this.showError("Please select another account as primary before deleting this one.");
        return;
      }
      
      if (confirm('Are you sure you want to remove this bank account?')) {
        const deleteSub = this.paymentService.deleteBankAccount(accountId).subscribe({
          next: () => {
            this.showSuccess('Bank account removed successfully');
          },
          error: (error:any) => {
            this.showError('Failed to remove bank account');
          }
        });
        
        this.subscriptions.push(deleteSub);
      }
    }
  
    setPrimaryBankAccount(accountId: string) {
    const setPrimarySub = this.paymentService.setPrimaryBankAccount(accountId).subscribe({
      next: () => {
        this.showSuccess('Primary bank account updated');
      },
      error: (error:any) => {
        this.showError('Failed to update primary account');
      }
    });
    
    this.subscriptions.push(setPrimarySub);
  }

  // Bank Account Methods
  selectBankAccount(account: any): void {
    this.selectedBankAccount = this.selectedBankAccount?.id === account.id ? null : account;
  }
  
  // Utility methods
  public isValidCardForm(): boolean {
    return !!(
      this.newCard.number &&
      this.newCard.holder_name &&
      this.newCard.expiry_month &&
      this.newCard.expiry_year &&
      this.newCard.cvv &&
      this.newCard.number.replace(/\s/g, '').length >= 13 &&
      /^\d{3,4}$/.test(this.newCard.cvv)
    );
  }

   detectCardBrand(number: string): string {
    const cleanNumber = number.replace(/\D/g, '');
    
    if (/^4/.test(cleanNumber)) return 'Visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'MasterCard';
    if (/^3[47]/.test(cleanNumber)) return 'Amex';
    if (/^6/.test(cleanNumber)) return 'Discover';
    
    return '';
  }
  
  public isValidBankForm(): boolean {
    return !!(
      this.newBankAccount.account_name &&
      this.newBankAccount.account_number &&
      this.newBankAccount.routing_number &&
      this.newBankAccount.bank_name &&
      this.newBankAccount.account_number.length >= 8 &&
      this.newBankAccount.routing_number.length === 9
    );
  }
  
  public getCardBrand(number: string): string {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (cleaned.startsWith('5') || cleaned.startsWith('2')) return 'Mastercard';
    if (cleaned.startsWith('3')) return 'American Express';
    return 'Unknown';
  }

  getPreviewName(): string {
    return this.newCard.holder_name?.toUpperCase() || 'YOUR NAME';
  }

  getPreviewExpiry(): string {
    const month = this.newCard.expiry_month || 'MM';
    const year = this.newCard.expiry_year || 'YY';
    return `${month}/${year}`;
  }

    getPreviewBrand(): string {
    return this.detectCardBrand(this.newCard.number) || 'CARD';
  }

  getPreviewNumber(): string {
    if (!this.newCard.number) return '•••• •••• •••• ••••';
    
    const formatted = this.newCard.number;
    const brand = this.detectCardBrand(this.newCard.number);
    
    if (brand?.toLowerCase() === 'amex') {
      return formatted.padEnd(17, '•').replace(/(.{4})(.{7})(.{6})/, '$1 $2 $3');
    }
    return formatted.padEnd(19, '•');
  }

    showAllActivity(): void {
    // Navigate to activity page or show modal
    console.log('Show all activity');
  }

  

  // Form Methods - Add Card
  getPreviewCardClass(): string {
    const brand = this.detectCardBrand(this.newCard.number);
    return brand ? this.getCardClass(brand) : '';
  }

   getCardClass(brand: string): string {
    // return brand.toLowerCase().replace(/\s+/g, '');
    const normalizedBrand = brand.toLowerCase().replace(/\s+/g, '');
    
    // Handle different variations of card brand names
    const brandMapping: { [key: string]: string } = {
      'visa': 'visa',
      'mastercard': 'mastercard',
      'master card': 'mastercard',
      'americanexpress': 'americanexpress',
      'american express': 'americanexpress',
      'amex': 'americanexpress',
      'discover': 'discover'
    };
    
    return brandMapping[normalizedBrand] || normalizedBrand;
  }

    // Method to check if we should show the expand arrow
  shouldShowExpandArrow(): boolean {
    return this.savedCards.length > 3 && !this.isCardsExpanded;
  }

  // Method to get card count text for accessibility
  getCardCountText(): string {
    if (this.savedCards.length <= 3) {
      return `${this.savedCards.length} cards`;
    }
    
    if (this.isCardsExpanded) {
      return `All ${this.savedCards.length} cards`;
    }
    
    return `${this.savedCards.length} cards (showing 3)`;
  }
  
  formatCardNumber(event: any) {
    let value = event.target.value.replace(/\s/g, '').replace(/[^0-9]/g, '');
    const chunks = value.match(/.{1,4}/g) || [];
    const formatted = chunks.join(' ');
    
    if (formatted.length <= 19) {
      this.newCard.number = formatted;
      event.target.value = formatted;
    }
  }
  
  formatExpiry(event: any, type: 'month' | 'year') {
    let value = event.target.value.replace(/[^0-9]/g, '');
    
    if (type === 'month') {
      if (value.length > 2) value = value.slice(0, 2);
      const month = parseInt(value);
      if (month > 12) value = '12';
      if (month < 1 && value.length === 2) value = '01';
      this.newCard.expiry_month = value;
    } else {
      if (value.length > 4) value = value.slice(0, 4);
      this.newCard.expiry_year = value;
    }
    
    event.target.value = value;
  }
  
  formatAccountNumber(event: any) {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value.length > 17) value = value.slice(0, 17);
    this.newBankAccount.account_number = value;
    event.target.value = value;
  }
  
  formatRoutingNumber(event: any) {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value.length > 9) value = value.slice(0, 9);
    this.newBankAccount.routing_number = value;
    event.target.value = value;
  }
  
  private resetCardForm() {
    this.newCard = {
      number: '',
      holder_name: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      is_primary: false
    };
  }
  
  private resetBankForm() {
    this.newBankAccount = {
      account_name: '',
      account_number: '',
      routing_number: '',
      bank_name: '',
      account_type: 'checking',
      is_primary: false
    };
  }
  
  private showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => {
      this.successMessage = '';
    }, 5000);
  }
  
  private showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }
  
  private clearMessages() {
    this.successMessage = '';
    this.errorMessage = '';
  }
  
  // Navigation
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
  
  makePayment() {
    this.router.navigate(['/payment']);
  }

   // Overview Methods
  getTotalBalance(): number {
    return Object.values(this.accountBalances).reduce((sum, balance) => sum + balance, 0);
  }

  closeBankDetails(): void {
    this.selectedBankAccount = null;
  }

  // TrackBy function for cards
  trackByCardId(index: number, card: SavedCard): string {
    return card.id;
  }

  // TrackBy function for bank accounts
  trackByAccountId(index: number, account: BankAccount): string {
    return account.id;
  }

  getMonthlyPayments(): number {
    const thisMonth = this.recentActivities
      .filter(activity => activity.amount < 0 && this.isCurrentMonth(activity.date))
      .reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
    return thisMonth;
  }

  getAccountBalance(accountId: string): number {
    return this.accountBalances[accountId] || 0;
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  public isCurrentMonth(date: Date): boolean {
  const now = new Date();
  const targetDate = new Date(date);
  
  return (
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth()
  );
  }
}