import { API_URL } from '../config/api';

/**
 * Normaliza URLs de imágenes locales/legacy a URLs accesibles en producción.
 * Si una imagen apunta a localhost:8000 en Vercel, la redirige a Render HTTPS.
 */
export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Si está en localhost pero la app corre en producción (HTTPS/Vercel)
  if (trimmed.includes('http://localhost:8000/static/') || trimmed.includes('http://127.0.0.1:8000/static/')) {
    const isLocalApp = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocalApp) {
      return trimmed
        .replace('http://localhost:8000/static/', 'https://estilo-nordico-app.onrender.com/static/')
        .replace('http://127.0.0.1:8000/static/', 'https://estilo-nordico-app.onrender.com/static/');
    }
  }

  return trimmed;
}

/**
 * Optimiza y convierte cualquier archivo de imagen (PNG, JPG, JPEG, WebP)
 * a WebP en el navegador, preservando el fondo transparente si es PNG sin fondo.
 * Redimensiona a maxDimension (1200px) con compresión balanceada 0.85.
 */
export async function optimizeImageToWebP(file, maxDimension = 1200, quality = 0.85) {
  if (!file) throw new Error('No se seleccionó ningún archivo');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Redimensionar manteniendo proporción solo si excede maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Preservar canal alfa (transparencia) para prendas sin fondo
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al procesar la imagen en WebP'));
              return;
            }
            // Generar nombre de archivo con extensión .webp
            const cleanBase = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const webpFile = new File([blob], `${cleanBase}.webp`, { type: 'image/webp' });
            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo en disco'));
    reader.readAsDataURL(file);
  });
}

/**
 * Sube una imagen optimizada al backend (que la envía a Supabase Storage bucket 'products')
 * y la vincula al producto o variante especificada.
 */
export async function uploadProductImage(productId, fileOrBlob, replace = false) {
  const formData = new FormData();
  formData.append('file', fileOrBlob);

  const token = localStorage.getItem('token');
  const url = `${API_URL}/products/${productId}/upload-image${replace ? '?replace=true' : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error al subir la imagen' }));
    throw new Error(err.detail || 'Error al subir la imagen');
  }

  return await res.json();
}

/**
 * Elimina una imagen de la galería de un producto o variante.
 */
export async function removeProductImage(productId, imageUrl) {
  const token = localStorage.getItem('token');
  const url = `${API_URL}/products/${productId}/images?image_url=${encodeURIComponent(imageUrl)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error al eliminar la imagen' }));
    throw new Error(err.detail || 'Error al eliminar la imagen');
  }

  return await res.json();
}

/**
 * Extrae un nombre amigable y limpio a partir de una URL de Supabase Storage.
 * Permite mostrar en el tooltip el nombre clave con el que se subió (ej: "frontal", "estampado trasero").
 */
export function extractImageName(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const filename = url.split('/').pop().split('?')[0];
    let name = filename.replace(/\.(webp|jpg|jpeg|png)$/i, '');
    // Remover sufijo uuid al final (ej: _a1b2c3d4 o _a1b2c3)
    name = name.replace(/_[a-f0-9]{6,8}$/i, '');
    return decodeURIComponent(name).replace(/_/g, ' ').toUpperCase();
  } catch {
    return url;
  }
}
