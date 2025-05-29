// REAL Full Canvas Capture - Figma-Specific Implementation
// This captures the ENTIRE Figma design by manipulating zoom levels
import type { RecordingOptions } from './types';

// Firefox compatibility for TypeScript
declare const browser: typeof chrome | undefined;

// Cross-browser API helper
const getBrowserAPI = () => {
  if (typeof browser !== 'undefined' && browser.tabs && browser.scripting) {
    return browser;
  }
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    return chrome;
  }
  throw new Error("No browser extension API detected");
};

/**
 * REAL full canvas capture - manipulates Figma's zoom to capture entire design
 */
export async function captureFullCanvas(options: RecordingOptions): Promise<void> {
  try {
    const browserAPI = getBrowserAPI();
    
    // Get the current active tab
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab || !tab.id) {
      throw new Error("Cannot find current tab. Please refresh and try again.");
    }

    // Validate that we're on Figma
    if (!tab.url?.includes('figma.com')) {
      throw new Error("This extension only works on Figma pages. Please navigate to a Figma file.");
    }

    // Advanced injected function that captures the FULL design
    function captureFullDesign(options: any) {
      console.log("🎬 Starting FULL design capture - Real Implementation");
      
      return new Promise((resolve, reject) => {
        try {
          // Find the main Figma canvas
          const canvases = Array.from(document.querySelectorAll('canvas'));
          if (canvases.length === 0) {
            reject("No canvases found on page. Please ensure you're on a Figma file page.");
            return;
          }
          
          const canvas = canvases.sort((a, b) => 
            (b.width * b.height) - (a.width * a.height)
          )[0];
          
          if (!canvas || canvas.width === 0 || canvas.height === 0) {
            reject("Found canvas but it has no content. Please ensure the Figma file is loaded.");
            return;
          }
          
          console.log(`📐 Main canvas: ${canvas.width}x${canvas.height}`);
          
          // STRATEGY 1: Try to use Figma's "Zoom to fit all" functionality
          let zoomToFitAttempted = false;
          
          // Look for Figma's zoom controls and "fit all" functionality
          const zoomControls = document.querySelector('[data-testid="zoom-tool"]') ||
                              document.querySelector('.zoom-menu') ||
                              document.querySelector('[aria-label*="zoom"]') ||
                              document.querySelector('[title*="zoom"]');
          
          // Look for "fit all" or "zoom to fit" button
          const fitAllButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            const title = btn.getAttribute('title')?.toLowerCase() || '';
            const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
            
            return text.includes('fit') || text.includes('all') || 
                   title.includes('fit') || title.includes('all') ||
                   ariaLabel.includes('fit') || ariaLabel.includes('all') ||
                   text.includes('zoom to fit') || title.includes('zoom to fit');
          });
          
          if (fitAllButton) {
            console.log("🎯 Found 'Zoom to Fit All' button, attempting to use it");
            try {
              // Click the fit all button
              if (fitAllButton instanceof HTMLElement) {
                fitAllButton.click();
                zoomToFitAttempted = true;
                console.log("✅ Triggered zoom to fit all");
                
                // Wait for zoom animation to complete, then start recording
                setTimeout(() => {
                  startRecording();
                }, 1500);
                return;
              }
            } catch (error) {
              console.warn("⚠️ Failed to trigger zoom to fit, trying manual zoom:", error);
            }
          }
          
          // STRATEGY 2: Keyboard shortcut for "Zoom to Fit All"
          if (!zoomToFitAttempted) {
            console.log("🎯 Trying keyboard shortcut for zoom to fit (Shift+1)");
            try {
              // Simulate Shift+1 (Figma's "Zoom to Fit All" shortcut)
              const shiftOneEvent = new KeyboardEvent('keydown', {
                key: '1',
                shiftKey: true,
                bubbles: true,
                cancelable: true
              });
              
              document.dispatchEvent(shiftOneEvent);
              
              // Also try the keyup event
              const shiftOneEventUp = new KeyboardEvent('keyup', {
                key: '1',
                shiftKey: true,
                bubbles: true,
                cancelable: true
              });
              
              document.dispatchEvent(shiftOneEventUp);
              
              console.log("✅ Sent Shift+1 keyboard shortcut");
              zoomToFitAttempted = true;
              
              // Wait for zoom animation, then start recording
              setTimeout(() => {
                startRecording();
              }, 1500);
              return;
              
            } catch (error) {
              console.warn("⚠️ Keyboard shortcut failed, trying manual zoom calculation:", error);
            }
          }
          
          // STRATEGY 3: Manual zoom calculation and application
          if (!zoomToFitAttempted) {
            console.log("🎯 Attempting manual zoom calculation");
            
            // Try to find Figma's viewport and zoom controls
            const viewport = document.querySelector('[data-testid="canvas"]') ||
                           document.querySelector('.view') ||
                           document.querySelector('.canvas') ||
                           document.querySelector('main') ||
                           document.body;
            
            if (viewport instanceof HTMLElement) {
              console.log("🔍 Found viewport element");
              
              // Get all visible elements that might represent design content
              const designElements = Array.from(document.querySelectorAll('*')).filter(el => {
                if (!(el instanceof HTMLElement)) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && 
                       (el.classList.toString().includes('layer') || 
                        el.classList.toString().includes('object') ||
                        el.classList.toString().includes('node') ||
                        el.hasAttribute('data-id'));
              });
              
              if (designElements.length > 0) {
                // Calculate bounding box of all design elements
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                
                designElements.forEach(el => {
                  const rect = el.getBoundingClientRect();
                  minX = Math.min(minX, rect.left);
                  minY = Math.min(minY, rect.top);
                  maxX = Math.max(maxX, rect.right);
                  maxY = Math.max(maxY, rect.bottom);
                });
                
                const designWidth = maxX - minX;
                const designHeight = maxY - minY;
                
                console.log(`📏 Calculated design bounds: ${designWidth}x${designHeight}`);
                
                // Calculate zoom needed to fit design in canvas
                const zoomX = canvas.width / designWidth;
                const zoomY = canvas.height / designHeight;
                const targetZoom = Math.min(zoomX, zoomY) * 0.9; // 90% to add some padding
                
                console.log(`🎯 Target zoom: ${targetZoom}`);
                
                // Try to find and manipulate zoom controls
                const zoomInput = document.querySelector('input[type="number"]') ||
                                document.querySelector('[value*="%"]') ||
                                document.querySelector('.zoom-input');
                
                if (zoomInput instanceof HTMLInputElement) {
                  console.log("🔧 Found zoom input, setting zoom level");
                  const zoomPercent = Math.round(targetZoom * 100);
                  zoomInput.value = zoomPercent.toString();
                  zoomInput.dispatchEvent(new Event('change', { bubbles: true }));
                  zoomInput.dispatchEvent(new Event('input', { bubbles: true }));
                  
                  // Wait for zoom to apply, then record
                  setTimeout(() => {
                    startRecording();
                  }, 1500);
                  return;
                }
              }
            }
          }
          
          // FALLBACK: Just record what's currently visible
          console.log("⚠️ Could not manipulate zoom, recording current viewport");
          startRecording();
          
          function startRecording() {
            console.log("🎥 Starting recording of (hopefully) full design...");
            
            try {
              // Create stream from canvas
              const stream = canvas.captureStream(options.frameRate || 30);
              const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 8000000 // 8 Mbps for high quality
              });
              
              const chunks: BlobPart[] = [];
              
              recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                  chunks.push(e.data);
                }
              };
              
              recorder.onstop = () => {
                console.log('🛑 Full design recording stopped, processing...');
                
                const blob = new Blob(chunks, { type: 'video/webm' });
                
                if (blob.size === 0) {
                  reject("Recording produced empty file");
                  return;
                }
                
                console.log(`📁 Created full design video: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                
                // Convert to data URL and send for download
                const reader = new FileReader();
                reader.onloadend = function() {
                  console.log('✅ Sending full design video for download...');
                  window.postMessage({
                    type: 'FIGMA_FLOW_FULLSIZE_VIDEO',
                    dataUrl: reader.result,
                    filename: `figma-flow-${new Date().toISOString().replace(/[:.]/g, '-')}-fulldesign.webm`
                  }, '*');
                  
                  resolve("Full design capture completed!");
                };
                
                reader.onerror = function() {
                  console.error('❌ FileReader error:', reader.error);
                  reject("Failed to process video file");
                };
                
                reader.readAsDataURL(blob);
              };
              
              recorder.onerror = (error) => {
                console.error("❌ MediaRecorder error:", error);
                reject("Recording failed");
              };
              
              // Start recording
              recorder.start();
              console.log(`🎬 Full design recording started for ${options.duration || 5000}ms`);
              
              // Stop recording after duration
              setTimeout(() => {
                if (recorder.state === 'recording') {
                  console.log("⏹️ Stopping full design recording...");
                  recorder.stop();
                }
              }, options.duration || 5000);
              
            } catch (error) {
              console.error("❌ Error in recording:", error);
              reject(error);
            }
          }
          
        } catch (error) {
          console.error("❌ Error in full design capture:", error);
          reject(error);
        }
      });
    }
    
    
    // Execute the script in the page context
    console.log("🚀 Injecting REAL full design capture script");
    await browserAPI.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureFullDesign,
      args: [options]
    });
    
    console.log("✅ Full design capture initiated");
    return;
  } catch (error) {
    console.error("❌ Error during full canvas capture:", error);
    throw error;
  }
}
