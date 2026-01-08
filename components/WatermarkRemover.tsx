import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Film, Frame, Palette, Maximize2, RefreshCcw } from 'lucide-react';
import { ffmpegService } from '../services/ffmpegService';
import { ProcessingState } from '../types';
import Button from './ui/Button';

interface SilhouetteSettings {
  type: 'rect' | 'cinema';
  size: number;
  color: string;
}

const VideoSilhouette: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: '',
    error: null
  });

  const [settings, setSettings] = useState<SilhouetteSettings>(() => {
    const saved = localStorage.getItem('vf_silhouette_settings');
    return saved ? JSON.parse(saved) : { type: 'rect', size: 5, color: '#ffffff' };
  });

  useEffect(() => {
    localStorage.setItem('vf_silhouette_settings', JSON.stringify(settings));
  }, [settings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setVideoUrl(URL.createObjectURL(selectedFile));
      setResultUrl(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setStatus({ isProcessing: true, progress: 0, message: 'Silhouet toepassen...', error: null });
    
    try {
      const url = await ffmpegService.applySilhouette(file, settings, (progress) => {
        setStatus(prev => ({ ...prev, progress: Math.round(progress) }));
      });
      setResultUrl(url);
    } catch (err: any) {
      console.error(err);
      setStatus(prev => ({ ...prev, error: 'Verwerking mislukt.' }));
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const reset = () => {
    setFile(null);
    setVideoUrl(null);
    setResultUrl(null);
  };

  // Preview Style Calculation
  const getPreviewStyle = () => {
    const thickness = settings.size; // Scaled for CSS
    if (settings.type === 'rect') {
      return {
        border: `${thickness}px solid ${settings.color}`,
        inset: '0px',
      };
    } else {
      return {
        borderTop: `${thickness}px solid ${settings.color}`,
        borderBottom: `${thickness}px solid ${settings.color}`,
        inset: '0px',
      };
    }
  };

  if (resultUrl) {
    return (
      <div className="flex flex-col h-full p-6 animate-fade-in space-y-6">
        <h2 className="text-2xl font-bold text-center text-green-400">Video Klaar!</h2>
        
        <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-700 flex items-center justify-center">
          <video 
            src={resultUrl} 
            controls 
            className="max-h-full max-w-full" 
            crossOrigin="anonymous"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={() => {
                const a = document.createElement('a');
                a.href = resultUrl;
                a.download = `silhouette_video.mp4`;
                a.click();
            }} 
            icon={<Download size={20} />}
          >
            Opslaan
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setResultUrl(null)} 
            icon={<RefreshCcw size={20} />}
          >
            Opnieuw Bewerken
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-indigo-400">Video Silhouet</h2>
        <p className="text-slate-400 text-sm">Voeg kaders en randen toe aan je video.</p>
      </div>

      {!file ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors p-10 group">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Upload size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Upload een video</h3>
          <p className="text-slate-400 text-center max-w-xs mb-8">
            Sleep je bestand hierheen of klik om te uploaden
          </p>
          <div className="relative">
            <Button icon={<Upload size={20} />}>Bestand Kiezen</Button>
            <input 
              type="file" 
              accept="video/*" 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
          {/* Settings Panel */}
          <div className="w-full lg:w-80 bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 space-y-6 overflow-y-auto">
             <div className="space-y-4">
               <h3 className="font-bold text-white flex items-center gap-2">
                 <Frame size={18} className="text-indigo-400" />
                 Stijl Instellingen
               </h3>
               
               {/* Type Selection */}
               <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-400 uppercase">Type Lijst</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={() => setSettings(s => ({ ...s, type: 'rect' }))}
                     className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                       settings.type === 'rect' 
                         ? 'bg-indigo-600 border-indigo-500 text-white' 
                         : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                     }`}
                   >
                     <div className="w-8 h-6 border-2 border-current rounded-sm"></div>
                     <span className="text-xs">Kader</span>
                   </button>
                   <button
                     onClick={() => setSettings(s => ({ ...s, type: 'cinema' }))}
                     className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                       settings.type === 'cinema' 
                         ? 'bg-indigo-600 border-indigo-500 text-white' 
                         : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                     }`}
                   >
                     <div className="w-8 h-6 border-y-4 border-current rounded-sm"></div>
                     <span className="text-xs">Cinema</span>
                   </button>
                 </div>
               </div>

               {/* Size Slider */}
               <div className="space-y-2">
                 <div className="flex justify-between">
                   <label className="text-xs font-semibold text-slate-400 uppercase">Grootte</label>
                   <span className="text-xs text-indigo-400 font-mono">{settings.size}</span>
                 </div>
                 <input 
                   type="range" 
                   min="1" 
                   max="50" 
                   value={settings.size} 
                   onChange={(e) => setSettings(s => ({ ...s, size: parseInt(e.target.value) }))}
                   className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                 />
               </div>

               {/* Color Picker */}
               <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-400 uppercase">Kleur</label>
                 <div className="flex items-center gap-3">
                   <div 
                     className="w-10 h-10 rounded-lg border border-slate-600 shadow-inner"
                     style={{ backgroundColor: settings.color }}
                   />
                   <input 
                     type="color" 
                     value={settings.color}
                     onChange={(e) => setSettings(s => ({ ...s, color: e.target.value }))}
                     className="flex-1 bg-slate-700 h-10 rounded-lg cursor-pointer px-1 py-1"
                   />
                 </div>
               </div>
             </div>

             <div className="pt-4 border-t border-slate-700 space-y-3">
               <Button 
                 fullWidth 
                 onClick={handleProcess}
                 disabled={status.isProcessing}
                 icon={status.isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Film size={20} />}
               >
                 {status.isProcessing ? 'Verwerken...' : 'Video Genereren'}
               </Button>
               <Button variant="secondary" fullWidth onClick={reset}>
                 Annuleren
               </Button>
             </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 bg-black/50 rounded-2xl border border-slate-700 flex items-center justify-center p-8 relative overflow-hidden">
             {status.isProcessing && (
                <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="font-bold">{status.progress}%</p>
                  <p className="text-sm text-slate-400">{status.message}</p>
                </div>
             )}

            <div className="relative transition-all duration-300 shadow-2xl overflow-hidden">
               <video 
                 src={videoUrl!} 
                 className="max-h-[60vh] max-w-full block" 
                 controls={false}
                 muted
                 autoPlay
                 loop
                 playsInline
                 crossOrigin="anonymous"
               />
               <div 
                 className="absolute pointer-events-none transition-all duration-300"
                 style={getPreviewStyle()}
               />
            </div>
             
             <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-white border border-white/10 pointer-events-none">
               Live Preview
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoSilhouette;