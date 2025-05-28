// Recording service for capturing canvas content
import type { RecordingOptions } from './types';

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

  return new Promise((resolve, reject) => {
    try {
      // Find the canvas
      const canvas = findFigmaCanvas();
      
      if (!canvas) {
        reject("No Figma canvas found. Are you on a Figma prototype?");
        return;
      }
      
      console.log("Found canvas:", canvas.width + "x" + canvas.height);
      
      // Create a stream from the canvas
      const stream = canvas.captureStream(options.frameRate);
      
      if (!stream) {
        reject("Failed to create stream from canvas");
        return;
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
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        
        // Download the recording
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `figma-flow-${timestamp}.${options.format === 'gif' ? 'webm' : options.format}`;
        a.href = url;
        document.body.appendChild(a); // Required for Firefox
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        resolve("Recording completed and downloaded");
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
export function startCapture(options: RecordingOptions): Promise<void> {
  return captureCanvas({
    ...options,
    // Default duration of 5 seconds if not specified
    duration: options.duration || 5000
  });
}
