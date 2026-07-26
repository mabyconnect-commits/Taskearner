// Client-side image helpers. We store post images inline (as compressed data:
// URLs) instead of using external blob storage, so the browser downscales and
// re-encodes the file before upload to keep it small.

export async function compressImage(file: File, maxDim = 1080, quality = 0.72): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fallback: original
  ctx.drawImage(img, 0, 0, width, height);
  // GIFs/PNGs with transparency lose it as JPEG, but for shareable flyers JPEG
  // gives by far the smallest size, which is what matters here.
  return canvas.toDataURL("image/jpeg", quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read the image"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = src;
  });
}

// Trigger a download of a data: URL (or any URL) as a file.
export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
