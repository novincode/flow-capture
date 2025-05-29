// Recording service for capturing canvas content
import type { RecordingOptions } from './types';
import { convertWebmToGIF, convertWebmToMP4, ensureFFmpeg, isFFmpegLoading, setProgressCallback } from './ffmpegService';
import { captureFullCanvas } from './fullCanvasCapture';

// Firefox compatibility
declare const browser: typeof chrome;

// Configuration for different export formats
const MIME_TYPES = {
  webm: 'video/webm',
  mp4: 'video/mp4',
  gif: 'image/gif'
};

// Cross-browser API helper
const getBrowserAPI = () => {
  // Firefox uses the browser namespace, Chrome uses chrome
  if (typeof browser !== 'undefined') {
    return browser;
  }
  if (typeof chrome !== 'undefined') {
    return chrome;
  }
  throw new Error("No browser extension API detected");
};

// This function will be serialized and injected into the page
function injectedScript(options: RecordingOptions) {
  // Define a function to find the Figma canvas
  function findFigmaCanvas(): HTMLCanvasElement | null {
    // Figma's canvas is typically the largest canvas on the page
    const canvases = Array.from(document.querySelectorAll('canvas'));
    
    if (canvases.length === 0) {
      console.error('No canvases found on the page');
      return null;
    }
    
    // Sort canvases by area (largest first)
    const sortedCanvases = canvases.sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      return areaB - areaA;
    });
    
    return sortedCanvases[0];
  }
  
  // Function to get the full scrollable content dimensions
  function getFullContentDimensions() {
    // Try to find Figma frame or design size
    const viewportElement = document.querySelector('.view');
    const zoomElement = document.querySelector('.zoom-wrapper') as HTMLElement;
    
    // Fallback to document scrolling dimensions if Figma elements not found
    let fullWidth = document.documentElement.scrollWidth;
    let fullHeight = document.documentElement.scrollHeight;
    
    // If we found Figma specific elements, use those for more accurate dimensions
    if (zoomElement) {
      const scale = zoomElement.style.transform
        ? parseFloat(zoomElement.style.transform.match(/scale\(([^)]+)\)/)?.[1] || "1")
        : 1;
      
      // Account for zoom level when calculating full dimensions
      if (zoomElement.scrollWidth > 0 && zoomElement.scrollHeight > 0) {
        fullWidth = Math.max(fullWidth, zoomElement.scrollWidth * (1/scale));
        fullHeight = Math.max(fullHeight, zoomElement.scrollHeight * (1/scale));
      }
    }
    
    console.log(`Full content dimensions: ${fullWidth}x${fullHeight}`);
    return { width: fullWidth, height: fullHeight };
  }

  return new Promise((resolve, reject) => {
    try {
      // Find the canvas
      const canvas = findFigmaCanvas();
      
      if (!canvas) {
        reject("No Figma canvas found. Are you on a Figma prototype?");
        return;
      }
      
      // Get the full content dimensions (entire design, not just viewport)
      const fullDimensions = getFullContentDimensions();
      
      console.log("Found canvas:", canvas.width + "x" + canvas.height);
      console.log("Full content dimensions:", fullDimensions.width + "x" + fullDimensions.height);
      
      // Determine if we need to capture scroll content
      const needsScrollCapture = fullDimensions.width > window.innerWidth || 
                                fullDimensions.height > window.innerHeight;
      
      // Create a stream from the canvas
      const stream = canvas.captureStream(options.frameRate);
      
      if (!stream) {
        reject("Failed to create stream from canvas");
        return;
      }
      
      // If we need to capture content larger than the viewport, inform the user
      if (needsScrollCapture) {
        console.log("Design is larger than viewport. Will attempt to capture full content.");
      }
      
      // Use requestAnimationFrame for smoother recording (optional enhancement)
      let lastFrameTime = 0;
      const frameInterval = 1000 / options.frameRate;
      
      function processFrame(timestamp: number) {
        if (!lastFrameTime || timestamp - lastFrameTime >= frameInterval) {
          lastFrameTime = timestamp;
          // Frame processing could happen here if needed
        }
        
        if (recorder.state === 'recording') {
          requestAnimationFrame(processFrame);
        }
      }
      
      // Create recorder with supported codec
      let mimeType = 'video/webm'; // Default
      
      // Test for codec support
      if (options.format === 'webm' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (options.format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000 // 5 Mbps for high quality
      });
      
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        try {
          // Always record in WebM format initially for best compatibility
          const webmBlob = new Blob(chunks, { type: mimeType });
          
          // Create timestamp for filenames
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          
          // Handle format conversion for non-WebM formats
          if (options.format !== 'webm') {
            // For non-WebM formats, we'll send a message to convert
            console.log(`Starting ${options.format.toUpperCase()} conversion...`);
            
            // Post message for format conversion
            window.postMessage({
              type: 'FIGMA_FLOW_CONVERT',
              format: options.format,
              blob: webmBlob
            }, '*');
            
            // Also download the WebM as a backup
            const webmUrl = URL.createObjectURL(webmBlob);
            const webmLink = document.createElement('a');
            webmLink.download = `figma-flow-${timestamp}-original.webm`;
            webmLink.href = webmUrl;
            webmLink.style.display = 'none';
            document.body.appendChild(webmLink);
            webmLink.click();
            
            // Clean up WebM download
            setTimeout(() => {
              document.body.removeChild(webmLink);
              URL.revokeObjectURL(webmUrl);
            }, 100);
            
            resolve(`${options.format.toUpperCase()} conversion initiated, WebM backup downloaded`);
            return;
          }
          
          // For WebM format, just download directly
          const url = URL.createObjectURL(webmBlob);
          const a = document.createElement('a');
          a.download = `figma-flow-${timestamp}.webm`;
          a.href = url;
          document.body.appendChild(a); // Required for Firefox
          a.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          
          resolve("WebM recording completed and downloaded");
        } catch (error) {
          console.error("Error processing recording:", error);
          reject(error);
        }
      };
      
      // Start recording with requestAnimationFrame for better timing
      recorder.start();
      console.log("Started recording at", options.frameRate, "FPS");
      requestAnimationFrame(processFrame);
      
      // Record for the specified duration
      setTimeout(() => {
        if (recorder.state === 'recording') {
          console.log("Stopping recording after", options.duration, "ms");
          recorder.stop();
        }
      }, options.duration || 5000);
      
    } catch (error) {
      console.error("Recording error:", error);
      reject(error);
    }
  });
}

