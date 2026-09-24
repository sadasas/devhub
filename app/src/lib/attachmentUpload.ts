import * as Tus from 'tus-js-client';

/**
 * Helper upload file bersama (dipakai AttachmentSection + MarkdownField).
 * Jalur utama TUS resumable, fallback PUT satu request.
 * Service key tak pernah ke browser — hanya endpoint + token presigned.
 */

export function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.send(file);
  });
}

/**
 * True bila kegagalan upload tampak seperti penolakan auth (401/403 —
 * mis. token TUS tak cocok dengan header). Dipakai untuk fallback ke PUT.
 */
export function isUploadAuthError(err: unknown): boolean {
  const status = (
    err as { originalResponse?: { getStatus?: () => number } } | null
  )?.originalResponse?.getStatus?.();
  if (status === 401 || status === 403) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /response code:\s*40[13]|401|403|unauthorized|access denied|invalid compact jws/i.test(msg);
}

export function putFileTus(
  file: File,
  tus: { tusEndpoint: string; uploadToken: string; bucket: string; objectName: string },
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new Tus.Upload(file, {
      endpoint: tus.tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        'x-signature': tus.uploadToken,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: tus.bucket,
        objectName: tus.objectName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: (err) => reject(err instanceof Error ? err : new Error('Upload failed')),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) {
          onProgress(Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100)));
        }
      },
      onSuccess: () => {
        onProgress(100);
        resolve();
      },
    });
    void upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]!);
        upload.start();
      })
      .catch((err) => reject(err instanceof Error ? err : new Error('Upload failed')));
  });
}
