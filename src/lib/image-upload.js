export async function imageToWebp(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('請選擇 JPG、PNG、WebP 或 GIF 圖片。');
  }
  if (file.size > 4 * 1024 * 1024) throw new Error('圖片不可超過 4 MB，請選擇較小的檔案。');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature, offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  if (!(matches([0xff, 0xd8, 0xff])
    || matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    || matches([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
    || matches([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    || (matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8)))) {
    throw new Error('圖片格式無效，請使用真正的 JPG、PNG、WebP 或 GIF 圖片。');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('這張圖片無法開啟，請選擇其他有效的圖片。'); }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('瀏覽器無法處理圖片，請更新瀏覽器後重試。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // ponytail: GIF keeps only its first frame; use an animated WebP encoder if motion is needed.
    const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    canvas.width = canvas.height = 1;
    if (!compressed || compressed.type !== 'image/webp') {
      throw new Error('瀏覽器不支援 WebP 壓縮，請使用較新的瀏覽器。');
    }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result) : reject(new Error('圖片讀取失敗，請重新選擇。'));
      reader.onerror = () => reject(new Error('圖片讀取失敗，請重新選擇。'));
      reader.onabort = () => reject(new Error('圖片讀取已中止，請重新選擇。'));
      reader.readAsDataURL(compressed);
    });
    return { data, size: compressed.size };
  } finally { bitmap.close(); }
}

export function imageUrlPreview(value, signal) {
  const url = value.trim();
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error('請填寫完整的圖片網址，例如 https://example.com/photo.jpg。'); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('請使用不含帳號密碼的 HTTP 或 HTTPS 圖片網址。');
  }
  if (location.protocol === 'https:' && parsed.protocol !== 'https:') {
    throw new Error('請使用 HTTPS 圖片網址，避免瀏覽器封鎖圖片。');
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error('圖片載入逾時，請確認網址後重試。')), 15000);
    const abort = () => finish(new DOMException('已取消圖片載入。', 'AbortError'));
    function finish(error) {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      if (error) { image.src = ''; reject(error); }
      else resolve(url);
    }
    image.onload = () => image.naturalWidth && image.naturalHeight
      ? finish() : finish(new Error('這個網址沒有可用的圖片，請改用圖片直連網址。'));
    image.onerror = () => finish(new Error('圖片無法載入，請確認為可公開讀取的圖片直連網址。'));
    image.referrerPolicy = 'no-referrer';
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    else image.src = url;
  });
}
