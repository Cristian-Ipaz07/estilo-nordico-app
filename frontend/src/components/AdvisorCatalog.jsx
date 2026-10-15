import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Package, Globe, Copy, Check, Edit3, 
  ExternalLink, ChevronDown, ChevronUp, Sparkles, Layers, Tag 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { normalizeImageUrl } from '../utils/imageOptimizer';
import { WEB_STORE_URL } from '../config/api';

const fmt = (num) => Number(num || 0).toLocaleString('es-CO');

/**
 * Tarjeta individual de producto con variantes interactivas,
 * selector dinámico de color/foto, enlace directo a la web y ficha WhatsApp.
 */
function AdvisorProductCard({ product, variants = [], isAdmin, onEditProduct }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [copied, setCopied] = useState(false);

  // Agrupar variantes por color con sus tallas, stock y fotos
  const colorGroups = useMemo(() => {
    const map = {};
    variants.forEach(v => {
      const col = (v.color || 'ÚNICO').trim().toUpperCase();
      if (!map[col]) {
        map[col] = {
          color: col,
          totalStock: 0,
          sizes: [],
          image: (Array.isArray(v.images) && v.images.length > 0) ? v.images[0] : null,
          variants: []
        };
      }
      map[col].totalStock += (v.stock || 0);
      map[col].sizes.push({
        id: v.id,
        size: v.size || '-',
        stock: v.stock || 0,
        ref: v.ref,
        image: (Array.isArray(v.images) && v.images.length > 0) ? v.images[0] : null
      });
      map[col].variants.push(v);
      if (!map[col].image && Array.isArray(v.images) && v.images.length > 0) {
        map[col].image = v.images[0];
      }
    });
    return Object.values(map);
  }, [variants]);

  // Stock total de la referencia (sumando variantes o stock base)
  const totalStock = variants.length > 0 
    ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (product.stock || 0);

  // Foto activa: según el color seleccionado, o la base, o la primera variante que tenga foto
  const activeImage = useMemo(() => {
    if (selectedColor) {
      const group = colorGroups.find(g => g.color === selectedColor);
      if (group && group.image) return group.image;
    }
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0];
    }
    const variantWithImg = variants.find(v => Array.isArray(v.images) && v.images.length > 0);
    if (variantWithImg) return variantWithImg.images[0];
    return null;
  }, [selectedColor, colorGroups, product.images, variants]);

  // URL directa al producto publicado en la web o a la tienda principal
  const productWebUrl = useMemo(() => {
    if (!product.is_published) return WEB_STORE_URL;
    if (product.slug) return `${WEB_STORE_URL}/chaquetas/${product.slug}`;
    if (product.ref) return `${WEB_STORE_URL}/chaquetas/${product.ref.toLowerCase()}`;
    return WEB_STORE_URL;
  }, [product.is_published, product.slug, product.ref]);

  const hasDiscount = product.compare_price && product.compare_price > product.price_sale;

  // Generador de Ficha WhatsApp súper rica y persuasiva
  const handleCopyWhatsApp = () => {
    let text = `❄️ *ESTILO NÓRDICO* ❄️\n`;
    text += `🏷️ *${product.name}*\n`;
    text += `🔖 *Ref:* ${product.ref}\n`;
    text += `💰 *Precio:* $${fmt(product.price_sale)}`;
    if (hasDiscount) {
      text += ` ~(Antes: $${fmt(product.compare_price)})~`;
    }
    text += `\n`;

    if (selectedColor) {
      const group = colorGroups.find(g => g.color === selectedColor);
      text += `🎨 *Color Seleccionado:* ${selectedColor}\n`;
      if (group && group.sizes.length > 0) {
        const inStockSizes = group.sizes.filter(s => s.stock > 0).map(s => `${s.size} (${s.stock} un.)`);
        text += `📏 *Tallas Disponibles:* ${inStockSizes.length > 0 ? inStockSizes.join(', ') : 'Agotado en este color'}\n`;
      }
    } else if (colorGroups.length > 0) {
      text += `\n🎨 *COLORES Y TALLAS DISPONIBLES:*\n`;
      colorGroups.forEach(g => {
        const inStock = g.sizes.filter(s => s.stock > 0).map(s => `${s.size} (${s.stock} un.)`);
        if (inStock.length > 0) {
          text += `• *${g.color}:* ${inStock.join(', ')}\n`;
        }
      });
    }

    text += `⚡ *Stock Disponible:* ${totalStock > 0 ? `¡${totalStock} unidades en tienda!` : 'Agotado'}\n`;

    if (product.description) {
      text += `\n📝 _${product.description}_\n`;
    }

    if (activeImage) {
      text += `\n📸 *Ver foto:* ${normalizeImageUrl(activeImage)}\n`;
    }

    text += `\n🌐 *Mirar en Tienda Web:* ${productWebUrl}\n`;
    text += `\n🚚 *¿Te gustaría apartarla para entrega inmediata en Pasto o envío contraentrega a todo Colombia?*`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group">
      
      {/* Zona de Imagen Principal */}
      <div className="h-56 bg-slate-50 relative overflow-hidden flex items-center justify-center p-2">
        {activeImage ? (
          <img
            src={normalizeImageUrl(activeImage)}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="text-center text-slate-300">
            <Package size={44} className="mx-auto mb-1 opacity-40 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin foto asignada</span>
          </div>
        )}

        {/* Badges superiores izquierda (Tipo y Botón Mundito Web) */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <span className="bg-slate-900/85 backdrop-blur-md text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-xl shadow-xs">
            {product.product_type || 'ROPA'}
          </span>

          {/* Botón Mundito interactivo que redirige a la web */}
          <a
            href={productWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`backdrop-blur-md text-[9px] font-black uppercase px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs transition-all hover:scale-105 cursor-pointer ${
              product.is_published 
                ? 'bg-emerald-600/95 hover:bg-emerald-600 text-white' 
                : 'bg-slate-800/80 hover:bg-slate-900 text-slate-300'
            }`}
            title={product.is_published ? 'Ver producto publicado en la web (abre en nueva pestaña)' : 'Ir a la tienda web principal'}
          >
            <Globe size={10} />
            <span>{product.is_published ? 'Online' : 'Tienda'}</span>
            <ExternalLink size={9} />
          </a>
        </div>

        {/* Badge superior derecha (Stock Total) */}
        <div className="absolute top-3 right-3 z-10">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xs ${
            totalStock <= 0 
              ? 'bg-rose-500 text-white' 
              : totalStock < 3 
                ? 'bg-amber-400 text-slate-900' 
                : 'bg-emerald-500 text-white'
          }`}>
            {totalStock <= 0 ? 'Agotado' : `${totalStock} un.`}
          </span>
        </div>

        {/* Indicador de color activo sobre la foto */}
        {selectedColor && (
          <div className="absolute bottom-2 left-2 z-10 bg-indigo-600/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
            <span>Color: {selectedColor}</span>
            <button 
              type="button" 
              onClick={() => setSelectedColor(null)}
              className="hover:text-rose-200 ml-1 cursor-pointer font-bold"
              title="Ver foto general"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Contenido / Información del Producto */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Header de Ref y Categoría */}
          <div className="flex justify-between items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-black text-indigo-700 uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
              REF: {product.ref}
            </span>
            {product.category && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                {product.category} {product.subcategory ? `· ${product.subcategory}` : ''}
              </span>
            )}
          </div>

          {/* Nombre de la prenda */}
          <h4 className="font-black text-sm text-slate-900 leading-snug line-clamp-2">
            {product.name}
          </h4>

          {/* Selector Interactivo de Colores y Variantes */}
          {colorGroups.length > 0 ? (
            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Colores ({colorGroups.length}):
                </span>
                <span className="text-[9px] text-indigo-600 font-bold">
                  {selectedColor ? 'Clic para ver foto' : 'Toca un color'}
                </span>
              </div>

              {/* Pills de Color */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {colorGroups.map(g => {
                  const isSelected = selectedColor === g.color;
                  return (
                    <button
                      key={g.color}
                      type="button"
                      onClick={() => setSelectedColor(isSelected ? null : g.color)}
                      className={`px-2 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                      title={`Ver foto y stock de color ${g.color}`}
                    >
                      <span>{g.color}</span>
                      <span className={`text-[8px] px-1 py-0.2 rounded-md ${
                        isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {g.totalStock}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Tallas del color seleccionado */}
              {selectedColor ? (
                <div className="p-2 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-wider text-indigo-700 mb-1">
                    Tallas para {selectedColor}:
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {colorGroups
                      .find(g => g.color === selectedColor)
                      ?.sizes.map(s => (
                        <span
                          key={s.id}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            s.stock > 0
                              ? 'bg-white text-indigo-900 border-indigo-200 shadow-2xs'
                              : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                          }`}
                        >
                          {s.size}: <strong className="font-mono">{s.stock} un.</strong>
                        </span>
                      ))}
                  </div>
                </div>
              ) : (
                /* Resumen general de tallas en stock */
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Tallas:</span>
                  {Array.from(new Set(variants.map(v => v.size).filter(Boolean))).map(s => {
                    const stockForSize = variants.filter(v => v.size === s).reduce((sum, v) => sum + (v.stock || 0), 0);
                    return (
                      <span
                        key={s}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono ${
                          stockForSize > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-300'
                        }`}
                      >
                        {s}({stockForSize})
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Acordeón para ver detalle completo de SKUs */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAllVariants(!showAllVariants)}
                  className="w-full text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center justify-between py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>Ver todas las {variants.length} variantes</span>
                  {showAllVariants ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showAllVariants && (
                  <div className="mt-1 max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl custom-scrollbar bg-slate-50/50">
                    {variants.map(v => (
                      <div key={v.id} className="p-1.5 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {Array.isArray(v.images) && v.images.length > 0 ? (
                            <img src={normalizeImageUrl(v.images[0])} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded bg-slate-200 text-slate-500 font-bold text-[8px] flex items-center justify-center shrink-0">
                              {v.size || '-'}
                            </div>
                          )}
                          <span className="font-mono text-slate-700 truncate">{v.ref}</span>
                        </div>
                        <span className={`font-black font-mono shrink-0 ml-2 ${v.stock > 0 ? 'text-emerald-700' : 'text-rose-500'}`}>
                          {v.stock} un.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            (product.color || product.size) && (
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 font-medium">
                {product.color && (
                  <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 font-bold">
                    {product.color}
                  </span>
                )}
                {product.size && (
                  <span className="bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-black text-indigo-700 font-mono">
                    {product.size}
                  </span>
                )}
              </div>
            )
          )}
        </div>

        {/* Zona Inferior: Precios y Acciones */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p className="text-xl font-black text-slate-900 tracking-tight">
                ${fmt(product.price_sale)}
              </p>
              {hasDiscount && (
                <p className="text-[10px] font-bold text-slate-400 line-through">
                  Antes: ${fmt(product.compare_price)}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Costo Base</span>
                <span className="text-xs font-black text-slate-600 font-mono">${fmt(product.my_cost)}</span>
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2">
            {/* Botón Principal Ficha WhatsApp */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? '✅ ¡Copiado!' : '💬 Ficha WhatsApp'}</span>
            </button>

            {/* Botón Mirar en Web (Redirige a la página web) */}
            <a
              href={productWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
              title="Mirar esta prenda directamente en la tienda web"
            >
              <Globe size={16} />
            </a>

            {/* Botón Editar para Admin */}
            {isAdmin && onEditProduct && (
              <button
                type="button"
                onClick={() => onEditProduct(product)}
                className="p-2.5 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all shrink-0 cursor-pointer"
                title="Editar ficha del producto"
              >
                <Edit3 size={15} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Catálogo Asesores completo con filtros avanzados, búsqueda instantánea
 * y mapeo inteligente de variantes para cada prenda base.
 */
export default function AdvisorCatalog({ products = [], allProducts = [], onEditProduct }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('TODOS');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Mapear variantes para cada producto base
  const variantsByParent = useMemo(() => {
    const map = {};
    (allProducts || []).forEach(item => {
      if (item.parent_id) {
        if (!map[item.parent_id]) map[item.parent_id] = [];
        map[item.parent_id].push(item);
      }
    });

    // Para productos que no tengan parent_id explícito pero su ref sea prefijo
    (products || []).forEach(p => {
      if (!map[p.id]) {
        const prefix = `${p.ref}-`.toLowerCase();
        const found = (allProducts || []).filter(item => 
          item.id !== p.id && item.ref && item.ref.toLowerCase().startsWith(prefix)
        );
        if (found.length > 0) map[p.id] = found;
      }
    });

    return map;
  }, [products, allProducts]);

  // Filtrado reactivo de productos
  const filtered = useMemo(() => {
    let list = [...products];

    if (selectedType !== 'TODOS') {
      list = list.filter(p => (p.product_type || 'ROPA').toUpperCase() === selectedType);
    }

    if (onlyInStock) {
      list = list.filter(p => {
        const vars = variantsByParent[p.id] || [];
        const totStock = vars.length > 0 
          ? vars.reduce((sum, v) => sum + (v.stock || 0), 0)
          : (p.stock || 0);
        return totStock > 0;
      });
    }

    if (search && search.trim()) {
      const kws = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(item => {
        const vars = variantsByParent[item.id] || [];
        const variantText = vars.map(v => `${v.ref} ${v.color || ''} ${v.size || ''} ${v.brand || ''}`).join(' ');
        const content = `${item.ref || ''} ${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${item.brand || ''} ${item.color || ''} ${item.size || ''} ${item.product_type || ''} ${variantText}`.toLowerCase();
        return kws.every(k => content.includes(k));
      });
    }

    return list;
  }, [products, selectedType, onlyInStock, search, variantsByParent]);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      
      {/* Barra Superior de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar prenda, ref, color (ej: azul, negro), talla (ej: XL, M)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['TODOS', 'CHAQUETA', 'ROPA', 'PERFUME', 'RELOJ', 'ACCESORIO'].map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedType === t 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}

          <button
            onClick={() => setOnlyInStock(!onlyInStock)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
              onlyInStock 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Filter size={12} /> Solo en Stock
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas del Catálogo */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="font-bold text-sm text-slate-600">No se encontraron prendas con este criterio.</p>
            <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros o buscando por color o talla.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
            {filtered.map(p => (
              <AdvisorProductCard
                key={p.id}
                product={p}
                variants={variantsByParent[p.id] || []}
                isAdmin={isAdmin}
                onEditProduct={onEditProduct}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
