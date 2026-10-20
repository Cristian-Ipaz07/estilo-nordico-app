import { useEffect } from 'react';

// Contador global de modales activos (soporta modales anidados)
let activeLocks = 0;

export function lockBodyScroll() {
  activeLocks++;
  if (activeLocks === 1) {
    if (typeof document !== 'undefined') {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }
}

export function unlockBodyScroll() {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks === 0) {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('overflow');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }
}

export function forceUnlockBodyScroll() {
  activeLocks = 0;
  if (typeof document !== 'undefined') {
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

// Limpieza inicial garantizada al cargar el módulo
if (typeof document !== 'undefined') {
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

/**
 * useBodyScrollLock:
 * Bloquea el scroll del fondo mientras isOpen sea true (o mientras el componente esté montado).
 * Al cerrarse o desmontarse, restaura el scroll al 100% de forma limpia y garantizada.
 */
export function useBodyScrollLock(isOpen = true) {
  useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);
}

export default useBodyScrollLock;
