import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, Package, Globe, Copy, Check, Edit3, 
  ExternalLink, X, Eye, Sparkles, Layers, Tag, ChevronRight,
  Shirt, CheckCircle2, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { normalizeImageUrl } from '../utils/imageOptimizer';
import { copyImageToClipboard } from '../utils/clipboardHelper';
import { Camera, Link as LinkIcon, Share2, Palette, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { WEB_STORE_URL } from '../config/api';
import { getProductWebUrl } from '../utils/webUrlHelper';

const fmt = (num) => Number(num || 0).toLocaleString('es-CO');

/**
 * MODAL EMERGENTE DE CONSULTA DE TALLAS & COLORES
 * Permite al asesor responder en 2 segundos: "¿Qué colores tienes en talla M?"
 * o "¿Qué tallas tienes en color Azul?", con fotos exactas y copia a WhatsApp.
 */
function ProductSalesModal({ product, variants = [], isOpen, onClose }) {
  if (!isOpen || !product) return null;

  const [selectedSize, setSelectedSize] = useState('TODAS');
  const [selectedColor, setSelectedColor] = useState('TODOS');
  const [activeVariant, setActiveVariant] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);

  const handleCopyImage = async () => {
    if (!heroImage) return;
    try {
      await copyImageToClipboard(heroImage);
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  // Lista única de tallas disponibles con stock > 0
  const availableSizes = useMemo(() => {
    const set = new Set();
    variants.forEach(v => {
      if ((v.stock || 0) > 0 && v.size) set.add(v.size.trim().toUpperCase());
    });
    const order = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '30', '32', '34', '36', '38'];
    return Array.from(set).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [variants]);

  // Lista única de colores disponibles, ordenados por disponibilidad y orden alfabético A-Z
  const availableColors = useMemo(() => {
    const map = {};
    variants.forEach(v => {
      const col = (v.color || 'ÚNICO').trim().toUpperCase();
      if (!map[col]) {
        map[col] = {
          name: col,
          totalStock: 0,
          image: (Array.isArray(v.images) && v.images.length > 0) ? v.images[0] : null
        };
      }
      map[col].totalStock += (v.stock || 0);
      if (!map[col].image && Array.isArray(v.images) && v.images.length > 0) {
        map[col].image = v.images[0];
      }
    });
    return Object.values(map).sort((a, b) => {
      // 1. Con stock primero, agotados al final
      const sA = a.totalStock > 0 ? 1 : 0;
      const sB = b.totalStock > 0 ? 1 : 0;
      if (sA !== sB) return sB - sA;
      // 2. Orden alfabético A-Z
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  }, [variants]);

  // Variantes filtradas según la talla y/o color seleccionados
  // ORDEN ESTILO NÓRDICO:
  // 1. Disponibles primero (stock > 0), agotadas de últimas (stock <= 0)
  // 2. Por Talla estándar (si se ven Todas)
  // 3. Por orden ALFABÉTICO estricto de color (A -> Z) igual que los percheros del local
  const filteredVariants = useMemo(() => {
    const list = variants.filter(v => {
      const vSize = (v.size || '').trim().toUpperCase();
      const vColor = (v.color || '').trim().toUpperCase();
      const sizeMatch = selectedSize === 'TODAS' || vSize === selectedSize;
      const colorMatch = selectedColor === 'TODOS' || vColor === selectedColor;
      return sizeMatch && colorMatch;
    });

    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38'];

    return list.sort((a, b) => {
      // 1. Disponibles con stock > 0 primero, agotadas al final
      const stockA = (a.stock || 0) > 0 ? 1 : 0;
      const stockB = (b.stock || 0) > 0 ? 1 : 0;
      if (stockA !== stockB) return stockB - stockA;

      // 2. Si se están viendo TODAS las tallas, ordenar primero por orden de talla estándar
      if (selectedSize === 'TODAS') {
        const sizeA = (a.size || '').trim().toUpperCase();
        const sizeB = (b.size || '').trim().toUpperCase();
        if (sizeA !== sizeB) {
          const idxA = sizeOrder.indexOf(sizeA);
          const idxB = sizeOrder.indexOf(sizeB);
          if (idxA !== -1 && idxB !== -1) {
            if (idxA !== idxB) return idxA - idxB;
          } else if (idxA !== -1) {
            return -1;
          } else if (idxB !== -1) {
            return 1;
          } else {
            const sizeCmp = sizeA.localeCompare(sizeB, 'es', { numeric: true });
            if (sizeCmp !== 0) return sizeCmp;
          }
        }
      }

      // 3. Orden alfabético estricto de Color (A -> Z)
      const colorA = (a.color || '').trim().toUpperCase();
      const colorB = (b.color || '').trim().toUpperCase();
      const colorCmp = colorA.localeCompare(colorB, 'es', { sensitivity: 'base' });
      if (colorCmp !== 0) return colorCmp;

      // 4. Orden alfabético por Marca / Submodelo
      const brandA = (a.brand || '').trim().toUpperCase();
      const brandB = (b.brand || '').trim().toUpperCase();
      const brandCmp = brandA.localeCompare(brandB, 'es', { sensitivity: 'base' });
      if (brandCmp !== 0) return brandCmp;

      return (a.name || '').localeCompare(b.name || '', 'es');
    });
  }, [variants, selectedSize, selectedColor]);

  // Foto destacada para previsualizar en el modal
  const heroImage = useMemo(() => {
    if (activeVariant && Array.isArray(activeVariant.images) && activeVariant.images.length > 0) {
      return activeVariant.images[0];
    }
    if (selectedColor !== 'TODOS') {
      const colObj = availableColors.find(c => c.name === selectedColor);
      if (colObj?.image) return colObj.image;
    }
    const withImg = filteredVariants.find(v => Array.isArray(v.images) && v.images.length > 0);
    if (withImg) return withImg.images[0];
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    return null;
  }, [activeVariant, selectedColor, availableColors, filteredVariants, product.images]);

  const totalStock = variants.length > 0 
    ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (product.stock || 0);

  const productWebUrl = useMemo(() => {
    return getProductWebUrl(product, selectedColor !== 'TODOS' ? selectedColor : (activeVariant?.color || null));
  }, [product, selectedColor, activeVariant]);

  // Copia inteligente y contextual a WhatsApp
  const handleCopyWhatsApp = () => {
    let text = `❄️ *ESTILO NÓRDICO* ❄️\n`;
    text += `🏷️ *${product.name}*\n`;
    text += `🔖 *Ref:* ${product.ref}\n`;
    text += `💰 *Precio:* $${fmt(product.price_sale)}\n\n`;

    // 1. Si filtró por una talla específica (ej: M):
    if (selectedSize !== 'TODAS') {
      text += `📏 *CONSULTA EN TALLA ${selectedSize}:*\n`;
      const inStockInSize = variants.filter(v => (v.size || '').toUpperCase() === selectedSize && (v.stock || 0) > 0);
      if (inStockInSize.length > 0) {
        text += `✨ *Colores disponibles en ${selectedSize}:*\n`;
        inStockInSize.forEach(v => {
          const brandText = v.brand && v.brand !== 'Estilo Nórdico' ? ` (${v.brand})` : '';
          text += `• ${v.color}${brandText}: *${v.stock} un. disponible(s)*\n`;
        });
      } else {
        text += `⚠️ En este momento no hay disponibilidad en talla ${selectedSize}.\n`;
      }
    } 
    // 2. Si filtró por un color específico:
    else if (selectedColor !== 'TODOS') {
      text += `🎨 *CONSULTA EN COLOR ${selectedColor}:*\n`;
      const inStockInColor = variants.filter(v => (v.color || '').toUpperCase() === selectedColor && (v.stock || 0) > 0);
      if (inStockInColor.length > 0) {
        const sizesStr = inStockInColor.map(v => `${v.size} (${v.stock} un.)`).join(', ');
        text += `📏 *Tallas disponibles en ${selectedColor}:* ${sizesStr}\n`;
      }
    } 
    // 3. Resumen general completo:
    else {
      text += `🎨 *COLORES Y TALLAS DISPONIBLES:*\n`;
      availableColors.forEach(c => {
        const sizesForCol = variants
          .filter(v => (v.color || '').toUpperCase() === c.name && (v.stock || 0) > 0)
          .map(v => `${v.size} (${v.stock} un.)`);
        if (sizesForCol.length > 0) {
          text += `• *${c.name}:* ${sizesForCol.join(', ')}\n`;
        }
      });
    }

    text += `\n⚡ *Disponibilidad:* ¡${totalStock} unidades en stock real para entrega inmediata!\n`;
    if (heroImage) {
      text += `📸 *Ver foto:* ${normalizeImageUrl(heroImage)}\n`;
    }
    text += `🌐 *Ver en Tienda Web:* ${productWebUrl}\n`;
    text += `\n🚚 *¿Te gustaría apartarla o solicitar envío contraentrega?*`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header del Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Shirt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                  REF: {product.ref}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase">
                  {product.category} · {product.subcategory || product.product_type}
                </span>
                {product.is_published && (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Globe size={10} /> Web
                  </span>
                )}
              </div>
              <h3 className="font-black text-slate-900 text-lg leading-snug">{product.name}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xl font-black text-slate-900">${fmt(product.price_sale)}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">
                {totalStock} unidades en stock
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Filtro Rápido por Talla */}
        <div className="px-6 py-3 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1">
              <span>🎯 Filtrar por Talla:</span>
            </span>
            <button
              onClick={() => setSelectedSize('TODAS')}
              className={`px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                selectedSize === 'TODAS'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              Todas ({availableSizes.length})
            </button>
            {availableSizes.map(s => {
              const stockInSize = variants.filter(v => (v.size || '').toUpperCase() === s).reduce((sum, v) => sum + (v.stock || 0), 0);
              const isSelected = selectedSize === s;
              return (
                <button
                  key={s}
                  onClick={() => setSelectedSize(isSelected ? 'TODAS' : s)}
                  className={`px-3 py-1 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <span>{s}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {stockInSize}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedSize !== 'TODAS' && (
            <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
              Mostrando colores en talla <strong className="font-black text-indigo-900">{selectedSize}</strong>
            </span>
          )}
        </div>

        {/* Barra de Filtro Rápido por Color */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
            Color:
          </span>
          <button
            onClick={() => setSelectedColor('TODOS')}
            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase transition-all shrink-0 cursor-pointer ${
              selectedColor === 'TODOS'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos
          </button>
          {availableColors.map(c => {
            const isSelected = selectedColor === c.name;
            return (
              <button
                key={c.name}
                onClick={() => setSelectedColor(isSelected ? 'TODOS' : c.name)}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{c.name}</span>
                <span className={`text-[8px] px-1 rounded ${isSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {c.totalStock}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cuerpo del Modal: Foto Activa + Grid de Variantes */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col md:flex-row gap-6">
          
          {/* Columna Izquierda: Visor de Foto Grande */}
          <div className="w-full md:w-64 shrink-0 flex flex-col gap-3">
            <div className="aspect-square bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative flex items-center justify-center p-2 shadow-xs">
              {heroImage ? (
                <img
                  src={normalizeImageUrl(heroImage)}
                  alt={product.name}
                  className="w-full h-full object-contain drop-shadow-sm transition-all"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="text-center text-slate-300">
                  <Package size={48} className="mx-auto mb-1 opacity-40 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400">Sin foto</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Variantes filtradas:</span>
                <span className="font-mono text-slate-900">{filteredVariants.length}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Stock disponible:</span>
                <span className="font-mono text-emerald-700">
                  {filteredVariants.reduce((sum, v) => sum + (v.stock || 0), 0)} un.
                </span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Tarjetas de Variantes Filtradas */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                {selectedSize !== 'TODAS' 
                  ? `Colores disponibles en talla ${selectedSize}:`
                  : 'Opciones de color y talla disponibles:'}
              </span>
              {(selectedSize !== 'TODAS' || selectedColor !== 'TODOS') && (
                <button
                  onClick={() => { setSelectedSize('TODAS'); setSelectedColor('TODOS'); }}
                  className="text-indigo-600 hover:underline text-[11px] font-bold cursor-pointer"
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            {filteredVariants.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Shirt size={36} className="mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="font-bold text-sm text-slate-600">No hay existencias con este filtro.</p>
                <p className="text-xs text-slate-400 mt-1">Prueba seleccionando otra talla o color arriba.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredVariants.map(v => {
                  const hasImg = Array.isArray(v.images) && v.images.length > 0;
                  const isStockOut = (v.stock || 0) <= 0;

                  return (
                    <div
                      key={v.id}
                      onClick={() => setActiveVariant(v)}
                      className={`p-3 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                        activeVariant?.id === v.id
                          ? 'bg-indigo-50/80 border-indigo-400 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Thumbnail de la foto exacta */}
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {hasImg ? (
                          <img
                            src={normalizeImageUrl(v.images[0])}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="font-mono font-black text-xs text-slate-500">{v.size || '-'}</span>
                        )}
                      </div>

                      {/* Info de la variante */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-black text-xs text-slate-900 truncate uppercase">
                            {v.color || 'COLOR ÚNICO'}
                          </p>
                          {v.brand && v.brand !== 'Estilo Nórdico' && (
                            <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
                              {v.brand}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 font-mono truncate">{v.ref}</p>

                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-black font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded">
                            Talla: {v.size}
                          </span>
                          <span className={`text-[11px] font-black font-mono ${
                            isStockOut ? 'text-rose-500' : 'text-emerald-700'
                          }`}>
                            {isStockOut ? 'Agotado' : `${v.stock} un.`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer del Modal con Copiado WhatsApp y Link a Web */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={productWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Globe size={14} className="text-indigo-600" />
              <span>Ver en Tienda Web</span>
              <ExternalLink size={11} className="text-slate-400" />
            </a>

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={!heroImage}
              className={`px-3.5 py-2.5 rounded-xl font-black text-xs border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                copiedImg 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md animate-bounce' 
                  : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-700'
              }`}
              title="Copiar foto exacta al portapapeles. Luego ve a WhatsApp y presiona Ctrl + V"
            >
              {copiedImg ? <Check size={14} /> : <Camera size={14} className="text-indigo-600" />}
              <span>{copiedImg ? '✅ ¡Foto Copiada! (Ctrl + V)' : '📸 Copiar Foto'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>
                {copied 
                  ? '✅ ¡Ficha Copiada al Portapapeles!' 
                  : selectedSize !== 'TODAS'
                    ? `💬 Copiar Ficha Talla ${selectedSize} para WhatsApp`
                    : '💬 Copiar Ficha Completa para WhatsApp'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * TARJETA COMPACTA DEL PRODUCTO EN EL CATÁLOGO
 * Diseño optimizado, tamaño estándar, sin costos internos y con apertura de la ventana de tallas.
 */
function CompactAdvisorProductCard({ product, variants = [], isAdmin, onEditProduct, onOpenSalesModal }) {
  const [copied, setCopied] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);

  const handleCopyCardImage = async (e) => {
    e.stopPropagation();
    if (!cardImage) return;
    try {
      await copyImageToClipboard(cardImage);
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Total stock
  const totalStock = variants.length > 0 
    ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (product.stock || 0);

  // Lista de tallas únicas disponibles
  const sizes = useMemo(() => {
    const set = new Set();
    variants.forEach(v => {
      if ((v.stock || 0) > 0 && v.size) set.add(v.size);
    });
    return Array.from(set);
  }, [variants]);

  // Lista de colores únicos
  const colorsCount = useMemo(() => {
    const set = new Set();
    variants.forEach(v => {
      if ((v.stock || 0) > 0 && v.color) set.add(v.color.toUpperCase());
    });
    return set.size;
  }, [variants]);

  // Foto principal limpia
  const cardImage = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    const vImg = variants.find(v => Array.isArray(v.images) && v.images.length > 0);
    return vImg ? vImg.images[0] : null;
  }, [product.images, variants]);

  const productWebUrl = useMemo(() => {
    return getProductWebUrl(product);
  }, [product]);

  const hasDiscount = product.compare_price && product.compare_price > product.price_sale;

  const handleQuickCopyWhatsApp = (e) => {
    e.stopPropagation();
    let text = `❄️ *ESTILO NÓRDICO* ❄️\n`;
    text += `🏷️ *${product.name}*\n`;
    text += `🔖 *Ref:* ${product.ref}\n`;
    text += `💰 *Precio:* $${fmt(product.price_sale)}`;
    if (hasDiscount) text += ` ~(Antes: $${fmt(product.compare_price)})~`;
    text += `\n`;
    if (sizes.length > 0) text += `📏 *Tallas disponibles:* ${sizes.join(', ')}\n`;
    text += `⚡ *Stock disponible:* ${totalStock} unidades\n`;
    if (cardImage) text += `📸 *Ver foto:* ${normalizeImageUrl(cardImage)}\n`;
    text += `🌐 *Ver en Web:* ${productWebUrl}\n`;
    text += `\n🚚 *¿Te gustaría apartarla o solicitar envío contraentrega?*`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      onClick={() => onOpenSalesModal(product)}
      className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all duration-200 overflow-hidden flex flex-col group cursor-pointer"
    >
      {/* Zona de Imagen Compacta (h-48) */}
      <div className="h-48 bg-slate-50 relative overflow-hidden flex items-center justify-center p-3">
        {cardImage ? (
          <img
            src={normalizeImageUrl(cardImage)}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="text-center text-slate-300">
            <Package size={40} className="mx-auto mb-1 opacity-40 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin foto</span>
          </div>
        )}

        {/* Badges superiores izquierda */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <span className="bg-slate-900/85 backdrop-blur-md text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shadow-xs">
            {product.product_type || 'ROPA'}
          </span>
          {product.is_published && (
            <a
              href={productWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="bg-emerald-600/95 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs transition-transform hover:scale-105 cursor-pointer"
              title="Abrir en la tienda web"
            >
              <Globe size={10} /> Online
            </a>
          )}
        </div>

        {/* Badge superior derecha (Stock Total) */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg shadow-xs font-mono ${
            totalStock <= 0 
              ? 'bg-rose-500 text-white' 
              : totalStock < 3 
                ? 'bg-amber-400 text-slate-900' 
                : 'bg-emerald-500 text-white'
          }`}>
            {totalStock <= 0 ? 'Agotado' : `${totalStock} un.`}
          </span>
        </div>

        {/* Botón flotante para inspeccionar tallas */}
        <div className="absolute inset-x-0 bottom-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-slate-900/90 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
            <Eye size={12} /> Clic para ver tallas y colores
          </span>
        </div>
      </div>

      {/* Contenido / Información Compacta */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          <div className="flex justify-between items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-black text-indigo-700 uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
              REF: {product.ref}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {product.category}
            </span>
          </div>

          <h4 className="font-black text-sm text-slate-900 leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {product.name}
          </h4>

          {/* Fila de Resumen de Tallas y Colores */}
          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600 font-medium">
            <span className="text-slate-400 font-bold">
              {colorsCount > 0 ? `${colorsCount} colores` : 'Color único'}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Tallas:</span>
              <span className="font-black text-slate-800 font-mono">
                {sizes.length > 0 ? sizes.slice(0, 4).join(', ') + (sizes.length > 4 ? '...' : '') : 'Única'}
              </span>
            </div>
          </div>
        </div>

        {/* Zona Inferior: Precio y Acciones */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              ${fmt(product.price_sale)}
            </p>
            {hasDiscount && (
              <p className="text-[9px] font-bold text-slate-400 line-through">
                Antes: ${fmt(product.compare_price)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {/* Botón WhatsApp */}
            <button
              type="button"
              onClick={handleQuickCopyWhatsApp}
              className={`py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1 shadow-xs cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
              }`}
              title="Copiar ficha básica para WhatsApp"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span className="text-[11px]">{copied ? '¡Copiado!' : 'WhatsApp'}</span>
            </button>

            {/* Botón Copiar Foto */}
            <button
              type="button"
              onClick={handleCopyCardImage}
              disabled={!cardImage}
              className={`p-2 border rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-2xs ${
                copiedImg 
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700' 
                  : 'border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700'
              }`}
              title="Copiar foto al portapapeles para pegar en WhatsApp (Ctrl + V)"
            >
              {copiedImg ? <Check size={14} className="text-emerald-600" /> : <Camera size={15} />}
            </button>

            {/* Botón Ver Web */}
            <a
              href={productWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
              title="Mirar esta prenda en la tienda web"
            >
              <Globe size={15} />
            </a>

            {/* Botón Editar para Admin */}
            {isAdmin && onEditProduct && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
                className="p-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shrink-0 cursor-pointer"
                title="Editar ficha del producto"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * CATÁLOGO COMPLETO DE ASESORES
 * Con filtros rápidos por Talla, Tipo, Búsqueda instantánea y Modal emergente de ventas.
 */
export default function AdvisorCatalog({ products = [], allProducts = [], onEditProduct }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('TODOS');
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const colorMenuRef = useRef(null);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCatalog, setCopiedCatalog] = useState(false);

  // Estado del modal emergente de venta
  const [activeModalProduct, setActiveModalProduct] = useState(null);

  // Mapear variantes por id de producto base
  const variantsByParent = useMemo(() => {
    const map = {};
    (allProducts || []).forEach(item => {
      if (item.parent_id) {
        if (!map[item.parent_id]) map[item.parent_id] = [];
        map[item.parent_id].push(item);
      }
    });

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

  // Lista de tallas comunes para el filtro rápido superior
  // Cerrar desplegable de colores al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target)) {
        setIsColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Lista dinámica de todos los colores registrados en inventario con stock > 0
  const availableColorsList = useMemo(() => {
    const set = new Set();
    (allProducts || []).forEach(p => {
      const c = (p.color || '').trim().toUpperCase();
      if (c && c !== 'UNICO' && c !== 'ÚNICO' && (p.stock || 0) > 0) {
        set.add(c);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allProducts]);

  const commonFilterSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38'];

  // Filtrado reactivo de productos
  const filtered = useMemo(() => {
    let list = [...products];

    // Filtro por Tipo de prenda
    if (selectedType !== 'TODOS') {
      list = list.filter(p => (p.product_type || 'ROPA').toUpperCase() === selectedType);
    }

    // Filtro por Talla(s) Seleccionada(s) (ej: XL y 32 simultáneamente)
    if (selectedSizes.length > 0) {
      list = list.filter(p => {
        const vars = variantsByParent[p.id] || [];
        if (vars.length > 0) {
          return vars.some(v => selectedSizes.includes((v.size || '').toUpperCase()) && (v.stock || 0) > 0);
        }
        return selectedSizes.includes((p.size || '').toUpperCase()) && (p.stock || 0) > 0;
      });
    }

    // Filtro por Color(es) Seleccionado(s) desde el menú desplegable
    if (selectedColors.length > 0) {
      list = list.filter(p => {
        const vars = variantsByParent[p.id] || [];
        if (vars.length > 0) {
          return vars.some(v => 
            selectedColors.includes((v.color || '').trim().toUpperCase()) && (v.stock || 0) > 0
          );
        }
        return selectedColors.includes((p.color || '').trim().toUpperCase()) && (p.stock || 0) > 0;
      });
    }

    // Filtro Solo en Stock
    if (onlyInStock) {
      list = list.filter(p => {
        const vars = variantsByParent[p.id] || [];
        const totStock = vars.length > 0 
          ? vars.reduce((sum, v) => sum + (v.stock || 0), 0)
          : (p.stock || 0);
        return totStock > 0;
      });
    }

    // Buscador Inteligente con soporte para múltiples términos (ej: "pantalones 32, camisetas M" o "AND / OR")
    if (search && search.trim()) {
      const rawQuery = search.trim();
      const orClauses = rawQuery.includes(' OR ')
        ? rawQuery.split(' OR ')
        : (rawQuery.includes(',') ? rawQuery.split(',') : [rawQuery]);

      list = list.filter(item => {
        const vars = variantsByParent[item.id] || [];
        const variantSizes = vars.filter(v => (v.stock || 0) > 0).map(v => (v.size || '').toUpperCase()).join(' ');
        const variantColors = vars.map(v => (v.color || '').toUpperCase()).join(' ');
        const variantBrands = vars.map(v => (v.brand || '').toUpperCase()).join(' ');
        const content = `${item.ref || ''} ${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${item.brand || ''} ${item.color || ''} ${item.size || ''} ${item.product_type || ''} ${variantSizes} ${variantColors} ${variantBrands}`.toLowerCase();

        return orClauses.some(clause => {
          const terms = clause.replace(/\s+AND\s+/gi, ' ').trim().toLowerCase().split(/\s+/).filter(Boolean);
          return terms.every(k => content.includes(k));
        });
      });
    }

    // ORDENAMIENTO ESTILO NÓRDICO (Igual que el catálogo de tienda):
    // 1. Prendas con stock disponible primero, agotadas de últimas
    // 2. Orden alfabético A-Z por Nombre de prenda o Referencia
    return list.sort((a, b) => {
      const varsA = variantsByParent[a.id] || [];
      const stockA = varsA.length > 0 ? varsA.reduce((sum, v) => sum + (v.stock || 0), 0) : (a.stock || 0);
      const varsB = variantsByParent[b.id] || [];
      const stockB = varsB.length > 0 ? varsB.reduce((sum, v) => sum + (v.stock || 0), 0) : (b.stock || 0);

      const hasStockA = stockA > 0 ? 1 : 0;
      const hasStockB = stockB > 0 ? 1 : 0;
      if (hasStockA !== hasStockB) return hasStockB - hasStockA; // Disponibles primero

      const nameA = (a.name || a.ref || '').trim();
      const nameB = (b.name || b.ref || '').trim();
      const nameCmp = nameA.localeCompare(nameB, 'es', { sensitivity: 'base', numeric: true });
      if (nameCmp !== 0) return nameCmp;

      return (a.ref || '').localeCompare(b.ref || '', 'es');
    });
  }, [products, selectedType, selectedSizes, selectedColors, onlyInStock, search, variantsByParent]);

  const toggleSize = (s) => {
    setSelectedSizes(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleColor = (c) => {
    setSelectedColors(prev => 
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleCopyFilteredLink = () => {
    let url = `${WEB_STORE_URL}/chaquetas`;
    const params = [];
    if (selectedSizes.length > 0) {
      params.push(`talla=${encodeURIComponent(selectedSizes.join(','))}`);
    }
    if (selectedColors.length > 0) {
      params.push(`color=${encodeURIComponent(selectedColors.join(','))}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCatalogSummary = () => {
    let titleParts = [];
    if (selectedSizes.length > 0) titleParts.push(`TALLA ${selectedSizes.join(' / ')}`);
    if (selectedColors.length > 0) titleParts.push(`COLOR ${selectedColors.join(' / ')}`);

    let title = titleParts.length > 0 
      ? `❄️ *DISPONIBLES EN ${titleParts.join(' - ')}* ❄️\n`
      : `❄️ *CATÁLOGO DE PRENDAS DISPONIBLES* ❄️\n`;
    
    let text = title;
    text += `¡Hola! Aquí tienes lo disponible para entrega inmediata en Pasto y envíos nacionales:\n\n`;

    filtered.slice(0, 15).forEach(p => {
      const vars = variantsByParent[p.id] || [];
      const availableItems = vars.length > 0
        ? vars.filter(v => {
            const matchesSize = selectedSizes.length === 0 || selectedSizes.includes((v.size || '').toUpperCase());
            const matchesColor = selectedColors.length === 0 || selectedColors.includes((v.color || '').trim().toUpperCase());
            return matchesSize && matchesColor && (v.stock || 0) > 0;
          })
        : [p];

      const colorsArr = Array.from(new Set(availableItems.map(v => v.color).filter(Boolean)));
      const colorsStr = colorsArr.length > 0 ? colorsArr.join(', ') : (p.color || 'Disponible');
      text += `• *${p.name}* (Ref: ${p.ref})\n`;
      text += `  🎨 Colores: ${colorsStr}\n`;
      text += `  💰 Precio: $${fmt(p.price_sale)}\n\n`;
    });

    let webUrl = `${WEB_STORE_URL}/chaquetas`;
    const params = [];
    if (selectedSizes.length > 0) params.push(`talla=${encodeURIComponent(selectedSizes.join(','))}`);
    if (selectedColors.length > 0) params.push(`color=${encodeURIComponent(selectedColors.join(','))}`);
    if (params.length > 0) webUrl += `?${params.join('&')}`;

    text += `🌐 *Ver fotos completas y colores en la tienda web:* ${webUrl}\n`;
    text += `\n🚚 *¿Te gustaría apartar alguna para envío contraentrega?*`;

    navigator.clipboard.writeText(text);
    setCopiedCatalog(true);
    setTimeout(() => setCopiedCatalog(false), 2500);
  };


  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      
      {/* Barra Superior de Filtros */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por referencia (ej: 5080), nombre, color..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtros de Tipo */}
          <div className="flex items-center gap-1.5 flex-wrap">
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
              <Filter size={12} /> En Stock
            </button>
          </div>
        </div>

        {/* Fila 2: Filtro Rápido Global por Talla (Soporta múltiples tallas a la vez: ej. XL y 32) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Shirt size={12} className="text-indigo-600" /> Tallas:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSizes([])}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                selectedSizes.length === 0
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todas
            </button>
            {commonFilterSizes.map(s => {
              const isSelected = selectedSizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Menú Desplegable de Colores con selección múltiple */}
          <div className="relative" ref={colorMenuRef}>
            <button
              type="button"
              onClick={() => setIsColorMenuOpen(prev => !prev)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                selectedColors.length > 0
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="Filtrar por uno o varios colores disponibles"
            >
              <Palette size={12} className={selectedColors.length > 0 ? 'text-white' : 'text-indigo-600'} />
              <span>{selectedColors.length > 0 ? `Colores (${selectedColors.length})` : 'Color'}</span>
              <ChevronDownIcon size={12} className={`transition-transform duration-200 ${isColorMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isColorMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Colores Disponibles
                  </span>
                  {selectedColors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedColors([])}
                      className="text-[10px] text-rose-500 font-black hover:underline cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                  {availableColorsList.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-3">No hay colores registrados</p>
                  ) : (
                    availableColorsList.map(col => {
                      const isChecked = selectedColors.includes(col);
                      return (
                        <div
                          key={col}
                          onClick={() => toggleColor(col)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            isChecked ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full border transition-all ${
                              isChecked ? 'bg-indigo-600 border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300 bg-white'
                            }`} />
                            <span className="text-xs uppercase font-bold">{col}</span>
                          </div>
                          {isChecked && <Check size={13} className="text-indigo-600" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Badges de Colores Seleccionados para remover con un clic */}
          {selectedColors.map(col => (
            <span
              key={col}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
            >
              {col}
              <button
                type="button"
                onClick={() => toggleColor(col)}
                className="hover:text-rose-600 cursor-pointer ml-0.5"
                title={`Quitar filtro ${col}`}
              >
                ✕
              </button>
            </span>
          ))}

          {/* Botones de Acción para Asesores: Compartir link filtrado y Resumen WhatsApp */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopyFilteredLink}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                copiedLink 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-700'
              }`}
              title="Copiar enlace directo de la web con el filtro de tallas y colores activo para enviar al cliente"
            >
              {copiedLink ? <Check size={12} /> : <LinkIcon size={12} className="text-indigo-600" />}
              <span>
                {copiedLink 
                  ? '¡Link Copiado!' 
                  : (selectedSizes.length > 0 || selectedColors.length > 0)
                    ? `🔗 Link Tienda (${[...selectedSizes, ...selectedColors].slice(0, 2).join('+')}${selectedSizes.length + selectedColors.length > 2 ? '...' : ''})` 
                    : '🔗 Link Tienda'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyCatalogSummary}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                copiedCatalog 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-700 hover:text-emerald-700'
              }`}
              title="Copiar lista de prendas disponibles en esta talla con precios y link para WhatsApp"
            >
              {copiedCatalog ? <Check size={12} /> : <Copy size={12} className="text-emerald-600" />}
              <span>{copiedCatalog ? '¡Lista Copiada!' : '💬 Lista WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas Compactas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="font-bold text-sm text-slate-600">No se encontraron prendas con este criterio.</p>
            <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros de talla o búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-8">
            {filtered.map(p => (
              <CompactAdvisorProductCard
                key={p.id}
                product={p}
                variants={variantsByParent[p.id] || []}
                isAdmin={isAdmin}
                onEditProduct={onEditProduct}
                onOpenSalesModal={(prod) => setActiveModalProduct(prod)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Emergente de Ventas para Asesor */}
      {activeModalProduct && (
        <ProductSalesModal
          product={activeModalProduct}
          variants={variantsByParent[activeModalProduct.id] || []}
          isOpen={Boolean(activeModalProduct)}
          onClose={() => setActiveModalProduct(null)}
        />
      )}

    </div>
  );
}
