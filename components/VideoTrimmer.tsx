import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Scissors, Image as ImageIcon, RotateCcw } from 'lucide-react';
import Button from './ui/Button';
import { loadVideoFromFile, extractFrameFromVideo, downloadDataUrl } from '../services/videoUtils';
import { ffmpegService } from '../services/ffmpegService';
import { ProcessingState } from '../types';

const VideoTrimmer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [cutTime, setCutTime] = useState<number>(0);
  const [status, setStatus] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: '',
    error: null
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset old state
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(selectedFile);
    setStatus({ isProcessing: false, progress: 0, message: '', error: null });

    try {
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);

      // Load metadata to get duration
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        setDuration(tempVideo.duration);
        setCutTime(tempVideo.duration); // Default to full length
      };
    } catch (err) {
      console.error(err);
      setStatus(prev => ({ ...prev, error: "Failed to load video." }));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCutTime(time);
    
    // Seek video to preview the cut point
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleTrimVideo = async () => {
    if (!file || !videoRef.current) return;

    setStatus({ isProcessing: true, progress: 0, message: 'Trimming Video...', error: null });

    try {
      const resultUrl = await ffmpegService.trimVideo(file, cutTime, (progress) => {
        setStatus(prev => ({ ...prev, progress: Math.round(progress) }));
      });

      // Trigger download
      const a = document.createElement('a');
      a.href = resultUrl;
      a.download = `trimmed-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setStatus({ isProcessing: false, progress: 100, message: 'Done!', error: null });
    } catch (err: any) {
      console.error(err);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Trimming failed.' });
    }
  };

  const handleSaveLastFrame = async () => {
    if (!videoRef.current) return;

    setStatus({ isProcessing: true, progress: 0, message: 'Capturing Frame...', error: null });

    try {
      // Use the current cutTime as the frame to extract
      // Ensure we don't go past video bounds
      const frameTime = Math.min(cutTime, videoRef.current.duration);
      const dataUrl = await extractFrameFromVideo(videoRef.current, frameTime, 1.0);
      downloadDataUrl(dataUrl, `frame-at-${frameTime.toFixed(1)}s.jpg`);
      setStatus({ isProcessing: false, progress: 0, message: '', error: null });
    } catch (err) {
      console.error(err);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Frame capture failed.' });
    }
  };

  const reset = () => {
    setFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setDuration(0);
    setCutTime(0);
    setStatus({ isProcessing: false, progress: 0, message: '', error: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const adjustTime = (delta: number) => {
    setCutTime(prev => {
      const newTime = Math.max(0, Math.min(duration, prev + delta));
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
      return newTime;
    });
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto p-4 space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-rose-400">
          Trim & Capture
        </h2>
        <p className="text-slate-400 text-sm">Shorten video and save the final moment.</p>
      </div>

      <div className="flex-1 flex flex-col w-full relative">
        
        {/* Main Video Display */}
        <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative aspect-video flex items-center justify-center">
          {!videoUrl ? (
            <div className="text-center p-6 space-y-4">
               <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                 <Upload className="w-8 h-8 text-pink-400" />
               </div>
               <p className="text-slate-300">Upload video to start</p>
               <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="video/*" 
                  onChange={handleFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
            </div>
          ) : (
            <video 
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              playsInline
              muted
              // We don't autoplay, we let user control via slider mostly
            />
          )}

          {/* Loading Overlay */}
          {status.isProcessing && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
               <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-pink-200 font-medium">{status.message}</span>
               </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {videoUrl && (
          <div className="mt-6 space-y-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
            
            <div className="space-y-2">
               <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-400">Length</span>
                  <span className="text-pink-300">{formatTime(cutTime)} / {formatTime(duration)}</span>
               </div>
               <input 
                 type="range" 
                 min="0" 
                 max={duration} 
                 step="0.1" 
                 value={cutTime} 
                 onChange={handleSliderChange}
                 className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400"
               />
               <p className="text-xs text-center text-slate-500">Drag slider to set new end point</p>
               
               {/* Fine Controls */}
               <div className="flex items-center justify-center gap-2 pt-2">
                  <button onClick={() => adjustTime(-1)} className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">-1s</button>
                  <button onClick={() => adjustTime(-0.1)} className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">-0.1s</button>
                  <button onClick={() => adjustTime(-0.04)} className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">-1fr</button>
                  <div className="w-px h-4 bg-slate-700 mx-2"></div>
                  <button onClick={() => adjustTime(0.04)} className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">+1fr</button>
                  <button onClick={() => adjustTime(0.1)} className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">+0.1s</button>
                  <button onClick={() => adjustTime(1)} className="px-2 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">+1s</button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <Button 
                  onClick={handleTrimVideo} 
                  disabled={status.isProcessing}
                  icon={<Scissors size={18} />}
                  className="bg-pink-600 hover:bg-pink-500 shadow-pink-500/20"
               >
                 Save Video
               </Button>
               <Button 
                  onClick={handleSaveLastFrame} 
                  disabled={status.isProcessing}
                  icon={<ImageIcon size={18} />}
                  className="bg-rose-600 hover:bg-rose-500 shadow-rose-500/20"
               >
                 Save Frame
               </Button>
            </div>
            
            <Button variant="secondary" onClick={reset} fullWidth icon={<RotateCcw size={18} />} className="opacity-80">
              New Project
            </Button>
          </div>
        )}

        {status.error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-center text-sm">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoTrimmer;