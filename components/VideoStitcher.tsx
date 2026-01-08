import React, { useState, useEffect, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { VideoFile, ProcessingState, TransitionType } from '../types';
import { generateThumbnail, loadVideoFromFile } from '../services/videoUtils';
import { ffmpegService } from '../services/ffmpegService';
import Button from './ui/Button';
import SortableVideoItem from './SortableVideoItem';
import { Plus, Film, Download, ArrowLeft, AlertCircle, Music, Scissors, Search, Volume2, X } from 'lucide-react';

// Vrij te gebruiken audio bestanden (CORS-vriendelijke bronnen via proxy)
const FREE_AUDIO_LIBRARY = [
  { id: '1', name: 'Inspiring Dreams', url: 'https://cdn.pixabay.com/audio/2022/10/14/audio_9939f7510d.mp3', author: 'Pixabay' },
  { id: '2', name: 'Corporate Motivation', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_50278917e7.mp3', author: 'Pixabay' },
  { id: '3', name: 'Happy Upbeat', url: 'https://cdn.pixabay.com/audio/2022/11/22/audio_feb3768800.mp3', author: 'Pixabay' },
  { id: '4', name: 'Summer Travel', url: 'https://cdn.pixabay.com/audio/2022/01/21/audio_31743c589f.mp3', author: 'Pixabay' },
  { id: '5', name: 'Lofi Chill', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_180873748b.mp3', author: 'Pixabay' },
  { id: '6', name: 'Ambient Nature', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b123685e.mp3', author: 'Pixabay' },
];

const VideoStitcher: React.FC = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [backgroundAudio, setBackgroundAudio] = useState<File | string | null>(null);
  const [backgroundAudioName, setBackgroundAudioName] = useState<string | null>(null);
  const [showAudioPopup, setShowAudioPopup] = useState(false);
  const [audioSearchQuery, setAudioSearchQuery] = useState('');
  
  const [status, setStatus] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: '',
    error: null
  });

  const [pixabayAudio, setPixabayAudio] = useState<any[]>([]);
  const [isSearchingAudio, setIsSearchingAudio] = useState(false);

  // Pixabay API Key vanuit omgevingsvariabelen
  const PIXABAY_API_KEY = import.meta.env.VITE_PIXABAY_API_KEY || ''; // Geen hardcoded fallback om security scans te passeren

  // Hulpfunctie om CORS-problemen te omzeilen voor audiobestanden
  const getProxiedUrl = (url: string) => {
    if (!url) return '';
    return url;
  };

  const searchPixabayMusic = useCallback(async (query: string) => {
    if (!query) {
      setPixabayAudio([]);
      return;
    }

    setIsSearchingAudio(true);
    try {
      const response = await fetch(
        `https://pixabay.com/api/music/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=15&lang=nl&safesearch=true`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pixabay Fout: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.hits) {
        setPixabayAudio(data.hits.map((hit: any) => ({
          id: hit.id.toString(),
          name: hit.title || 'Onbekend nummer',
          url: hit.audio,
          author: hit.user || 'Pixabay Artiest',
          duration: hit.duration,
          tags: hit.tags
        })));
      }
    } catch (error: any) {
      console.error("Pixabay API error:", error);
      // Toon foutmelding aan gebruiker indien nodig
    } finally {
      setIsSearchingAudio(false);
    }
  }, [PIXABAY_API_KEY]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (audioSearchQuery) {
        searchPixabayMusic(audioSearchQuery);
      } else {
        setPixabayAudio([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [audioSearchQuery, searchPixabayMusic]);

  const [lastLog, setLastLog] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Fix for buttons not clicking inside sortable
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    setStatus(prev => ({ ...prev, isProcessing: true, message: 'Analyzing videos...' }));

    const newFiles: VideoFile[] = [];
    const fileList = Array.from(e.target.files) as File[];

    try {
      for (const file of fileList) {
        const thumb = await generateThumbnail(file);
        let duration = 0;
        let width = 0;
        let height = 0;
        
        try {
            const tempVid = await loadVideoFromFile(file);
            duration = tempVid.duration;
            width = tempVid.videoWidth;
            height = tempVid.videoHeight;
            URL.revokeObjectURL(tempVid.src);
        } catch(e) {
          console.warn("Could not load video metadata", e);
        }

        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          thumbnail: thumb,
          duration,
          width,
          height,
          transition: {
            type: TransitionType.NONE,
            duration: 1
          }
        });
      }
      setVideos(prev => [...prev, ...newFiles]);
    } catch (err) {
      console.error(err);
      setStatus(prev => ({ ...prev, error: 'Failed to load videos.' }));
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false, message: '' }));
      e.target.value = '';
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setVideos((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemove = (id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const handleUpdateTransition = (id: string, transition: { type: TransitionType, duration: number }) => {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, transition } : v));
  };

  const validateVideos = (): boolean => {
    if (videos.length < 2) {
      setStatus(prev => ({ ...prev, error: 'Add at least two videos to stitch.' }));
      return false;
    }
    return true;
  };

  const handleExtractAudio = async (video: VideoFile) => {
    setStatus({ isProcessing: true, progress: 0, message: 'Extracting audio...', error: null });
    try {
      const audioUrl = await ffmpegService.extractAudio(video.file, (progress) => {
        setStatus(prev => ({ ...prev, progress: Math.round(progress) }));
      });
      
      // Download the extracted audio
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `${video.file.name.split('.')[0]}_audio.mp3`;
      a.click();
      
      setStatus(prev => ({ ...prev, isProcessing: false, message: 'Audio extracted!' }));
      setTimeout(() => setStatus(prev => ({ ...prev, message: '' })), 2000);
    } catch (err: any) {
      console.error(err);
      setStatus(prev => ({ ...prev, error: 'Audio extraction failed.' }));
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleStitch = async () => {
    if (!validateVideos()) return;

    setLastLog('');
    setStatus({ isProcessing: true, progress: 0, message: 'Preparing your video...', error: null });
    
    try {
      const url = await ffmpegService.stitchVideos(videos, (progress) => {
        const p = Math.round(progress);
        setStatus(prev => ({
          ...prev, 
          progress: p,
          message: p >= 100 ? 'Finalizing video...' : 'Merging clips...' 
        }));
      }, (text) => {
        setLastLog(text);
        console.debug('[FFmpeg]', text);
      }, backgroundAudio || undefined);
      setResultVideoUrl(url);
    } catch (err: any) {
      console.error(err);
      setStatus(prev => ({ 
        ...prev, 
        error: err.message || 'Stitching failed.' 
      }));
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Audio Selection Popup
  const renderAudioPopup = () => {
    if (!showAudioPopup) return null;

    const displayAudio = audioSearchQuery ? pixabayAudio : FREE_AUDIO_LIBRARY;

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAudioPopup(false)} />
        <div className="relative bg-slate-900 w-full max-w-lg sm:rounded-3xl border-t sm:border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Music className="text-indigo-400" size="20" />
              Pixabay Muziek
            </h3>
            <button onClick={() => setShowAudioPopup(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
              <X size="20" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size="18" />
              <input 
                type="text"
                placeholder="Zoek op genre, sfeer of instrument..."
                value={audioSearchQuery}
                onChange={(e) => setAudioSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {audioSearchQuery ? 'Pixabay Resultaten' : 'Aanbevolen Tracks'}
                </p>
                {isSearchingAudio && (
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <div className="space-y-2">
                {displayAudio.length === 0 && !isSearchingAudio ? (
                  <div className="py-10 text-center space-y-2">
                    <Search size="32" className="mx-auto text-slate-700" />
                    <p className="text-slate-500 text-sm">Geen audio gevonden voor "{audioSearchQuery}"</p>
                  </div>
                ) : (
                  displayAudio.map(audio => (
                    <div key={audio.id} className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-3 flex items-center justify-between group hover:border-indigo-500/50 transition-colors">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-white truncate">{audio.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-tight">{audio.author}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <audio 
                          id={`audio-${audio.id}`} 
                          src={getProxiedUrl(audio.url)} 
                          preload="none" 
                          crossOrigin="anonymous"
                        />
                        <button 
                          onClick={async () => {
                            const el = document.getElementById(`audio-${audio.id}`) as HTMLAudioElement;
                            if (el.paused) {
                              document.querySelectorAll('audio').forEach(a => {
                                if (a.id !== `audio-${audio.id}`) {
                                  a.pause();
                                  a.currentTime = 0;
                                }
                              });
                              
                              try {
                                await el.play();
                              } catch (err) {
                                console.error("Audio play failed:", err);
                              }
                            } else {
                              el.pause();
                            }
                          }}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl transition-colors"
                          title="Luister voorbeeld"
                        >
                          <Volume2 size="16" />
                        </button>
                        <button 
                          onClick={() => {
                            setBackgroundAudio(getProxiedUrl(audio.url));
                            setBackgroundAudioName(audio.name);
                            setShowAudioPopup(false);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors"
                        >
                          Kies
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 pb-2 text-center border-t border-slate-800/50">
              <a 
                href="https://pixabay.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
              >
                Muziek van <span className="font-bold">Pixabay</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Result View
  if (resultVideoUrl) {
    return (
      <div className="flex flex-col h-full p-4 animate-fade-in space-y-6">
        <h2 className="text-2xl font-bold text-center text-green-400">Video Created!</h2>
        
        <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-700">
          <video 
            src={resultVideoUrl} 
            controls 
            className="w-full h-full object-contain" 
            playsInline
            preload="auto"
            crossOrigin="anonymous"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button 
            onClick={() => {
                const a = document.createElement('a');
                a.href = resultVideoUrl;
                const ext = (videos[0]?.file?.name.split('.').pop() || 'mp4').toLowerCase();
                a.download = `stitched_video.${ext}`;
                a.click();
            }} 
            icon={<Download size={20} />}
          >
            Save
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => {
                setResultVideoUrl(null);
            }} 
            icon={<Plus size={20} />}
          >
            Edit
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => {
                setResultVideoUrl(null);
                setVideos([]);
            }} 
            icon={<ArrowLeft size={20} />}
          >
            New
          </Button>
        </div>
      </div>
    );
  }

  // Main Editor View
  return (
    <div className="flex flex-col h-full max-w-lg mx-auto p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-indigo-400">Video Stitcher</h2>
        <p className="text-slate-400 text-sm">Drag to reorder. Merge identical clips.</p>
      </div>

      {/* Progress Overlay */}
      {status.isProcessing && (
         <div className="absolute inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
            <div className="w-full max-w-md space-y-5 text-center">
               <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
               <h3 className="text-xl font-bold text-white">{status.message}</h3>
               <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                 <div className="bg-indigo-500 h-2 transition-all duration-300" style={{ width: `${status.progress}%` }} />
               </div>
               <p className="text-slate-400 text-sm">Processing your video...</p>
               {lastLog && (
                 <div className="mt-4 p-2 bg-black/40 rounded text-[10px] text-slate-500 font-mono truncate max-w-xs mx-auto">
                   {lastLog}
                 </div>
               )}
            </div>
         </div>
      )}

      {/* Error Message */}
      {status.error && (
        <div className="bg-red-900/40 border border-red-500/50 p-4 rounded-xl text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5 text-red-400" size={20} />
          <div className="flex-1">
             <p className="whitespace-pre-line">{status.error}</p>
             <button onClick={() => setStatus(s => ({...s, error: null}))} className="mt-3 text-xs bg-red-800/50 hover:bg-red-800 px-3 py-1 rounded transition-colors uppercase font-bold tracking-wide">
               Dismiss
             </button>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto min-h-[300px] bg-slate-800/30 rounded-2xl p-2 border border-slate-800/50">
        {videos.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-60">
              <Film size={48} />
              <p>No videos added yet</p>
           </div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={videos.map(v => v.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 pb-20">
                {videos.map((video, index) => (
                  <SortableVideoItem 
                    key={video.id} 
                    video={video} 
                    onRemove={handleRemove} 
                    onUpdateTransition={handleUpdateTransition}
                    onExtractAudio={handleExtractAudio}
                    isLast={index === videos.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Selected Audio Info */}
      {backgroundAudioName && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Music size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Achtergrondaudio</p>
              <p className="text-sm text-white font-medium truncate max-w-[200px]">{backgroundAudioName}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setBackgroundAudio(null);
              setBackgroundAudioName(null);
            }}
            className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Bottom Actions - Sticky */}
      <div className="sticky bottom-0 bg-slate-900 pt-2 pb-4 space-y-3 border-t border-slate-800">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
               <Button variant="secondary" fullWidth icon={<Plus size={24} />}>
                  Video's
               </Button>
               <input 
                  type="file" 
                  multiple 
                  accept="video/*" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
               />
          </div>
          <Button 
            variant="secondary" 
            fullWidth 
            onClick={() => setShowAudioPopup(true)}
            icon={<Music size={20} />}
          >
            Audio
          </Button>
        </div>
        
        {videos.length >= 2 && (
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleStitch} 
            disabled={status.isProcessing}
            icon={<Film size={20} />}
          >
            Video Maken ({videos.length})
          </Button>
        )}
      </div>

      {renderAudioPopup()}
    </div>
  );
};

export default VideoStitcher;
