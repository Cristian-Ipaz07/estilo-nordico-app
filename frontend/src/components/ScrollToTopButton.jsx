import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * BOTÓN FLOTANTE "VOLVER ARRIBA" (Scroll-to-Top)
 * Aparece sutilmente cuando el usuario baja en cualquier página (Inventario, Flujo de Caja, etc.)
 * y permite volver a la cabecera en 1 solo clic suave sin perder la posición.
 */
export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const top = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (top > 250) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 p-3 bg-slate-900/85 hover:bg-indigo-600 text-white rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 border border-slate-700/40 flex items-center justify-center cursor-pointer group animate-in fade-in zoom-in-75"
      title="Volver arriba (subida rápida)"
      aria-label="Volver arriba"
    >
      <ArrowUp size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
}
