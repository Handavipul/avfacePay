import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
  type: 'debit' | 'credit';
  merchant?: string;
  paymentMethod: string;
}

interface SpendingData {
  month: string;
  amount: number;
  category?: string;
}

interface FavoritePayee {
  id: string;
  name: string;
  type: 'person' | 'business';
  lastAmount?: number;
  avatar?: string;
  frequency: number;
}

interface QuickAction {
  id: string;
  title: string;
  icon: string;
  action: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  isSpendingExpanded: boolean = true;
  isFavoritesExpanded: boolean = true;
  // User & Auth
  currentUser: any = null;
  isAuthenticated = false;
  
  // Dashboard Data
  recentTransactions: Transaction[] = [];
  spendingData: SpendingData[] = [];
  categorySpending: any[] = [];
  favoritePayees: FavoritePayee[] = [];
  quickActions: QuickAction[] = [];
  
  // UI State
  selectedPeriod: 'week' | 'month' | 'quarter' | 'year' = 'month';
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  
  // Summary Data
  totalBalance = 0;
  monthlySpending = 0;
  monthlyIncome = 0;
  savingsRate = 0;
  cardCount = 0;
  accountCount = 0;

  constructor(
    private authService: AuthService,
    private paymentService: PaymentService,
    private router: Router
  ) {
    this.initializeQuickActions();
  }

  ngOnInit() {
    // Subscribe to auth state
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuth => {
        this.isAuthenticated = isAuth;
        if (!isAuth) {
          this.router.navigate(['/']);
        }
      });

    // Subscribe to current user
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Load dashboard data
    this.loadDashboardData();
  }

  toggleSpending() {
  this.isSpendingExpanded = !this.isSpendingExpanded;
}

