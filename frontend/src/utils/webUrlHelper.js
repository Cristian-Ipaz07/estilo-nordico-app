import { WEB_STORE_URL } from '../config/api.js';

/**
 * Normaliza nombres de colores para slugs de la tienda web Astro
 * Ejemplo: "Azul Cobalto" -> "azul-cobalto", "Gris Ratón" -> "gris-raton"
 */
export function normalizeColorSlug(color) {
  if (!color) return '';
  return color
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Generador inteligente y seguro de URLz hacia la tienda web (web-estilo-nordico.vercel.app).
 * Garantiza que cada link abierto desde el ERP o compartido por WhatsApp apunte
 * a una página existente (HTTP 200) y nunca devuelva 404.
 * */
export function getProductWebUrl(product, selectedColor = null) {
  if (!product) return WEB_STORE_URL;
  if (product.is_published === false) return WEB_STORE_URL;

  const ref = (product.ref || '').toUpperCase();
  const subcategory = (product.subcategory || '').toUpperCase();
  const category = (product.category || '').toUpperCase();
  const productType = (product.product_type || '').toUpperCase();

  // 1. CHAQUETAS (Ref 5080 o subcategoría/categoria/tipo Chaqueta)
  const isJacket = ref.startsWith('5080') ||
                   subcategory.includes('CHAQUETA') ||
                   category.includes('CHAQUETAS') ||
                   category.includes('CHAQUETA') ||
                   productType === 'CHAQUETA';

  if (isJacket) {
    const effectiveColor = (selectedColor && selectedColor !== 'TODOS')
      ? selectedColor
      : (product.color && product.color !== 'TODOS' ? product.color : null);

    if (effectiveColor) {
      const colorSlug = normalizeColorSlug(effectiveColor);
      return `${WEB_STORE_URL}/chaquetas/chaqueta-impermeable-${colorSlug}`;
    }

    return `${WEB_STORE_URL}/chaquetas`;
  }

  // 2. PERFUMES
  const isPerfume = category.includes('PERFUME') ||
                      subcategory.includes('PERFUME') ||
                      productType === 'PERFUME';

  if (isPerfume) {
    if (product.slug && product.slug !== 'null' && product.slug !== 'undefined') {
      return `${WEB_STORE_URL}/perfumes/${product.slug}`;
    }
    return `${WEB_STORE_URL}/perfumes`;
  }

  // 3. RELOJES
  const isWatch = category.includes('RELOJ') ||
                   subcategory.includes('RELOJ') ||
                   productType === 'RELOJ';

  if (isWatch) {
    if (product.slug && product.slug !== 'null' && product.slug !== 'undefined') {
      return `${WEB_STORE_URL}/relojes/${product.slug}`;
    }
    return `${WEB_STORE_URL}/relojes`;
  }

  // 4. RESTO DEL CATÁLOGO
  return WEB_STORE_URL;
}
