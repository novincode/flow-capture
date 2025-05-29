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
  
  if (message.type === 'RECORDING_COMPLETE') {
    // Handle recording complete
    sendResponse({ success: true });
  } 
  else if (message.type === 'CONVERT_FORMAT') {
    // Format conversion request from content script
    // This will be forwarded to the popup/service worker where FFmpeg is loaded
    console.log('Forwarding format conversion request:', message.format);
    sendResponse({ success: true, message: 'Conversion request received' });
  }
  
  return true; // Keep the message channel open for async responses
});
