// FFmpeg integration for video format conversion - Local Package Version
/**
 * Enhanced FFmpeg loader for browser extensions
 * Uses local FFmpeg packages to avoid CSP issues
 */

// Declare FFmpeg types for TypeScript
declare global {
  interface Window {
    FFmpeg: any;
    FFmpegWASM: any;
  }
}

// FFmpeg Instance and state management
let ffmpeg: any = null;
let ffmpegLoadPromise: Promise<any> | null = null;
let ffmpegLoaded = false;
let ffmpegError: Error | null = null;
let progressCallback: ((progress: number) => void) | null = null;
let lastProgress = 0;

/**
 * Fetch and convert to Uint8Array (replacement for fetchFile)
 */
async function fetchToUint8Array(input: Blob | File | string): Promise<Uint8Array> {
  if (typeof input === 'string') {
    try {
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (err) {
      throw new Error(`Failed to fetch: ${err.message}`);
    }
  } else {
    return new Uint8Array(await (input as Blob).arrayBuffer());
  }
}

/**
 * Set a callback to receive loading progress updates
 */
export function setProgressCallback(cb: (progress: number) => void): void {
  progressCallback = cb;
}

/**
 * Reset FFmpeg loader state to allow retry after failure
 */
export function resetFFmpegLoader(): void {
  ffmpeg = null;
  ffmpegLoadPromise = null;
  ffmpegLoaded = false;
  ffmpegError = null;
  lastProgress = 0;
  console.log('[FFmpeg] Loader state reset, ready for retry');
}

/**
 * Enhanced FFmpeg loader using dynamic imports (CSP-safe)
 */
export async function ensureFFmpeg(): Promise<any> {
  if (ffmpegLoaded && ffmpeg) return ffmpeg;
  
  if (ffmpegError) throw ffmpegError;
  
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    try {
      // Report initial progress
      if (progressCallback) progressCallback(10);
      
      console.log('[FFmpeg] Loading FFmpeg via dynamic import...');
      
      try {
        // Use dynamic imports which are CSP-safe
        const ffmpegModule = await import('@ffmpeg/ffmpeg');
        const utilModule = await import('@ffmpeg/util');
        
        if (progressCallback) progressCallback(50);
        
        console.log('[FFmpeg] Modules loaded, creating FFmpeg instance...');
        
        // Create FFmpeg instance
        const { FFmpeg } = ffmpegModule;
        const { fetchFile } = utilModule;
        
        ffmpeg = new FFmpeg();
        
        // Set up logging and progress tracking
        ffmpeg.on('log', ({ message }: { message: string }) => {
          console.log(`[FFmpeg Worker] ${message}`);
        });
        
        ffmpeg.on('progress', ({ progress }: { progress: number }) => {
          const progressValue = 50 + Math.round(progress * 50);
          if (progressCallback && progressValue !== lastProgress) {
            progressCallback(progressValue);
            lastProgress = progressValue;
          }
        });
        
        console.log('[FFmpeg] Loading WASM...');
        await ffmpeg.load();
        
        // Store fetchFile utility for later use
        (ffmpeg as any).fetchFile = fetchFile;
        
        console.log('[FFmpeg] Successfully loaded!');
        ffmpegLoaded = true;
        ffmpegError = null;
        if (progressCallback) progressCallback(100);
        
        return ffmpeg;
      } catch (importError) {
        console.error('[FFmpeg] Dynamic import failed:', importError);
        throw new Error(`Failed to load FFmpeg modules: ${importError.message}`);
      }
    } catch (error) {
      console.error('[FFmpeg] Error loading FFmpeg:', error);
      ffmpegError = error instanceof Error ? error : new Error(String(error));
      ffmpegLoadPromise = null;
      if (progressCallback) progressCallback(0);
      throw ffmpegError;
    }
  })();
  
  return ffmpegLoadPromise;
}

/**
 * Convert WebM to MP4
 */
export async function convertWebmToMP4(webmBlob: Blob): Promise<Blob> {
  const ffmpegInstance = await ensureFFmpeg();
  
  await ffmpegInstance.writeFile('input.webm', await fetchToUint8Array(webmBlob));
  
  await ffmpegInstance.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '128k',
    'output.mp4'
  ]);
  
  const data = await ffmpegInstance.readFile('output.mp4');
  
  await ffmpegInstance.deleteFile('input.webm');
  await ffmpegInstance.deleteFile('output.mp4');
  
  return new Blob([data], { type: 'video/mp4' });
}

/**
 * Convert WebM to GIF
 */
export async function convertWebmToGIF(webmBlob: Blob): Promise<Blob> {
  const ffmpegInstance = await ensureFFmpeg();
  
  await ffmpegInstance.writeFile('input.webm', await fetchToUint8Array(webmBlob));
  
  await ffmpegInstance.exec([
    '-i', 'input.webm',
    '-vf', 'fps=15,scale=640:-1:flags=lanczos,palettegen',
    'palette.png'
  ]);
  
  await ffmpegInstance.exec([
    '-i', 'input.webv',
    '-i', 'palette.png',
    '-filter_complex', 'fps=15,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse',
    'output.gif'
  ]);
  
  const data = await ffmpegInstance.readFile('output.gif');
  
  await ffmpegInstance.deleteFile('input.webm');
  await ffmpegInstance.deleteFile('palette.png');
  await ffmpegInstance.deleteFile('output.gif');
  
  return new Blob([data], { type: 'image/gif' });
}

/**
 * Check if FFmpeg is available
 */
export function isFFmpegAvailable(): boolean {
  return ffmpegLoaded;
}

/**
 * Check if FFmpeg is currently loading
 */
export function isFFmpegLoading(): boolean {
  return ffmpegLoadPromise !== null && !ffmpegLoaded;
}

/**
 * Get any FFmpeg loading error
 */
export function getFFmpegLoadError(): Error | null {
  return ffmpegError;
}
