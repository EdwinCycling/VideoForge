import React, { useState, useRef } from 'react';
import { Upload, Download, Share2, Image as ImageIcon, RotateCcw } from 'lucide-react';
import Button from './ui/Button';
import { loadVideoFromFile, extractFrameFromVideo, downloadDataUrl } from '../services/videoUtils';

const FrameExtractor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setError(null);
    setCapturedImage(null);

    try {
      const video = await loadVideoFromFile(selectedFile);
      // Seek to very end - 0.1s to ensure we get a visible frame and not EOF blackness
      const safeTime = Math.max(0, video.duration - 0.1);
      const dataUrl = await extractFrameFromVideo(video, safeTime, 1.0);
      setCapturedImage(dataUrl);
      URL.revokeObjectURL(video.src); // Cleanup
    } catch (err) {
      console.error(err);
      setError("Failed to process video. Please try another file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (capturedImage) {
      downloadDataUrl(capturedImage, `frame-${Date.now()}.jpg`);
    }
  };

  const handleShare = async () => {
    if (capturedImage && navigator.share) {
      try {
        const blob = await (await fetch(capturedImage)).blob();
        const file = new File([blob], "last-frame.jpg", { type: blob.type });
        await navigator.share({
          files: [file],
          title: 'Captured Frame',
          text: 'Check out this frame I captured!'
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      handleDownload();
    }
  };

  const reset = () => {
    setFile(null);
    setCapturedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto p-4 space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          Last Frame Extractor
        </h2>
        <p className="text-slate-400">Get the perfect ending shot from your video.</p>
      </div>

      {/* Result Container */}
      <div className={`
        flex-1 flex flex-col items-center justify-center w-full 
        rounded-2xl bg-slate-800/50 relative overflow-hidden transition-colors 
        ${capturedImage ? 'border-0 bg-transparent' : 'border-2 border-dashed border-slate-700 hover:border-indigo-500/50 min-h-[300px]'}
      `}>
        
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
             <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-indigo-200 font-medium">Extracting Frame...</span>
             </div>
          </div>
        )}

        {/* Empty State / Input */}
        {!file && !capturedImage && (
          <div className="text-center p-6 space-y-4">
            <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-lg font-medium">Tap to upload video</p>
            <p className="text-sm text-slate-500">Supports MP4, MOV, WebM</p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="video/*" 
              onChange={handleFileChange} 
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
        )}

        {/* Result State */}
        {capturedImage && !isLoading && (
          <div className="w-full flex items-center justify-center">
            <img 
              src={capturedImage} 
              alt="Captured Frame" 
              className="w-full h-auto max-h-[60vh] object-contain shadow-2xl rounded-2xl border border-slate-700/50" 
            />
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-center text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {capturedImage ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleDownload} icon={<Download size={20} />}>
                Save
              </Button>
              <Button variant="secondary" onClick={handleShare} icon={<Share2 size={20} />}>
                Share
              </Button>
            </div>
            <Button variant="secondary" onClick={reset} fullWidth icon={<RotateCcw size={20} />} className="opacity-70">
              Pick Another
            </Button>
          </>
        ) : (
             // Placeholder for button layout stability if needed, or just nothing
             <div className="h-12"></div>
        )}
      </div>
    </div>
  );
};

export default FrameExtractor;
