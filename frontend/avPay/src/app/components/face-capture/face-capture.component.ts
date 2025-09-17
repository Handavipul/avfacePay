import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { FaceCaptureService, CaptureSession } from '../../services/face-capture.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-face-capture',
  standalone: false,
  template: `
    <div class="space-y-6">
      <!-- Instructions -->
      <div class="text-center">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          {{ getInstructionTitle() }}
        </h3>
        <p class="text-gray-600 text-sm mb-4">
          {{ getInstructionText() }}
        </p>
        <div *ngIf="captureSession" class="flex justify-center space-x-2 mb-4">
          <div 
            *ngFor="let angle of captureSession.requiredAngles" 
            class="w-3 h-3 rounded-full"
            [class.bg-green-500]="captureSession.capturedImages[angle]"
            [class.bg-blue-500]="captureSession.currentAngle === angle && !captureSession.capturedImages[angle]"
            [class.bg-gray-300]="captureSession.currentAngle !== angle && !captureSession.capturedImages[angle]"
          ></div>
        </div>
      </div>

      <!-- Camera View -->
      <div class="relative bg-black rounded-xl overflow-hidden" style="aspect-ratio: 4/3;">
        <video 
          #videoElement
          autoplay 
          muted 
          playsinline
          class="w-full h-full object-cover"
          [class.hidden]="!cameraActive"
        ></video>
        
        <!-- Camera Placeholder -->
        <div *ngIf="!cameraActive" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center text-white">
            <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p class="text-sm opacity-75">Camera initializing...</p>
          </div>
        </div>

        <!-- Face Outline Guide -->
        <div *ngIf="cameraActive" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-48 h-60 border-2 border-white border-dashed rounded-full opacity-50"></div>
        </div>

        <!-- Current Angle Indicator -->
        <div *ngIf="captureSession && cameraActive" class="absolute top-4 left-4 right-4">
          <div class="bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-center">
            <span class="text-sm font-medium">
              {{ getAngleInstruction(captureSession.currentAngle) }}
            </span>
          </div>
        </div>

        <!-- Quality Indicator -->
        <div *ngIf="imageQuality > 0" class="absolute top-4 right-4">
          <div class="bg-black bg-opacity-50 text-white px-2 py-1 rounded-lg text-xs">
            Quality: {{ (imageQuality * 100) | number:'1.0-0' }}%
          </div>
        </div>

        <!-- Auto-capture countdown -->
        <div *ngIf="countdownTimer > 0" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div class="text-white text-6xl font-bold">
            {{ countdownTimer }}
          </div>
        </div>

        <!-- Processing overlay -->
        <div *ngIf="processing" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div class="text-center text-white">
            <svg class="animate-spin w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm">Processing images...</p>
          </div>
        </div>
      </div>

      <!-- Capture Controls -->
      <div class="flex justify-center space-x-4">
        <button 
          (click)="onCancel.emit()"
          class="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
          [disabled]="processing"
        >
          Cancel
        </button>
        
        <button 
          *ngIf="!autoCapture"
          (click)="startAutoCapture()"
          [disabled]="!cameraActive || processing"
          class="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M12 5v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Start Auto Capture</span>
        </button>

        <button 
          *ngIf="autoCapture && !processing"
          (click)="stopAutoCapture()"
          class="px-8 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9l6 6m0-6L9 15"/>
          </svg>
          <span>Stop Auto Capture</span>
        </button>
      </div>

      <!-- Captured Images Preview -->
      <div *ngIf="captureSession && Object.keys(captureSession.capturedImages).length > 0" class="grid grid-cols-3 gap-2">
        <div *ngFor="let angle of captureSession.requiredAngles" class="aspect-square">
          <div *ngIf="captureSession.capturedImages[angle]; else placeholder" 
               class="w-full h-full rounded-lg overflow-hidden border-2 border-green-300">
            <img [src]="captureSession.capturedImages[angle]" 
                 class="w-full h-full object-cover" 
                 [alt]="angle + ' view'">
          </div>
          <ng-template #placeholder>
            <div class="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
              <span class="text-xs text-gray-500 capitalize">{{ angle }}</span>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `
})
export class FaceCaptureComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @Input() mode!: 'login' | 'register' | 'face-only';
  @Output() onSuccess = new EventEmitter<string[]>();
  @Output() onError = new EventEmitter<string>();
  @Output() onCancel = new EventEmitter<void>();
  @Input() email!: string;
  public readonly Object = Object;

  captureSession: CaptureSession | null = null;
  cameraActive = false;
  capturing = false;
  processing = false;
  imageQuality = 0;
  autoCapture = false;
  countdownTimer = 0;
  
  private subscriptions: Subscription[] = [];
  private stream: MediaStream | null = null;
  private captureInterval: any = null;
  private countdownInterval: any = null;
  private faceDetectionInterval: any = null;

  // Auto-capture configuration
  private readonly CAPTURE_DELAY = 3000; // 3 seconds countdown
  private readonly QUALITY_THRESHOLD = 0.6;
  private readonly AUTO_CAPTURE_INTERVAL = 1000; // Check every second

  constructor(private faceCaptureService: FaceCaptureService) {}

  async ngOnInit() {
    try {
      await this.initializeCapture();
    } catch (error) {
      this.onError.emit('Failed to initialize camera');
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.faceCaptureService.resetSession();
    this.stopAutoCapture();
  }

  private async initializeCapture() {
    try {
      // Start capture session
      await this.faceCaptureService.startCaptureSession();
      
      // Subscribe to session updates
      const sessionSub = this.faceCaptureService.captureSession$.subscribe(session => {
        this.captureSession = session;
        
        // Auto-process when all angles are captured
        if (session?.isComplete && this.autoCapture) {
          this.processCapturedImages();
        }
      });
      this.subscriptions.push(sessionSub);

      // Initialize camera
      this.stream = await this.faceCaptureService.initializeCamera();
      this.videoElement.nativeElement.srcObject = this.stream;
      this.cameraActive = true;

    } catch (error) {
      this.onError.emit('Failed to access camera. Please check permissions.');
    }
  }

  startAutoCapture() {
    this.autoCapture = true;
    this.startFaceDetection();
  }

  stopAutoCapture() {
    this.autoCapture = false;
    this.clearAllIntervals();
  }

  private startFaceDetection() {
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
    }

    this.faceDetectionInterval = setInterval(() => {
      if (!this.autoCapture || !this.captureSession || this.capturing || this.processing) {
        return;
      }

      this.checkForFaceAndCapture();
    }, this.AUTO_CAPTURE_INTERVAL);
  }

  private async checkForFaceAndCapture() {
    if (!this.captureSession || this.capturing || this.countdownTimer > 0) return;

    try {
      // Check if face is properly positioned and quality is good
      const imageData = this.faceCaptureService.captureImage(
        this.videoElement.nativeElement, 
        this.captureSession.currentAngle
      );

      this.imageQuality = await this.faceCaptureService.assessImageQuality(imageData);

      if (this.imageQuality >= this.QUALITY_THRESHOLD) {
        this.startCaptureCountdown();
      }
    } catch (error) {
      // Continue checking for face
    }
  }

  private startCaptureCountdown() {
    this.countdownTimer = Math.ceil(this.CAPTURE_DELAY / 1000);
    
    this.countdownInterval = setInterval(() => {
      this.countdownTimer--;
      
      if (this.countdownTimer <= 0) {
        clearInterval(this.countdownInterval);
        this.performAutoCapture();
      }
    }, 1000);
  }

  private async performAutoCapture() {
    if (!this.captureSession || this.capturing) return;

    this.capturing = true;
    
    try {
      const imageData = this.faceCaptureService.captureImage(
        this.videoElement.nativeElement, 
        this.captureSession.currentAngle
      );

      // Double-check quality before final capture
      this.imageQuality = await this.faceCaptureService.assessImageQuality(imageData);

      if (this.imageQuality < this.QUALITY_THRESHOLD) {
        // Continue auto-capture process
        this.capturing = false;
        return;
      }

      // Image captured successfully, continue with next angle if needed
      // The session subscription will handle auto-processing when complete

    } catch (error) {
      this.onError.emit('Failed to capture image');
    }
    
    this.capturing = false;
  }

  async processCapturedImages() {
    if (!this.captureSession?.isComplete) return;

    this.processing = true;
    this.stopAutoCapture(); // Stop auto-capture during processing
    
    try {
      const images = this.faceCaptureService.getCapturedImages();
      this.onSuccess.emit(images);
    } catch (error) {
      this.onError.emit('Failed to process captured images');
      this.processing = false;
    }
  }

  private clearAllIntervals() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = null;
    }
    this.countdownTimer = 0;
  }

  getInstructionTitle(): string {
    if (this.mode === 'register') {
      return 'Register Your Face';
    }
    return 'Face Authentication';
  }

  getInstructionText(): string {
    if (!this.captureSession) {
      return 'Initializing camera...';
    }
    
    if (this.processing) {
      return 'Processing captured images...';
    }
    
    if (this.captureSession.isComplete) {
      return 'All angles captured successfully! Processing automatically...';
    }

    if (this.autoCapture) {
      const remaining = this.captureSession.requiredAngles.length - Object.keys(this.captureSession.capturedImages).length;
      return `Auto-capture active. Position your face for ${remaining} more angle${remaining !== 1 ? 's' : ''}. Hold still when countdown appears.`;
    }

    const remaining = this.captureSession.requiredAngles.length - Object.keys(this.captureSession.capturedImages).length;
    return `Click "Start Auto Capture" to automatically capture ${remaining} angle${remaining !== 1 ? 's' : ''}.`;
  }

  getAngleInstruction(angle: string): string {
    switch (angle) {
      case 'front': return 'Look straight ahead';
      case 'left': return 'Turn your head left';
      case 'right': return 'Turn your head right';
      default: return 'Position your face';
    }
  }
}