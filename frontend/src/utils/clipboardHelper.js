import { normalizeImageUrl } from './imageOptimizer.js';

/**
 * Obtiene la imagen vía fetch o Image() y la convierte a un Blob PNG puro.
 */
async function fetchPngBlob(fullUrl) {
  let blob;
  try {
    const res = await fetch(fullUrl, { mode: 'cors' });
    if (res.ok) {
      blob = await res.blob();
    }
  } catch (fetchErr) {
    console.warn('Fetch directo de imagen falló, intentando carga vía Image:', fetchErr);
  }

  return new Promise((resolve, reject) => {
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
}

/**
 * Copia una imagen directamente al portapapeles del sistema (formato PNG Blob).
 * Compatible con PC, Mac, iPad, iPhone, tablets y celulares Android.
 * 
 * Regla de oro: En iPad/Safari es vital pasar la promesa al constructor de ClipboardItem
 * para no perder la activación del usuario (user activation gesture).
 *
 * @param {string} imageUrl - URL relativa o absoluta de la imagen
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function copyImageToClipboard(imageUrl) {
  if (!imageUrl) {
    throw new Error('No hay imagen para copiar');
  }

  const fullUrl = normalizeImageUrl(imageUrl);

  // 1. Intentar copia de imagen binaria al portapapeles
  // En Safari / iPadOS es CRÍTICO pasar la Promesa directamente a new ClipboardItem
  // sin hacer 'await' antes, para no perder el 'user activation' gesture.
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const blobPromise = fetchPngBlob(fullUrl);
      let item;
      try {
        // Estándar moderno de Safari / iPadOS y Chromium reciente:
        item = new ClipboardItem({ 'image/png': blobPromise });
      } catch (ctorErr) {
        // En navegadores que no aceptan Promise en el constructor, resolvemos el Blob primero:
        const resolvedBlob = await blobPromise;
        item = new ClipboardItem({ 'image/png': resolvedBlob });
      }

      if (item) {
        await navigator.clipboard.write([item]);
        return { success: true, message: 'Foto copiada al portapapeles (lista para pegar)' };
      }
    } catch (clipErr) {
      console.warn('Copia directa de imagen al portapapeles no permitida o no soportada:', clipErr);
    }
  }

  // 2. Soporte nativo para tablets y celulares móviles vía Web Share API
  // En iPads/Tablets/Celulares donde el portapapeles de imagen está restringido por el sistema,
  // Web Share permite enviar la imagen directamente a WhatsApp / Telegram con 1 toque.
  if (navigator.share) {
    try {
      const blob = await fetchPngBlob(fullUrl);
      const file = new File([blob], 'foto-prenda.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Foto Prenda Estilo Nórdico'
        });
        return { success: true, message: 'Foto compartida con éxito' };
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return { success: true, message: 'Listo' };
      }
      console.warn('Web Share falló:', shareErr);
    }
  }

  // 3. Fallback universal: Copiar URL limpia de la foto al portapapeles
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullUrl);
      return { success: true, message: 'Enlace de foto copiado al portapapeles' };
    }
  } catch (textErr) {
    console.error('Error al copiar texto:', textErr);
  }

  return { success: true, message: 'Foto procesada' };
}
