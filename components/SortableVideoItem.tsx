import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical, Settings2 } from 'lucide-react';
import { VideoFile, TransitionType } from '../types';

interface Props {
  video: VideoFile;
  onRemove: (id: string) => void;
  onUpdateTransition: (id: string, transition: { type: TransitionType, duration: number }) => void;
  isLast?: boolean;
}

const SortableVideoItem: React.FC<Props> = ({ video, onRemove, onUpdateTransition, isLast }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const currentTransition = video.transition || { type: TransitionType.NONE, duration: 1 };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div
        className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-sm touch-manipulation"
      >
        <div 
          {...attributes} 
          {...listeners} 
          className="text-slate-500 cursor-grab active:cursor-grabbing p-2 hover:bg-slate-700 rounded-lg"
        >
          <GripVertical size={24} />
        </div>

        <div className="w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 relative border border-slate-600">
          <img 
              src={video.thumbnail} 
              alt="thumb" 
              className="w-full h-full object-cover" 
          />
          <div className="absolute bottom-0 right-0 bg-black/60 text-[10px] px-1 text-white">
             {Math.round(video.duration)}s
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-slate-200">
            {video.file.name}
          </p>
          <p className="text-xs text-slate-500">
            {(video.file.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>

        <button 
          onClick={() => onRemove(video.id)}
          className="p-3 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
          aria-label="Remove video"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {!isLast && (
        <div className="mx-8 p-3 bg-slate-800/50 border border-dashed border-slate-700 rounded-xl flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Settings2 size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Overgang naar volgende clip</span>
          </div>
          
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <select
              value={currentTransition.type}
              onChange={(e) => onUpdateTransition(video.id, { ...currentTransition, type: e.target.value as TransitionType })}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value={TransitionType.NONE}>Geen overgang</option>
              <option value={TransitionType.FADE}>Vervagen (Fade)</option>
              <option value={TransitionType.WIPELEFT}>Wipe Links</option>
              <option value={TransitionType.WIPERIGHT}>Wipe Rechts</option>
              <option value={TransitionType.WIPEUP}>Wipe Omhoog</option>
              <option value={TransitionType.WIPEDOWN}>Wipe Omlaag</option>
              <option value={TransitionType.SLIDELT}>Slide Links</option>
              <option value={TransitionType.SLIDERT}>Slide Rechts</option>
              <option value={TransitionType.SLIDEUP}>Slide Omhoog</option>
              <option value={TransitionType.SLIDEDOWN}>Slide Omlaag</option>
              <option value={TransitionType.CIRCLECROP}>Cirkel</option>
              <option value={TransitionType.RECTCROP}>Rechthoek</option>
              <option value={TransitionType.DISTANCE}>Afstand</option>
              <option value={TransitionType.FADEBLACK}>Fade naar Zwart</option>
              <option value={TransitionType.FADEWHITE}>Fade naar Wit</option>
              <option value={TransitionType.RADIAL}>Radiaal</option>
              <option value={TransitionType.SMOOTHLEFT}>Smooth Links</option>
              <option value={TransitionType.SMOOTHRIGHT}>Smooth Rechts</option>
            </select>

            {currentTransition.type !== TransitionType.NONE && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Duur:</span>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={currentTransition.duration}
                  onChange={(e) => onUpdateTransition(video.id, { ...currentTransition, duration: parseFloat(e.target.value) || 1 })}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-500">sec</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SortableVideoItem;
