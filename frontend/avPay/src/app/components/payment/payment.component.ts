import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PaymentService, PaymentRequest, SavedCard } from '../../services/payment.service';
import { FaceCaptureService } from '../../services/face-capture.service';
import { debounceTime, Subscription } from 'rxjs';

interface CardPaymentRequest {
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

interface BankAccount {
  id?: string;
  account_name: string;
  account_number: string;
  routing_number: string;
  bank_name: string;
  account_type: 'checking' | 'savings';
  is_primary?: boolean;
}

interface CreditCard {
  id?: string;
  card_number: string;
  holder_name: string;
  expiry_month: number;
  expiry_year: number;
  cvv: string;
  brand?: string;
  last_four?: string;
  is_primary?: boolean;
}



@Component({
  selector: 'app-payment',
  standalone: false,
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      <!-- Header -->
      <header class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-sm mx-auto px-4 py-4 flex items-center">
          <button (click)="goBack()" class="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 class="text-xl font-semibold text-gray-900">
            {{ isCrossBorderPayment ? 'International Payment' : 'Send Payment' }}
          </h1>
        </div>
      </header>

      <div class="max-w-sm mx-auto px-4 py-6">
        
        <!-- Payment Type Selection -->
        <div *ngIf="currentStep === 'payment-type'" class="space-y-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Select Payment Type</h2>
            
            <div class="space-y-3">
              <button 
                (click)="selectPaymentType('domestic')"
                class="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center space-x-3"
              >
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-1a1 1 0 011-1h2a1 1 0 011 1v1a1 1 0 001 1m-6 0h6"/>
                  </svg>
                </div>
                <div class="text-left">
                  <div class="font-medium text-gray-900">Domestic Payment</div>
                  <div class="text-sm text-gray-500">Send money within your country</div>
                </div>
              </button>

              <button 
                (click)="selectPaymentType('international')"
                class="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center space-x-3"
              >
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div class="text-left">
                  <div class="font-medium text-gray-900">International Payment</div>
                  <div class="text-sm text-gray-500">Send money abroad</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Country & Currency Selection (for international payments) -->
        <div *ngIf="currentStep === 'country-currency'" class="space-y-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Select Destination</h2>
            
            <!-- Country Selection -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Destination Country</label>
              <select 
                [(ngModel)]="selectedCountry" 
                [ngModelOptions]="{ standalone: true }"
                (change)="onCountryChange()"
                class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Country</option>
                <option *ngFor="let country of supportedCountries" [value]="country.code">
                  {{ country.flag }} {{ country.name }}
                </option>
              </select>
            </div>

            <!-- Currency Selection -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select 
                [(ngModel)]="selectedCurrency" 
                [ngModelOptions]="{ standalone: true }"
                (change)="onCurrencyChange()"
                class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Currency</option>
                <option *ngFor="let currency of AllCurrenciesCollection" [value]="currency.code">
                  {{ currency.code }} - {{ currency.name }}
                </option>
              </select>
            </div>

            <!-- Exchange Rate Display -->
            <div *ngIf="selectedCurrency && exchangeRate" class="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 class="font-semibold text-green-900 mb-2">Exchange Rate</h3>
              <div class="text-sm">
                <div class="flex justify-between">
                  <span class="text-green-700">1 USD =</span>
                  <span class="font-medium text-green-900">{{ exchangeRate | number:'1.4-4' }} {{ selectedCurrency }}</span>
                </div>
                <div class="text-xs text-green-600 mt-1">
                  Rate updated: {{ exchangeRateTimestamp | date:'short' }}
                </div>
              </div>
            </div>

            <!-- Compliance Notice -->
            <div *ngIf="selectedCountry" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
              <div class="flex items-start space-x-3">
                <svg class="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                <div>
                  <h4 class="font-semibold text-yellow-900">Compliance Notice</h4>
                  <p class="text-sm text-yellow-700 mt-1">
                    International transfers may require additional documentation and are subject to regulatory compliance checks.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button 
            (click)="proceedToPaymentMethod()"
            [disabled]="!selectedCountry || !selectedCurrency"
            class="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>

        <!-- Payment Method Selection -->
        <div *ngIf="currentStep === 'method'" class="space-y-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Choose Payment Method</h2>
            
            <div class="space-y-3">
              <button 
                (click)="selectPaymentMethod('bank')"
                class="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center space-x-3"
              >
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
                <div class="text-left">
                  <div class="font-medium text-gray-900">Bank Transfer</div>
                  <div class="text-sm text-gray-500">
                    {{ isCrossBorderPayment ? 'International wire transfer' : 'Transfer to bank account' }}
                  </div>
                </div>
              </button>

              <button 
                (click)="selectPaymentMethod('card')"
                class="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center space-x-3"
              >
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                  </svg>
                </div>
                <div class="text-left">
                  <div class="font-medium text-gray-900">Card Payment</div>
                  <div class="text-sm text-gray-500">Pay with debit/credit card</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Bank Transfer Form -->
        <div *ngIf="currentStep === 'bank-form'" class="space-y-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <form [formGroup]="paymentForm" class="space-y-4">
              
              <!-- Amount -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Amount {{ isCrossBorderPayment ? '(USD)' : '' }}
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span class="text-gray-500 text-lg">$</span>
                  </div>
                  <input 
                    type="number" 
                    formControlName="amount"
                    (input)="calculateConvertedAmount()"
                    class="block w-full pl-8 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                  >
                </div>
                <div *ngIf="paymentForm.get('amount')?.invalid && paymentForm.get('amount')?.touched" 
                     class="mt-1 text-sm text-red-600">
                  Please enter a valid amount
                </div>
                
                <!-- Converted Amount Display -->
                <div *ngIf="isCrossBorderPayment && paymentForm.get('amount')?.value && convertedAmount" 
                     class="mt-2 text-sm text-gray-600">
                  Recipient will receive: {{ convertedAmount | number:'1.2-2' }} {{ selectedCurrency }}
                </div>
              </div>

              <!-- Recipient Information -->
              <div class="space-y-4">
                <h3 class="font-semibold text-gray-900">Recipient Information</h3>
                
                <!-- Recipient Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Recipient Name</label>
                  <input 
                    type="text" 
                    formControlName="recipient_name"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Full name of recipient"
                  >
                  <div *ngIf="paymentForm.get('recipient_name')?.invalid && paymentForm.get('recipient_name')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Please enter recipient name
                  </div>
                </div>

                <!-- Recipient Address (for international) -->
                <div *ngIf="isCrossBorderPayment">
                  <label class="block text-sm font-medium text-gray-700 mb-2">Recipient Address</label>
                  <textarea 
                    formControlName="recipient_address"
                    rows="3"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Complete address of recipient"
                  ></textarea>
                  <div *ngIf="paymentForm.get('recipient_address')?.invalid && paymentForm.get('recipient_address')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Please enter recipient address
                  </div>
                </div>

                <!-- Recipient Account -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    {{ isCrossBorderPayment ? 'IBAN / Account Number' : 'Recipient Account' }}
                  </label>
                  <input 
                    type="text" 
                    formControlName="recipient_account"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    [placeholder]="isCrossBorderPayment ? 'Enter IBAN or account number' : 'Enter account number'"
                  >
                  <div *ngIf="paymentForm.get('recipient_account')?.invalid && paymentForm.get('recipient_account')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Please enter recipient account
                  </div>
                </div>

                <!-- SWIFT Code (for international) -->
                <div *ngIf="isCrossBorderPayment">
                  <label class="block text-sm font-medium text-gray-700 mb-2">SWIFT/BIC Code</label>
                  <input 
                    type="text" 
                    formControlName="swift_code"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., CHASUS33"
                  >
                  <div *ngIf="paymentForm.get('swift_code')?.invalid && paymentForm.get('swift_code')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Please enter SWIFT/BIC code
                  </div>
                </div>

                <!-- Recipient Bank -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Recipient Bank</label>
                  <input 
                    type="text" 
                    formControlName="recipient_bank"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Bank name"
                  >
                  <div *ngIf="paymentForm.get('recipient_bank')?.invalid && paymentForm.get('recipient_bank')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Please enter recipient bank
                  </div>
                </div>
              </div>

              <!-- Purpose -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Purpose {{ isCrossBorderPayment ? '(Required)' : '(Optional)' }}
                </label>
                <select 
                  formControlName="purpose"
                  class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select purpose</option>
                  <option value="family_support">Family Support</option>
                  <option value="education">Education</option>
                  <option value="business">Business Payment</option>
                  <option value="investment">Investment</option>
                  <option value="property">Property Purchase</option>
                  <option value="medical">Medical Treatment</option>
                  <option value="gift">Gift</option>
                  <option value="other">Other</option>
                </select>
                <div *ngIf="paymentForm.get('purpose')?.invalid && paymentForm.get('purpose')?.touched" 
                     class="mt-1 text-sm text-red-600">
                  Please select purpose
                </div>
              </div>

              <!-- Additional Purpose Details -->
              <div *ngIf="paymentForm.get('purpose')?.value === 'other'">
                <label class="block text-sm font-medium text-gray-700 mb-2">Please specify</label>
                <input 
                  type="text" 
                  formControlName="purpose_details"
                  class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Specify purpose"
                >
              </div>
            </form>
          </div>

          <!-- Payment Summary -->
          <div *ngIf="paymentForm.get('amount')?.value" class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 class="font-semibold text-blue-900 mb-2">Payment Summary</h3>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-blue-700">Amount:</span>
                <span class="font-medium text-blue-900">{{ paymentForm.get('amount')?.value | number:'1.2-2' }}</span>
              </div>
              <div *ngIf="isCrossBorderPayment" class="flex justify-between">
                <span class="text-blue-700">Exchange Rate:</span>
                <span class="font-medium text-blue-900">{{ exchangeRate | number:'1.4-4' }}</span>
              </div>
              <div *ngIf="isCrossBorderPayment" class="flex justify-between">
                <span class="text-blue-700">Converted Amount:</span>
                <span class="font-medium text-blue-900">{{ convertedAmount | number:'1.2-2' }} {{ selectedCurrency }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">Transfer Fee:</span>
                <span class="font-medium text-blue-900">{{ getTransferFee() | number:'1.2-2' }}</span>
              </div>
              <div class="border-t border-blue-200 pt-1 mt-2">
                <div class="flex justify-between">
                  <span class="font-semibold text-blue-900">Total:</span>
                  <span class="font-bold text-blue-900">{{ getTotalAmount() | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Processing Time Info -->
          <div *ngIf="isCrossBorderPayment" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div class="flex items-center space-x-2 mb-2">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="font-semibold text-amber-900">Processing Time</span>
            </div>
            <p class="text-sm text-amber-700">
              International transfers typically take 1-3 business days to complete and may require additional compliance verification.
            </p>
          </div>

          <button 
            (click)="proceedToVerification()"
            [disabled]="!paymentForm.valid"
            class="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Verification
          </button>
        </div>

        <!-- Card Payment Form -->
        <div *ngIf="currentStep === 'card-form'" class="space-y-6">
          <!-- Amount Input -->
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Amount {{ isCrossBorderPayment ? '(USD)' : '' }}
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span class="text-gray-500 text-lg">$</span>
                </div>
                <input 
                  type="number" 
                  [(ngModel)]="cardPaymentAmount" 
                  [ngModelOptions]="{ standalone: true }"
                  (input)="calculateCardConvertedAmount()"
                  class="block w-full pl-8 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                >
              </div>
              <div *ngIf="isCrossBorderPayment && cardPaymentAmount && cardConvertedAmount" 
                   class="mt-2 text-sm text-gray-600">
                Recipient will receive: {{ cardConvertedAmount | number:'1.2-2' }} {{ selectedCurrency }}
              </div>
            </div>

            <!-- Purpose -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Purpose {{ isCrossBorderPayment ? '(Required)' : '(Optional)' }}
              </label>
              <select 
                [(ngModel)]="cardPaymentPurpose" 
                [ngModelOptions]="{ standalone: true }"
                class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select purpose</option>
                <option value="family_support">Family Support</option>
                <option value="education">Education</option>
                <option value="business">Business Payment</option>
                <option value="investment">Investment</option>
                <option value="property">Property Purchase</option>
                <option value="medical">Medical Treatment</option>
                <option value="gift">Gift</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <!-- Saved Cards -->
          <div *ngIf="savedCards.length > 0" class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Saved Cards</h3>
            <div class="space-y-3">
              <div 
                *ngFor="let card of savedCards" 
                (click)="selectSavedCard(card)"
                [class]="'p-4 border-2 rounded-xl cursor-pointer transition-all ' + 
                         (selectedCardId === card.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300')"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                      <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                      </svg>
                    </div>
                    <div>
                      <div class="font-medium text-gray-900">•••• •••• •••• {{ card.last_four }}</div>
                      <div class="text-sm text-gray-500">{{ card.brand }} • Expires {{ card.expiry_month }}/{{ card.expiry_year }}</div>
                    </div>
                  </div>
                  <div *ngIf="selectedCardId === card.id" class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              (click)="showNewCardForm()"
              class="w-full mt-4 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              + Add New Card
            </button>
          </div>

          <!-- New Card Form -->
          <div *ngIf="showCardForm" class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{ savedCards.length > 0 ? 'Add New Card' : 'Card Details' }}
            </h3>
            
            <form [formGroup]="cardForm" class="space-y-4">
              <!-- Card Number -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                <input 
                  type="text" 
                  formControlName="number"
                   autocomplete="cc-number"
                  class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="1234 5678 9012 3456"
                  maxlength="19"
                >
                <div *ngIf="cardForm.get('number')?.invalid && cardForm.get('number')?.touched" 
                     class="mt-1 text-sm text-red-600">
                  Please enter a valid card number
                </div>
              </div>

              <!-- Cardholder Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                <input 
                  type="text" 
                  formControlName="holder_name"
                  class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                >
                <div *ngIf="cardForm.get('holder_name')?.invalid && cardForm.get('holder_name')?.touched" 
                     class="mt-1 text-sm text-red-600">
                  Please enter cardholder name
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <!-- Expiry -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
                  <input 
                    type="text" 
                     autocomplete="cc-exp"
                    formControlName="expiry"
                    (input)="formatExpiry($event)"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="MM/YY"
                    maxlength="5"
                  >
                  <div *ngIf="cardForm.get('expiry')?.invalid && cardForm.get('expiry')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Invalid expiry
                  </div>
                </div>

                <!-- CVV -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                  <input 
                    type="text" 
                    formControlName="cvv"
                    autocomplete="cc-csc"
                    class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123"
                    maxlength="4"
                  >
                  <div *ngIf="cardForm.get('cvv')?.invalid && cardForm.get('cvv')?.touched" 
                       class="mt-1 text-sm text-red-600">
                    Invalid CVV
                  </div>
                </div>
              </div>

              <!-- Save Card Option -->
              <div class="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="saveCard"
                  [(ngModel)]="saveCard" [ngModelOptions]="{ standalone: true }"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                >
                <label for="saveCard" class="text-sm text-gray-700">Save this card for future payments</label>
              </div>
            </form>
          </div>

          <!-- Card Payment Summary -->
          <div *ngIf="cardPaymentAmount" class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 class="font-semibold text-blue-900 mb-2">Payment Summary</h3>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-blue-700">Amount:</span>
                <span class="font-medium text-blue-900">{{ cardPaymentAmount | number:'1.2-2' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">Processing Fee:</span>
                <span class="font-medium text-blue-900">$2.50</span>
              </div>
              <div class="border-t border-blue-200 pt-1 mt-2">
                <div class="flex justify-between">
                  <span class="font-semibold text-blue-900">Total:</span>
                  <span class="font-bold text-blue-900">{{ (cardPaymentAmount + 2.50) | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            (click)="proceedToCardVerification()"
            [disabled]="!isCardPaymentValid()"
            class="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Verification
          </button>
        </div>

        <!-- Face Verification -->
        <div *ngIf="currentStep === 'verification'" class="space-y-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-gray-900 mb-2">Verify Payment</h2>
              <p class="text-gray-600">Please verify your identity to authorize this payment</p>
            </div>

            <!-- Payment Details Review -->
            <div class="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 class="font-semibold text-gray-900 mb-3">Payment Details</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Amount:</span>
                  <span class="font-medium text-gray-900">{{ getPaymentAmount() | number:'1.2-2' }}</span>
                </div>
                <div *ngIf="paymentMethod === 'bank'" class="flex justify-between">
                  <span class="text-gray-600">To Account:</span>
                  <span class="font-medium text-gray-900">{{ paymentData.recipient_account }}</span>
                </div>
                <div *ngIf="paymentMethod === 'bank'" class="flex justify-between">
                  <span class="text-gray-600">Bank:</span>
                  <span class="font-medium text-gray-900 capitalize">{{ paymentData.recipient_bank?.replace('_', ' ') }}</span>
                </div>
                <div *ngIf="paymentMethod === 'card' && selectedCardId" class="flex justify-between">
                  <span class="text-gray-600">Card:</span>
                  <span class="font-medium text-gray-900">•••• {{ getSelectedCard()?.last_four }}</span>
                </div>
                <div *ngIf="getPurpose()" class="flex justify-between">
                  <span class="text-gray-600">Purpose:</span>
                  <span class="font-medium text-gray-900">{{ getPurpose() }}</span>
                </div>
              </div>
            </div>

            <app-face-capture 
              mode="login"
              (onSuccess)="handleVerificationSuccess($event)"
              (onError)="handleVerificationError($event)"
              (onCancel)="cancelVerification()"
            ></app-face-capture>
          </div>
        </div>

        <!-- Processing -->
        <div *ngIf="currentStep === 'processing'" class="text-center py-12">
          <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg class="animate-spin w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Processing Payment</h2>
          <p class="text-gray-600">Please wait while we process your transaction...</p>
        </div>

        <!-- Success -->
        <div *ngIf="currentStep === 'success'" class="text-center py-12">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p class="text-gray-600 mb-6">Your payment has been processed successfully</p>
          
          <div *ngIf="transactionId" class="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <h3 class="font-semibold text-gray-900 mb-2">Transaction Details</h3>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Transaction ID:</span>
                <span class="font-mono text-gray-900">{{ transactionId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Amount:</span>
                <span class="font-medium text-gray-900">{{ getPaymentAmount() | number:'1.2-2' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Status:</span>
                <span class="font-medium text-green-600">Completed</span>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button 
              (click)="goToDashboard()"
              class="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <button 
              (click)="makeAnotherPayment()"
              class="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Make Another Payment
            </button>
          </div>
        </div>

        <!-- Error Messages -->
        <div *ngIf="errorMessage" class="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
          <div class="flex items-center space-x-3">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-red-700 font-medium">{{ errorMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PaymentComponent implements OnInit, OnDestroy {
  paymentForm!: FormGroup;
  cardForm!: FormGroup;
  currentStep: 'payment-type' | 'country-currency' | 'method' | 'bank-form' | 'card-form' | 'verification' | 'processing' | 'success' = 'payment-type';
  paymentMethod: 'bank' | 'card' = 'bank';
  paymentData: PaymentRequest = {} as PaymentRequest;
  transactionId: string = '';
  errorMessage: string = '';
  
  // Cross-border payment properties
  isCrossBorderPayment: boolean = false;
  selectedCountry: string = '';
  selectedCurrency: string = '';
  exchangeRate: number = 0;
  exchangeRateTimestamp: Date = new Date();
  convertedAmount: number = 0;
  
  // Supported countries and currencies
  supportedCountries = [
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' }
  ];

  AllCurrenciesCollection = [
    { code: 'GBP', name: 'British Pound' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'MXN', name: 'Mexican Peso' },
    { code: 'BRL', name: 'Brazilian Real' }
  ];

  availableCurrencies = [...this.AllCurrenciesCollection];
  
  // Card payment properties
  savedCards: SavedCard[] = [];
  selectedCardId: string | null = null;
  showCardForm: boolean = false;
  saveCard: boolean = false;
  cardPaymentAmount: number = 0;
  cardPaymentPurpose: string = '';
  cardConvertedAmount: number = 0;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private paymentService: PaymentService,
    private faceCaptureService: FaceCaptureService
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.clearErrorMessage();
    this.loadSavedCards();
    this.cardForm.get('number')?.valueChanges
      .pipe(debounceTime(50))
      .subscribe(raw => {
        const cleaned = (raw || '').replace(/\s/g, '').replace(/[^0-9]/g, '').substring(0, 16);
        const sections = cleaned.match(/.{1,4}/g);
        const formatted = sections ? sections.join(' ') : '';
        if (raw !== formatted) {
          this.cardForm.get('number')?.setValue(formatted, { emitEvent: false });
        }
      });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.faceCaptureService.resetSession();
  }

  private initializeForms() {
    this.paymentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
      recipient_name: ['', Validators.required],
      recipient_address: [''],
      recipient_account: ['', [Validators.required, Validators.minLength(5)]],
      recipient_bank: ['', Validators.required],
      swift_code: [''],
      purpose: [''],
      purpose_details: ['']
    });

    this.cardForm = this.fb.group({
      number: ['', [Validators.required, Validators.pattern(/^\d{4}\s\d{4}\s\d{4}\s\d{4}$/)]],
      holder_name: ['', [Validators.required, Validators.minLength(2)]],
      expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
    });

    // Update form validators based on payment type
    this.updateFormValidators();
  }

  private updateFormValidators() {
    if (this.isCrossBorderPayment) {
      this.paymentForm.get('recipient_address')?.setValidators([Validators.required]);
      this.paymentForm.get('swift_code')?.setValidators([Validators.required]);
      this.paymentForm.get('purpose')?.setValidators([Validators.required]);
    } else {
      this.paymentForm.get('recipient_address')?.clearValidators();
      this.paymentForm.get('swift_code')?.clearValidators();
      this.paymentForm.get('purpose')?.clearValidators();
    }
    
    this.paymentForm.get('recipient_address')?.updateValueAndValidity();
    this.paymentForm.get('swift_code')?.updateValueAndValidity();
    this.paymentForm.get('purpose')?.updateValueAndValidity();
  }

  selectPaymentType(type: 'domestic' | 'international') {
    this.isCrossBorderPayment = type === 'international';
    this.currentStep = type === 'international' ? 'country-currency' : 'method';
    this.updateFormValidators();
    this.clearErrorMessage();
  }

  onCountryChange() {
    this.selectedCurrency = '';
    this.exchangeRate = 0;
    this.updateAvailableCurrencies();

    if (this.availableCurrencies.length > 0) {
    this.selectedCurrency = this.availableCurrencies[0].code;
    this.fetchExchangeRate();
  }
  }

  onCurrencyChange() {
    if (this.selectedCurrency) {
      this.fetchExchangeRate();
    }
  }

  private updateAvailableCurrencies() {
    const countryToCurrency: { [key: string]: string[] } = {
      'GB': ['GBP'], 'CA': ['CAD'], 'AU': ['AUD'], 'DE': ['EUR'],
      'FR': ['EUR'], 'JP': ['JPY'], 'IN': ['INR'], 'SG': ['SGD'],
      'MX': ['MXN'], 'BR': ['BRL'], 'US': ['USD'], 'CH': ['CHF', 'EUR'],
      'DK': ['DKK', 'EUR'], 'ES': ['EUR', 'USD'], 'PT': ['EUR', 'USD'],
      'PH': ['PHP', 'USD'], 'KH': ['KHR', 'USD'], 'NG': ['NGN', 'USD'],
      'AR': ['ARS', 'USD'], 'ZA': ['ZAR', 'USD'], 'KR': ['KRW', 'USD'],
    };

    const allowed = countryToCurrency[this.selectedCountry] || [];
    this.availableCurrencies = this.AllCurrenciesCollection.filter(currency =>
      allowed.includes(currency.code)
    );
  }

   private fetchExchangeRate() {
    const baseCurrency = 'USD'; // Or dynamically set base currency if needed
    if (!this.selectedCountry || !this.selectedCurrency) {
      this.exchangeRate = 0;
      this.convertedAmount = 0;
      return;
    }
    this.paymentService.getExchangeRate(baseCurrency, this.selectedCurrency)
      .subscribe({
        next: (data) => {
          // Check if exchange rate exists for the selected currency
          if (data.rate) {
            this.exchangeRate = data.rate;
            this.exchangeRateTimestamp = new Date();
            this.calculateConvertedAmount();
          } else {
            console.error('Exchange rate not found for selected currency');
            this.exchangeRate = 1; // Default to 1 if not found
            this.convertedAmount = 0;
          }
        },
        error: (error) => {
          console.error('Error fetching exchange rate:', error);
          this.exchangeRate = 1; // Default to 1 if error occurs
          this.convertedAmount = 0;
        }
      });
  }

  calculateConvertedAmount() {
    const amount = this.paymentForm.get('amount')?.value || 0;
    if (this.isCrossBorderPayment && this.exchangeRate && amount) {
      this.convertedAmount = amount * this.exchangeRate;
    } else {
      this.convertedAmount = 0;
    }
  }

  calculateCardConvertedAmount() {
    if (this.isCrossBorderPayment && this.exchangeRate && this.cardPaymentAmount) {
      this.cardConvertedAmount = this.cardPaymentAmount * this.exchangeRate;
    } else {
      this.cardConvertedAmount = 0;
    }
  }

  getTransferFee(): number {
    if (this.isCrossBorderPayment) {
      const amount = this.paymentForm.get('amount')?.value || 0;
      return Math.max(15, amount * 0.02); // 2% with minimum $15
    }
    return 2.50; // Domestic transfer fee
  }

  getTotalAmount(): number {
    const amount = this.paymentForm.get('amount')?.value || 0;
    return amount + this.getTransferFee();
  }

  proceedToPaymentMethod() {
    if (this.selectedCountry && this.selectedCurrency) {
      this.currentStep = 'method';
      this.clearErrorMessage();
    }
  }

  private loadSavedCards() {
    // const subscription = this.paymentService.getSavedCards()
    //   .subscribe({
    //     next: (cards: any) => {
    //       this.savedCards = cards;
    //       this.showCardForm = cards.length === 0;
    //     },
    //     error: (error: any) => {
    //       console.error('Error loading saved cards:', error);
    //     }
    //   });
    
    // this.subscriptions.push(subscription);
  }

  selectPaymentMethod(method: 'bank' | 'card') {
    this.paymentMethod = method;
    this.currentStep = method === 'bank' ? 'bank-form' : 'card-form';
    this.clearErrorMessage();
  }

  selectSavedCard(card: SavedCard) {
    this.selectedCardId = card.id;
    this.showCardForm = false;
  }

  showNewCardForm() {
    this.showCardForm = true;
    this.selectedCardId = null;
  }

  formatCardNumber(event: any) {
    let value = event.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    const matches = value.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      event.target.value = parts.join(' ');
      this.cardForm.patchValue({ number: parts.join(' ') });
    } else {
      event.target.value = '';
      this.cardForm.patchValue({ number: '' });
    }
  }

  formatExpiry(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    event.target.value = value;
    this.cardForm.patchValue({ expiry: value });
  }

  isCardPaymentValid(): boolean {
    if (!this.cardPaymentAmount || this.cardPaymentAmount <= 0) {
      return false;
    }

    if (this.isCrossBorderPayment && !this.cardPaymentPurpose) {
      return false;
    }

    if (this.selectedCardId) {
      return true;
    }

    return this.cardForm.valid;
  }

  getPaymentAmount(): number {
    if (this.paymentMethod === 'card') {
      return this.cardPaymentAmount;
    }
    return this.paymentForm.get('amount')?.value || 0;
  }

  getPurpose(): string {
    if (this.paymentMethod === 'card') {
      return this.cardPaymentPurpose;
    }
    return this.paymentData.purpose || '';
  }

  getSelectedCard(): SavedCard | undefined {
    return this.savedCards.find(card => card.id === this.selectedCardId);
  }

  goBack() {
    switch (this.currentStep) {
      case 'country-currency':
        this.currentStep = 'payment-type';
        break;
      case 'method':
        this.currentStep = this.isCrossBorderPayment ? 'country-currency' : 'payment-type';
        break;
      case 'bank-form':
      case 'card-form':
        this.currentStep = 'method';
        break;
      case 'verification':
        this.currentStep = this.paymentMethod === 'bank' ? 'bank-form' : 'card-form';
        break;
      default:
        this.router.navigate(['admin/dashboard']);
        break;
    }
    this.clearErrorMessage();
  }

  proceedToVerification() {
    if (this.paymentForm.valid) {
      this.paymentData = {
        amount: this.paymentForm.value.amount,
        currency: this.isCrossBorderPayment ? this.selectedCurrency : 'USD',
        recipient_name: this.paymentForm.value.recipient_name,
        recipient_address: this.paymentForm.value.recipient_address,
        recipient_account: this.paymentForm.value.recipient_account,
        recipient_bank: this.paymentForm.value.recipient_bank,
        swift_code: this.paymentForm.value.swift_code,
        purpose: this.paymentForm.value.purpose || '',
        purpose_details: this.paymentForm.value.purpose_details || ''
      };
      this.currentStep = 'verification';
      this.clearErrorMessage();
    } else {
      this.markFormGroupTouched();
    }
  }

  proceedToCardVerification() {
    if (this.isCardPaymentValid()) {
      this.currentStep = 'verification';
      this.clearErrorMessage();
    }
  }

  handleVerificationSuccess(verificationData: any) {
    this.clearErrorMessage();
    this.currentStep = 'processing';
    
    if (this.paymentMethod === 'bank') {
      this.processBankPayment(verificationData);
    } else {
      this.processCardPayment(verificationData);
    }
  }

  handleVerificationError(error: any) {
    this.errorMessage = error.message || 'Face verification failed. Please try again.';
  }

  cancelVerification() {
    this.currentStep = this.paymentMethod === 'bank' ? 'bank-form' : 'card-form';
    this.clearErrorMessage();
  }

  private processBankPayment(verificationData: any) {
    const paymentRequest = {
      ...this.paymentData,
      verification_data: verificationData
    };

    const subscription = this.paymentService.processPayment(paymentRequest)
      .subscribe({
        next: (response) => {
          this.transactionId = response.transaction_id ?? '';
          this.currentStep = 'success';
          this.clearErrorMessage();
        },
        error: (error) => {
          this.currentStep = 'verification';
          this.errorMessage = error.error?.message || 'Payment processing failed. Please try again.';
        }
      });

    this.subscriptions.push(subscription);
  }

  private processCardPayment(verificationData: any) {
    const cardPaymentRequest: CardPaymentRequest = {
      amount: this.cardPaymentAmount,
      currency: this.isCrossBorderPayment ? this.selectedCurrency : 'USD',
      purpose: this.cardPaymentPurpose
    };

    if (this.selectedCardId) {
      cardPaymentRequest.card_id = this.selectedCardId;
    } else {
      const [month, year] = this.cardForm.value.expiry.split('/');
      cardPaymentRequest.card_details = {
        number: this.cardForm.value.number.replace(/\s/g, ''),
        expiry_month: parseInt(month),
        expiry_year: parseInt('20' + year),
        cvv: this.cardForm.value.cvv,
        holder_name: this.cardForm.value.holder_name
      };
      cardPaymentRequest.save_card = this.saveCard;
    }

    const subscription = this.paymentService.authorizeCardPaymentWithFace(verificationData, cardPaymentRequest)
      .subscribe({
        next: (response: any) => {
          this.currentStep = response.success === true ? 'success' : 'verification';
          if (response.success === true) {
            this.clearErrorMessage();
            this.transactionId = response.transaction_id ?? '';
            if (this.saveCard && !this.selectedCardId) {
              this.loadSavedCards();
            }
          } else {
            this.errorMessage = response.message || 'Card payment authorization failed. Please try again.';
          }
        },
        error: (error: any) => {
          this.currentStep = 'verification';
          this.errorMessage = error.error?.message || 'Card payment processing failed. Please try again.';
        }
      });

    this.subscriptions.push(subscription);
  }

  goToDashboard() {
    this.router.navigate(['admin/dashboard']);
  }

  makeAnotherPayment() {
    this.resetComponent();
  }

  private resetComponent() {
    this.paymentForm.reset();
    this.cardForm.reset();
    this.currentStep = 'payment-type';
    this.paymentMethod = 'bank';
    this.paymentData = {} as PaymentRequest;
    this.transactionId = '';
    this.selectedCardId = null;
    this.showCardForm = this.savedCards.length === 0;
    this.saveCard = false;
    this.cardPaymentAmount = 0;
    this.cardPaymentPurpose = '';
    this.isCrossBorderPayment = false;
    this.selectedCountry = '';
    this.selectedCurrency = '';
    this.exchangeRate = 0;
    this.convertedAmount = 0;
    this.cardConvertedAmount = 0;
    this.clearErrorMessage();
    this.faceCaptureService.resetSession();
  }

  private markFormGroupTouched() {
    Object.keys(this.paymentForm.controls).forEach(key => {
      this.paymentForm.get(key)?.markAsTouched();
    });
  }

  private clearErrorMessage() {
    this.errorMessage = '';
  }
}