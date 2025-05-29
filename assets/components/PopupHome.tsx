import React, { useState, useEffect } from 'react'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import Slider from './ui/Slider'
import FormatSelector from './ui/FormatSelector'
import Toast from './ui/Toast'
import ProgressBar from './ui/ProgressBar'
import { useRecording } from '../lib/useRecording'
import type { ExportFormat } from '../lib/types'
import { ensureFFmpeg, isFFmpegAvailable, isFFmpegLoading, setProgressCallback, resetFFmpegLoader, getFFmpegLoadError } from '../lib/ffmpegService'

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
  const [captureFullSize, setCaptureFullSize] = useState<boolean>(true) // Default to full-size capture
  const [recordDuration, setRecordDuration] = useState<number>(5000) // 5 seconds by default
  const [toastMessage, setToastMessage] = useState<string>("")
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')
  const [permissionsReady, setPermissionsReady] = useState<boolean>(hasBrowserAPIs())
  const [ffmpegLoading, setFfmpegLoading] = useState<boolean>(false)
  const [ffmpegLoadProgress, setFfmpegLoadProgress] = useState<number>(0)
  const [ffmpegError, setFfmpegError] = useState<string>("");
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
    let ffmpegStatusInterval: NodeJS.Timeout | null = null;
    const checkFFmpegStatus = () => {
      const loading = isFFmpegLoading();
      setFfmpegLoading(loading);
      if (loading) {
        setProgressCallback((progress) => {
          setFfmpegLoadProgress(progress);
        });
        if (!ffmpegStatusInterval) {
          ffmpegStatusInterval = setInterval(() => {
            const stillLoading = isFFmpegLoading();
            setFfmpegLoading(stillLoading);
            if (!stillLoading) {
              setFfmpegLoadProgress(100);
              if (ffmpegStatusInterval) clearInterval(ffmpegStatusInterval);
            }
          }, 200);
        }
      } else {
        setFfmpegLoadProgress(100);
        if (ffmpegStatusInterval) clearInterval(ffmpegStatusInterval);
      }
    };
    checkFFmpegStatus();
    return () => {
      if (ffmpegStatusInterval) clearInterval(ffmpegStatusInterval);
    };
  }, []);
  
  // Clear error when changing settings
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [exportFormat, frameRate, showCursor, renderGestures, captureFullSize]);
  
  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
  
  // More detailed loading status for FFmpeg
  const [ffmpegStatus, setFfmpegStatus] = useState<string>("");
  
  // Monitor FFmpeg loading status when non-WebM formats are selected
  useEffect(() => {
    if (exportFormat !== 'webm') {
      // Set up console logging interceptor to track FFmpeg status
      const originalConsoleLog = console.log;
      console.log = function(...args) {
        if (typeof args[0] === 'string' && args[0].includes('[FFmpeg]')) {
          setFfmpegStatus(args[0].replace('[FFmpeg] ', ''));
        }
        originalConsoleLog.apply(console, args);
      };
      
      // Progress callback
      setProgressCallback((progress) => {
        setFfmpegLoadProgress(progress);
      });
      
      // Regular status check
      const checkLoading = () => {
        setFfmpegLoading(isFFmpegLoading());
        const err = getFFmpegLoadError();
        setFfmpegError(err ? err.message : "");
      };
      
      checkLoading();
      const interval = setInterval(checkLoading, 500);
      
      return () => {
        console.log = originalConsoleLog; // Restore original console.log
        clearInterval(interval);
      };
    } else {
      setFfmpegError("");
      setFfmpegStatus("");
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
          setFfmpegLoading(false);
          setFfmpegLoadProgress(100);
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
      
      setToastMessage(captureFullSize ? "Starting full-design capture... Please wait." : "Starting recording... Please wait.");
      setToastType('info');
      
      await startRecording({
        format: exportFormat,
        frameRate: frameRate,
        showCursor: showCursor,
        renderGestures: renderGestures,
        duration: recordDuration,
        captureFullSize: captureFullSize
      });
      
      // For non-WebM formats, adjust message to indicate conversion will happen
      if (exportFormat !== 'webm') {
        setToastMessage(`${captureFullSize ? 'Full-design' : 'Recording'} in progress (${recordDuration/1000}s)... ${exportFormat.toUpperCase()} conversion will follow.`);
      } else {
        setToastMessage(`${captureFullSize ? 'Full-design capture' : 'Recording'} in progress (${recordDuration/1000}s)...`);
      }
      setToastType('info');
      
      // Show success message after recording finishes
      setTimeout(() => {
        if (exportFormat !== 'webm') {
          setToastMessage(`${captureFullSize ? 'Full-design capture' : 'Recording'} complete! ${exportFormat.toUpperCase()} conversion may take a few more seconds.`);
        } else {
          setToastMessage(`${captureFullSize ? 'Full-design capture' : 'Recording'} complete! Check your downloads folder.`);
        }
        setToastType('success');
      }, recordDuration + 1000);
      
    } catch (err) {
      console.error("Failed to start recording:", err);
      setToastMessage(err instanceof Error ? err.message : "Recording failed. Please check console for details.");
      setToastType('error');
    }
  }

  const handleRetryFFmpeg = async () => {
    resetFFmpegLoader();
    setFfmpegError("");
    setFfmpegLoadProgress(0);
    setFfmpegLoading(true);
    try {
      await ensureFFmpeg();
      setFfmpegLoading(false);
      setFfmpegLoadProgress(100);
    } catch (error) {
      setFfmpegError(error instanceof Error ? error.message : String(error));
      setFfmpegLoading(false);
      setFfmpegLoadProgress(0);
    }
  };

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
      {(error || toastMessage || ffmpegError) && (
        <Toast
          message={error || toastMessage || ffmpegError}
          type={error ? 'error' : ffmpegError ? 'error' : toastType}
          onDismiss={error ? clearError : () => { setToastMessage(""); setFfmpegError(""); }}
        />
      )}
      
      {/* FFmpeg status and error UI */}
      {exportFormat !== 'webm' && (ffmpegError || ffmpegLoading || ffmpegStatus) && (
        <div className="flex flex-col items-center gap-2 text-xs w-full">
          {ffmpegLoading && (
            <>
              <div className="w-full flex flex-col items-center gap-1">
                <ProgressBar progress={ffmpegLoadProgress} />
                <div className="flex items-center gap-2">
                  <span className="text-amber-300">Loading conversion tools:</span>
                  <span className="font-mono">{ffmpegStatus || "Initializing..."}</span>
                  <span className="text-slate-400">{Math.round(ffmpegLoadProgress)}%</span>
                </div>
              </div>
            </>
          )}
          {ffmpegError && (
            <>
              <span className="text-red-400">Failed to load conversion tools: {ffmpegError}</span>
              <button
                className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                onClick={handleRetryFFmpeg}
                disabled={ffmpegLoading}
              >
                Retry Loading
              </button>
            </>
          )}
        </div>
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
        
        <Toggle 
          checked={captureFullSize} 
          onChange={() => setCaptureFullSize(!captureFullSize)} 
          label="Capture Full Design" 
          id="fullSize" 
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