import React, { useState, useEffect } from 'react'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import Slider from './ui/Slider'
import FormatSelector from './ui/FormatSelector'
import Toast from './ui/Toast'
import { useRecording } from '../lib/useRecording'
import type { ExportFormat } from '../lib/types'
import { ensureFFmpeg, isFFmpegAvailable, isFFmpegLoading, setProgressCallback } from '../lib/ffmpegService'

// Firefox compatibility
declare const browser: typeof chrome;

// Check if browser extension APIs are available
const hasBrowserAPIs = () => {
  return typeof chrome !== 'undefined' && !!chrome.tabs;
};

const PopupHome = () => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("webm") // Default to WebM as most compatible
  const [frameRate, setFrameRate] = useState<number>(30)
  const [showCursor, setShowCursor] = useState<boolean>(true)
  const [renderGestures, setRenderGestures] = useState<boolean>(false)
  const [recordDuration, setRecordDuration] = useState<number>(5000) // 5 seconds by default
  const [toastMessage, setToastMessage] = useState<string>("")
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')
  const [permissionsReady, setPermissionsReady] = useState<boolean>(hasBrowserAPIs())
  const [ffmpegLoading, setFfmpegLoading] = useState<boolean>(false)
  const [ffmpegLoadProgress, setFfmpegLoadProgress] = useState<number>(0)
  const { isCapturing, error, startRecording, clearError } = useRecording()
  
  // Check for browser extension APIs on mount
  useEffect(() => {
    setPermissionsReady(hasBrowserAPIs());
    
    // Check for proper extension permissions
    if (!hasBrowserAPIs()) {
      setToastMessage("Extension API not detected. Please reload the extension.");
      setToastType('error');
    }
    
    // Set up FFmpeg status tracking
    const checkFFmpegStatus = () => {
      setFfmpegLoading(isFFmpegLoading());
      
      // Only track progress if we're loading
      if (isFFmpegLoading()) {
        // Set a callback to get loading progress
        setProgressCallback((progress) => {
          setFfmpegLoadProgress(progress);
        });
        
        // Check again in 200ms
        setTimeout(checkFFmpegStatus, 200);
      }
    };
    
    // Start tracking FFmpeg status
    checkFFmpegStatus();
  }, []);
  
  // Clear error when changing settings
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [exportFormat, frameRate, showCursor, renderGestures]);
  
  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
  
  // Monitor FFmpeg loading status when non-WebM formats are selected
  useEffect(() => {
    if (exportFormat !== 'webm') {
      // Setup progress callback for FFmpeg loading
      setProgressCallback((progress) => {
        setFfmpegLoadProgress(progress);
      });
      
      // Check FFmpeg loading status periodically
      const checkLoading = () => {
        setFfmpegLoading(isFFmpegLoading());
      };
      
      // Initial check
      checkLoading();
      
      // Set up interval to check status
      const interval = setInterval(checkLoading, 500);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [exportFormat]);
  
  const handleCapture = async () => {
    if (isCapturing) return; // Prevent multiple captures
    
    try {
      // Check browser APIs again just to be safe
      if (!hasBrowserAPIs()) {
        setToastMessage("Browser extension APIs not available. Please reload the extension.");
        setToastType('error');
        return;
      }
      
      // Check if we need to load FFmpeg for non-WebM formats
      if (exportFormat !== 'webm' && !isFFmpegAvailable() && !ffmpegLoading) {
        // Start loading FFmpeg
        setToastMessage(`Loading conversion tools for ${exportFormat.toUpperCase()}...`);
        setToastType('info');
        setFfmpegLoading(true);
        
        try {
          // Load FFmpeg - this will wait until it's ready
          await ensureFFmpeg();
        } catch (error) {
          console.error("FFmpeg loading error:", error);
          setToastMessage(`Failed to load conversion tools: ${error.message}`);
          setToastType('error');
          setFfmpegLoading(false);
          return;
        }
      }
      
      // If we're still loading FFmpeg, tell the user we need to wait
      if (exportFormat !== 'webm' && (ffmpegLoading || isFFmpegLoading())) {
        setToastMessage(`Please wait for ${exportFormat.toUpperCase()} conversion tools to finish loading...`);
        setToastType('info');
        return;
      }
      
      setToastMessage("Starting recording... Please wait.");
      setToastType('info');
      
      await startRecording({
        format: exportFormat,
        frameRate: frameRate,
        showCursor: showCursor,
        renderGestures: renderGestures,
        duration: recordDuration
      });
      
      // For non-WebM formats, adjust message to indicate conversion will happen
      if (exportFormat !== 'webm') {
        setToastMessage(`Recording in progress (${recordDuration/1000}s)... ${exportFormat.toUpperCase()} conversion will follow.`);
      } else {
        setToastMessage(`Recording in progress (${recordDuration/1000}s)...`);
      }
      setToastType('info');
      
      // Show success message after recording finishes
      setTimeout(() => {
        if (exportFormat !== 'webm') {
          setToastMessage(`Recording complete! ${exportFormat.toUpperCase()} conversion may take a few more seconds.`);
        } else {
          setToastMessage("Recording complete! Check your downloads folder.");
        }
        setToastType('success');
      }, recordDuration + 1000);
      
    } catch (err) {
      console.error("Failed to start recording:", err);
      setToastMessage(err instanceof Error ? err.message : "Recording failed. Please check console for details.");
      setToastType('error');
    }
  }

  return (
    <div className="w-80 space-y-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600">
            <span className="text-lg">🎬</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">Flow Capture</h1>
        </div>
      </div>
      
      {/* Toast notifications */}
      {(error || toastMessage) && (
        <Toast
          message={error || toastMessage}
          type={error ? 'error' : toastType}
          onDismiss={error ? clearError : () => setToastMessage("")}
        />
      )}
      
      {/* Export Format */}
      <FormatSelector
        formats={["mp4", "gif", "webm"]}
        selectedFormat={exportFormat}
        onChange={(format) => {
          setExportFormat(format as ExportFormat);
          // Pre-load FFmpeg if selecting a format that needs conversion
          if (format !== 'webm' && !isFFmpegAvailable()) {
            // Load in background
            ensureFFmpeg().catch(err => {
              console.error("Error pre-loading FFmpeg:", err);
              setToastMessage("Error loading conversion tools: " + err.message);
              setToastType('error');
            });
          }
        }}
        label="Export Format"
        isLoading={ffmpegLoading}
        loadProgress={ffmpegLoadProgress}
      />
      
      {/* Frame Rate Slider */}
      <Slider
        min={15}
        max={60}
        value={frameRate}
        onChange={setFrameRate}
        label="Frame Rate"
        unit=" FPS"
      />
      
      {/* Settings */}
      <div className="space-y-3 rounded-lg bg-slate-900 p-3">
        <h3 className="text-sm font-medium text-slate-300">Settings</h3>
        
        <Toggle 
          checked={showCursor} 
          onChange={() => setShowCursor(!showCursor)} 
          label="Show Cursor" 
          id="cursor" 
        />
        
        <Toggle 
          checked={renderGestures} 
          onChange={() => setRenderGestures(!renderGestures)} 
          label="Render Gestures" 
          id="gestures" 
        />
        
        {/* Recording Duration */}
        <div className="mt-3 space-y-1">
          <label className="block text-xs font-medium text-slate-400">Recording Duration</label>
          <div className="flex items-center gap-2">
            {[3, 5, 10].map(seconds => (
              <button
                key={seconds}
                onClick={() => setRecordDuration(seconds * 1000)}
                className={`flex-1 rounded-md py-1 text-xs transition-colors ${
                  recordDuration === seconds * 1000 
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Capture Button */}
      <Button 
        onClick={handleCapture}
        disabled={isCapturing || !permissionsReady || (ffmpegLoading && exportFormat !== 'webm')}
        fullWidth
        className="py-2.5 text-sm"
      >
        {isCapturing ? (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Recording {recordDuration/1000}s...</span>
          </div>
        ) : ffmpegLoading && exportFormat !== 'webm' ? (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Preparing {exportFormat.toUpperCase()} Tools...</span>
          </div>
        ) : (
          <span className="flex items-center gap-1.5">
            <span>🎬</span> Capture Flow
          </span>
        )}
      </Button>
      
      <div className="mt-2 text-center text-xs text-slate-500">
        Works on any webpage with a canvas element.
      </div>
    </div>
  )
}

export default PopupHome