// TypeScript types for the recording service

export type ExportFormat = 'mp4' | 'gif' | 'webm';

export interface RecordingOptions {
  // Format to export in
  format: ExportFormat;
  
  // Frame rate in frames per second
  frameRate: number;
  
  // Show cursor during capture
  showCursor: boolean;
  
  // Render gestures (clicks, drags, etc)
  renderGestures: boolean;
  
  // Duration of recording in milliseconds (optional)
  duration?: number;
}
