import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';

export interface CaptureSession {
  id: string;
  requiredAngles: string[];
  capturedImages: { [angle: string]: string };
  currentAngle: string;
  isComplete: boolean;
  quality: number;
}

export interface FaceDetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class FaceCaptureService {
  private captureSessionSubject = new BehaviorSubject<CaptureSession | null>(null);
  public captureSession$ = this.captureSessionSubject.asObservable();

  private readonly requiredAngles = ['front', 'left', 'right'];
  private stream: MediaStream | null = null;

  constructor() {}

  async startCaptureSession(): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: CaptureSession = {
      id: sessionId,
      requiredAngles: [...this.requiredAngles],
      capturedImages: {},
      currentAngle: this.requiredAngles[0],
      isComplete: false,
      quality: 0
    };

    this.captureSessionSubject.next(session);
    return sessionId;
  }

  async initializeCamera(): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      return this.stream;
    } catch (error) {
      throw new Error('Unable to access camera');
    }
  }

  // Face detection method
  async detectFace(canvas: HTMLCanvasElement): Promise<FaceDetectionResult | null> {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Simple face detection using brightness and edge detection
      // This is a basic implementation - in production, you'd use a proper face detection library
      const faceRegion = this.findFaceRegion(imageData);
      
      if (faceRegion) {
        return {
          x: faceRegion.x,
          y: faceRegion.y,
          width: faceRegion.width,
          height: faceRegion.height,
          confidence: faceRegion.confidence
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Face detection failed:', error);
      return null;
    }
  }

  private findFaceRegion(imageData: ImageData): FaceDetectionResult | null {
    const { width, height, data } = imageData;
    
    // Convert to grayscale and find potential face regions
    const grayData = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      grayData[i / 4] = gray;
    }
    
    // Look for face-like patterns in the center region
    const centerX = width / 2;
    const centerY = height / 2;
    const searchRadius = Math.min(width, height) / 4;
    
    // Find the region with highest contrast (likely to contain a face)
    let bestRegion: FaceDetectionResult | null = null;
    let maxContrast = 0;
    
    for (let y = centerY - searchRadius; y < centerY + searchRadius; y += 10) {
      for (let x = centerX - searchRadius; x < centerX + searchRadius; x += 10) {
        if (x < 0 || y < 0 || x >= width - 60 || y >= height - 80) continue;
        
        const regionWidth = 60;
        const regionHeight = 80;
        const contrast = this.calculateRegionContrast(grayData, width, x, y, regionWidth, regionHeight);
        
        if (contrast > maxContrast) {
          maxContrast = contrast;
          bestRegion = {
            x,
            y,
            width: regionWidth,
            height: regionHeight,
            confidence: Math.min(contrast / 50, 1.0) // Normalize confidence
          };
        }
      }
    }
    
    // Only return if confidence is above threshold
    if (bestRegion && bestRegion.confidence > 0.3) {
      return bestRegion;
    }
    
    return null;
  }

  private calculateRegionContrast(grayData: Uint8Array, width: number, startX: number, startY: number, regionWidth: number, regionHeight: number): number {
    let sum = 0;
    let count = 0;
    let min = 255;
    let max = 0;
    
    for (let y = startY; y < startY + regionHeight; y++) {
      for (let x = startX; x < startX + regionWidth; x++) {
        const index = y * width + x;
        const value = grayData[index];
        
        sum += value;
        count++;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    
    const contrast = max - min;
    const avgBrightness = sum / count;
    
    // Prefer regions with good contrast and moderate brightness
    const brightnessScore = 1.0 - Math.abs(avgBrightness - 128) / 128;
    return contrast * brightnessScore;
  }



  

  

  captureImage(videoElement: HTMLVideoElement, angle: string): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    ctx.drawImage(videoElement, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Update session
    const currentSession = this.captureSessionSubject.value;
    if (currentSession) {
      currentSession.capturedImages[angle] = imageData;
      
      // Move to next angle
      const currentIndex = currentSession.requiredAngles.indexOf(angle);
      if (currentIndex < currentSession.requiredAngles.length - 1) {
        currentSession.currentAngle = currentSession.requiredAngles[currentIndex + 1];
      } else {
        currentSession.isComplete = true;
      }
      
      this.captureSessionSubject.next({ ...currentSession });
    }
    
    return imageData;
  }

  getCapturedImages(): string[] {
    const session = this.captureSessionSubject.value;
    if (!session) return [];
    
    return this.requiredAngles.map(angle => session.capturedImages[angle]).filter(Boolean);
  }

  resetSession(): void {
    this.captureSessionSubject.next(null);
    this.stopCamera();
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Quality assessment methods
  assessImageQuality(imageData: string): Promise<number> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const quality = this.calculateSharpness(imageData) * 0.6 + this.calculateBrightness(imageData) * 0.4;
        resolve(Math.min(quality, 1.0));
      };
      img.src = imageData;
    });
  }

  private calculateSharpness(imageData: ImageData): number {
    const data = imageData.data;
    let sum = 0;
    let count = 0;
    
    for (let i = 4; i < data.length - 4; i += 4) {
      const current = data[i]; // Red channel
      const next = data[i + 4];
      sum += Math.abs(current - next);
      count++;
    }
    
    return Math.min(sum / count / 255, 1.0);
  }

  private calculateBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let sum = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += brightness;
    }
    
    const avgBrightness = sum / (data.length / 4) / 255;
    return 1.0 - Math.abs(avgBrightness - 0.5) * 2; // Prefer moderate brightness
  }
}