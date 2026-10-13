// Centralizador de URL del backend
// En localhost usa http://localhost:8000 directo.
// En acceso remoto/túnel/móvil usa rutas relativas proxied por Vite ('') o VITE_API_URL.
export const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : ''
);
