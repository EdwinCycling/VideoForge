import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical } from 'lucide-react';
import { VideoFile } from '../types';

interface Props {
  video: VideoFile;
  onRemove: (id: string) => void;
}

const SortableVideoItem: React.FC<Props> = ({ video, onRemove }) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
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
  );
};

export default SortableVideoItem;
