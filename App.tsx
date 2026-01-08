import React, { useState } from 'react';
import { Image as ImageIcon, Film, Scissors, Frame } from 'lucide-react';
import FrameExtractor from './components/FrameExtractor';
import VideoStitcher from './components/VideoStitcher';
import VideoTrimmer from './components/VideoTrimmer';
import VideoSilhouette from './components/WatermarkRemover'; // We kept the filename for now to avoid breaking imports
import AuthWrapper from './components/AuthWrapper';
import { AppTab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.EXTRACTOR);

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Film size={18} className="text-white" />
             </div>
             <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
               VideoForge
             </h1>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-3xl mx-auto relative overflow-hidden">
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === AppTab.EXTRACTOR ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <FrameExtractor />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === AppTab.STITCHER ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <VideoStitcher />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === AppTab.TRIMMER ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <VideoTrimmer />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === AppTab.WATERMARK_REMOVER ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <VideoSilhouette />
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="h-20 pb-4 bg-slate-900 border-t border-slate-800 flex justify-around items-center px-1 shrink-0 z-50">
          <button 
            onClick={() => setActiveTab(AppTab.EXTRACTOR)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all w-20 ${activeTab === AppTab.EXTRACTOR ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <ImageIcon size={22} strokeWidth={activeTab === AppTab.EXTRACTOR ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Extract</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.STITCHER)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all w-20 ${activeTab === AppTab.STITCHER ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Film size={22} strokeWidth={activeTab === AppTab.STITCHER ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Stitcher</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.TRIMMER)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all w-20 ${activeTab === AppTab.TRIMMER ? 'bg-pink-500/10 text-pink-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Scissors size={22} strokeWidth={activeTab === AppTab.TRIMMER ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Trimmer</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.WATERMARK_REMOVER)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all w-20 ${activeTab === AppTab.WATERMARK_REMOVER ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Frame size={22} strokeWidth={activeTab === AppTab.WATERMARK_REMOVER ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Silhouet</span>
          </button>
        </nav>
      </div>
    </AuthWrapper>
  );
};

export default App;