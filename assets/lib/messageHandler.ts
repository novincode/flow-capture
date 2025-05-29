// Message handler for format conversion
import { convertWebmToGIF, convertWebmToMP4, ensureFFmpeg, isFFmpegLoading, setProgressCallback } from './ffmpegService';

/**
 * Initialize message listener for handling format conversion requests
 */
export function initMessageHandler() {
  // Listen for messages from content scripts
  window.addEventListener('message', async (event) => {
    // Make sure the message is from our extension
    if (event.data && event.data.type === 'FIGMA_FLOW_CONVERT') {
      try {
        const { format, blob } = event.data;
        
        // Create a proper Blob from the data
        // This is needed because the object might not be a true Blob when passed through postMessage
        const webmData = await fetch(URL.createObjectURL(new Blob([blob]))).then(r => r.blob());
        
        // Display loading message
        showToast(`Converting to ${format.toUpperCase()}... Loading FFmpeg`, 'info');
        
        // Set up progress tracking
        setProgressCallback((progress) => {
          showToast(`Converting: ${Math.floor(progress)}%`, 'info');
        });

        // Ensure FFmpeg is loaded first before attempting conversion
        // If loading fails, this will throw an error
        await ensureFFmpeg();
        
        showToast(`Converting to ${format.toUpperCase()}... This may take a moment`, 'info');
        
        // Perform the actual conversion
        let convertedBlob: Blob;
        if (format === 'mp4') {
          convertedBlob = await convertWebmToMP4(webmData);
          showToast(`MP4 conversion successful!`, 'success');
        } else if (format === 'gif') {
          convertedBlob = await convertWebmToGIF(webmData);
          showToast(`GIF conversion successful!`, 'success');
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }
        
        // Download the converted file
        const url = URL.createObjectURL(convertedBlob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `figma-flow-${timestamp}.${format}`;
        a.href = url;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        // Show success message
        showToast(`Successfully converted and downloaded ${format.toUpperCase()}!`, 'success');
      } catch (error) {
        console.error(`Error converting to ${event.data.format}:`, error);
        showToast(`Failed to convert: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    }
  });
}

/**
 * Display a toast notification
 */
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('ffmpeg-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ffmpeg-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.color = 'white';
    toast.style.fontSize = '14px';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(toast);
  }
  
  // Set background color based on type
  switch (type) {
    case 'success':
      toast.style.backgroundColor = '#10B981';
      break;
    case 'error':
      toast.style.backgroundColor = '#EF4444';
      break;
    case 'info':
    default:
      toast.style.backgroundColor = '#3B82F6';
  }
  
  // Update message and show toast
  toast.textContent = message;
  toast.style.opacity = '1';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 5000);
}
