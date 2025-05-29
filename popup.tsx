import React, { useEffect } from "react"
import './globals.css'
import PopupHome from "./assets/components/PopupHome"
import { ensureFFmpeg } from "./assets/lib/ffmpegService"

function IndexPopup() {
  // Pre-load FFmpeg in background when popup is opened
  useEffect(() => {
    // Temporarily disable FFmpeg preloading to test core functionality first
    console.log("FFmpeg preloading temporarily disabled for CSP testing");
    
    // // Start loading FFmpeg in the background (non-blocking)
    // // This helps speed up the first conversion
    // const preloadFFmpeg = async () => {
    //   try {
    //     // We use a timeout to not block the UI rendering
    //     setTimeout(() => {
    //       ensureFFmpeg().catch(err => {
    //         console.error("Error pre-loading FFmpeg:", err);
    //       });
    //     }, 1000);
    //   } catch (error) {
    //     console.error("Failed to pre-load FFmpeg:", error);
    //   }
    // };
    
    // preloadFFmpeg();
  }, []);

  return (
    <div className="min-h-[400px] bg-slate-950 text-slate-100">
      <PopupHome />
    </div>
  )
}

export default IndexPopup
