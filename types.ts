export enum TransitionType {
  NONE = 'none',
  FADE = 'fade',
  WIPELEFT = 'wipeleft',
  WIPERIGHT = 'wiperight',
  WIPEUP = 'wipeup',
  WIPEDOWN = 'wipedown',
  SLIDELT = 'slidelt',
  SLIDERT = 'slidert',
  SLIDEUP = 'slideup',
  SLIDEDOWN = 'slidedown',
  CIRCLECROP = 'circlecrop',
  RECTCROP = 'rectcrop',
  DISTANCE = 'distance',
  FADEBLACK = 'fadeblack',
  FADEWHITE = 'fadewhite',
  RADIAL = 'radial',
  SMOOTHLEFT = 'smoothleft',
  SMOOTHRIGHT = 'smoothright',
  // Nieuwe "zware" overgangen
  PIXELIZE = 'pixelize',
  DISSOLVE = 'dissolve',
  CIRCLEOPEN = 'circleopen',
  CIRCLECLOSE = 'circleclose',
  ZOOMIN = 'zoomin',
  HLSLICE = 'hlslice',
  HRSLICE = 'hrslice',
  VUSLICE = 'vuslice',
  VDSLICE = 'vdslice',
  HBLUR = 'hblur',
  SQUEEZEH = 'squeezeh',
  SQUEEZEV = 'squeezev',
  DIAGONAL = 'diagonal',
}

export interface VideoFile {
  id: string;
  file: File;
  thumbnail: string;
  duration: number;
  width: number;
  height: number;
  transition?: {
    type: TransitionType;
    duration: number; // in seconds
  };
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