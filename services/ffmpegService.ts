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
    onLog?: (text: string) => void,
    backgroundAudio?: File | string // Added background audio support
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
    ) || !!backgroundAudio; // Re-encode if we have background audio

    for (let i = 0; i < videos.length; i++) {
      const name = `input${i}.${ext}`;
      inputNames.push(name);
      await ffmpeg.writeFile(name, await fetchFile(videos[i].file));
    }

    let audioInputName = '';
    if (backgroundAudio) {
      audioInputName = 'background_audio.mp3';
      await ffmpeg.writeFile(audioInputName, await fetchFile(backgroundAudio));
    }
    
    if (onLog) onLog(`Prepared ${videos.length} inputs. Re-encode: ${needsReencode}`);

    const outputName = `output.${ext}`;

    // 2. Register Progress
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    // 3. Run Command
    let command: string[] = [];

    const hasTransitions = videos.some(v => v.transition && v.transition.type !== 'none');

    if (!needsReencode && !hasTransitions && !backgroundAudio) {
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
      // ROBUST PATH: Filter Complex with Scaling, Transitions, and Re-encoding
      const inputs: string[] = [];
      let filterComplex = '';
      
      // First pass: Scale and prepare all inputs
      for (let i = 0; i < videos.length; i++) {
        inputs.push('-i', inputNames[i]);
        // Scale and pad to match first video's resolution
        filterComplex += `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}];`;
      }

      if (backgroundAudio) {
        inputs.push('-i', audioInputName);
      }

      if (!hasTransitions) {
        // Simple concat without transitions
        for (let i = 0; i < videos.length; i++) {
          filterComplex += `[v${i}]`;
        }
        filterComplex += `concat=n=${videos.length}:v=1:a=0[v];`;
        
        if (backgroundAudio) {
           // Use background audio, ignore video audio
           filterComplex += `[${videos.length}:a]anull[a]`;
        } else {
           // Concat original audio
           for (let i = 0; i < videos.length; i++) {
             filterComplex += `[${i}:a]`;
           }
           filterComplex += `concat=n=${videos.length}:v=0:a=1[a]`;
        }
      } else {
        // Complex xfade logic
        let currentV = '[v0]';
        let currentA = '[0:a]';
        let currentOffset = 0;

        for (let i = 0; i < videos.length - 1; i++) {
          const v1 = videos[i];
          const v2 = videos[i + 1];
          const trans = v1.transition || { type: 'none', duration: 1 };
          
          // Calculate offset: cumulative duration - overlap
          const transitionDuration = trans.type === 'none' ? 0 : trans.duration;
          const offset = currentOffset + v1.duration - transitionDuration;
          
          if (trans.type === 'none' || transitionDuration <= 0) {
            // No transition: use concat
            filterComplex += `${currentV}[v${i+1}]concat=n=2:v=1:a=0[vtemp${i}];`;
            if (!backgroundAudio) {
              filterComplex += `${currentA}[${i+1}:a]concat=n=2:v=0:a=1[atemp${i}];`;
            }
            currentOffset += v1.duration;
          } else {
            // Map our transition types to ffmpeg names
            let ffmpegTrans = trans.type.toString();
            if (ffmpegTrans === 'slidelt') ffmpegTrans = 'slideleft';
            if (ffmpegTrans === 'slidert') ffmpegTrans = 'slideright';
            
            filterComplex += `${currentV}[v${i+1}]xfade=transition=${ffmpegTrans}:duration=${transitionDuration}:offset=${offset}[vtemp${i}];`;
            if (!backgroundAudio) {
              filterComplex += `${currentA}[${i+1}:a]acrossfade=d=${transitionDuration}[atemp${i}];`;
            }
            currentOffset = offset;
          }
          
          currentV = `[vtemp${i}]`;
          if (!backgroundAudio) {
            currentA = `[atemp${i}]`;
          }
        }
        
        if (backgroundAudio) {
          filterComplex += `${currentV}null[v];[${videos.length}:a]anull[a]`;
        } else {
          filterComplex += `${currentV}null[v];${currentA}anull[a]`;
        }
      }

      command = [
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-pix_fmt', 'yuv420p',
        '-shortest', // Ensure video ends when the shortest stream (usually audio/video) ends
        outputName
      ];
      
      if (onLog) onLog('Starting merge with transitions and re-encoding');
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
    if (audioInputName) {
      try { await ffmpeg.deleteFile(audioInputName); } catch(e) {}
    }
    if (!needsReencode && !backgroundAudio) {
      try { await ffmpeg.deleteFile('filelist.txt'); } catch(e) {}
    }
    try { await ffmpeg.deleteFile(outputName); } catch(e) {}

    if (typeof data === 'string') {
      throw new Error('FFmpeg read file returned a string instead of binary data');
    }

    // Create a new Blob with the data and mime type
    // We use a specific array buffer to ensure the browser treats it as a full file
    const blob = new Blob([data.buffer], { type: mime });
    return URL.createObjectURL(blob);
  }

  async extractAudio(file: File, onProgress: (ratio: number) => void): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    const inputName = 'audio_input.mp4';
    const outputName = 'extracted_audio.mp3';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    const command = [
      '-i', inputName,
      '-vn', // Disable video
      '-acodec', 'libmp3lame',
      outputName
    ];

    try {
      await ffmpeg.exec([...command, '-y']);
      const data = await ffmpeg.readFile(outputName);
      
      // Cleanup
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      const blob = new Blob([(data as any).buffer], { type: 'audio/mp3' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error(e);
      throw new Error("Audio extraction failed.");
    }
  }

  async applySilhouette(
    file: File,
    options: { type: 'rect' | 'cinema', size: number, color: string },
    onProgress: (ratio: number) => void
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    const inputName = 'silhouette_input.mp4';
    const outputName = 'silhouette_output.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    let filter = '';
    
    // Convert hex color to ffmpeg color format (0xRRGGBB)
    const color = options.color.replace('#', '0x');

    if (options.type === 'rect') {
       // drawbox draws INSIDE the video
       // t is thickness, size * 5 for a decent scale
       const thickness = options.size * 5;
       filter = `drawbox=x=0:y=0:w=iw:h=ih:color=${color}:t=${thickness}`;
    } else if (options.type === 'cinema') {
       // Two boxes at top and bottom
       const boxHeight = options.size * 5;
       filter = `drawbox=y=0:w=iw:h=${boxHeight}:color=${color}:t=fill,drawbox=y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=${color}:t=fill`;
    }

    const command = [
      '-i', inputName,
      '-vf', filter,
      '-c:a', 'copy', // Copy audio without re-encoding
      outputName
    ];

    try {
      await ffmpeg.exec([...command, '-y']);
      const data = await ffmpeg.readFile(outputName);
      
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      const blob = new Blob([(data as any).buffer], { type: 'video/mp4' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error(e);
      throw new Error("Silhouette application failed.");
    }
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

    if (typeof data === 'string') {
      throw new Error('FFmpeg read file returned a string instead of binary data');
    }

    const blob = new Blob([data.buffer], { type: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' });
    return URL.createObjectURL(blob);
  }

  async removeWatermark(
    file: File,
    x: number,
    y: number,
    width: number,
    height: number,
    onProgress: (ratio: number) => void,
    onLog?: (text: string) => void,
    duration?: number,
    band: number = 1
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    const inputName = 'watermark_input.mp4';
    const outputName = 'watermark_output.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    if (onLog) onLog(`Starting watermark removal at x=${x}, y=${y}, w=${width}, h=${height}${duration ? ` (Test: ${duration}s)` : ''}, band=${band}`);

    // The delogo filter: x, y, w, h are the coordinates and size
    // show=0 means it will actually remove it (show=1 would show a green box for testing)
    const filter = `delogo=x=${x}:y=${y}:w=${width}:h=${height}:show=0`;

    const command = [
      '-i', inputName,
      '-vf', filter,
      '-c:a', 'copy', // Keep audio as is
    ];

    if (duration) {
      command.push('-t', duration.toString());
    }

    command.push(outputName);

    try {
      await ffmpeg.exec(command);
    } catch (e) {
      console.error(e);
      throw new Error("Watermark removal failed.");
    }

    const data = await ffmpeg.readFile(outputName);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    if (typeof data === 'string') {
      throw new Error('FFmpeg read file returned a string instead of binary data');
    }

    const blob = new Blob([data.buffer], { type: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' });
    return URL.createObjectURL(blob);
  }

  async getPreviewFrame(
    file: File,
    x: number,
    y: number,
    width: number,
    height: number,
    time: number,
    mode: 'remove' | 'crop',
    band: number = 1
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    const inputName = 'preview_input.mp4';
    const outputName = 'preview_frame.jpg';

    // Log FFmpeg output for debugging
    const logCallback = ({ message }: { message: string }) => {
      console.log(`[FFmpeg Preview] ${message}`);
      
      // Check for buffer reallocation errors and handle them gracefully
      if (message.includes('Buffer reallocation failed')) {
        console.warn('[FFmpeg Preview] Buffer reallocation error detected - attempting fallback');
        throw new Error('BUFFER_REALLOCATION_FAILED');
      }
    };
    ffmpeg.on('log', logCallback);

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      let filter = '';
      if (mode === 'remove') {
        filter = `delogo=x=${x}:y=${y}:w=${width}:h=${height}:show=0`;
      } else {
        filter = `crop=${width}:${height}:${x}:${y}`;
      }

      // Extract one frame at 'time', apply filter, and save as JPG
      // Ensure time is formatted correctly (though toString usually works)
      const command = [
        '-ss', time.toFixed(3),
        '-i', inputName,
        '-vf', filter,
        '-frames:v', '1',
        '-q:v', '2',
        outputName
      ];

      const ret = await ffmpeg.exec(command);
      if (ret !== 0) {
        throw new Error(`FFmpeg exited with code ${ret}`);
      }

      const data = await ffmpeg.readFile(outputName);
      
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      if (typeof data === 'string') {
        throw new Error('FFmpeg read file returned a string instead of binary data');
      }

      const blob = new Blob([data.buffer], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("[FFmpeg Preview Error]", e);
      
      // Handle specific buffer reallocation error with fallback
      if (e instanceof Error && e.message === 'BUFFER_REALLOCATION_FAILED') {
        console.warn('[FFmpeg Preview] Using fallback method due to buffer reallocation error');
        
        // Fallback: try without filter first, then apply filter separately if needed
        try {
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.writeFile(inputName, await fetchFile(file));
          
          const fallbackCommand = [
            '-ss', time.toFixed(3),
            '-i', inputName,
            '-frames:v', '1',
            '-q:v', '2',
            outputName
          ];
          
          const fallbackRet = await ffmpeg.exec(fallbackCommand);
          if (fallbackRet === 0) {
            const data = await ffmpeg.readFile(outputName);
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
            
            if (typeof data === 'string') {
              throw new Error('FFmpeg read file returned string data');
            }
            
            const blob = new Blob([data.buffer], { type: 'image/jpeg' });
            return URL.createObjectURL(blob);
          }
        } catch (fallbackError) {
          console.error('[FFmpeg Preview] Fallback also failed:', fallbackError);
        }
        
        // If all else fails, throw a more user-friendly error
        throw new Error('Preview generation failed due to video format limitations. Try a different video or time position.');
      }
      
      // Clean up files if they exist
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}
      throw e;
    } finally {
      ffmpeg.off('log', logCallback);
    }
  }

  async cropVideo(
    file: File,
    x: number,
    y: number,
    width: number,
    height: number,
    onProgress: (ratio: number) => void,
    onLog?: (text: string) => void
  ): Promise<string> {
    if (!this.ffmpeg || !this.loaded) {
      await this.load();
    }
    const ffmpeg = this.ffmpeg!;
    const inputName = 'crop_input.mp4';
    const outputName = 'crop_output.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // ffmpeg -i input.mp4 -vf "crop=w:h:x:y" output.mp4
    const filter = `crop=${width}:${height}:${x}:${y}`;

    if (onLog) onLog(`Starting crop at x=${x}, y=${y}, w=${width}, h=${height}`);

    const command = [
      '-i', inputName,
      '-vf', filter,
      '-c:a', 'copy',
      outputName
    ];

    await ffmpeg.exec(command);

    const data = await ffmpeg.readFile(outputName);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    if (typeof data === 'string') {
      throw new Error('FFmpeg read file returned a string instead of binary data');
    }

    const blob = new Blob([data.buffer], { type: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' });
    return URL.createObjectURL(blob);
  }
}

export const ffmpegService = new FFmpegService();