toggleFavorites() {
  this.isFavoritesExpanded = !this.isFavoritesExpanded;
}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeQuickActions() {
    this.quickActions = [
      {
        id: 'pay',
        title: 'Pay Someone',
        icon: '💳',
        action: 'pay',
        color: 'primary'
      },
      {
        id: 'request',
        title: 'Request Money',
        icon: '📩',
        action: 'request',
        color: 'secondary'
      },
      {
        id: 'scan',
        title: 'Scan & Pay',
        icon: '📱',
        action: 'scan',
        color: 'accent'
      },
      {
        id: 'bills',
        title: 'Pay Bills',
        icon: '🏠',
        action: 'bills',
        color: 'warning'
      }
    ];
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      // Load all dashb
      // oard data in parallel
      debugger;
      await Promise.all([
        this.loadAccountSummary(),
        this.loadRecentTransactions(),
        this.loadSpendingData(),
        this.loadFavoritePayees(),
        this.loadCategorySpending()
      ]);
      
      this.calculateDerivedMetrics();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.errorMessage = 'Failed to load dashboard data. Please refresh the page.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadAccountSummary() {
    try {
      debugger;
      const cards = await this.paymentService.getSavedCards().toPromise();

      // Simulate API calls - replace with actual service calls
      // const [cards, accounts, balance] = await Promise.all([
      //   this.paymentService.getSavedCards().toPromise(),
      //   this.paymentService.getSavedBankAccounts().toPromise(),
      //   this.simulateBalanceLoad()
      // ]);
      
      this.cardCount = cards?.length || 0;
      // this.accountCount = accounts?.length || 0;
      // this.totalBalance = balance;
      
    } catch (error) {
      console.error('Error loading account summary:', error);
      // Set defaults on error
      this.cardCount = 0;
      this.accountCount = 0;
      this.totalBalance = 0;
    }
  }

  private async loadRecentTransactions() {
    try {
      // Simulate loading recent transactions
      this.recentTransactions = this.generateMockTransactions();
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.recentTransactions = [];
    }
  }

  private async loadSpendingData() {
    try {
      // Generate spending data based on selected period
      this.spendingData = this.generateSpendingData(this.selectedPeriod);
    } catch (error) {
      console.error('Error loading spending data:', error);
      this.spendingData = [];
    }
  }

  private async loadFavoritePayees() {
    try {
      // Simulate loading favorite payees
      this.favoritePayees = this.generateMockFavorites();
    } catch (error) {
      console.error('Error loading favorite payees:', error);
      this.favoritePayees = [];
    }
  }

   getMaxSpending(): number {
    if (this.spendingData.length === 0) return 1000;
    return Math.max(...this.spendingData.map(data => data.amount));
  }

  private async loadCategorySpending() {
    try {
      // Generate category spending data
      this.categorySpending = this.generateCategorySpending();
    } catch (error) {
      console.error('Error loading category spending:', error);
      this.categorySpending = [];
    }
  }

  private calculateDerivedMetrics() {
    // Calculate monthly spending and income from transactions
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    
    const monthlyTransactions = this.recentTransactions.filter(t => 
      t.date.getMonth() === thisMonth && t.date.getFullYear() === thisYear
    );
    
    this.monthlySpending = monthlyTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    this.monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate savings rate
    this.savingsRate = this.monthlyIncome > 0 
      ? ((this.monthlyIncome - this.monthlySpending) / this.monthlyIncome) * 100 
      : 0;
  }

  // Mock data generation methods (replace with actual API calls)
  private async simulateBalanceLoad(): Promise<number> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(15420.50);
      }, 500);
    });
  }

  private generateMockTransactions(): Transaction[] {
    const mockTransactions: Transaction[] = [
      {
        id: '1',
        amount: 85.50,
        description: 'Grocery Shopping',
        category: 'Groceries',
        date: new Date(Date.now() - 86400000), // Yesterday
        type: 'debit',
        merchant: 'SuperMart',
        paymentMethod: 'Credit Card'
      },
      {
        id: '2',
        amount: 2500.00,
        description: 'Salary Deposit',
        category: 'Income',
        date: new Date(Date.now() - 172800000), // 2 days ago
        type: 'credit',
        paymentMethod: 'Direct Deposit'
      },
      {
        id: '3',
        amount: 45.00,
        description: 'Coffee Shop',
        category: 'Food & Dining',
        date: new Date(Date.now() - 259200000), // 3 days ago
        type: 'debit',
        merchant: 'Brew & Bean',
        paymentMethod: 'Debit Card'
      },
      {
        id: '4',
        amount: 120.00,
        description: 'Gas Station',
        category: 'Transportation',
        date: new Date(Date.now() - 345600000), // 4 days ago
        type: 'debit',
        merchant: 'Shell',
        paymentMethod: 'Credit Card'
      },
      {
        id: '5',
        amount: 15.99,
        description: 'Netflix Subscription',
        category: 'Entertainment',
        date: new Date(Date.now() - 432000000), // 5 days ago
        type: 'debit',
        merchant: 'Netflix',
        paymentMethod: 'Credit Card'
      }
    ];
    
    return mockTransactions;
  }

  private generateSpendingData(period: string): SpendingData[] {
    const data: SpendingData[] = [];
    const now = new Date();
    
    if (period === 'month') {
      // Generate last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        data.push({
          month: monthName,
          amount: Math.floor(Math.random() * 2000) + 500
        });
      }
    } else if (period === 'week') {
      // Generate last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        data.push({
          month: `Week ${8 - i}`,
          amount: Math.floor(Math.random() * 500) + 100
        });
      }
    }
    
    return data;
  }

  private generateMockFavorites(): FavoritePayee[] {
    return [
      {
        id: '1',
        name: 'John Doe',
        type: 'person',
        lastAmount: 50.00,
        frequency: 15
      },
      {
        id: '2',
        name: 'Electric Company',
        type: 'business',
        lastAmount: 125.00,
        frequency: 12
      }
     
      
    ];
  }

  private generateCategorySpending(): any[] {
    return [
      { name: 'Groceries', value: 450, color: '#FF6B6B' },
      { name: 'Transportation', value: 320, color: '#4ECDC4' },
      { name: 'Entertainment', value: 180, color: '#45B7D1' },
      { name: 'Food & Dining', value: 275, color: '#96CEB4' },
      { name: 'Utilities', value: 220, color: '#FECA57' },
      { name: 'Shopping', value: 195, color: '#FF9FF3' }
    ];
  }

  // Event handlers
  onPeriodChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'week' | 'month' | 'quarter' | 'year';
    this.selectedPeriod = value;
    this.loadSpendingData();
  }

  onQuickAction(actionId: string) {
    switch (actionId) {
      case 'pay':
        this.router.navigate(['/pay']);
        break;
      case 'request':
        this.router.navigate(['/request']);
        break;
      case 'scan':
        this.router.navigate(['/scan']);
        break;
      case 'bills':
        this.router.navigate(['/bills']);
        break;
      default:
        console.log('Quick action:', actionId);
    }
  }

  onFavoritePayeeClick(payee: FavoritePayee) {
    // Navigate to pay with pre-filled payee
    this.router.navigate(['/pay'], { 
      queryParams: { 
        payee: payee.name,
        amount: payee.lastAmount 
      }
    });
  }

  onTransactionClick(transaction: Transaction) {
    // Show transaction details
    console.log('Transaction details:', transaction);
  }

  navigateToTransactions() {
    this.router.navigate(['/transactions']);
  }

  navigateToAccounts() {
    this.router.navigate(['/accounts']);
  }

  navigateToSettings() {
    this.router.navigate(['/settings']);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  refreshDashboard() {
    this.loadDashboardData();
  }

  // Utility methods
  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    if (this.currentUser.name) {
      const names = this.currentUser.name.trim().split(' ');
      if (names.length >= 2) {
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
      } else if (names.length === 1) {
        return names[0].substring(0, 2).toUpperCase();
      }
    }
    
    if (this.currentUser.email) {
      const emailName = this.currentUser.email.split('@')[0];
      return emailName.substring(0, 2).toUpperCase();
    }
    
    return 'U';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getTransactionIcon(category: string): string {
    const iconMap: { [key: string]: string } = {
      'Groceries': '🛒',
      'Transportation': '🚗',
      'Entertainment': '🎬',
      'Food & Dining': '🍽️',
      'Utilities': '🏠',
      'Shopping': '🛍️',
      'Income': '💰',
      'Healthcare': '🏥',
      'Education': '📚'
    };
    
    return iconMap[category] || '💳';
  }

  private clearMessages() {
    this.successMessage = '';
    this.errorMessage = '';
  }
}