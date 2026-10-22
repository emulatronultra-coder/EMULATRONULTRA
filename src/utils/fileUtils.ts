/**
 * Safe file reading utilities that handle browser security/permission edge cases,
 * stale file handles, and Blob/ArrayBuffer conversions.
 */

export async function safeReadFileAsArrayBuffer(
  file: File | Blob | ArrayBuffer | Uint8Array | null | undefined
): Promise<ArrayBuffer | null> {
  if (!file) return null;
  if (file instanceof ArrayBuffer) return file;
  if (file instanceof Uint8Array) {
    return file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength
    ) as ArrayBuffer;
  }

  // Attempt 1: Modern File.prototype.arrayBuffer()
  try {
    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      if (buffer && buffer.byteLength >= 0) {
        return buffer;
      }
    }
  } catch (err) {
    console.warn('Direct file.arrayBuffer() failed:', err);
  }

  // Attempt 2: FileReader fallback
  try {
    const buffer = await new Promise<ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => {
        console.warn('FileReader failed:', reader.error);
        resolve(null);
      };
      reader.onabort = () => resolve(null);
      reader.readAsArrayBuffer(file);
    });

    if (buffer) return buffer;
  } catch (err) {
    console.warn('FileReader exception:', err);
  }

  // Attempt 3: Response object slice
  try {
    if (typeof Response !== 'undefined') {
      const response = new Response(file);
      const buffer = await response.arrayBuffer();
      if (buffer && buffer.byteLength >= 0) {
        return buffer;
      }
    }
  } catch (err) {
    console.warn('Response.arrayBuffer fallback failed:', err);
  }

  return null;
}

export async function safeReadFileAsUint8Array(
  file: File | Blob | ArrayBuffer | Uint8Array | null | undefined
): Promise<Uint8Array | null> {
  const buffer = await safeReadFileAsArrayBuffer(file);
  if (!buffer) return null;
  return new Uint8Array(buffer);
}