// Inject the script into the page
export async function captureCanvas(options: RecordingOptions): Promise<void> {
  try {
    // Get browser API (works in both Chrome and Firefox)
    const browserAPI = getBrowserAPI();
    
    // Check if we have required permissions
    if (!browserAPI.tabs) {
      throw new Error("Browser tabs API is not available. The extension may need to be reloaded.");
    }
    
    if (!browserAPI.scripting) {
      throw new Error("Browser scripting API is not available. Please make sure you have the 'scripting' permission.");
    }
    
    // Get the current active tab
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab || !tab.id) {
      throw new Error("Cannot find current tab. Please refresh and try again.");
    }
    
    // Check current URL if needed
    const url = tab.url || "";
    if (url && !url.includes("figma.com") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
      console.warn("Not on a Figma site. Canvas detection might not work correctly.");
    }
    
    // Execute the script in the context of the page
    const result = await browserAPI.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedScript,
      args: [options]
    });
    
    // Handle result
    console.log("Recording result:", result);
    return;
    
  } catch (error) {
    console.error("Error during canvas capture:", error);
    throw error;
  }
}

// Function to start recording with the specified options
export async function startCapture(options: RecordingOptions): Promise<void> {
  const recordingOptions = {
    ...options,
    // Default duration of 5 seconds if not specified
    duration: options.duration || 5000,
    // New option to control full-size capture
    captureFullSize: options.captureFullSize ?? false // Default to false for safety
  };

  // Always use WebM now since we're disabling FFmpeg temporarily
  recordingOptions.format = 'webm';

  // Choose capture method based on user preference
  if (recordingOptions.captureFullSize) {
    console.log("🎬 Using full canvas capture (new simple approach)");
    return captureFullCanvas(recordingOptions);
  } else {
    console.log("🎥 Using basic WebM recording (safe fallback)");
    return captureCanvas(recordingOptions);
  }
}
