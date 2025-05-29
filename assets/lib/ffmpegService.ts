// FFmpeg integration for video format conversion
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Type definitions for FFmpeg data
type FFmpegFileData = Uint8Array | ArrayBuffer;

// Type for FFmpeg instance
let ffmpeg: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoaded = false;
let progressCallback: ((progress: number) => void) | null = null;

/**
 * Set a callback to receive loading progress updates
 */
export function setProgressCallback(callback: (progress: number) => void) {
  progressCallback = callback;
}

/**
 * Lazily load FFmpeg when needed
 */
export async function ensureFFmpeg(): Promise<FFmpeg> {
  if (ffmpegLoaded && ffmpeg) {
    return ffmpeg;
  }
  
  if (ffmpegLoading) {
    // Wait for loading to complete
    return new Promise<FFmpeg>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (ffmpegLoaded && ffmpeg) {
          clearInterval(checkInterval);
          resolve(ffmpeg);
        }
      }, 200);
      
      // Timeout after 20 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("FFmpeg loading timeout"));
      }, 20000);
    });
  }
  
  try {
    ffmpegLoading = true;
    
    // Report 10% progress for starting the load
    if (progressCallback) progressCallback(10);
    
    // Create a new FFmpeg instance
    ffmpeg = new FFmpeg();
    
    // Set up progress logging
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg log:', message);
    });
    
    // Load FFmpeg core
    ffmpeg.on('progress', ({ progress }) => {
      // Scale progress from 0-1 to 20-90 (reserve 10% for starting, 10% for final setup)
      const scaledProgress = 20 + progress * 70;
      if (progressCallback) progressCallback(scaledProgress);
    });
    
    // Report 20% progress before main loading starts
    if (progressCallback) progressCallback(20);
    
    // Load FFmpeg from CDN
    const baseURL = 'https://unpkg.com/@ffmpeg';
    
    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${baseURL}/core@0.12.10/dist/ffmpeg-core.js`,
        'text/javascript'
      ),
      wasmURL: await toBlobURL(
        `${baseURL}/core@0.12.10/dist/ffmpeg-core.wasm`,
        'application/wasm'
      )
    });
    
    // Report 100% progress when fully loaded
    if (progressCallback) progressCallback(100);
    
    ffmpegLoaded = true;
    ffmpegLoading = false;
    return ffmpeg;
  } catch (error) {
    ffmpegLoading = false;
    console.error("Error loading FFmpeg:", error);
    throw error;
  }
}

/**
 * Convert WebM to MP4
 */
export async function convertWebmToMP4(webmBlob: Blob): Promise<Blob> {
  try {
    // Ensure FFmpeg is loaded
    const ffmpegInstance = await ensureFFmpeg();
    
    // Create file names
    const inputFileName = 'input.webm';
    const outputFileName = 'output.mp4';
    
    // Write the webm file to FFmpeg's virtual file system
    ffmpegInstance.writeFile(inputFileName, await fetchFile(webmBlob));
    
    // Run the FFmpeg command to convert WebM to MP4
    await ffmpegInstance.exec([
      '-i', inputFileName,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      outputFileName
    ]);
    
    // Read the output file
    const data = await ffmpegInstance.readFile(outputFileName);
    
    // Convert to blob - using any to bypass TypeScript checking since we know the data is usable as a BlobPart
    const mp4Blob = new Blob([data as any], { type: 'video/mp4' });
    
    // Clean up files
    await ffmpegInstance.deleteFile(inputFileName);
    await ffmpegInstance.deleteFile(outputFileName);
    
    return mp4Blob;
  } catch (error) {
    console.error('Error converting WebM to MP4:', error);
    throw error;
  }
}

/**
 * Convert WebM to GIF
 */
export async function convertWebmToGIF(webmBlob: Blob): Promise<Blob> {
  try {
    // Ensure FFmpeg is loaded
    const ffmpegInstance = await ensureFFmpeg();
    
    // Create file names
    const inputFileName = 'input.webm';
    const paletteFileName = 'palette.png';
    const outputFileName = 'output.gif';
    
    // Write the webm file to FFmpeg's virtual file system
    ffmpegInstance.writeFile(inputFileName, await fetchFile(webmBlob));
    
    // Generate a palette for better quality GIF
    await ffmpegInstance.exec([
      '-i', inputFileName,
      '-vf', 'fps=15,scale=640:-1:flags=lanczos,palettegen',
      paletteFileName
    ]);
    
    // Convert to GIF using the palette
    await ffmpegInstance.exec([
      '-i', inputFileName,
      '-i', paletteFileName,
      '-filter_complex', 'fps=15,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse',
      outputFileName
    ]);
    
    // Read the output file
    const data = await ffmpegInstance.readFile(outputFileName);
    
    // Convert to blob - using any to bypass TypeScript checking since we know the data is usable as a BlobPart
    const gifBlob = new Blob([data as any], { type: 'image/gif' });
    
    // Clean up files
    await ffmpegInstance.deleteFile(inputFileName);
    await ffmpegInstance.deleteFile(paletteFileName);
    await ffmpegInstance.deleteFile(outputFileName);
    
    return gifBlob;
  } catch (error) {
    console.error('Error converting WebM to GIF:', error);
    throw error;
  }
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
  return ffmpegLoading;
}
