import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Trash2, Check, RefreshCw, AlertCircle, Layers, Tag, 
  ShieldCheck, Camera, Image as ImageIcon, UploadCloud, Pencil
} from 'lucide-react';
import { API_URL } from '../config/api';
import { 
  normalizeImageUrl, 
  optimizeImageToWebP, 
  uploadProductImage, 
  removeProductImage 
} from '../utils/imageOptimizer';
import EditVariantModal from './EditVariantModal';

const COMMON_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '30', '32', '34', '36'];
const COMMON_COLORS = ['NEGRO', 'AZUL', 'AZUL OSCURO', 'BLANCO', 'BEIGE', 'VERDE', 'VERDE MILITAR', 'ROJO', 'VINOTINTO', 'GRIS', 'CAMEL'];
const QUICK_BRANDS = ['THE NORTH FACE', 'COLUMBIA', 'MONCLER', 'DIESEL', 'ARMANI', 'ESTILO NÓRDICO'];

export default function VariantBreakdownModal({ baseProduct, allProducts, isOpen, onClose, onRefresh }) {
  if (!isOpen || !baseProduct) return null;

  // Estados de formulario nueva variante
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tempQty, setTempQty] = useState('');

  // Estados para asignación y carga de fotos de variantes
  const [uploadingVariantId, setUploadingVariantId] = useState(null);
  const [pickingGalleryFor, setPickingGalleryFor] = useState(null);
  const [newVariantFile, setNewVariantFile] = useState(null);
  const [newVariantPreview, setNewVariantPreview] = useState(null);

  // Estado para modal de edición completa de una variante
  const [editingVariant, setEditingVariant] = useState(null);

  // Estados para corrección en lote de variantes con 'ESTILO NÓRDICO'
  const [targetBatchBrand, setTargetBatchBrand] = useState('THE NORTH FACE');
  const [batchFixing, setBatchFixing] = useState(false);

  // Encuentra variantes existentes que pertenezcan a este producto base
  // ORDEN ESTILO NÓRDICO:
  // 1. Por COLOR estricto en orden alfabético (A -> Z). Así todas las Azules van seguidas, luego Azul Cobalto, Beige, etc.
  // 2. Por TALLA estándar (S, M, L, XL, XXL, XXXL...)
  // 3. Por MARCA / Submodelo
  const existingVariants = useMemo(() => {
    const prefix = `${baseProduct.ref}-`.toLowerCase();
    const list = allProducts.filter(p => 
      p.id !== baseProduct.id && 
      (p.parent_id === baseProduct.id || (p.ref && p.ref.toLowerCase().startsWith(prefix)))
    );

    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38'];

    return list.sort((a, b) => {
      // 1. Orden alfabético por Color (A -> Z)
      const colorA = (a.color || '').trim().toUpperCase();
      const colorB = (b.color || '').trim().toUpperCase();
      const colorCmp = colorA.localeCompare(colorB, 'es', { sensitivity: 'base' });
      if (colorCmp !== 0) return colorCmp;

      // 2. Por Talla estándar dentro del mismo color
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
          const sCmp = sizeA.localeCompare(sizeB, 'es', { numeric: true });
          if (sCmp !== 0) return sCmp;
        }
      }

      // 3. Por Marca / Submodelo
      const brandA = (a.brand || '').trim().toUpperCase();
      const brandB = (b.brand || '').trim().toUpperCase();
      const bCmp = brandA.localeCompare(brandB, 'es', { sensitivity: 'base' });
      if (bCmp !== 0) return bCmp;

      return (a.name || '').localeCompare(b.name || '', 'es');
    });
  }, [allProducts, baseProduct]);

  // Marca dominante detectada en las variantes existentes (ej: THE NORTH FACE)
  const dominantVariantBrand = useMemo(() => {
    const counts = {};
    existingVariants.forEach(v => {
      const b = (v.brand || '').trim().toUpperCase();
      if (b && b !== 'ESTILO NÓRDICO' && b !== 'ESTILO NORDICO') {
        counts[b] = (counts[b] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }, [existingVariants]);

  // Inicializar o ajustar marca sugerida para no dejar 'Estilo Nórdico' por error
  useEffect(() => {
    if (dominantVariantBrand) {
      setBrand(dominantVariantBrand);
      setTargetBatchBrand(dominantVariantBrand);
    } else if (baseProduct.brand && baseProduct.brand !== 'Estilo Nórdico') {
      setBrand(baseProduct.brand);
    } else {
      setBrand('');
    }
  }, [dominantVariantBrand, baseProduct.brand]);

  // LISTA DINÁMICA DE COLORES:
  // Combina:
  // 1. Colores de variantes de este producto (ej: AZUL COBALTO, GRIS RATÓN...)
  // 2. Colores existentes en TODO el catálogo de la tienda
  // 3. Colores comunes base
  const dynamicColorOptions = useMemo(() => {
    const set = new Set();
    
    // Variantes de esta referencia
    existingVariants.forEach(v => {
      const c = (v.color || '').trim().toUpperCase();
      if (c) set.add(c);
    });

    // Catálogo completo
    (allProducts || []).forEach(p => {
      const c = (p.color || '').trim().toUpperCase();
      if (c) set.add(c);
    });

    // Colores estándar
    COMMON_COLORS.forEach(c => {
      const clean = c.trim().toUpperCase();
      if (clean) set.add(clean);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [existingVariants, allProducts]);

  // Colores específicos ya creados en esta referencia (para chips de selección rápida con 1 clic)
  const existingReferenceColors = useMemo(() => {
    const set = new Set();
    existingVariants.forEach(v => {
      const c = (v.color || '').trim().toUpperCase();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [existingVariants]);

  // LISTA DINÁMICA DE TALLAS:
  const dynamicSizeOptions = useMemo(() => {
    const set = new Set();
    
    existingVariants.forEach(v => {
      const s = (v.size || '').trim().toUpperCase();
      if (s) set.add(s);
    });

    (allProducts || []).forEach(p => {
      const s = (p.size || '').trim().toUpperCase();
      if (s) set.add(s);
    });

    COMMON_SIZES.forEach(s => {
      const clean = s.trim().toUpperCase();
      if (clean) set.add(clean);
    });

    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40'];
    return Array.from(set).sort((a, b) => {
      const idxA = sizeOrder.indexOf(a);
      const idxB = sizeOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'es', { numeric: true });
    });
  }, [existingVariants, allProducts]);

  // Detectar variantes creadas con marca 'ESTILO NÓRDICO' o slug ESTILO-NÓRDICO para ofrecer corrección rápida
  const variantsWithEstiloNordico = useMemo(() => {
    return existingVariants.filter(v => 
      (v.brand || '').trim().toUpperCase() === 'ESTILO NÓRDICO' ||
      (v.brand || '').trim().toUpperCase() === 'ESTILO NORDICO' ||
      (v.ref || '').toUpperCase().includes('ESTILO-NÓRDICO') ||
      (v.ref || '').toUpperCase().includes('ESTILO-NORDICO')
    );
  }, [existingVariants]);

  const totalAssignedStock = existingVariants.reduce((sum, v) => sum + (v.stock || 0), 0);

  // Selección de foto para la nueva variante en el formulario superior
  const handleSelectNewVariantPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewVariantFile(file);
    const previewUrl = URL.createObjectURL(file);
    setNewVariantPreview(previewUrl);
  };

  const handleClearNewVariantPhoto = () => {
    setNewVariantFile(null);
    if (newVariantPreview) {
      URL.revokeObjectURL(newVariantPreview);
      setNewVariantPreview(null);
    }
  };

  // Subir foto directamente a una variante existente
  const handleUploadVariantPhoto = async (variantId, file) => {
    if (!file) return;
    setUploadingVariantId(variantId);
    try {
      const webpFile = await optimizeImageToWebP(file);
      await uploadProductImage(variantId, webpFile, true);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error al subir la imagen de la variante');
    } finally {
      setUploadingVariantId(null);
    }
  };

  // Quitar la foto de una variante existente
  const handleRemoveVariantPhoto = async (variantId, imgUrl) => {
    if (!window.confirm('¿Deseas desvincular la foto de esta variante?')) return;
    setUploadingVariantId(variantId);
    try {
      await removeProductImage(variantId, imgUrl);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Error al quitar la imagen');
    } finally {
      setUploadingVariantId(null);
    }
  };

  // Asignar una foto ya existente en la prenda base a la variante
  const handleAssignBaseGalleryPhoto = async (variantId, photoUrl) => {
    setUploadingVariantId(variantId);
    try {
      const res = await fetch(`${API_URL}/products/${variantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ images: [photoUrl] })
      });
      if (res.ok) {
        setPickingGalleryFor(null);
        if (onRefresh) await onRefresh();
      } else {
        alert('No se pudo asignar la foto a la variante');
      }
    } catch (e) {
      console.error(e);
      alert('Error al asignar foto');
    } finally {
      setUploadingVariantId(null);
    }
  };

  // Corrección en bloque de las variantes con 'ESTILO NÓRDICO' a la marca seleccionada
  const handleBatchFixBrand = async () => {
    if (!targetBatchBrand) return;
    const targets = variantsWithEstiloNordico;
    if (targets.length === 0) return;

    const confirmMsg = `¿Deseas corregir las ${targets.length} variantes con 'ESTILO NÓRDICO' a '${targetBatchBrand}'?

` +
      `Esto actualizará su marca a '${targetBatchBrand}', actualizará sus SKUs (ej: ${baseProduct.ref}-${targetBatchBrand.replace(/\s+/g, '-')}-...) y sus nombres en el sistema.`;
    
    if (!window.confirm(confirmMsg)) return;

    setBatchFixing(true);
    try {
      let successCount = 0;
      for (const v of targets) {
        const cleanColor = (v.color || '').trim().toUpperCase().replace(/\s+/g, '-');
        const cleanSize = (v.size || '').trim().toUpperCase();
        const brandSlug = (targetBatchBrand !== 'ESTILO NÓRDICO' && targetBatchBrand !== 'ESTILO NORDICO')
          ? targetBatchBrand.trim().toUpperCase().replace(/\s+/g, '-')
          : '';
        
        const newSku = brandSlug
          ? `${baseProduct.ref}-${brandSlug}-${cleanColor}-${cleanSize}`
          : `${baseProduct.ref}-${cleanColor}-${cleanSize}`;

        const brandForName = brandSlug ? ` ${targetBatchBrand}` : '';
        const newName = `${baseProduct.name.trim()}${brandForName} ${v.color || ''} ${cleanSize}`.trim();

        const res = await fetch(`${API_URL}/products/${v.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            brand: targetBatchBrand,
            ref: newSku,
            name: newName
          })
        });

        if (res.ok) successCount++;
      }

      alert(`✅ Se corrigieron exitosamente ${successCount} de ${targets.length} variantes a '${targetBatchBrand}'.`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al actualizar las variantes.');
    } finally {
      setBatchFixing(false);
    }
  };

  const handleAddVariant = async (e) => {
    e.preventDefault();
    const cleanColor = color.trim().toUpperCase().replace(/\s+/g, '-');
    const cleanSize = size.trim().toUpperCase();
    const cleanBrand = brand ? brand.trim().toUpperCase() : '';

    if (!cleanColor) {
      alert('Por favor ingresa un color.');
      return;
    }

    // SKU estándar: [REF]-[MARCA?]-[COLOR]-[TALLA]
    // Si la marca es ESTILO NÓRDICO no se inserta slug redundante
    const brandSlug = (cleanBrand && cleanBrand !== 'ESTILO NÓRDICO' && cleanBrand !== 'ESTILO NORDICO')
      ? cleanBrand.replace(/\s+/g, '-')
      : '';

    const sku = brandSlug 
      ? `${baseProduct.ref}-${brandSlug}-${cleanColor}-${cleanSize}`
      : `${baseProduct.ref}-${cleanColor}-${cleanSize}`;

    const brandForName = brandSlug ? ` ${cleanBrand}` : '';
    const variantName = `${baseProduct.name.trim()}${brandForName} ${color.trim().toUpperCase()} ${cleanSize}`.trim();

    // Validar si ya existe por SKU exacto
    const existsBySku = allProducts.find(p => p.ref && p.ref.toUpperCase() === sku.toUpperCase());
    if (existsBySku) {
      alert(`⚠️ La variante con SKU '${sku}' ya existe en el inventario. Puedes editar su stock o datos directamente en la lista inferior.`);
      return;
    }

    // Validar si ya existe por Color y Talla (para evitar duplicados como dos 'Gris M')
    const rawColor = color.trim().toUpperCase();
    const existsByColorSize = existingVariants.find(v => 
      (v.color || '').trim().toUpperCase() === rawColor && 
      (v.size || '').trim().toUpperCase() === cleanSize &&
      (cleanBrand ? (v.brand || '').trim().toUpperCase() === cleanBrand : true)
    );
    if (existsByColorSize) {
      alert(`⚠️ ¡ATENCIÓN! Ya existe la variante con Color: '${rawColor}' y Talla: '${cleanSize}' (${existsByColorSize.ref}).

No se permite duplicar la misma prenda. Puedes editar sus unidades directamente en la lista de abajo.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ref: sku,
        name: variantName,
        category: baseProduct.category || 'Hombre',
        subcategory: baseProduct.subcategory || '',
        brand: cleanBrand || baseProduct.brand || 'Estilo Nórdico',
        origin: baseProduct.origin || 'Propio',
        color: color.trim().toUpperCase(),
        size: cleanSize,
        parent_id: baseProduct.id,
        price_sale: baseProduct.price_sale || 0,
        my_cost: baseProduct.my_cost || 0,
        stock: Number(quantity) || 0,
        product_type: baseProduct.product_type || 'ROPA',
        is_published: false
      };

      const res = await fetch(`${API_URL}/products/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdVariant = await res.json();
        
        // Si se seleccionó una foto para esta nueva variante, optimizarla y subirla de inmediato
        if (newVariantFile && createdVariant?.id) {
          try {
            const webpFile = await optimizeImageToWebP(newVariantFile);
            await uploadProductImage(createdVariant.id, webpFile, true);
          } catch (photoErr) {
            console.error('Variante creada pero falló foto:', photoErr);
          }
        }

        setColor('');
        setQuantity(1);
        handleClearNewVariantPhoto();
        if (onRefresh) onRefresh();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al crear la variante');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión al crear variante');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStock = async (variantId, newStock) => {
    const val = Number(newStock);
    if (isNaN(val) || val < 0) return;

    try {
      const res = await fetch(`${API_URL}/products/${variantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ stock: val })
      });
      if (res.ok) {
        setEditingId(null);
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteVariant = async (variantId, sku) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la variante ${sku}?`)) return;
    try {
      const res = await fetch(`${API_URL}/products/${variantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        if (onRefresh) onRefresh();
      } else {
        alert('No se pudo eliminar la variante');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg">
                  REF: {baseProduct.ref}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase">
                  {baseProduct.category} · {baseProduct.subcategory}
                </span>
              </div>
              <h3 className="font-black text-slate-800 text-base">{baseProduct.name}</h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen de Stock Base vs Variantes */}
        <div className="px-6 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Stock Total Desglosado:</span>
            <span className="font-black text-indigo-700 font-mono text-sm bg-white px-2.5 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
              {totalAssignedStock} un.
            </span>
            <span className="text-[10px] text-slate-400 ml-1">(Stock base original: {baseProduct.stock || 0} un.)</span>
          </div>
          <div>
            <span className="font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded border border-indigo-100">
              {existingVariants.length} variantes / SKUs creados
            </span>
          </div>
        </div>

        {/* Formulario de Nueva Variante */}
        <form onSubmit={handleAddVariant} className="p-6 border-b border-slate-100 bg-white space-y-4 shrink-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-600" /> Crear Nueva Variante / Talla
          </p>

          {/* Fila 1: Marca opcional */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Marca (Opcional - ej: THE NORTH FACE / COLUMBIA)
              </label>
              {brand && (
                <button 
                  type="button" 
                  onClick={() => setBrand('')} 
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  Limpiar marca
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Ej: THE NORTH FACE, COLUMBIA"
              value={brand}
              onChange={e => setBrand(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Rápidas:</span>
              {QUICK_BRANDS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrand(b)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    brand.toUpperCase() === b ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Fila 2: Color, Talla, Stock Inicial y Foto Opcional */}
          <div className="grid grid-cols-12 gap-3 items-end">
            {/* Color */}
            <div className="col-span-4">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Color
              </label>
              <input
                type="text"
                list="common-colors"
                placeholder="Ej: NEGRO, AZUL, ROJO"
                value={color}
                onChange={e => setColor(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
              <datalist id="common-colors">
                {dynamicColorOptions.map(c => <option key={c} value={c} />)}
              </datalist>

              {/* Píldoras de colores ya existentes en esta referencia para clic directo */}
              {existingReferenceColors.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap pt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase mr-0.5">En esta ref:</span>
                  {existingReferenceColors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        color.toUpperCase() === c
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Talla */}
            <div className="col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Talla
              </label>
              <input
                type="text"
                list="common-sizes"
                placeholder="Ej: M, L, XL, XXXL"
                value={size}
                onChange={e => setSize(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
              <datalist id="common-sizes">
                {dynamicSizeOptions.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            {/* Cantidad Inicial */}
            <div className="col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Stock
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Botón Adjuntar Foto Opcional para la nueva variante */}
            <div className="col-span-3 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 truncate">
                  Foto (Opcional)
                </label>
                {newVariantPreview ? (
                  <div className="flex items-center gap-1.5 p-1 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <img src={newVariantPreview} alt="Preview" className="w-7 h-7 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={handleClearNewVariantPhoto}
                      className="p-1 text-rose-500 hover:text-rose-700"
                      title="Quitar foto"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="new-variant-file"
                    className="w-full px-2 py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Subir foto para esta nueva variante"
                  >
                    <Camera size={13} className="text-slate-400" />
                    <span>+ Foto</span>
                  </label>
                )}
                <input
                  id="new-variant-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSelectNewVariantPhoto}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shrink-0 transition-all shadow-sm disabled:opacity-50 cursor-pointer h-[38px] mt-auto"
                title="Agregar Variante"
              >
                {submitting ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={16} />}
              </button>
            </div>
          </div>

          {/* Botones de selección rápida de tallas comunes */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Tallas Rápidas:</span>
            {['M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                  size === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
            <span className="text-slate-300 text-xs">|</span>
            {['S', '30', '32', '34', '36'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  size === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </form>

        {/* Lista de Variantes Existentes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          
          {/* BANNER DE CORRECCIÓN RÁPIDA: Si hay variantes con 'ESTILO NÓRDICO' */}
          {variantsWithEstiloNordico.length > 0 && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <p className="font-black text-amber-950">
                    {variantsWithEstiloNordico.length} variantes tienen asignada la marca "ESTILO NÓRDICO"
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium">
                    ¿Deseas corregir su marca y actualizar sus códigos SKU automáticamente?
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={targetBatchBrand}
                  onChange={e => setTargetBatchBrand(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="THE NORTH FACE">THE NORTH FACE</option>
                  <option value="COLUMBIA">COLUMBIA</option>
                  <option value="MONCLER">MONCLER</option>
                  <option value="DIESEL">DIESEL</option>
                  <option value="ARMANI">ARMANI</option>
                </select>

                <button
                  type="button"
                  onClick={handleBatchFixBrand}
                  disabled={batchFixing}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {batchFixing ? <RefreshCw className="animate-spin" size={13} /> : <ShieldCheck size={13} />}
                  <span>Corregir {variantsWithEstiloNordico.length} Variantes</span>
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Variantes Actuales ({existingVariants.length})</span>
            <span className="text-[10px] font-normal text-slate-400">
              💡 Asigna la foto exacta o usa el lápiz para editar marca, color o talla
            </span>
          </p>

          {existingVariants.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <AlertCircle size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
              Esta referencia no tiene variantes desglosadas aún.<br />
              Agrega los colores, marcas y tallas arriba para desglosarla.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
              {existingVariants.map(v => {
                const hasVariantImage = Array.isArray(v.images) && v.images.length > 0;
                const isUploadingThis = uploadingVariantId === v.id;
                const isPickingGallery = pickingGalleryFor === v.id;

                return (
                  <div key={v.id} className="p-3 bg-white hover:bg-slate-50/80 flex flex-col gap-2 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail / Asignador de Foto de la Variante */}
                        <div className="relative group w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {isUploadingThis ? (
                            <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center">
                              <RefreshCw className="animate-spin text-indigo-600" size={16} />
                              <span className="text-[7px] font-black text-indigo-600 mt-0.5">Subiendo</span>
                            </div>
                          ) : hasVariantImage ? (
                            <>
                              <img
                                src={normalizeImageUrl(v.images[0])}
                                alt={v.ref}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              {/* Overlay de acciones sobre la foto */}
                              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                <label
                                  htmlFor={`variant-img-${v.id}`}
                                  className="p-1 bg-white text-slate-900 rounded-md cursor-pointer hover:scale-110 transition-transform shadow-sm"
                                  title="Cambiar foto de esta variante"
                                >
                                  <Camera size={12} />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariantPhoto(v.id, v.images[0])}
                                  className="p-1 bg-rose-600 text-white rounded-md cursor-pointer hover:scale-110 transition-transform shadow-sm"
                                  title="Quitar foto de esta variante"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <label
                              htmlFor={`variant-img-${v.id}`}
                              className="w-full h-full flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 cursor-pointer transition-colors p-1 text-center"
                              title="Asignar foto exacta a esta variante"
                            >
                              <Camera size={16} className="mb-0.5 text-slate-400 group-hover:text-indigo-600" />
                              <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-600 leading-none">
                                + Foto
                              </span>
                            </label>
                          )}

                          <input
                            id={`variant-img-${v.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadVariantPhoto(v.id, e.target.files?.[0])}
                          />
                        </div>

                        {/* Datos de la variante */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-black text-slate-800 font-mono truncate">{v.ref}</p>
                            {v.brand && v.brand !== 'Estilo Nórdico' ? (
                              <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                {v.brand}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                {v.brand || 'Estilo Nórdico'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Color: <span className="font-bold text-slate-700">{v.color || 'N/A'}</span> · Talla: <span className="font-bold text-indigo-700 font-mono">{v.size || 'N/A'}</span>
                          </p>

                          {/* Botón para asignar foto desde la galería base */}
                          {baseProduct.images && baseProduct.images.length > 0 && !hasVariantImage && (
                            <button
                              type="button"
                              onClick={() => setPickingGalleryFor(isPickingGallery ? null : v.id)}
                              className="text-[9px] font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                            >
                              <ImageIcon size={10} />
                              {isPickingGallery ? 'Cerrar selector' : `Elegir de fotos base (${baseProduct.images.length})`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stock & Acciones */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Editor Rápido de Stock Inline */}
                        {editingId === v.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={tempQty}
                              onChange={e => setTempQty(e.target.value)}
                              className="w-16 px-2 py-1 bg-white border-2 border-indigo-500 rounded-lg text-xs font-bold text-slate-800 outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateStock(v.id, tempQty)}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(v.id); setTempQty(v.stock); }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-black font-mono text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Clic para editar stock rápidamente"
                          >
                            {v.stock} un.
                          </button>
                        )}

                        {/* Botón Editar Completo de la Variante (Lápiz) */}
                        <button
                          type="button"
                          onClick={() => setEditingVariant(v)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar variante (marca, color, talla, SKU, precio)"
                        >
                          <Pencil size={14} />
                        </button>

                        {/* Botón Eliminar Variante */}
                        <button
                          onClick={() => handleDeleteVariant(v.id, v.ref)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar variante"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Selector Desplegable de Fotos de la Prenda Base */}
                    {isPickingGallery && baseProduct.images && baseProduct.images.length > 0 && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-150">
                        <p className="text-[10px] font-bold text-slate-600 mb-2">
                          Selecciona la foto de la prenda base para la variante <span className="font-mono text-indigo-600">{v.ref}</span>:
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                          {baseProduct.images.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAssignBaseGalleryPhoto(v.id, imgUrl)}
                              className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-600 shrink-0 transition-all hover:scale-105 cursor-pointer bg-white"
                              title="Asignar esta foto"
                            >
                              <img
                                src={normalizeImageUrl(imgUrl)}
                                alt={`Foto base ${idx+1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-medium">
            💡 Las fotos asignadas a variantes se sincronizan con el Catálogo de Asesores y la Tienda Web.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>

      </div>

      {/* Modal Subsidario para Editar Variante */}
      <EditVariantModal
        isOpen={!!editingVariant}
        variant={editingVariant}
        baseProduct={baseProduct}
        allProducts={allProducts}
        dynamicColors={dynamicColorOptions}
        referenceColors={existingReferenceColors}
        dynamicSizes={dynamicSizeOptions}
        onClose={() => setEditingVariant(null)}
        onSuccess={async () => {
          setEditingVariant(null);
          if (onRefresh) await onRefresh();
        }}
      />
    </div>
  );
}
