import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { VideoFile } from '../types';

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private loaded: boolean = false;

  async load() {
    if (this.loaded) return;

    this.ffmpeg = new FFmpeg();

    // Use unpkg for consistent structure
    const baseURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm';
    const coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    // Worker workaround:
    // Browsers block "new Worker(crossOriginURL)".
    // To fix this, we create a local Blob that simply imports the worker script from the CDN.
    // The import statement handles the cross-origin fetch correctly (standard CORS), 
    // and the Blob URL is considered same-origin for the Worker constructor.
    const workerURL = `${baseURL}/worker.js`;
    const blob = new Blob([`import "${workerURL}";`], { type: 'text/javascript' });
    const workerBlobURL = URL.createObjectURL(blob);
    
    try {
      // console.debug('[FFmpeg] Loading core...');
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: workerBlobURL,
      });
      // console.debug('[FFmpeg] Loaded successfully');
      this.loaded = true;
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      throw new Error("Could not initialize video processor. Please check your browser compatibility (SharedArrayBuffer support required).");
    }
  }

  async stitchVideos(
    videos: VideoFile[],
    onProgress: (ratio: number) => void,
    onLog?: (text: string) => void
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    ffmpeg.on('log', ({ message }) => {
      // console.debug('[FFmpeg]', message);
      if (onLog) onLog(message);
    });

    // 1. Write files to memory
    const inputNames: string[] = [];
    const first = videos[0];
    const targetW = first.width;
    const targetH = first.height;
    const ext = ((first.file.name || '').split('.').pop() || 'mp4').toLowerCase();
    const mime = first.file.type || 'video/mp4';

    // Check if re-encoding is needed (resolution or format mismatch)
    const needsReencode = videos.some(v => 
      v.width !== targetW || 
      v.height !== targetH || 
      v.file.type !== mime
    );

    for (let i = 0; i < videos.length; i++) {
      const name = `input${i}.${ext}`;
      inputNames.push(name);
      await ffmpeg.writeFile(name, await fetchFile(videos[i].file));
    }
    
    if (onLog) onLog(`Prepared ${videos.length} inputs. Re-encode: ${needsReencode}`);

    const outputName = `output.${ext}`;

    // 2. Register Progress
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    // 3. Run Command
    let command: string[] = [];

    if (!needsReencode) {
      // FAST PATH: Concat Demuxer with Stream Copy
      let concatList = '';
      for (let i = 0; i < inputNames.length; i++) {
        concatList += `file '${inputNames[i]}'\n`;
      }
      await ffmpeg.writeFile('filelist.txt', concatList);

      command = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'filelist.txt',
        '-c', 'copy',
        outputName
      ];
      
      if (onLog) onLog('Starting concat with stream copy (fast)');
    } else {
      // ROBUST PATH: Filter Complex with Scaling and Re-encoding
      // This handles resolution mismatch and different formats
      const inputs: string[] = [];
      let filterComplex = '';
      
      for (let i = 0; i < videos.length; i++) {
        inputs.push('-i', inputNames[i]);
        // Scale and pad to match first video's resolution
        filterComplex += `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;
      }

      for (let i = 0; i < videos.length; i++) {
        filterComplex += `[v${i}][${i}:a]`;
      }
      filterComplex += `concat=n=${videos.length}:v=1:a=1[v][a]`;

      command = [
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        outputName
      ];
      
      if (onLog) onLog('Starting concat with re-encoding and scaling (robust)');
    }

    try {
      await ffmpeg.exec([...command, '-y']);
    } catch (e) {
      console.error(e);
      if (needsReencode) {
        throw new Error("Stitching failed during re-encoding. Some videos might lack audio or have incompatible streams.");
      } else {
        throw new Error("FFmpeg execution failed. Please ensure all videos have the same format and encoding.");
      }
    }

    // 4. Read Result
    if (onLog) onLog('Stitching complete. Reading result file...');
    let data;
    try {
       data = await ffmpeg.readFile(outputName);
    } catch (e) {
       console.error('ReadFile error:', e);
       throw new Error("Failed to read the output video from memory. It might be too large or the process failed.");
    }
    
    if (onLog) onLog(`Result read successfully (${(data.length / (1024 * 1024)).toFixed(1)} MB). Cleaning up...`);
    
    // Cleanup files to free memory
    for (const name of inputNames) {
      try { await ffmpeg.deleteFile(name); } catch(e) {}
    }
    if (!needsReencode) {
      try { await ffmpeg.deleteFile('filelist.txt'); } catch(e) {}
    }
    try { await ffmpeg.deleteFile(outputName); } catch(e) {}

    return URL.createObjectURL(new Blob([data], { type: mime }));
  }

  async trimVideo(
    file: File, 
    endTime: number, 
    onProgress: (ratio: number) => void
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    const inputName = 'trim_input.mp4';
    const outputName = 'trim_output.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    // -t specifies duration. 
    // -c copy performs a stream copy (fast, no re-encoding).
    // Note: Stream copy might not be frame-perfect if the cut point isn't a keyframe, 
    // but it is the standard for fast "lossless" trimming.
    const command = [
      '-i', inputName,
      '-t', endTime.toString(),
      '-c', 'copy',
      outputName
    ];

    try {
      await ffmpeg.exec(command);
    } catch (e) {
      console.error(e);
      throw new Error("FFmpeg execution failed.");
    }

    let data;
    try {
      data = await ffmpeg.readFile(outputName);
    } catch (e) {
      throw new Error("Failed to create output video.");
    }

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
  }
}

export const ffmpegService = new FFmpegService();
