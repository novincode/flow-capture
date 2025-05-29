// FFmpeg integration for video format conversion - CDN Only
/**
 * Enhanced FFmpeg loader for browser extensions
 * Uses local FFmpeg files to avoid CSP issues
 */

// Declare FFmpeg types for TypeScript
declare global {
  interface Window {
    FFmpeg: {
      createFFmpeg: (config: {
        log?: boolean;
        logger?: (...args: any[]) => void;
        progress?: (progress: { ratio: number }) => void;
        corePath?: string;
      }) => any;
      fetchFile: (file: Blob | File | string) => Promise<Uint8Array>;
    };
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
 * Load FFmpeg using dynamic imports (CSP-safe)
 */
async function loadFFmpegDynamic(): Promise<void> {
  try {
    console.log('[FFmpeg] Loading FFmpeg via dynamic import...');
    
    // Use dynamic imports which are CSP-safe
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile } = await import('@ffmpeg/util');
    
    // Make available globally for compatibility
    window.FFmpeg = {
      createFFmpeg: FFmpeg.createFFmpeg || FFmpeg,
      fetchFile: fetchFile
    };
    
    console.log('[FFmpeg] Dynamic import successful');
  } catch (error) {
    console.error('[FFmpeg] Dynamic import failed:', error);
    throw new Error(`Failed to load FFmpeg: ${error.message}`);
  }
}

/**
 * Fetch and convert to Uint8Array (replacement for fetchFile)
 * Enhanced with retry logic and progress tracking
 */
async function fetchToUint8Array(input: Blob | File | string, retries = 2): Promise<Uint8Array> {
  if (typeof input === 'string') {
    let attempt = 0;
    
    while (attempt <= retries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(input, { 
          signal: controller.signal,
          // Adding cache-busting for extension context
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        // If the resource has a content-length header, we can track download progress
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        // If we can't determine size, we can't track progress
        if (!total) {
          return new Uint8Array(await response.arrayBuffer());
        }
        
        // Track download progress for large files
        let loaded = 0;
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          // Report progress for large files
          if (progressCallback && total > 1000000) { // Only for files > 1MB
            const progress = Math.round((loaded / total) * 100);
            if (progress !== lastProgress) {
              progressCallback(progress);
              lastProgress = progress;
            }
          }
        }
        
        // Concatenate chunks
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let position = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, position);
          position += chunk.length;
        }
        
        return result;
      } catch (err) {
        attempt++;
        
        if (attempt > retries) {
          throw err;
        }
        
        console.warn(`[FFmpeg] Error fetching ${input}, retrying... (${retries - attempt + 1} left)`);
        // Exponential backoff
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    
    throw new Error(`Failed to fetch after ${retries} retries`);
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
 * Enhanced FFmpeg loader with multiple strategies
 */
export async function ensureFFmpeg(): Promise<any> {
  if (ffmpegLoaded && ffmpeg) return ffmpeg;
  
  if (ffmpegError) throw ffmpegError;
  
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    try {
      // Report initial progress
      if (progressCallback) progressCallback(10);
      
      console.log('[FFmpeg] Loading FFmpeg from CDN...');
      
      try {
        // Primary CDN strategy
        await loadScript(CDN_URLS.ffmpegCore);
        if (progressCallback) progressCallback(30);
        
        await loadScript(CDN_URLS.ffmpeg);
        if (progressCallback) progressCallback(50);
      } catch (err) {
        // Fallback CDN strategy
        console.warn('[FFmpeg] Primary CDN failed, trying fallback CDNs');
        
        try {
          await loadScript(CDN_URLS.ffmpegCoreFallback);
          if (progressCallback) progressCallback(30);
          
          await loadScript(CDN_URLS.ffmpegFallback);
          if (progressCallback) progressCallback(50);
        } catch (fallbackErr) {
          throw new Error(`Failed to load FFmpeg from all CDNs: ${fallbackErr.message}`);
        }
      }
      
      // Verify FFmpeg is available on window
      if (!window.FFmpeg) {
        throw new Error('FFmpeg failed to load - window.FFmpeg is not defined');
      }
      
      console.log('[FFmpeg] Creating FFmpeg instance...');
      
      // Create FFmpeg instance with detailed logging
      ffmpeg = window.FFmpeg.createFFmpeg({
        log: true,
        logger: (message: string) => console.log(`[FFmpeg Worker] ${message}`),
        progress: ({ ratio }: { ratio: number }) => {
          const progressValue = 50 + Math.round(ratio * 50);
          if (progressCallback && progressValue !== lastProgress) {
            progressCallback(progressValue);
            lastProgress = progressValue;
          }
        }
      });
      
      console.log('[FFmpeg] Loading WASM...');
      await ffmpeg.load();
      
      console.log('[FFmpeg] Successfully loaded!');
      ffmpegLoaded = true;
      ffmpegError = null;
      if (progressCallback) progressCallback(100);
      
      return ffmpeg;
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
  
  ffmpegInstance.FS('writeFile', 'input.webm', await fetchToUint8Array(webmBlob));
  
  await ffmpegInstance.run(
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '128k',
    'output.mp4'
  );
  
  const data = ffmpegInstance.FS('readFile', 'output.mp4');
  
  ffmpegInstance.FS('unlink', 'input.webm');
  ffmpegInstance.FS('unlink', 'output.mp4');
  
  return new Blob([data.buffer], { type: 'video/mp4' });
}

/**
 * Convert WebM to GIF
 */
export async function convertWebmToGIF(webmBlob: Blob): Promise<Blob> {
  const ffmpegInstance = await ensureFFmpeg();
  
  ffmpegInstance.FS('writeFile', 'input.webm', await fetchToUint8Array(webmBlob));
  
  await ffmpegInstance.run(
    '-i', 'input.webm',
    '-vf', 'fps=15,scale=640:-1:flags=lanczos,palettegen',
    'palette.png'
  );
  
  await ffmpegInstance.run(
    '-i', 'input.webm',
    '-i', 'palette.png',
    '-filter_complex', 'fps=15,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse',
    'output.gif'
  );
  
  const data = ffmpegInstance.FS('readFile', 'output.gif');
  
  ffmpegInstance.FS('unlink', 'input.webm');
  ffmpegInstance.FS('unlink', 'palette.png');
  ffmpegInstance.FS('unlink', 'output.gif');
  
  return new Blob([data.buffer], { type: 'image/gif' });
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

// No need to redeclare FFmpeg type - already declared at the top of the file
