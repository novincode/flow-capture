import type { PlasmoContentScript } from "plasmo"

export const config: PlasmoContentScript = {
  matches: ["https://*.figma.com/*"]
}

// Plasmo content script for Figma Flow Capture
// This runs in the context of Figma pages and handles message passing

console.log("Figma Flow Capture content script loaded");

// Listen for fullsize video messages from the page context
window.addEventListener('message', (event) => {
  // Only accept messages from the same page
  if (event.source !== window) return;
  
  const message = event.data;
  console.log("🎬 Content script received message:", message);
  
  // Handle fullsize video capture completion
  if (message && message.type === 'FIGMA_FLOW_FULLSIZE_VIDEO' && message.dataUrl && message.filename) {
    console.log("📥 Relaying fullsize video download request to background");
    console.log("📊 Data URL size:", message.dataUrl.length, "characters");
    
    // Validate the data URL
    if (!message.dataUrl.startsWith('data:video/webm')) {
      console.error('❌ Invalid data URL format:', message.dataUrl.substring(0, 50));
      // Try fallback download
      console.log("🔄 Attempting fallback download...");
      fallbackDownload(message.dataUrl, message.filename);
      return;
    }
    
    // Send to background script for download
    console.log("📤 Sending message to background script...");
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FULLSIZE_VIDEO',
      dataUrl: message.dataUrl,
      filename: message.filename
    }, (response) => {
      // Check for runtime errors
      if (chrome.runtime.lastError) {
        console.error("❌ Runtime error:", chrome.runtime.lastError);
        console.log("🔄 Attempting fallback download...");
        fallbackDownload(message.dataUrl, message.filename);
        return;
      }
      
      console.log("✅ Background script response:", response);
      if (response && response.success) {
        console.log("🎉 Download initiated successfully");
      } else {
        console.error("❌ Download failed:", response);
        // Try fallback download
        console.log("🔄 Attempting fallback download...");
        fallbackDownload(message.dataUrl, message.filename);
      }
    });
  }
});

// Fallback download function that works in content script context
function fallbackDownload(dataUrl: string, filename: string) {
  try {
    console.log("🔽 Starting fallback download...");
    
    // Create download link
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.style.display = 'none';
    
    // Add to page and trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      console.log("✅ Fallback download completed");
    }, 100);
    
  } catch (error) {
    console.error("❌ Fallback download failed:", error);
  }
}

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Error sending ready message:', chrome.runtime.lastError);
  } else {
    console.log('Content script ready message sent');
  }
});
