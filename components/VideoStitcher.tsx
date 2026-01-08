import React, { useState } from 'react';
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
import { Plus, Film, Download, ArrowLeft, AlertCircle } from 'lucide-react';

const VideoStitcher: React.FC = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: '',
    error: null
  });

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
      });
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
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                setVideos([]);
            }} 
            icon={<ArrowLeft size={20} />}
          >
            Create New
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
                    isLast={index === videos.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Bottom Actions - Sticky */}
      <div className="sticky bottom-0 bg-slate-900 pt-2 pb-4 space-y-3 border-t border-slate-800">
        <div className="relative">
             <Button variant="secondary" fullWidth icon={<Plus size={24} />}>
                Add Videos
             </Button>
             <input 
                type="file" 
                multiple 
                accept="video/*" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
             />
        </div>
        
        {videos.length >= 2 && (
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleStitch} 
            disabled={status.isProcessing}
            icon={<Film size={20} />}
          >
            Merge Videos ({videos.length})
          </Button>
        )}
      </div>
    </div>
  );
};

export default VideoStitcher;
