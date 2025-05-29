import { useState } from 'react';
import type { ExportFormat, RecordingOptions } from './types';
import { startCapture } from './recordingService';

// Firefox compatibility
declare const browser: typeof chrome;

export function useRecording() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if browser extension APIs are available
  const checkBrowserPermissions = (): boolean => {
    try {
      // Check for Firefox or Chrome APIs
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      
      if (!browserAPI || !browserAPI.tabs) {
        setError("Browser extension APIs not available. Please reload the extension.");
        return false;
      }
      
      if (!browserAPI.scripting) {
        setError("Scripting permission is required but not available.");
        return false;
      }
      
      return true;
    } catch (err) {
      setError("Failed to access browser APIs. Please reload the extension.");
      return false;
    }
  };
  
  const startRecording = async (options: {
    format: ExportFormat;
    frameRate: number;
    showCursor: boolean;
    renderGestures: boolean;
    duration?: number;
    captureFullSize?: boolean;
  }) => {
    try {
      setError(null);
      
      // Check permissions first
      if (!checkBrowserPermissions()) {
        return;
      }
      
      setIsCapturing(true);
      
      const recordingOptions: RecordingOptions = {
        ...options,
        // Default duration of 5 seconds if not provided
        duration: options.duration || 5000
      };
      
      await startCapture(recordingOptions);
      
      // We'll set isCapturing to false after the expected recording duration plus a buffer
      setTimeout(() => {
        setIsCapturing(false);
      }, recordingOptions.duration + 1000); // Add 1 second buffer for processing
      
    } catch (err) {
      console.error('Error during recording:', err);
      let errorMessage = 'Unknown error during recording';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      setIsCapturing(false);
    }
  };
  
  // Function to clear errors
  const clearError = () => setError(null);
  
  return {
    isCapturing,
    error,
    startRecording,
    clearError
  };
}
