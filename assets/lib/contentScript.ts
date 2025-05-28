// Content script to be injected into the Figma page
import type { RecordingOptions } from './types';

// Provide a more robust canvas detection for Figma
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

export function initializeContentRecorder(options: RecordingOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // 1. Find the canvas
      const canvas = findFigmaCanvas();
      
      if (!canvas) {
        return reject(new Error("No Figma canvas found. Are you on a Figma prototype?"));
      }
      
      // 2. Get stream from canvas
      const stream = canvas.captureStream(options.frameRate);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        return reject(new Error("Could not capture stream from canvas"));
      }
      
      // 3. Set up MediaRecorder with appropriate format
      let mimeType: string;
      
      switch (options.format) {
        case 'webm':
          mimeType = 'video/webm';
          break;
        case 'mp4':
          mimeType = 'video/mp4';
          break;
        case 'gif':
          // For GIF, we'll still record as WebM then convert
          mimeType = 'video/webm';
          break;
        default:
          mimeType = 'video/webm';
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000 // 5 Mbps
      });
      
      const chunks: BlobPart[] = [];
      
      // 4. Set up event listeners
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: mimeType });
        resolve(recordedBlob);
      };
      
      recorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event.error}`));
      };
      
      // 5. Start recording
      recorder.start();
      
      // 6. Stop after specified duration
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, options.duration || 5000);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Function to download the recorded blob
export function downloadRecording(blob: Blob, format: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `figma-flow-capture-${timestamp}.${format}`;
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
