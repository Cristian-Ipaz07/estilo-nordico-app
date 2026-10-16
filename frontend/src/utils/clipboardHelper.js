import { normalizeImageUrl } from './imageOptimizer.js';

/**
 * Copia una imagen directamente al portapapeles del sistema (formato PNG Blob).
 * Diseñado específicamente para que el asesor pueda presionar el botón y luego
 * ir a WhatsApp (Web, Desktop o Móvil) y darle "Pegar" (Ctrl + V).
 * 
 * Regla de oro: NUNCA abre ventanas, pestañas ni descarga archivos molestos.
 *
 * @param {string} imageUrl - URL relativa o absoluta de la imagen
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function copyImageToClipboard(imageUrl) {
  if (!imageUrl) {
    throw new Error('No hay imagen para copiar');
  }

  const fullUrl = normalizeImageUrl(imageUrl);

  // 1. Obtener la imagen mediante fetch (evita problemas de crossOrigin en canvas directo)
  let blob;
  try {
    const res = await fetch(fullUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    blob = await res.blob();
  } catch (fetchErr) {
    console.warn('Fetch directo de imagen falló, intentando carga vía Image:', fetchErr);
  }

  // 2. Convertir a PNG Blob (los navegadores requieren obligatoriamente image/png en ClipboardItem)
  const pngBlob = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 600;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error('No se pudo convertir la imagen a PNG'));
          }
        }, 'image/png');
      } catch (canvasErr) {
        reject(canvasErr);
      }
    };

    img.onerror = () => {
      reject(new Error('No se pudo cargar la imagen para renderizar'));
    };

    if (blob) {
      img.src = URL.createObjectURL(blob);
    } else {
      img.src = fullUrl;
    }
  });

  // 3. Escribir PNG en el portapapeles del sistema
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      return { success: true, message: 'Foto copiada al portapapeles (Ctrl + V en WhatsApp)' };
    } catch (clipErr) {
      console.warn('navigator.clipboard.write con imagen no soportado en este dispositivo:', clipErr);
    }
  }

  // 4. Si el navegador no permite escribir imágenes binarias (ej: ciertos móviles):
  // Guardamos el enlace limpio al portapapeles sin abrir ninguna ventana
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullUrl);
      return { success: true, message: 'Enlace de foto copiado al portapapeles' };
    }
  } catch (textErr) {
    console.error('Error al copiar texto:', textErr);
  }

  return { success: true, message: 'Foto lista' };
}
