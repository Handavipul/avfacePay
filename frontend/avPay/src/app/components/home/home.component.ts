import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, AuthService, OTPRequest, OTPResponse } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';



@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  // UI State
  showRegister = false;
  showAccountManagement = false;
  showPaymentManagement = false;

  showFaceCapture = false;
  showEmailInput = false;
  showDashboard = false;
  // NEW: OTP Fallback State
  showOTPInput = false;
  otpCode = '';
  otpSessionId = '';
  otpMethod: 'sms' | 'email' = 'email';
  otpCountdown = 0;
  canResendOTP = true;
  maxOTPAttempts = 3;
  otpAttempts = 0;
  otpCodeSent: boolean = false;
  selectedContactMethod: 'email' | 'sms' = 'email';
  contactEmail: string = '';
  contactPhone: string = '';

  currentSessionId: string = '';
  isLoadingOTP = false;
  isOTPLocked = false;
  consecutiveFailures = 0;
  showBackupOption = false;

  // Account Data
  cardCount = 0;
  bankAccountCount = 0;
  totalBalance = 0;
  isLoadingAccountData = false;

  // Form Data
  loginEmail = '';
  loginPassword = '';
  registerName = '';
  registerEmail = '';
  registerPassword = '';
  registerConfirm = '';
  userEmail = '';
  currentMode: 'login' | 'register' | 'face-only' = 'face-only';

  // Messages
  successMessage = '';
  errorMessage = '';

  // Auth State
  isAuthenticated = false;
  currentUser: any = null;

  constructor(public authService: AuthService, public paymentService: PaymentService, private router: Router) {
    // Subscribe to authentication state
    this.authService.isAuthenticated$.subscribe(
      (authenticated) => {
        console.log('Authentication state changed:', authenticated);
        this.isAuthenticated = authenticated;
        if (authenticated) {
          this.resetUIStates();
           this.loadAccountData();
        } else {
          // Reset to login state when not authenticated
          this.showAccountManagement = false;
          this.resetAccountData();
        }
         
      }
    );

    // Subscribe to current user
    this.authService.currentUser$.subscribe(
      (user) => {
        this.currentUser = user;
        console.log('Current user updated:', user);
        
      }
    );
  }

  selectContactMethod(method: 'email' | 'sms'): void {
    this.selectedContactMethod = method;
    // Clear the other field when switching
    if (method === 'email') {
      this.contactPhone = '';
    } else {
      this.contactEmail = '';
    }
  }

   showDashboardView() {
    this.showDashboard = true;
    this.showAccountManagement = false;
    this.clearMessages();
  }

   hideDashboard() {
    this.showDashboard = false;
  }


  // Reset account data
  resetAccountData() {
    console.log('Resetting account data');
    this.cardCount = 0;
    this.bankAccountCount = 0;
    this.totalBalance = 0;
    this.isLoadingAccountData = false;
  }
 

  ngOnInit() {
    console.log('HomeComponent ngOnInit - isAuthenticated:', this.isAuthenticated);
    
    // Check if user is already authenticated on component load
    if (this.isAuthenticated) {
      this.showSuccess('Welcome back!');
      this.loadAccountData();
      // Clear success message after showing briefly
      setTimeout(() => {
        this.clearMessages();
      }, 2000);
    }
  }


  

  public resetUIStates() {
    console.log('Resetting UI states');
    this.showRegister = false;
    this.showFaceCapture = false;
    this.showEmailInput = false;
    this.showDashboard = false;
    // Don't reset showAccountManagement here as it should be controlled separately
  }

  // Navigation methods
  navigateToAuth() {
    this.router.navigate(['/auth']);
  }

   handleGoBack() {
    console.log('Go back from PayNow clicked');
    // You can toggle views or navigate
  }

  handlePaymentComplete(event: any) {
    console.log('Payment Complete:', event);
    alert(`✅ Payment of ${event.total} completed with TXN: ${event.transactionId}`);
  }

  navigateToDashboard() {
    this.showDashboardView();
  }

  // Show account management
  showAccountManagementView() {
    this.showAccountManagement = true;
    this.clearMessages();
  }

   showPaymentManagementView() {
    this.showAccountManagement = false;
    this.showPaymentManagement=true;
    // this.hideDashboard();
    this.clearMessages();
  }

  // Hide account management
  hideAccountManagement() {
    this.showAccountManagement = false;
  }

  // Start face registration flow
  startFaceRegistration() {
    this.currentMode = 'register';
    this.showEmailInput = true;
    this.showAccountManagement = false;
    this.clearMessages();
  }

  // Show register form
  showRegisterForm() {
    this.showRegister = true;
    this.showFaceCapture = false;
    this.showEmailInput = false;
    this.showAccountManagement = false;
    this.clearMessages();
  }

  // Hide register form and go back to login
  hideRegisterForm() {
    this.showRegister = false;
    this.clearRegisterForm();
    this.clearMessages();
  }

  // Toggle between login and register forms
  toggleRegisterForm() {
    this.showRegister = !this.showRegister;
    this.showAccountManagement = false;
    this.clearMessages();
    if (!this.showRegister) {
      this.clearRegisterForm();
    }
  }

  private clearRegisterForm() {
    this.registerName = '';
    this.registerEmail = '';
    this.registerPassword = '';
    this.registerConfirm = '';
  }

  // Start face login flow
  startFaceLogin() {
    this.currentMode = 'login';
    this.showEmailInput = true;
    this.showAccountManagement = false;
    this.clearMessages();
  }

  startQuickLogin() {
    this.currentMode = 'face-only';
    this.showEmailInput = false;
    this.showFaceCapture = true;
    this.showAccountManagement = false;
    this.clearMessages();
  }

  // Proceed with email after validation
  proceedWithEmail() {
    if (!this.isValidEmail(this.userEmail)) {
      this.showError('Please enter a valid email address.');
      return;
    }

    this.showEmailInput = false;
    this.showFaceCapture = true;
  }

  // Cancel email input
  cancelEmailInput() {
    this.showEmailInput = false;
    this.userEmail = '';
    this.clearMessages();
  }

  // Handle successful authentication
 

  loadAccountData() {
    if (!this.isAuthenticated) {
      return;
    }

    console.log('Loading account data...');
    this.isLoadingAccountData = true;
    this.loadAccountDataFromServices();
  }

  /**
 * Get user initials from name or email
 * @returns string - User initials (max 2 characters)
 */
