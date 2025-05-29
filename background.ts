// Firefox compatibility polyfill
// Some Firefox and Chrome APIs are different, so we need to provide compatibility

// Map chrome namespace to browser namespace for cross-browser compatibility
if (typeof globalThis.chrome !== 'undefined' && typeof globalThis.browser === 'undefined') {
  console.log('Adding browser API compatibility layer for Chrome');
  // @ts-ignore - browser namespace will be created
  globalThis.browser = chrome;
} 

// Listen for extension-related messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.type === 'CONTENT_SCRIPT_READY') {
    console.log('✅ Content script ready');
    sendResponse({ success: true });
  }
  else if (message.type === 'RECORDING_COMPLETE') {
    // Handle recording complete
    sendResponse({ success: true });
  } 
  else if (message.type === 'CONVERT_FORMAT') {
    // Format conversion request from content script
    // This will be forwarded to the popup/service worker where FFmpeg is loaded
    console.log('Forwarding format conversion request:', message.format);
    sendResponse({ success: true, message: 'Conversion request received' });
  }
  else if (message.type === 'DOWNLOAD_FULLSIZE_VIDEO') {
    // Download the video using the downloads API
    console.log('📥 Received fullsize video download request:', {
      type: message.type,
      filename: message.filename,
      dataUrlSize: message.dataUrl?.length || 0
    });
    
    const url = message.dataUrl;
    const filename = message.filename || `figma-flow-${Date.now()}.webm`;
    
    if (!url) {
      console.error('❌ No data URL provided');
      sendResponse({ success: false, error: 'No data URL provided' });
      return;
    }
    
    // Validate data URL format
    if (!url.startsWith('data:video/')) {
      console.error('❌ Invalid data URL format');
      sendResponse({ success: false, error: 'Invalid video data format' });
      return;
    }
    
    try {
      console.log('🔽 Starting download with chrome.downloads.download...');
      console.log('📁 Filename:', filename);
      console.log('📊 Data size:', Math.round(url.length / 1024), 'KB');
      
      chrome.downloads.download({
        url,
        filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Download failed:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('✅ Download started with ID:', downloadId);
          sendResponse({ success: true, downloadId });
        }
      });
      
      // Important: Return true to keep the message channel open for async response
      return true;
    } catch (error) {
      console.error('❌ Error starting download:', error);
      sendResponse({ success: false, error: error.toString() });
    }
  }
  
  return true; // Keep the message channel open for async responses
});
