import React, { useState, useRef, useEffect } from 'react';
import { Eraser, Upload, Download, ArrowLeft, AlertCircle, Maximize2, Minimize2, X } from 'lucide-react';
import { ffmpegService } from '../services/ffmpegService';
import { ProcessingState } from '../types';
import Button from './ui/Button';

const WatermarkRemover: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: '',
    error: null
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Area state (in percentages for UI, will convert to pixels for FFmpeg)
  const [area, setArea] = useState(() => {
    const saved = localStorage.getItem('vf_watermark_area');
    return saved ? JSON.parse(saved) : { x: 10, y: 10, width: 20, height: 10 };
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save area to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('vf_watermark_area', JSON.stringify(area));
  }, [area]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setVideoUrl(URL.createObjectURL(selectedFile));
      setResultUrl(null);
    }
  };

  const handleProcess = async () => {
    if (!file || !videoRef.current) return;

    setStatus({ isProcessing: true, progress: 0, message: 'Logo aan het verwijderen...', error: null });

    try {
      // Get actual video dimensions
      const video = videoRef.current;
      const actualWidth = video.videoWidth;
      const actualHeight = video.videoHeight;

      // Convert percentages to pixels
      const x = Math.round((area.x / 100) * actualWidth);
      const y = Math.round((area.y / 100) * actualHeight);
      const w = Math.round((area.width / 100) * actualWidth);
      const h = Math.round((area.height / 100) * actualHeight);

      const url = await ffmpegService.removeWatermark(file, x, y, w, h, (progress) => {
        setStatus(prev => ({ ...prev, progress: Math.round(progress) }));
      });

      setResultUrl(url);
    } catch (err: any) {
      console.error(err);
      setStatus(prev => ({ ...prev, error: err.message || 'Verwijderen mislukt.' }));
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
    }
  };

  if (resultUrl) {
    return (
      <div className="flex flex-col h-full p-4 space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-center text-green-400">Watermerk Verwijderd!</h2>
        <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
          <video 
            src={resultUrl} 
            controls 
            playsInline
            preload="auto"
            className="w-full h-full object-contain" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={() => {
              const a = document.createElement('a');
              a.href = resultUrl;
              a.download = `no_watermark_${file?.name}`;
              a.click();
            }}
            icon={<Download size={20} />}
          >
            Opslaan
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => {
              setResultUrl(null);
              setFile(null);
              setVideoUrl(null);
            }}
            icon={<ArrowLeft size={20} />}
          >
            Nieuwe Video
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-indigo-400 flex items-center justify-center gap-3">
          <Eraser size={32} /> Watermark Remover
        </h2>
        <p className="text-slate-400 text-sm mt-1">Selecteer het gebied van het watermerk om het te laten vervagen.</p>
      </div>

      {!videoUrl ? (
        <label className="flex-1 border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="text-indigo-400" size={32} />
          </div>
          <div className="text-center">
            <p className="text-slate-200 font-medium">Klik om een video te uploaden</p>
            <p className="text-slate-500 text-sm">MP4, MOV of WebM</p>
          </div>
          <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-700 flex-1 min-h-[300px]" ref={containerRef}>
            <video 
              ref={videoRef}
              src={videoUrl} 
              playsInline
              preload="auto"
              className="w-full h-full object-contain pointer-events-none"
            />
            
            {/* Fullscreen Toggle Button */}
            <button 
              onClick={() => setIsFullscreen(true)}
              className="absolute top-4 right-4 z-10 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl transition-all border border-slate-700/50 backdrop-blur-md group"
              title="Volledig scherm voor precisie"
            >
              <Maximize2 size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            
            {/* Selection Overlay */}
            <div 
              className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              style={{
                left: `${area.x}%`,
                top: `${area.y}%`,
                width: `${area.width}%`,
                height: `${area.height}%`,
              }}
            >
              <div className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Watermerk Gebied
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 space-y-6 shadow-xl">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Maximize2 size={12} /> Positie Horizontaal (X)
                  </span>
                  <input 
                    type="range" min="0" max={100 - area.width} value={area.x}
                    onChange={(e) => setArea({ ...area, x: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Maximize2 size={12} className="rotate-90" /> Positie Verticaal (Y)
                  </span>
                  <input 
                    type="range" min="0" max={100 - area.height} value={area.y}
                    onChange={(e) => setArea({ ...area, y: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                  />
                </label>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Breedte</span>
                  <input 
                    type="range" min="1" max={100 - area.x} value={area.width}
                    onChange={(e) => setArea({ ...area, width: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hoogte</span>
                  <input 
                    type="range" min="1" max={100 - area.y} value={area.height}
                    onChange={(e) => setArea({ ...area, height: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                  />
                </label>
              </div>
            </div>

            <Button 
              fullWidth 
              onClick={handleProcess}
              disabled={status.isProcessing}
              icon={<Eraser size={20} />}
            >
              Watermerk Verwijderen
            </Button>
          </div>
        </div>
      )}

      {/* Progress Overlay */}
      {status.isProcessing && (
         <div className="absolute inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm rounded-3xl">
            <div className="w-full max-w-md space-y-5 text-center">
               <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
               <h3 className="text-xl font-bold text-white">{status.message}</h3>
               <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                 <div className="bg-indigo-500 h-2 transition-all duration-300" style={{ width: `${status.progress}%` }} />
               </div>
               <p className="text-slate-400 text-sm">{status.progress}% voltooid</p>
            </div>
         </div>
      )}

      {status.error && (
        <div className="bg-red-900/40 border border-red-500/50 p-4 rounded-2xl text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5 text-red-400" size={20} />
          <p>{status.error}</p>
        </div>
      )}

      {/* Fullscreen Precision Editor */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between p-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Maximize2 size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold">Precisie Editor</h3>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Stel de marker heel nauwkeurig in</p>
              </div>
            </div>
            <button 
              onClick={() => setIsFullscreen(false)}
              className="p-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded-xl transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <video 
              src={videoUrl || ''} 
              playsInline
              preload="auto"
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
            
            {/* Selection Overlay (Larger in fullscreen) */}
            <div 
              className="absolute border-2 border-red-500 bg-red-500/30 pointer-events-none shadow-[0_0_30px_rgba(239,68,68,0.6)]"
              style={{
                left: `${area.x}%`,
                top: `${area.y}%`,
                width: `${area.width}%`,
                height: `${area.height}%`,
              }}
            >
              <div className="absolute -top-8 left-0 bg-red-500 text-white text-xs px-3 py-1 rounded-md font-bold uppercase tracking-widest shadow-lg">
                Watermerk Gebied
              </div>
              {/* Corner indicators for visual aid */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white"></div>
            </div>
          </div>

          <div className="p-8 bg-slate-900/90 border-t border-slate-800 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Maximize2 size={12} /> Horizontale Positie (X): <span className="text-indigo-400">{area.x}%</span>
                    </span>
                  </div>
                  <input 
                    type="range" min="0" max={100 - area.width} value={area.x}
                    onChange={(e) => setArea({ ...area, x: parseInt(e.target.value) })}
                    className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Maximize2 size={12} className="rotate-90" /> Verticale Positie (Y): <span className="text-indigo-400">{area.y}%</span>
                    </span>
                  </div>
                  <input 
                    type="range" min="0" max={100 - area.height} value={area.y}
                    onChange={(e) => setArea({ ...area, y: parseInt(e.target.value) })}
                    className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Breedte: <span className="text-indigo-400">{area.width}%</span></span>
                  </div>
                  <input 
                    type="range" min="1" max={100 - area.x} value={area.width}
                    onChange={(e) => setArea({ ...area, width: parseInt(e.target.value) })}
                    className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hoogte: <span className="text-indigo-400">{area.height}%</span></span>
                  </div>
                  <input 
                    type="range" min="1" max={100 - area.y} value={area.height}
                    onChange={(e) => setArea({ ...area, height: parseInt(e.target.value) })}
                    className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
               <Button 
                variant="primary" 
                onClick={() => setIsFullscreen(false)}
                className="px-12 py-3 text-lg"
                icon={<Minimize2 size={24} />}
              >
                Klaar met instellen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatermarkRemover;