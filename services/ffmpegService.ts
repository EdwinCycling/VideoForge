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

    // 1. Write files to memory and build concat list
    const inputNames: string[] = [];
    let concatList = '';
    const ext = ((videos[0]?.file?.name || '').split('.').pop() || 'mp4').toLowerCase();
    const mime = videos[0]?.file?.type || 'video/mp4';

    for (let i = 0; i < videos.length; i++) {
      const name = `input${i}.${ext}`;
      inputNames.push(name);
      await ffmpeg.writeFile(name, await fetchFile(videos[i].file));
      // Concat demuxer format: file 'filename'
      concatList += `file '${name}'\n`;
    }
    if (onLog) onLog(`Prepared ${videos.length} inputs`);

    // Write the list file
    await ffmpeg.writeFile('filelist.txt', concatList);

    const outputName = `output.${ext}`;

    // 2. Register Progress
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(100, progress * 100)));
    });

    // 3. Run Command: Concat Demuxer with Copy Codec
    // -f concat: use concat demuxer
    // -safe 0: allow reading relative paths
    // -i filelist.txt: input list
    // -c copy: copy streams directly (no re-encoding)
    const command = [
      '-f', 'concat',
      '-safe', '0',
      '-i', 'filelist.txt',
      '-c', 'copy',
      outputName
    ];

    try {
      if (onLog) onLog('Starting concat with stream copy');
      await ffmpeg.exec(command);
    } catch (e) {
      console.error(e);
      throw new Error("FFmpeg execution failed. Please ensure all videos have the same format and encoding.");
    }

    // 4. Read Result
    let data;
    try {
       data = await ffmpeg.readFile(outputName);
    } catch (e) {
       throw new Error("Failed to create output video. Input formats may be incompatible.");
    }
    
    // Cleanup files to free memory
    for (const name of inputNames) {
      await ffmpeg.deleteFile(name);
    }
    await ffmpeg.deleteFile('filelist.txt');
    await ffmpeg.deleteFile(outputName);

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
