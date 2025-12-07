/**
 * Loads a video file into an HTMLVideoElement and seeks to a specific time.
 * Returns the video element and the duration.
 */
export const loadVideoFromFile = (file: File): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      resolve(video);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video metadata."));
    };
  });
};

/**
 * Extracts a frame from a video at a specific time (in seconds).
 * Returns a data URL (base64 string) of the image.
 */
export const extractFrameFromVideo = async (
  video: HTMLVideoElement,
  time: number,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Seek to the time
    video.currentTime = time;

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Clean up
        video.removeEventListener('seeked', onSeeked);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    video.addEventListener('seeked', onSeeked);
    
    // Trigger seek if we aren't already there (or if 0, wait for seeked anyway)
    if (Math.abs(video.currentTime - time) < 0.1 && video.readyState >= 2) {
       onSeeked();
    }
  });
};

/**
 * Generates a thumbnail for a video file (frame at 1.0s or beginning).
 */
export const generateThumbnail = async (file: File): Promise<string> => {
  try {
    const video = await loadVideoFromFile(file);
    // Try to get a frame at 0.5s to avoid black start frames, or 0 if short
    const seekTime = Math.min(0.5, video.duration / 2);
    const thumb = await extractFrameFromVideo(video, seekTime, 0.5); // Lower quality for thumbnails
    URL.revokeObjectURL(video.src); // Cleanup
    return thumb;
  } catch (e) {
    console.error("Thumbnail generation failed", e);
    return "https://picsum.photos/100/100"; // Fallback
  }
};

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
