// Alternative Full Canvas Capture - Multi-Section Approach
// This captures large designs by recording multiple viewport sections
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
 * Multi-section capture for very large designs that can't fit in one viewport
 */
export async function captureMultiSection(options: RecordingOptions): Promise<void> {
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

    // Multi-section capture function
    function captureInSections(options: any) {
      console.log("🎬 Starting multi-section design capture");
      
      return new Promise((resolve, reject) => {
        try {
          // Find the main Figma canvas
          const canvases = Array.from(document.querySelectorAll('canvas'));
          if (canvases.length === 0) {
            reject("No canvases found on page.");
            return;
          }
          
          const canvas = canvases.sort((a, b) => 
            (b.width * b.height) - (a.width * a.height)
          )[0];
          
          console.log(`📐 Main canvas: ${canvas.width}x${canvas.height}`);
          
          // Detect if design is larger than viewport by checking scroll capabilities
          const viewport = document.querySelector('[data-testid="canvas"]') ||
                          document.querySelector('.view') ||
                          document.querySelector('.canvas') ||
                          document.body;
          
          if (!(viewport instanceof HTMLElement)) {
            reject("Could not find viewport element");
            return;
          }
          
          const hasHorizontalScroll = viewport.scrollWidth > viewport.clientWidth;
          const hasVerticalScroll = viewport.scrollHeight > viewport.clientHeight;
          
          if (!hasHorizontalScroll && !hasVerticalScroll) {
            console.log("✅ Design fits in viewport, using single capture");
            captureCurrentView();
            return;
          }
          
          console.log(`📏 Design extends beyond viewport: H=${hasHorizontalScroll}, V=${hasVerticalScroll}`);
          
          // Calculate how many sections we need
          const sectionsX = Math.ceil(viewport.scrollWidth / viewport.clientWidth);
          const sectionsY = Math.ceil(viewport.scrollHeight / viewport.clientHeight);
          
          console.log(`📊 Will capture ${sectionsX}x${sectionsY} sections`);
          
          // For now, just capture the center of the design by scrolling to middle
          // TODO: In future, capture all sections and stitch together
          const centerX = (viewport.scrollWidth - viewport.clientWidth) / 2;
          const centerY = (viewport.scrollHeight - viewport.clientHeight) / 2;
          
          viewport.scrollTo(centerX, centerY);
          
          // Wait for scroll to complete, then capture
          setTimeout(() => {
            console.log("📱 Scrolled to center, capturing view");
            captureCurrentView();
          }, 1000);
          
          function captureCurrentView() {
            console.log("🎥 Recording current view...");
            
            try {
              const stream = canvas.captureStream(options.frameRate || 30);
              const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 8000000
              });
              
              const chunks: BlobPart[] = [];
              
              recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                  chunks.push(e.data);
                }
              };
              
              recorder.onstop = () => {
                console.log('🛑 Multi-section recording stopped');
                
                const blob = new Blob(chunks, { type: 'video/webm' });
                
                if (blob.size === 0) {
                  reject("Recording produced empty file");
                  return;
                }
                
                console.log(`📁 Created multi-section video: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                
                const reader = new FileReader();
                reader.onloadend = function() {
                  console.log('✅ Sending multi-section video for download...');
                  window.postMessage({
                    type: 'FIGMA_FLOW_FULLSIZE_VIDEO',
                    dataUrl: reader.result,
                    filename: `figma-flow-${new Date().toISOString().replace(/[:.]/g, '-')}-multisection.webm`
                  }, '*');
                  
                  resolve("Multi-section capture completed!");
                };
                
                reader.onerror = function() {
                  reject("Failed to process video file");
                };
                
                reader.readAsDataURL(blob);
              };
              
              recorder.onerror = (error) => {
                console.error("❌ Recording error:", error);
                reject("Recording failed");
              };
              
              recorder.start();
              console.log(`🎬 Multi-section recording started for ${options.duration || 5000}ms`);
              
              setTimeout(() => {
                if (recorder.state === 'recording') {
                  recorder.stop();
                }
              }, options.duration || 5000);
              
            } catch (error) {
              console.error("❌ Error in recording:", error);
              reject(error);
            }
          }
          
        } catch (error) {
          console.error("❌ Error in multi-section capture:", error);
          reject(error);
        }
      });
    }
    
    // Execute the script
    console.log("🚀 Injecting multi-section capture script");
    await browserAPI.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureInSections,
      args: [options]
    });
    
    console.log("✅ Multi-section capture initiated");
    return;
    
  } catch (error) {
    console.error("❌ Multi-section capture error:", error);
    throw error;
  }
}
