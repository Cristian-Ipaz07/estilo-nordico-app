// Centralizador de URL del backend y tienda web
export const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://estilo-nordico-app.onrender.com'
);

export const WEB_STORE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEB_STORE_URL) || 'https://web-estilo-nordico.vercel.app';
