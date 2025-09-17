// face-capture.component.ts - FIXED VERSION
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AuthService, AuthResponse } from '../../services/auth.service';

interface CaptureStep {
  angle: string;
  instruction: string;
  icon: string;
  completed: boolean;
}

interface FaceDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

@Component({
  selector: 'app-auth',
  standalone: false,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  @Input() mode: 'login' | 'register' | 'face-only' |'verify' = 'login';
  @Input() email: string = '';

  @Output() onSuccess = new EventEmitter<AuthResponse>();
  @Output() onError = new EventEmitter<string>();
  @Output() onCancel = new EventEmitter<void>();

  // Streaming and capture states
  isStreaming = false;
  isCapturing = false;
  isProcessing = false;
  processingMessage = 'Processing face data...';
  errorMessage = '';
  successMessage = '';

  // Face detection
  faceDetected = false;
  faceInCircle = false;
  faceConfidence = 0;
  facePosition = { x: 0, y: 0 }; // Actual detected face center
  faceGuidePosition = { x: 0, y: 0 }; // Guide circle position (center of video)

  // Auto capture - FIXED
  autoCapture = true;
  autoCaptuteCountdown = 0;
  autoCaptureDelay = 3000; // 3 seconds
  private autoCaptureTimeout: any;
  private faceDetectionInterval: any;
  private lastStableFaceTime = 0;
  private faceStabilityDuration = 2000; // 2 seconds of stable face detection
  readyToCapture = false;
  private resizeObserver: ResizeObserver | null = null;

  // Progress tracking
  currentStepIndex = 0;
  completedSteps = 0;
  capturedImages: string[] = [];
  minRequiredCaptures = 3;

  showInstruction = true;
  showSettingsPopup = false;
  private instructionTimeout: any;

  // Face detection parameters
  private readonly FACE_CIRCLE_RADIUS = 100; // pixels
  private readonly FACE_ALIGNMENT_THRESHOLD = 80; // pixels - how close face center must be to circle center

  captureSteps: CaptureStep[] = [
    {
      angle: 'Center',
      instruction: 'Look straight at the camera',
      icon: '<svg fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>',
      completed: false
    },
    {
      angle: 'Left Turn',
      instruction: 'Turn your head slightly to the left',
      icon: '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>',
      completed: false
    },
    {
      angle: 'Right Turn',
      instruction: 'Turn your head slightly to the right',
      icon: '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>',
      completed: false
    },
    {
      angle: 'Tilt Up',
      instruction: 'Tilt your head slightly upward',
      icon: '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>',
      completed: false
    },
    {
      angle: 'Tilt Down',
      instruction: 'Tilt your head slightly downward',
      icon: '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>',
      completed: false
    }
  ];

  private stream: MediaStream | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // For non-registration modes, reduce required captures
    if (this.mode !== 'register') {
      this.minRequiredCaptures = 1;
    }
  }

  // When face authentication fails:
  private handleFaceAuthFailure(error: any) {``
    console.error('Face authentication failed:', error);
    // Emit the error to parent component (HomeComponent)
    this.onError.emit(error);
  }

  private onCameraError() {
    this.handleFaceAuthFailure({
      code: 'CAMERA_ACCESS_DENIED',
      message: 'Camera access denied'
    });
  }

  // 2. Face recognition timeout
  private onRecognitionTimeout() {
    this.handleFaceAuthFailure({
      code: 'FACE_RECOGNITION_TIMEOUT', 
      message: 'Face recognition timed out'
    });
  }

  // 3. Biometric verification failed
  private onBiometricFailed() {
    this.handleFaceAuthFailure({
      code: 'BIOMETRIC_FAILED',
      message: 'Face verification failed'
    });
  }

  // FIXED: Auto capture toggle
  onAutoCaptureToogle() {
    this.cancelAutoCapture();
    this.clearMessages();
    
    if (this.autoCapture) {
      this.showSuccess('Auto capture enabled. Position your face in the green circle.');
       this.showInstructionForCurrentStep();
    } else {
      this.showSuccess('Auto capture disabled. Use the capture button to take photos.');
       this.showInstructionForCurrentStep();
    }
    
    // Reset face stability tracking
    this.lastStableFaceTime = 0;
    this.readyToCapture = false;
    this.autoCaptuteCountdown = 0;
  }

  ngAfterViewInit() {
    this.initializeCamera();
    this.setupResizeObserver();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  // FIXED: Setup resize observer to handle video dimension changes
  private setupResizeObserver() {
    if (this.videoElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateFaceGuidePosition();
      });
      this.resizeObserver.observe(this.videoElement.nativeElement);
    }
  }

  // Helper method for step styling (used in template)
  getStepClasses(step: CaptureStep, index: number): string {
    let classes = '';
    
    if (step.completed) {
      classes += 'bg-green-50 border-green-200 text-green-800';
    } else if (index === this.currentStepIndex) {
      classes += 'bg-blue-50 border-blue-200 text-blue-800 ring-2 ring-blue-300';
    } else {
      classes += 'bg-gray-50 border-gray-200 text-gray-600';
    }
    
    return classes;
  }

  private cleanup() {
     // Clear intervals and timeouts
  if (this.faceDetectionInterval) {
    clearInterval(this.faceDetectionInterval);
  }
  this.cancelAutoCapture();

  // Clear instruction timeout
  if (this.instructionTimeout) {
    clearTimeout(this.instructionTimeout);
    this.instructionTimeout = null;
  }

  // Clean up resize observer
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
    this.resizeObserver = null;
  }

  // Stop camera stream
  if (this.stream) {
    this.stream.getTracks().forEach(track => track.stop());
  }

  this.clearMessages();
  
  // Reset UI state
  this.showInstruction = false;
  this.showSettingsPopup = false;
  }

  async initializeCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        this.videoElement.nativeElement.onloadedmetadata = () => {
          this.isStreaming = true;
          this.updateFaceGuidePosition();
          this.startFaceDetection();

           this.initializeInstructions();
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.showError('Could not access camera. Please ensure camera permissions are granted.');
    }
  }

  // FIXED: Update face guide position dynamically
  private updateFaceGuidePosition() {
    if (this.videoElement && this.isStreaming) {
      const videoRect = this.videoElement.nativeElement.getBoundingClientRect();
      this.faceGuidePosition = {
        x: videoRect.width / 2,
        y: videoRect.height / 2
      };
    }
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
    this.onError.emit(message);
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
  }

  private clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private startFaceDetection() {
    this.faceDetectionInterval = setInterval(() => {
      this.detectFace();
    }, 100);
  }

  // FIXED: Improved face detection and auto-capture logic
  private async detectFace() {
    if (!this.isStreaming || !this.videoElement) return;

    try {
      const video = this.videoElement.nativeElement;
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');

      if (!ctx || !video.videoWidth || !video.videoHeight) return;

      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const faceDetection = this.simulateFaceDetection(tempCanvas);

      if (faceDetection) {
        this.faceDetected = true;
        this.faceConfidence = faceDetection.confidence;

        // Convert face position to screen coordinates
        const videoRect = video.getBoundingClientRect();
        this.facePosition = {
          x: (faceDetection.x + faceDetection.width / 2) / video.videoWidth * videoRect.width,
          y: (faceDetection.y + faceDetection.height / 2) / video.videoHeight * videoRect.height
        };

        // Check if face is within the guide circle
        this.checkFaceAlignment();

        // FIXED: Auto capture logic
        if (this.autoCapture && !this.getCurrentStep()?.completed && this.faceInCircle && !this.isCapturing && !this.isProcessing) {
          const now = Date.now();
          
          // Initialize stable face timer
          if (this.lastStableFaceTime === 0) {
            this.lastStableFaceTime = now;
          }

          const stableDuration = now - this.lastStableFaceTime;
          
          // Check if face has been stable long enough
          if (stableDuration >= this.faceStabilityDuration) {
            this.readyToCapture = true;
            
            // Only trigger auto capture if not already in progress
            if (!this.autoCaptureTimeout) {
              this.triggerAutoCapture();
            }
          }
        } else {
          // Reset auto capture if conditions not met
          if (!this.faceInCircle || this.isCapturing || this.isProcessing || this.getCurrentStep()?.completed) {
            this.resetAutoCapture();
          }
        }
      } else {
        // No face detected
        this.faceDetected = false;
        this.faceInCircle = false;
        this.faceConfidence = 0;
        this.resetAutoCapture();
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  }

  // FIXED: Reset auto capture state
  private resetAutoCapture() {
    this.lastStableFaceTime = 0;
    this.readyToCapture = false;
    this.cancelAutoCapture();
  }

  private checkFaceAlignment() {
    if (!this.faceDetected) {
      this.faceInCircle = false;
      return;
    }

    // Calculate distance between face center and guide circle center
    const distance = Math.sqrt(
      Math.pow(this.facePosition.x - this.faceGuidePosition.x, 2) +
      Math.pow(this.facePosition.y - this.faceGuidePosition.y, 2)
    );

    // Face is considered "in circle" if its center is within the threshold distance
    this.faceInCircle = distance <= this.FACE_ALIGNMENT_THRESHOLD;
  }

  private simulateFaceDetection(canvas: HTMLCanvasElement): FaceDetection | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const sampleSize = 50;

      let brightness = 0;
      let samples = 0;

      for (let y = centerY - sampleSize; y < centerY + sampleSize; y += 5) {
        for (let x = centerX - sampleSize; x < centerX + sampleSize; x += 5) {
          if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const index = (y * canvas.width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            brightness += (r + g + b) / 3;
            samples++;
          }
        }
      }

      const avgBrightness = brightness / samples;

      if (avgBrightness > 50 && avgBrightness < 200) {
        return {
          x: centerX - 75,
          y: centerY - 75,
          width: 150,
          height: 150,
          confidence: Math.min(0.9, avgBrightness / 200)
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  getCurrentStep(): CaptureStep | undefined {
  return this.captureSteps[this.currentStepIndex];
}

  // Cancel method
  cancel(): void {
    this.cleanup();
    this.onCancel.emit();
  }

  get canCapture(): boolean {
    // Basic conditions for capturing
    const basicConditions = this.isStreaming &&
                          !this.isCapturing &&
                          !this.isProcessing
    // Ensure face is detected and aligned if auto capture is enabled
    if (this.autoCapture) {
      if (!this.faceDetected || !this.faceInCircle) {
        return false;
      }
    }

    if (!basicConditions) {
      return false;
    }

    return true;
  }

  // Manual capture method (called by button click)
  async captureCurrentAngle(): Promise<void> {
    this.cancelAutoCapture(); // Cancel any pending auto capture
    await this.performCapture();
  }



  // Method to actually perform the capture (called by both auto and manual capture)
  async performCapture(): Promise<void> {
    if (!this.canCapture) {
      return;
    }

    this.isCapturing = true;
    this.clearMessages();
    // Hide instruction during capture
  this.hideInstruction();


    try {
      const imageDataUrl = this.captureImageFromVideo();
      if (imageDataUrl) {
        this.capturedImages.push(imageDataUrl);

        // Mark current step as completed
        const currentStep = this.getCurrentStep();
        if (currentStep) {
          currentStep.completed = true;
          this.completedSteps++;
        }

        // Move to next step
        this.moveToNextStep();

        this.showSuccess(`${currentStep?.angle} captured successfully!`);

        if (this.allStepsCompleted) {
        this.showSuccess('All angles captured! You can now submit for authentication.');
      }
        
      } else {
        this.showError('Failed to capture image. Please try again.');
        this.showInstructionForCurrentStep();
      }
    } catch (error) {
      console.error('Capture error:', error);
      this.showError('An error occurred during capture. Please try again.');
    } finally {
      this.isCapturing = false;
      this.lastStableFaceTime = 0;
      this.readyToCapture = false;
    }
  }

  // Method to capture image from video stream
  private captureImageFromVideo(): string | null {
    if (!this.videoElement || !this.canvasElement) {
      return null;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || !video.videoWidth || !video.videoHeight) {
      return null;
    }



    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas (flip horizontally to match preview)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // Return base64 encoded image
    return canvas.toDataURL('image/jpeg', 0.8);
  }


  // Method to move to the next uncompleted step
  private moveToNextStep(): void {
    // Find next uncompleted step
    for (let i = 0; i < this.captureSteps.length; i++) {
      if (!this.captureSteps[i].completed) {
        this.currentStepIndex = i;
          // Show instruction for the new step
        this.showInstructionForCurrentStep();
        return;
      }
    }

    // If all steps are completed, stay at the last step
  this.currentStepIndex = this.captureSteps.length - 1;
   
  this.showInstruction = false;
  }

// Add the missing getter
  get allStepsCompleted(): boolean {
    return this.completedSteps >= this.captureSteps.length;
  }

  private triggerAutoCapture() {
    if (this.autoCaptureTimeout || this.isCapturing || this.getCurrentStep()?.completed || !this.canCapture) {
      return;
    }

    this.autoCaptureTimeout = setTimeout(async () => {
      if (!this.canCapture) {
        this.autoCaptureTimeout = null;
        return;
      }

      for (let i = 3; i > 0; i--) {
        if (!this.canCapture) {
          this.autoCaptuteCountdown = 0;
          this.autoCaptureTimeout = null;
          return;
        }

        this.autoCaptuteCountdown = i;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.autoCaptuteCountdown = 0;

      if (this.canCapture) {
        await this.performCapture();
      }

      this.autoCaptureTimeout = null;
    }, 1000);
  }

  private cancelAutoCapture() {
    if (this.autoCaptureTimeout) {
      clearTimeout(this.autoCaptureTimeout);
      this.autoCaptureTimeout = null;
    }
    // this.autoCaptureCountdown = 0;
    this.readyToCapture = false;
  }

  // async submitCaptures() {
  //   if (this.capturedImages.length < this.minRequiredCaptures) {
  //     this.showError(`Please capture at least ${this.minRequiredCaptures} images before proceeding.`);
  //     return;
  //   }
  //   this.isProcessing = true;
  //   this.clearMessages();
  //   try {
  //     debugger;
  //     let response: AuthResponse | undefined;
  //     switch (this.mode) {
  //       case 'register':
  //         this.processingMessage = 'Checking for existing face profiles...';
  //         response = await this.authService.registerFace(this.capturedImages, this.email).toPromise();
  //         this.showSuccess('Face registration completed successfully!');
  //         break;

  //       case 'login':
  //         this.processingMessage = 'Verifying your identity...';
  //         response = await this.authService.authenticateWithFace(this.capturedImages, this.email).toPromise();
  //         this.showSuccess('Authentication successful!');
  //         break;

  //       case 'face-only':
  //         this.processingMessage = 'Performing face recognition...';
  //         response = await this.authService.identifyFaceOnly(this.capturedImages).toPromise();
  //         this.showSuccess('Face recognition completed!');
  //         break;

  //       default:
  //         throw new Error('Invalid authentication mode');
  //     }

  //     // Emit success event with response
  //     this.onSuccess.emit(response);

  //     // Optional: Auto-close after success (with delay to show success message)
  //     setTimeout(() => {
  //       this.clearMessages();
  //     }, 2000);

  //   } catch (error: any) {
  //     console.error('Face authentication error:', error);

  //     // Handle different types of errors
  //     let errorMessage = 'Authentication failed. Please try again.';

  //     // Handle structured errors from the enhanced auth service
  //     if (error?.type) {
  //       switch (error.type) {
  //         case 'duplicate_face':
  //           errorMessage = 'This face is already registered with another email address. ' +
  //                         'Each person can only register once. Please use your existing account or contact support.';
  //           break;
  //         case 'invalid_face':
  //           errorMessage = error.message || 'No valid faces detected. Please ensure good lighting and face visibility.';
  //           break;
  //         case 'validation_error':
  //           errorMessage = 'Please provide valid email and face images.';
  //           break;
  //         case 'server_error':
  //           errorMessage = 'Server error occurred. Please try again later.';
  //           break;
  //         default:
  //           errorMessage = error.message || errorMessage;
  //       }
  //     } else if (typeof error === 'string') {
  //       errorMessage = error;
  //     } else if (error?.message) {
  //       errorMessage = error.message;
  //     } else if (error?.error) {
  //       // Fallback for HTTP error responses
  //       if (typeof error.error === 'string') {
  //         errorMessage = error.error;
  //       } else if (error.error.detail) {
  //         errorMessage = error.error.detail;
  //       } else if (error.error.message) {
  //         errorMessage = error.error.message;
  //       }
  //     }

  //     // Add specific error context for non-structured errors
  //     if (!error?.type) {
  //       if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
  //         errorMessage = 'Face verification failed. Please ensure good lighting and try again.';
  //       } else if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
  //         errorMessage = 'Invalid face data. Please recapture your images.';
  //       } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
  //         errorMessage = 'Face profile not found. Please register first.';
  //       } else if (errorMessage.includes('409') || errorMessage.includes('conflict')) {
  //         errorMessage = 'This face is already registered with another email address. Please use your existing account.';
  //       } else if (errorMessage.includes('500') || errorMessage.includes('server')) {
  //         errorMessage = 'Server error. Please try again later.';
  //       }
  //     }

  //     this.showError(errorMessage);

  //     // Emit error event
  //     this.onError.emit(errorMessage);
  //     this.handleFaceAuthFailure(error);

  //   } finally {
  //     this.isProcessing = false;
  //     this.processingMessage = 'Processing face data...';
  //   }
  // }

  async submitCaptures() {
    debugger;
  if (this.capturedImages.length < this.minRequiredCaptures) {
    this.showError(`Please capture at least ${this.minRequiredCaptures} images before proceeding.`);
    return;
  }
  
  this.isProcessing = true;
  this.clearMessages();
  
  try {
    let response: AuthResponse | undefined;
    
    switch (this.mode) {
      case 'register':
        this.processingMessage = 'Checking for existing face profiles...';
        response = await this.authService.registerFace(this.capturedImages, this.email).toPromise();
        this.showSuccess('Face registration completed successfully!');
        break;

      case 'login':
      case 'verify':
        this.processingMessage = 'Verifying your identity...';
        response = await this.authService.authenticateWithFace(this.capturedImages, this.email).toPromise();
        this.showSuccess('Authentication successful!');
        break;

      case 'face-only':
        this.processingMessage = 'Performing face recognition...';
        response = await this.authService.identifyFaceOnly(this.capturedImages).toPromise();
        this.showSuccess('Face recognition completed!');
        break;

      default:
        throw new Error('Invalid authentication mode');
    }

    // Check if response indicates failure even when no exception was thrown
    if (response && !response.success) {
      // Handle API response that indicates failure
      this.handleAuthResponseFailure(response);
      return;
    }
    
    const successResponse = {
      ...response,
      capturedImages: this.capturedImages, // Add the captured images array
    };


    // Emit success event with response
    this.onSuccess.emit(successResponse);

    // Optional: Auto-close after success (with delay to show success message)
    setTimeout(() => {
      this.clearMessages();
    }, 2000);

  } catch (error: any) {
    console.error('Face authentication error:', error);
    this.handleFaceAuthenticationError(error);
  } finally {
    this.isProcessing = false;
    this.processingMessage = 'Processing face data...';
  }
}

// Handle API responses that indicate failure but don't throw exceptions
private handleAuthResponseFailure(response: AuthResponse) {
  // Create structured error object from API response
  const structuredError = {
    code: response.message || this.mapMessageToCode(response.message??''),
    message: response.message,
    requiresFallback: response.fallbackTriggered || false,
    apiResponse: true
  };

  this.showError(structuredError.message??'');
  // this.onError.emit(structuredError);
  this.handleFaceAuthFailure(structuredError);
}

// Main error handling method
private handleFaceAuthenticationError(error: any) {
  // Create structured error object
  const structuredError = this.createStructuredError(error);
  
  // Show user-friendly error message
  this.showError(structuredError.message);
  
  // Emit structured error to parent component
  this.onError.emit(structuredError);
  
  // Handle the failure
  this.handleFaceAuthFailure(structuredError);
}

// Create structured error object from various error formats
private createStructuredError(error: any): any {
  // If it's already a structured error with code, pass it through
  if (error?.code) {
    return {
      ...error,
      message: error.message || 'Authentication failed'
    };
  }

  let errorCode = 'UNKNOWN_ERROR';
  let errorMessage = 'Authentication failed. Please try again.';
  let requiresFallback = false;

  // Handle different types of errors and map to codes
  if (error?.type) {
    // Handle structured errors from enhanced auth service
    switch (error.type) {
      case 'duplicate_face':
        errorCode = 'DUPLICATE_FACE_REGISTRATION';
        errorMessage = 'This face is already registered with another email address. Each person can only register once.';
        requiresFallback = false; // Registration error, don't trigger fallback
        break;
      case 'invalid_face':
        errorCode = 'FACE_DETECTION_FAILED';
        errorMessage = 'No valid faces detected. Please ensure good lighting and face visibility.';
        requiresFallback = true;
        break;
      case 'validation_error':
        errorCode = 'VALIDATION_ERROR';
        errorMessage = 'Please provide valid email and face images.';
        requiresFallback = false;
        break;
      case 'server_error':
        errorCode = 'SYSTEM_ERROR';
        errorMessage = 'Server error occurred. Please try again later.';
        requiresFallback = true;
        break;
      default:
        errorMessage = error.message || errorMessage;
        errorCode = 'UNKNOWN_ERROR';
        requiresFallback = true;
    }
  } else {
    // Handle HTTP errors and other error formats
    const errorString = this.extractErrorMessage(error);
    
    if (errorString.includes('401') || errorString.includes('unauthorized')) {
      errorCode = 'BIOMETRIC_FAILED';
      errorMessage = 'Face verification failed. Please ensure good lighting and try again.';
      requiresFallback = true;
    } else if (errorString.includes('400') || errorString.includes('bad request')) {
      errorCode = 'INVALID_REQUEST';
      errorMessage = 'Invalid face data. Please recapture your images.';
      requiresFallback = false;
    } else if (errorString.includes('404') || errorString.includes('not found')) {
      errorCode = 'FACE_NOT_REGISTERED';
      errorMessage = 'Face profile not found. Please register first.';
      requiresFallback = false;
    } else if (errorString.includes('409') || errorString.includes('conflict')) {
      errorCode = 'DUPLICATE_FACE_REGISTRATION';
      errorMessage = 'This face is already registered with another email address.';
      requiresFallback = false;
    } else if (errorString.includes('500') || errorString.includes('server')) {
      errorCode = 'SYSTEM_ERROR';
      errorMessage = 'Server error. Please try again later.';
      requiresFallback = true;
    } else if (errorString.includes('network') || errorString.includes('timeout')) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'Network connection issue. Please check your internet and try again.';
      requiresFallback = true;
    } else {
      errorCode = 'UNKNOWN_ERROR';
      errorMessage = errorString || errorMessage;
      requiresFallback = true;
    }
  }

  return {
    code: errorCode,
    message: errorMessage,
    requiresFallback: requiresFallback,
    originalError: error,
    timestamp: new Date().toISOString()
  };
}

// Extract error message from various error formats
private extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  } else if (error?.message) {
    return error.message;
  } else if (error?.error) {
    if (typeof error.error === 'string') {
      return error.error;
    } else if (error.error.detail) {
      return error.error.detail;
    } else if (error.error.message) {
      return error.error.message;
    }
  }
  return 'Unknown error occurred';
}

// Map error messages to codes (for API responses without codes)
private mapMessageToCode(message: string): string {
  const messageLower = message.toLowerCase();
  
  if (messageLower.includes('not recognized') || messageLower.includes('biometric')) {
    return 'BIOMETRIC_FAILED';
  } else if (messageLower.includes('detect') || messageLower.includes('face')) {
    return 'FACE_DETECTION_FAILED';
  } else if (messageLower.includes('system') || messageLower.includes('error')) {
    return 'SYSTEM_ERROR';
  } else if (messageLower.includes('network') || messageLower.includes('connection')) {
    return 'NETWORK_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

  
 

/**
 * Toggle the settings popup visibility
 */
toggleSettings(): void {
  this.showSettingsPopup = !this.showSettingsPopup;
  
  // If opening settings, pause any ongoing auto capture
  if (this.showSettingsPopup) {
    this.cancelAutoCapture();
  }
}

/**
 * Hide the settings popup
 */
hideSettings(): void {
  this.showSettingsPopup = false;
}

/**
 * Hide the instruction popup
 */
hideInstruction(): void {
  this.showInstruction = false;
  
  // Clear any existing timeout
  if (this.instructionTimeout) {
    clearTimeout(this.instructionTimeout);
    this.instructionTimeout = null;
  }
}

/**
 * Initialize instructions when camera starts
 */
private initializeInstructions(): void {
  // Show instruction for the first step
  setTimeout(() => {
    this.showInstructionForCurrentStep();
  }, 1000); // Small delay after camera starts
}

/**
 * Show instruction popup for current step
 */
private showInstructionForCurrentStep(): void {
  const currentStep = this.getCurrentStep();
  
  if (currentStep && !currentStep.completed) {
    this.showInstruction = true;
    
    // Auto-hide instruction after 5 seconds
    this.instructionTimeout = setTimeout(() => {
      this.showInstruction = false;
      this.instructionTimeout = null;
    }, 5000);
  }
}

/**
 * Clear error message
 */
clearError(): void {
  this.errorMessage = '';
}

/**
 * Clear success message
 */
clearSuccess(): void {
  this.successMessage = '';
}

}