import { normalizeImageUrl } from './imageOptimizer.js';

/**
 * Copia una imagen real directamente al portapapeles del sistema (formato PNG Blob).
 * Permite que el usuario simplemente vaya a WhatsApp Web o Desktop y presione Ctrl + V
 * para pegar la foto sin tener que descargar archivos ni enviar enlaces.
 *
 * @param {string} imageUrl - URL relativa o absoluta de la imagen
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function copyImageToClipboard(imageUrl) {
  if (!imageUrl) throw new Error('No hay imagen para copiar');
  const fullUrl = normalizeImageUrl(imageUrl);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            triggerFallback(fullUrl, resolve, reject);
            return;
          }

          try {
            if (navigator.clipboard && window.ClipboardItem) {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              resolve({ success: true, method: 'clipboard' });
            } else {
              triggerFallback(fullUrl, resolve, reject);
            }
          } catch (clipErr) {
            console.warn('Clipboard writeItem fallo, usando fallback:', clipErr);
            triggerFallback(fullUrl, resolve, reject);
          }
        }, 'image/png');
      } catch (err) {
        triggerFallback(fullUrl, resolve, reject);
      }
    };

    img.onerror = () => {
      triggerFallback(fullUrl, resolve, reject);
    };

    img.src = fullUrl;
  });
}

function triggerFallback(url, resolve, reject) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop() || 'prenda-estilo-nordico.webp';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    resolve({ success: true, method: 'download' });
  } catch (err) {
    window.open(url, '_blank');
    resolve({ success: true, method: 'open' });
  }
}
