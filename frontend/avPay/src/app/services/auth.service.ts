import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface EmailValidationRequest {
  email: string;
  mode: 'login' | 'register';
}

export interface EmailValidationResponse {
  valid: boolean;
  message: string;
}

export interface FaceAuthRequest {
  images: string[];
  email?: string;
}

export interface FaceRegistrationError {
  type: 'duplicate_face' | 'invalid_face' | 'server_error' | 'validation_error';
  message: string;
  existingEmail?: string; // For duplicate face errors
}

export interface OTPRequest {
  session_id?: string;
  email?: string;
  phone?: string;
  method: 'sms' | 'email';
  purpose?: string;
  transaction_id?: string;
  user_id?: number;
  original_auth_method?: string;
  fallback_reason?: string;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  session_id?: string;
  expiresInMinutes?: number;
  error?: string;
}

export interface OTPVerifyRequest {
  session_id: string;
  otp_code: string;
}

export interface OTPVerifyResponse {
  success: boolean;
  message: string;
  user_id?: number;
  email?: string;
  purpose?: string;
  transactionId?: string;
  remainingAttempts?: number;
  error?: string;
  token?: string;
}

export interface AuthResponse {
  success?: boolean;
  message?: string;
  token?: string;
  email?: string;
  user?: any;
  requiresOTP?: boolean;
  otpSessionId?: string;
  fallbackTriggered?: boolean;
  capturedImages?: string[];
}

export interface UserInfo {
  email: string;
  created_at: string;
  is_active: boolean;
}

export interface User {
  id?: number;
  email: string;
  // Add other user properties as needed
}

