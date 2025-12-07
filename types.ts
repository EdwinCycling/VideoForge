export interface VideoFile {
  id: string;
  file: File;
  thumbnail: string;
  duration: number;
  width: number;
  height: number;
}

export enum AppTab {
  EXTRACTOR = 'extractor',
  STITCHER = 'stitcher',
  TRIMMER = 'trimmer',
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number; // 0 to 100
  message: string;
  error?: string | null;
}