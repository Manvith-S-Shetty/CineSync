const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB

interface CloudinaryUploadResponse {
  secure_url?: string;
  done?: boolean;
  [key: string]: unknown;
}

function requireCloudinaryConfig(): { cloudName: string; uploadPreset: string } {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration is missing.');
  }
  return { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET };
}

export async function uploadVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!file) {
    throw new Error('No video file selected.');
  }

  if (!file.type.startsWith('video/')) {
    throw new Error('Please select a valid video file.');
  }

  requireCloudinaryConfig();

  if (file.size <= 100 * 1024 * 1024) {
    return uploadNormal(file, onProgress);
  }

  return uploadChunked(file, onProgress);
}

async function uploadNormal(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const { uploadPreset } = requireCloudinaryConfig();
  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const data = (await response.json()) as CloudinaryUploadResponse;

  onProgress?.(100);

  if (!data.secure_url) {
    throw new Error('Cloudinary did not return a video URL.');
  }

  return data.secure_url;
}

async function uploadChunked(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const uploadId = crypto.randomUUID();

  let start = 0;
  let secureUrl: string | null = null;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const { uploadPreset } = requireCloudinaryConfig();
    const formData = new FormData();

    formData.append('file', chunk);
    formData.append('upload_preset', uploadPreset);

    const contentRange = `bytes ${start}-${end - 1}/${file.size}`;

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        'X-Unique-Upload-Id': uploadId,
        'Content-Range': contentRange,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Cloudinary chunk upload failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as CloudinaryUploadResponse;

    start = end;

    const progress = Math.round((start / file.size) * 100);
    onProgress?.(progress);

    if (data.done && data.secure_url) {
      secureUrl = data.secure_url;
    }
  }

  if (!secureUrl) {
    throw new Error('Cloudinary did not return a completed video URL.');
  }

  return secureUrl;
}