getUserInitials(): string {
  if (!this.currentUser) return 'U';
  
  // Try to get initials from name first
  if (this.currentUser.name) {
    const names = this.currentUser.name.trim().split(' ');
    if (names.length >= 2) {
      // First and last name initials
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    } else if (names.length === 1) {
      // Single name - take first two characters or just first if single character
      return names[0].substring(0, 2).toUpperCase();
    }
  }
  
  // Fallback to email initials
  if (this.currentUser.email) {
    const emailName = this.currentUser.email.split('@')[0];
    if (emailName.length >= 2) {
      return emailName.substring(0, 2).toUpperCase();
    } else {
      return emailName.toUpperCase();
    }
  }
  
  // Ultimate fallback
  return 'U';
}

  private loadAccountDataFromServices() {
    this.isLoadingAccountData = true;
    
    const accountRequests = {
      cards: this.paymentService.getSavedCards(),
      // bankAccounts: this.paymentService.getSavedBankAccounts(),
      // balance: this.accountService.getTotalBalance()
    };

    forkJoin(accountRequests).subscribe({
      next: (results) => {
        this.cardCount = results.cards?.length || 0;
        // this.bankAccountCount = results.bankAccounts?.length || 0;
        // this.totalBalance = results.balance || 0;
        this.isLoadingAccountData = false;
        console.log('All account data loaded successfully');
      },
      error: (error) => {
        console.error('Error loading account data:', error);
        this.handleAccountDataError(error);
        this.isLoadingAccountData = false;
      }
    });
  }
 

  // Handle account data loading errors
  private handleAccountDataError(error: any) {
    console.error('Account data loading failed:', error);
    this.showError('Failed to load account information. Please try again.');
    // Reset to default values on error
    this.cardCount = 0;
    this.bankAccountCount = 0;
    this.totalBalance = 0;
  }

  // Temporary method to simulate loading - remove this when implementing real services
  private simulateAccountDataLoad() {
    // Simulate API call delay
    setTimeout(() => {
      try {
        // Simulate potential API failure (10% chance)
        if (Math.random() < 0.1) {
          throw new Error('Simulated API error');
        }
        
        // Simulate some sample data
        this.cardCount = Math.floor(Math.random() * 5) + 1; // Random 1-5 cards
        this.bankAccountCount = Math.floor(Math.random() * 3) + 1; // Random 1-3 accounts
        this.totalBalance = Math.floor(Math.random() * 10000) + 1000; // Random balance
        this.isLoadingAccountData = false;
        console.log('Account data loaded:', {
          cardCount: this.cardCount,
          bankAccountCount: this.bankAccountCount,
          totalBalance: this.totalBalance
        });
      } catch (error) {
        this.handleAccountDataError(error);
        this.isLoadingAccountData = false;
      }
    }, 1000); // 1 second delay to simulate API call
  }

  // Register with traditional form
  registerWithForm() {
    if (!this.validateRegisterForm()) {
      return;
    }

    // TODO: Implement actual registration logic with your auth service
    console.log('Registering with form:', {
      name: this.registerName,
      email: this.registerEmail,
      password: this.registerPassword
    });
    

  }

  // Validate register form
  private validateRegisterForm(): boolean {
    if (!this.registerName.trim()) {
      this.showError('Please enter your full name.');
      return false;
    }

    if (!this.isValidEmail(this.registerEmail)) {
      this.showError('Please enter a valid email address.');
      return false;
    }

    if (this.registerPassword.length < 6) {
      this.showError('Password must be at least 6 characters long.');
      return false;
    }

    if (this.registerPassword !== this.registerConfirm) {
      this.showError('Passwords do not match.');
      return false;
    }

    return true;
  }

  handleAuthError(error: any) {
    console.log('Primary authentication failed:', error);
    
    this.incrementConsecutiveFailures();
    
    // IMPORTANT: Enable backup option on any authentication error
    this.showBackupOption = true;
    
    // Check if this is a fallback-eligible error OR if user has multiple failures
    if (this.shouldTriggerOTPFallback(error)) {
      this.initiateFallbackFlow(error);
    } else {
      // Standard error handling - show error message which will enable backup button
      const errorMessage = this.getEnhancedErrorMessage(error);
      this.showError(errorMessage);
      
      // The backup button is now visible due to showBackupOption = true
      console.log('Backup verification option now available');
    }
  }

  triggerBackupVerification() {
   this.showFaceCapture = false;
    this.showOTPInput = true;
    this.otpCodeSent = false; // Start with contact input
    this.errorMessage = '';
    this.successMessage = '';
  // this.initiateFallbackFlow(manualError);
}

  private getEnhancedErrorMessage(error: { code?: string; message?: string }): string {
    const errorMap: { [key: string]: string } = {
      'CAMERA_ACCESS_DENIED': 'Camera access denied. Please enable camera permissions and try again, or use the backup verification option.',
      'FACE_RECOGNITION_TIMEOUT': 'Face recognition timed out. Please ensure good lighting and try again.',
      'MULTIPLE_FAILED_ATTEMPTS': 'Multiple failed attempts detected. Using backup verification for security.',
      'DEVICE_NOT_TRUSTED': 'Device not recognized. Please verify your identity with the backup method.',
      'BIOMETRIC_FAILED': 'Biometric authentication failed. Please try again or use backup verification.',
      'NETWORK_ERROR': 'Network connection issue. Please check your internet connection and try again.'
    };
    
    const baseMessage = (error.code && errorMap[error.code]) || error.message || 'Authentication failed. Please try again.';
  
    // Add backup guidance if not already included
    if (!baseMessage.includes('backup verification') && !baseMessage.includes('Use backup')) {
      return baseMessage + ' You can use backup verification if the issue persists.';
    }
    
    return baseMessage;
  }

 private shouldTriggerOTPFallback(error: any): boolean {
    const fallbackTriggers = [
      'BIOMETRIC_FAILED',
      'FACE_RECOGNITION_TIMEOUT', 
      'CAMERA_ACCESS_DENIED',
      'MULTIPLE_FAILED_ATTEMPTS',
      'DEVICE_NOT_TRUSTED',
      'SUSPICIOUS_ACTIVITY',
      'LIVENESS_CHECK_FAILED'
    ];
    
    return fallbackTriggers.includes(error.code) || 
           error.requiresFallback === true ||
           this.consecutiveFailures >= 2; // Trigger after 2 consecutive failures
  }

  // Enhanced OTP flow initiation
  private async initiateFallbackFlow(originalError: any) {
    console.log('Initiating OTP fallback flow');
    
    // Hide face capture, show OTP input
    this.showFaceCapture = false;
    this.showOTPInput = true;
    
    // Generate session ID for OTP flow
    this.otpSessionId = this.generateSessionId();
    
    try {
      this.isLoadingOTP = true;
      
      // Request OTP from backend
      const otpRequest = {
        sessionId: this.otpSessionId,
        email: this.userEmail || this.currentUser?.email,
        method: this.otpMethod,
        purpose: 'login_fallback',
        originalAuthMethod: 'face_recognition',
        fallbackReason: originalError.message || 'Primary authentication failed'
      };
      
      const response = await this.authService.requestOTP(otpRequest).toPromise();
      
      if (response?.success) {
        this.showSuccess(`Verification code sent to your ${this.otpMethod}. Please check and enter the code.`);
        this.startOTPCountdown();
        this.focusOTPInput();
        this.showOTPInput=true
      } else {
        throw new Error(response?.message || 'Failed to send verification code');
      }
      
    } catch (otpError: any) {
      console.error('OTP request failed:', otpError);
      this.showError('Unable to send verification code. Please try again.');
      this.showOTPInput = false;
      this.showFaceCapture = true; // Return to face auth
    } finally {
      this.isLoadingOTP = false;
    }
  }


  async validateOTP() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.showError('Please enter a valid 6-digit code');
      return;
    }

    try {
      this.isLoadingOTP = true;
      
      const response = await this.authService.validateOTP({
        session_id: this.currentSessionId,
        otp_code: this.otpCode
      }).toPromise();
      
      if (response?.success) {
        // OTP validated successfully
        this.handleAuthSuccess({
          ...response,
          message: 'Authentication successful via backup verification'
        });
        this.resetOTPState();
      } else {
        this.otpAttempts++;
        
        if (this.otpAttempts >= this.maxOTPAttempts) {
          this.showError('Maximum attempts exceeded. Please try again later.');
          this.lockOTPForCooldown();
        } else {
          const remaining = this.maxOTPAttempts - this.otpAttempts;
          this.showError(`Invalid code. ${remaining} attempts remaining.`);
          
          // Clear the input for retry
          this.otpCode = '';
          this.focusOTPInput();
        }
      }
      
    } catch (error: any) {
      console.error('OTP validation failed:', error);
      this.showError(error.message || 'Verification failed. Please try again.');
      
      // Clear input on error
      this.otpCode = '';
      this.focusOTPInput();
    } finally {
      this.isLoadingOTP = false;
    }
  }



  private loadUserAccounts(): void {
    if (this.currentUser) {
      // Load cards and bank accounts
      this.loadAccountData();
    }
  }

  focusOTPInput() {
    setTimeout(() => {
      const otpInput = document.querySelector('.otp-input') as HTMLInputElement;
      if (otpInput) {
        otpInput.focus();
      }
    }, 100);
  }

 async resendOTP() {
    if (!this.canResendOTP || this.isLoadingOTP) return;
    
    try {
      this.isLoadingOTP = true;
      
      const response = await this.authService.resendOTP(this.otpSessionId).toPromise();
      
      if (response?.success) {
        this.showSuccess(`New verification code sent to your ${this.otpMethod}`);
        this.startOTPCountdown();
        this.otpCode = ''; // Clear previous code
        this.focusOTPInput();
        
        // Reset attempts on successful resend
        this.otpAttempts = 0;
      } else {
        this.showError('Failed to resend code. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Resend OTP failed:', error);
      this.showError('Failed to resend verification code');
    } finally {
      this.isLoadingOTP = false;
    }
  }

  // Enhanced OTP method switching
  async switchOTPMethod(method: 'sms' | 'email' ) {
    if (this.isLoadingOTP) return;
    
    const previousMethod = this.otpMethod;
    this.otpMethod = method;
    
    try {
      this.isLoadingOTP = true;
      
      // Cancel current session
      await this.authService.cancelOTPSession(this.otpSessionId).toPromise();
      
      // Generate new session ID
      this.otpSessionId = this.generateSessionId();
      
      // Request new OTP with different method
      const otpRequest = {
        sessionId: this.otpSessionId,
        email: this.userEmail || this.currentUser?.email,
        phone: this.currentUser?.phone, // Assuming phone is available
        method: this.otpMethod,
        purpose: 'login_fallback'
      };
      
      const response = await this.authService.requestOTP(otpRequest).toPromise();
      
      if (response?.success) {
        this.showSuccess(`Verification code sent to your ${this.otpMethod}`);
        this.startOTPCountdown();
        this.otpCode = '';
        this.otpAttempts = 0;
        this.focusOTPInput();
      } else {
        // Revert on failure
        this.otpMethod = previousMethod;
        throw new Error(response?.message || 'Failed to switch method');
      }
      
    } catch (error: any) {
      console.error('Method switch failed:', error);
      this.showError(`Failed to send code via ${method}. Please try again.`);
      this.otpMethod = previousMethod; // Revert on error
    } finally {
      this.isLoadingOTP = false;
    }
  }

  // OTP Method Switch


  // Cancel OTP Flow
  cancelOTPFlow() {
    if (this.isLoadingOTP) {
      // Don't allow cancel during loading
      return;
    }

    this.showOTPInput = false;
    this.showFaceCapture = true;
    this.otpCodeSent = false;
    this.contactEmail = '';
    this.contactPhone = '';
    this.otpCode = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.otpAttempts = 0;
    this.selectedContactMethod = 'email';
    
    // Cancel OTP session on backend
    if (this.otpSessionId) {
      this.authService.cancelOTPSession(this.otpSessionId).subscribe({
        next: () => console.log('OTP session cancelled'),
        error: (error:any) => console.error('Error cancelling OTP session:', error)
      });
    }
    
    this.resetOTPState();
    this.showFaceCapture = true;
    this.clearMessages();
    
    // Show helpful message
    this.showSuccess('You can try face authentication again or use backup verification if needed.');
    
    setTimeout(() => {
      this.clearMessages();
    }, 3000);
  }

  // Utility Methods
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

// Enhanced countdown with visual feedback
  private startOTPCountdown() {
    this.canResendOTP = false;
    this.otpCountdown = 60; // 60 seconds
    
    const timer = setInterval(() => {
      this.otpCountdown--;
      
      // Update UI with remaining time
      this.updateResendButtonText();
      
      if (this.otpCountdown <= 0) {
        this.canResendOTP = true;
        clearInterval(timer);
      }
    }, 1000);
  }

   changeContactInfo(): void {
    this.otpCodeSent = false;
    this.otpCode = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.otpAttempts = 0;
  }

  getDisplayContact(): string {
    if (this.selectedContactMethod === 'email') {
      const email = this.contactEmail;
      const [localPart, domain] = email.split('@');
      if (localPart.length <= 2) {
        return `${localPart}***@${domain}`;
      }
      return `${localPart.substring(0, 2)}***@${domain}`;
    } else {
      const phone = this.contactPhone;
      if (phone.length <= 4) {
        return `***${phone.slice(-2)}`;
      }
      return `***${phone.slice(-4)}`;
    }
  }

  async sendOTPCode(): Promise<void> {
    if (!this.isContactInfoValid()) {
      this.errorMessage = 'Please enter a valid ' + this.selectedContactMethod;
      return;
    }

    this.isLoadingOTP = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const otpRequest: OTPRequest = {
    session_id: this.generateSessionId(),
    method: this.selectedContactMethod === 'email' ? 'email' : 'sms',
    purpose: 'login_fallback',
    fallback_reason: '',
    };

    // Add only if not empty
    if (this.contactEmail && this.selectedContactMethod === 'email') {
      otpRequest.email = this.contactEmail;
    }
    if (this.contactPhone && this.selectedContactMethod === 'sms') {
      otpRequest.phone = this.contactPhone;
    }
   
    this.authService.requestOTP(otpRequest).subscribe({
      next: (response: OTPResponse) => {
        if (response.success) {
          this.otpCodeSent = true;
          this.otpMethod = this.selectedContactMethod;
          this.successMessage = `Verification code sent to your ${this.selectedContactMethod}`;
          this.startOTPCountdown();
          // Store session_id if provided
          if (response.session_id) {
            this.currentSessionId = response.session_id;
          }
        } else {
          this.errorMessage = response.message || response.error || 'Failed to send verification code';
        }
      },
      error: (error) => {
        console.error('Error sending OTP:', error);
        this.errorMessage = 'Unable to send verification code. Please try again.';
      },
      complete: () => {
        this.isLoadingOTP = false;
      }
    });
    } catch (error) {
      console.error('Error sending OTP:', error);
      this.errorMessage = 'Unable to send verification code. Please try again.';
    } finally {
      this.isLoadingOTP = false;
    }
  }

  isContactInfoValid(): boolean {
    if (this.selectedContactMethod === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(this.contactEmail);
    } else {
      // Basic phone validation - you can make this more sophisticated
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      return phoneRegex.test(this.contactPhone);
    }
  }

  private updateResendButtonText() {
    const resendButton = document.querySelector('.resend-otp-button') as HTMLButtonElement;
    if (resendButton) {
      resendButton.textContent = this.canResendOTP ? 'Resend Code' : `Resend in ${this.otpCountdown}s`;
      resendButton.disabled = !this.canResendOTP;
    }
  }

  private lockOTPForCooldown() {
    this.showOTPInput = false;
    this.isOTPLocked = true;
    
    // Show cooldown message
    this.showError('Too many failed attempts. Please wait 5 minutes before trying again.');
    
    setTimeout(() => {
      this.resetOTPState();
      this.isOTPLocked = false;
      this.showFaceCapture = true;
    }, 300000); // 5 minutes cooldown
  }

  private resetOTPState() {
    this.showOTPInput = false;
    this.otpCode = '';
    this.otpSessionId = '';
    this.otpAttempts = 0;
    this.canResendOTP = true;
    this.otpCountdown = 0;
    this.isLoadingOTP = false;
  }

  onOTPInput(event: any) {
    debugger
    const input = event.target.value;
    
    // Remove non-numeric characters
    const numericValue = input.replace(/\D/g, '');
    
    // Limit to 6 digits
    const limitedValue = numericValue.slice(0, 6);
    
    // Update the model
    this.otpCode = limitedValue;
    
    // Update the input field
    event.target.value = limitedValue;
    
    // Auto-verify when 6 digits are entered
    if (limitedValue.length === 6) {
      setTimeout(() => {
        this.validateOTP();
      }, 100); // Small delay for better UX
    }
    
    // Clear any previous error messages when user starts typing
    if (this.errorMessage && limitedValue.length > 0) {
      this.clearMessages();
    }
  }



  // Handle authentication cancel
 handleAuthCancel() {
  console.log('Authentication cancelled');
  
  // If OTP is active, give user choice
  if (this.showOTPInput) {
    const userChoice = confirm('Do you want to cancel backup verification and return to the main page?');
    if (!userChoice) {
      return; // User chose to stay
    }
    
    // Cancel OTP session
    this.cancelOTPFlow();
  }
  
  // Reset everything and go back to main page
  this.showFaceCapture = false;
  this.showEmailInput = false;
  this.showOTPInput = false;
  this.showBackupOption = false; // Reset backup option visibility
  this.userEmail = '';
  this.resetOTPState();
  this.resetConsecutiveFailures();
  this.clearMessages();
}
  // Logout
  logout() {
    console.log('Logging out');
    this.authService.logout();
    this.showSuccess('Logged out successfully!');
    this.showAccountManagement = false;
    this.resetUIStates();
    this.clearRegisterForm();
    this.userEmail = '';
    
    // Clear success message after showing briefly
    setTimeout(() => {
      this.clearMessages();
    }, 3000);
  }

  // Utility methods
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
    console.log('Success message:', message);
  }

  // Updated method to ensure backup button visibility
  private showError(message: string) {
  this.errorMessage = message;
  this.successMessage = '';
  console.log('Error message:', message);
  
  // Auto-clear error messages after 8 seconds (increased from 5)
  // to give users more time to see the backup option
  setTimeout(() => {
    if (this.errorMessage === message) { // Only clear if it's the same message
      this.errorMessage = '';
    }
  }, 8000);
}

  private clearMessages() {
    this.successMessage = '';
    this.errorMessage = '';
  }
   private incrementConsecutiveFailures() {
    this.consecutiveFailures++;
    
    // Auto-trigger fallback after certain failures
    if (this.consecutiveFailures >= 2 && !this.showOTPInput) {
      const error = {
        code: 'MULTIPLE_FAILED_ATTEMPTS',
        message: 'Multiple authentication attempts failed',
        requiresFallback: true
      };
      // this.handleAuthError(error);
    }
  }

  private resetConsecutiveFailures() {
    this.consecutiveFailures = 0;
  }

  // Enhanced success handler
    handleAuthSuccess(response: AuthResponse) {
    console.log('Authentication successful:', response);
    
    // Reset failure counters and backup option
    this.resetConsecutiveFailures();
    this.showBackupOption = false;
    
    // Hide all auth UI
    this.showFaceCapture = false;
    this.showEmailInput = false;
    this.showRegister = false;
    this.showOTPInput = false;
    
    this.showSuccess(response.message || 'Authentication successful!');
    
    // Reset form data
    this.userEmail = '';
    this.clearRegisterForm();
    this.resetOTPState();
    
    // Clear success message after showing briefly
    setTimeout(() => {
      this.clearMessages();
    }, 3000);
  }
}