export interface UserContactResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/auth'; // Update this to your FastAPI server URL
  private baseUrl = 'http://localhost:8000'; // Update this to your FastAPI server URL
  private tokenKey = 'auth_token';
  private userKey = 'user_info';
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasValidToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<UserInfo | null>(this.getCurrentUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const token = localStorage.getItem('auth_token');
    if (this.hasValidToken() && !this.currentUserSubject.value) {
     this.tokenSubject.next(token);
    this.getCurrentUser().subscribe({
      next: (user) => console.log('User loaded on service init'),
      error: (err) => console.warn('Failed to load user info on init', err)
    });
  }
  }

  private hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }

    // OTP Methods
    requestOTP(request: OTPRequest): Observable<OTPResponse> {
      debugger;
      console.log("OTP Request Payload:", request);  // 👈 add this
      return this.http.post<OTPResponse>(`${this.baseUrl}/otp/request`, request)
        .pipe(
          map(response => {
            console.log('OTP request response:', response);
            return response;
          }),
          catchError(error => {
            console.error('OTP request error:', error);
            return throwError(() => new Error(
              error.error?.detail || error.message || 'Failed to request OTP'
            ));
          })
        );
    }

  validateOTP(request: OTPVerifyRequest): Observable<OTPVerifyResponse> {
    return this.http.post<OTPVerifyResponse>(`${this.baseUrl}/otp/verify`, request)
      .pipe(
        map(response => {
          console.log('OTP verify response:', response);
          
          // If OTP verification successful and includes user data, authenticate
          if (response.success && response.user_id) {
            // Create auth response from OTP verification
            const authResponse: AuthResponse = {
              success: true,
              message: response.message,
              token: response.token,
              user: {
                id: response.user_id,
                email: response.email
              }
            };
            // Set authentication state
            this.setAuthState(authResponse);
          }
          
          return response;
        }),
        catchError(error => {
          console.error('OTP verify error:', error);
          return throwError(() => new Error(
            error.error?.detail || error.message || 'Failed to verify OTP'
          ));
        })
      );
  }

  getUserByContact(contact: string, method: 'email' | 'phone'): Observable<UserContactResponse> {
    return this.http.post<UserContactResponse>(`${this.apiUrl}/auth/get-user-by-contact`, {
      contact,
      method
    });
  }

  // Set authentication state
  private setAuthState(response: AuthResponse) {
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
      this.tokenSubject.next(response.token);
    }
    
    if (response.user) {
      localStorage.setItem('current_user', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
    }
    
    this.isAuthenticatedSubject.next(true);
  }

  resendOTP(sessionId: string): Observable<{success: boolean, message: string}> {
    return this.http.post<{success: boolean, message: string}>(
      `${this.baseUrl}/otp/resend?session_id=${sessionId}`, 
      {}
    ).pipe(
      catchError(error => {
        console.error('Resend OTP error:', error);
        return throwError(() => new Error(
          error.error?.detail || error.message || 'Failed to resend OTP'
        ));
      })
    );
  }

  cancelOTPSession(sessionId: string): Observable<{success: boolean, message: string}> {
    return this.http.delete<{success: boolean, message: string}>(
      `${this.apiUrl}/otp/session/${sessionId}`
    ).pipe(
      catchError(error => {
        console.error('Cancel OTP session error:', error);
        return throwError(() => new Error(
          error.error?.detail || error.message || 'Failed to cancel OTP session'
        ));
      })
    );
  }

  getOTPStatus(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/otp/status/${sessionId}`)
      .pipe(
        catchError(error => {
          console.error('Get OTP status error:', error);
          return throwError(() => new Error(
            error.error?.detail || error.message || 'Failed to get OTP status'
          ));
        })
      );
  }

  private getCurrentUserFromStorage(): UserInfo | null {
    const userStr = localStorage.getItem(this.userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }
    return null;
  }

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });
  }

  

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unexpected error occurred';
    if (error.error) {
      if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.error.detail) {
        errorMessage = error.error.detail;
      } else if (error.error.message) {
        errorMessage = error.error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.error('Auth Service Error:', error);
    return throwError(() => errorMessage);
  }

  // Email validation
  validateEmail(email: string, mode: 'login' | 'register'): Observable<EmailValidationResponse> {
    const request: EmailValidationRequest = { email, mode };
    
    return this.http.post<EmailValidationResponse>(`${this.apiUrl}/auth/validate-email`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Face registration
  registerFace(images: string[], email: string): Observable<AuthResponse> {
    const request: FaceAuthRequest = { images, email };
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request)
      .pipe(
        map(response => {
          if (response.success) {
            console.log('Face registration successful');
            if (response.token) {
              this.setAuthData(response.token, email);
            }
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  // Face authentication with email
  authenticateWithFace(images: string[], email: string): Observable<AuthResponse> {
    const request: FaceAuthRequest = { images, email };
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request)
      .pipe(
        map(response => {
          if (response.success && response.token) {
            this.setAuthData(response.token, response.email || email);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  // Face-only identification (no email required)
  identifyFaceOnly(images: string[]): Observable<AuthResponse> {
    const request: FaceAuthRequest = { images };

    return this.http.post<AuthResponse>(`${this.apiUrl}/identify`, request)
      .pipe(
        map(response => {
          if (response.success && response.token && response.email) {
            this.setAuthData(response.token, response.email);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  // Get current user info
  getCurrentUser(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.apiUrl}/me`, { 
      headers: this.getHeaders() 
    }).pipe(
      map(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem(this.userKey, JSON.stringify(user));
        return user;
      }),
      catchError(this.handleError)
    );
  }

  // Set authentication data
  private setAuthData(token: string, email: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.isAuthenticatedSubject.next(true);
    
    // Fetch and store user info
    this.getCurrentUser().subscribe({
      next: (user) => {
        console.log('User info loaded:', user);
      },
      error: (error) => {
        console.error('Failed to load user info:', error);
        // Still consider authenticated if token is valid
      }
    });
  }

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.hasValidToken();
  }

  // Get current user synchronously
  getCurrentUserSync(): UserInfo | null {
    return this.currentUserSubject.value;
  }

  // Logout
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.isAuthenticatedSubject.next(false);
    this.currentUserSubject.next(null);
  }

  // Refresh token validation
  refreshAuthStatus(): void {
    const isValid = this.hasValidToken();
    this.isAuthenticatedSubject.next(isValid);
    
    if (!isValid) {
      this.logout();
    } else if (isValid && !this.currentUserSubject.value) {
      // Token is valid but no user info, fetch it
      this.getCurrentUser().subscribe({
        error: () => {
          // If we can't get user info, logout
          this.logout();
        }
      });
    }
  }

  private handleFaceRegistrationError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Face registration failed. Please try again.';
    let errorType: FaceRegistrationError['type'] = 'server_error';

    if (error.status === 409) {
      // Duplicate face detected
      errorType = 'duplicate_face';
      errorMessage = error.error?.detail || 
        'This face is already registered with another email address. Please use your existing account.';
    } else if (error.status === 400) {
      // Invalid face data
      errorType = 'invalid_face';
      if (error.error?.detail?.includes('No valid faces detected')) {
        errorMessage = 'No valid faces detected in the images. Please ensure good lighting and face visibility.';
      } else {
        errorMessage = error.error?.detail || 'Invalid face data provided.';
      }
    } else if (error.status === 422) {
      // Validation error
      errorType = 'validation_error';
      errorMessage = 'Please provide valid email and face images.';
    } else if (error.status === 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.status === 0) {
      errorMessage = 'Network error. Please check your connection.';
    }

    console.error('Face registration error:', error);
    return throwError(() => ({
      type: errorType,
      message: errorMessage,
      originalError: error
    } as FaceRegistrationError));
  }
}

 

