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
  const [detail, setDetail] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [currentColorSelect, setCurrentColorSelect] = useState('');
  const [showCustomColorInput, setShowCustomColorInput] = useState(false);
  const [customColorInput, setCustomColorInput] = useState('');
  const [size, setSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tempQty, setTempQty] = useState('');

  // Estados para asignación y carga de fotos de variantes
  const [uploadingVariantId, setUploadingVariantId] = useState(null);
  const [pickingGalleryFor, setPickingGalleryFor] = useState(null);
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState(null);
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

  // LISTA DINÁMICA DE MARCAS DE TODO EL SISTEMA:
  const dynamicBrandOptions = useMemo(() => {
    const set = new Set();
    
    // 1. Variantes de esta referencia
    existingVariants.forEach(v => {
      const b = (v.brand || '').trim().toUpperCase();
      if (b && b !== 'ESTILO NÓRDICO' && b !== 'ESTILO NORDICO') set.add(b);
    });

    // 2. Catálogo completo de la tienda
    (allProducts || []).forEach(p => {
      const b = (p.brand || '').trim().toUpperCase();
      if (b && b !== 'ESTILO NÓRDICO' && b !== 'ESTILO NORDICO') set.add(b);
    });

    // 3. Marcas rápidas habituales
    QUICK_BRANDS.forEach(b => {
      const clean = b.trim().toUpperCase();
      if (clean && clean !== 'ESTILO NÓRDICO' && clean !== 'ESTILO NORDICO') set.add(clean);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [existingVariants, allProducts]);

  // LISTA DINÁMICA DE COLORES:
  const dynamicColorOptions = useMemo(() => {
    const set = new Set();
    
    // Variantes de esta referencia
    existingVariants.forEach(v => {
      const c = (v.color || '').trim().toUpperCase();
      if (c) {
        c.split(/\s*\/\s*/).forEach(subCol => {
          const cleanSub = subCol.trim();
          if (cleanSub) set.add(cleanSub);
        });
        set.add(c);
      }
    });

    // Catálogo completo
    (allProducts || []).forEach(p => {
      const c = (p.color || '').trim().toUpperCase();
      if (c) {
        c.split(/\s*\/\s*/).forEach(subCol => {
          const cleanSub = subCol.trim();
          if (cleanSub) set.add(cleanSub);
        });
        set.add(c);
      }
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

  // TODAS LAS FOTOS EXISTENTES EN ESTA REFERENCIA (PRENDA BASE + VARIANTES EXISTENTES)
  const availableReferencePhotos = useMemo(() => {
    const set = new Set();
    // 1. Fotos de la prenda base
    if (Array.isArray(baseProduct.images)) {
      baseProduct.images.forEach(img => {
        if (img && typeof img === 'string') set.add(img);
      });
    }
    // 2. Fotos de variantes ya creadas en esta referencia
    existingVariants.forEach(v => {
      if (Array.isArray(v.images)) {
        v.images.forEach(img => {
          if (img && typeof img === 'string') set.add(img);
        });
      }
    });
    return Array.from(set);
  }, [baseProduct.images, existingVariants]);

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

  // Manejo de colores múltiples
  const handleAddColor = (col) => {
    const clean = (col || '').trim().toUpperCase();
    if (!clean) return;
    if (!selectedColors.includes(clean)) {
      setSelectedColors(prev => [...prev, clean]);
    }
    setCurrentColorSelect('');
    setCustomColorInput('');
    setShowCustomColorInput(false);
  };

  const handleRemoveColor = (colToRemove) => {
    setSelectedColors(prev => prev.filter(c => c !== colToRemove));
  };

  // Selección de foto para la nueva variante en el formulario superior
  const handleSelectNewVariantPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewVariantFile(file);
    setSelectedGalleryPhoto(null); // Archivo local tiene prioridad sobre foto de galería
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

  // Asignar una foto ya existente en la referencia/galería a la variante
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

  // Sincronizar automáticamente fotos entre variantes del mismo color
  const handleSyncColorPhotos = async () => {
    const colorPhotoMap = {};
    existingVariants.forEach(v => {
      const c = (v.color || '').trim().toUpperCase();
      if (c && Array.isArray(v.images) && v.images.length > 0 && !colorPhotoMap[c]) {
        colorPhotoMap[c] = v.images[0];
      }
    });

    const toUpdate = existingVariants.filter(v => {
      const c = (v.color || '').trim().toUpperCase();
      const hasImg = Array.isArray(v.images) && v.images.length > 0;
      return !hasImg && colorPhotoMap[c];
    });

    if (toUpdate.length === 0) {
      alert('Todas las variantes con fotos disponibles para su color ya están sincronizadas.');
      return;
    }

    if (!window.confirm(`¿Deseas sincronizar las fotos de ${toUpdate.length} variante(s) copiando la foto existente de su mismo color?`)) return;

    for (const v of toUpdate) {
      const c = (v.color || '').trim().toUpperCase();
      try {
        await fetch(`${API_URL}/products/${v.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ images: [colorPhotoMap[c]] })
        });
      } catch (err) {
        console.error(err);
      }
    }

    alert(`✅ Se sincronizaron las fotos de ${toUpdate.length} variante(s).`);
    if (onRefresh) await onRefresh();
  };

  // Corrección en bloque de las variantes con 'ESTILO NÓRDICO' a la marca seleccionada
  const handleBatchFixBrand = async () => {
    if (!targetBatchBrand) return;
    const targets = variantsWithEstiloNordico;
    if (targets.length === 0) return;

    const confirmMsg = `¿Deseas corregir las ${targets.length} variantes con 'ESTILO NÓRDICO' a '${targetBatchBrand}'?\n\n` +
      `Esto actualizará su marca a '${targetBatchBrand}', actualizará sus SKUs (ej: ${baseProduct.ref}-${targetBatchBrand.replace(/\s+/g, '-')}-...) y sus nombres en el sistema.`;
    
    if (!window.confirm(confirmMsg)) return;

    setBatchFixing(true);
    try {
      let successCount = 0;
      for (const v of targets) {
        const cleanColor = (v.color || '').trim().toUpperCase().replace(/\s*\/\s*/g, '-').replace(/\s+/g, '-');
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

    if (selectedColors.length === 0) {
      alert('Por favor selecciona o añade al menos un color.');
      return;
    }

    const finalColorName = selectedColors.join(' / ');
    const cleanColorSlug = selectedColors.map(c => c.trim().toUpperCase().replace(/\s+/g, '-')).join('-');
    const cleanSize = size.trim().toUpperCase();
    const cleanBrand = brand ? brand.trim().toUpperCase() : '';
    const cleanDetail = detail ? detail.trim().toUpperCase() : '';
    const detailSlug = cleanDetail ? cleanDetail.replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '') : '';

    if (!cleanSize) {
      alert('Por favor selecciona una talla.');
      return;
    }

    // SKU estándar: [REF]-[MARCA?]-[DETALLE?]-[COLOR]-[TALLA]
    const brandSlug = (cleanBrand && cleanBrand !== 'ESTILO NÓRDICO' && cleanBrand !== 'ESTILO NORDICO')
      ? cleanBrand.replace(/\s+/g, '-')
      : '';

    let skuParts = [baseProduct.ref];
    if (brandSlug) skuParts.push(brandSlug);
    if (detailSlug) skuParts.push(detailSlug);
    skuParts.push(cleanColorSlug);
    skuParts.push(cleanSize);
    const sku = skuParts.join('-');

    const brandForName = brandSlug ? ` ${cleanBrand}` : '';
    const detailForName = cleanDetail ? ` ${cleanDetail}` : '';
    const variantName = `${baseProduct.name.trim()}${brandForName}${detailForName} ${finalColorName} ${cleanSize}`.trim();

    // Validar si ya existe por SKU exacto
    const existsBySku = allProducts.find(p => p.ref && p.ref.toUpperCase() === sku.toUpperCase());
    if (existsBySku) {
      alert(`⚠️ La variante con SKU '${sku}' ya existe en el inventario. Puedes editar su stock o datos directamente en la lista inferior.`);
      return;
    }

    // Validar duplicado exacto por Color + Talla + Marca + Detalle
    const existsBySameSpecs = existingVariants.find(v => 
      (v.color || '').trim().toUpperCase() === finalColorName.toUpperCase() && 
      (v.size || '').trim().toUpperCase() === cleanSize &&
      (cleanBrand ? (v.brand || '').trim().toUpperCase() === cleanBrand : true) &&
      (cleanDetail ? (v.description || '').trim().toUpperCase() === cleanDetail : !(v.description || '').trim())
    );
    if (existsBySameSpecs) {
      alert(`⚠️ ¡ATENCIÓN! Ya existe la variante con Color: '${finalColorName}' y Talla: '${cleanSize}' (${existsBySameSpecs.ref}).\n\nNo se permite duplicar la misma prenda. Puedes editar sus unidades directamente en la lista de abajo.`);
      return;
    }

    setSubmitting(true);
    try {
      // Determinar imágenes para la nueva variante:
      // 1. Si el usuario seleccionó una foto de la galería de referencia
      // 2. O si otra variante del mismo color exacto ya tiene foto, heredarla automáticamente
      let finalImages = [];
      if (selectedGalleryPhoto) {
        finalImages = [selectedGalleryPhoto];
      } else {
        const sameColorVariant = existingVariants.find(v => 
          (v.color || '').trim().toUpperCase() === finalColorName.toUpperCase() &&
          Array.isArray(v.images) && v.images.length > 0
        );
        if (sameColorVariant) {
          finalImages = sameColorVariant.images;
        }
      }

      const payload = {
        ref: sku,
        name: variantName,
        description: cleanDetail || baseProduct.description || '',
        category: baseProduct.category || 'Hombre',
        subcategory: baseProduct.subcategory || '',
        brand: cleanBrand || baseProduct.brand || 'Estilo Nórdico',
        origin: baseProduct.origin || 'Propio',
        color: finalColorName,
        size: cleanSize,
        parent_id: baseProduct.id,
        price_sale: baseProduct.price_sale || 0,
        my_cost: baseProduct.my_cost || 0,
        stock: Number(quantity) || 0,
        product_type: baseProduct.product_type || 'ROPA',
        is_published: baseProduct.is_published !== false,
        images: finalImages
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
        
        // Si se seleccionó una foto nueva desde PC para esta variante, optimizarla a WebP y subirla
        if (newVariantFile && createdVariant?.id) {
          try {
            const webpFile = await optimizeImageToWebP(newVariantFile);
            await uploadProductImage(createdVariant.id, webpFile, true);
          } catch (photoErr) {
            console.error('Variante creada pero falló foto:', photoErr);
          }
        }

        setSelectedColors([]);
        setDetail('');
        setQuantity(1);
        setSelectedGalleryPhoto(null);
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
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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

          {/* Fila 1: Marca & Detalle/Estampado Opcional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna 1: Marca con autocompletado y filtro dinámico */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Marca (Desplegable / Búsqueda)
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
                list="all-system-brands"
                placeholder="Escribe o busca marca (ej: THE NORTH FACE, PUMA)"
                value={brand}
                onChange={e => setBrand(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
              />
              <datalist id="all-system-brands">
                {dynamicBrandOptions.map(b => (
                  <option key={b} value={b} />
                ))}
              </datalist>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Rápidas:</span>
                {QUICK_BRANDS.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                      brand.toUpperCase() === b ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Columna 2: Estampado / Detalle / Letras (Opcional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Estampado / Detalle / Letras (Opcional)
                </label>
                {detail && (
                  <button 
                    type="button" 
                    onClick={() => setDetail('')} 
                    className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                  >
                    Limpiar detalle
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Ej: CASUAL, LETRAS, BORDADA, LOGO PEQUEÑO"
                value={detail}
                onChange={e => setDetail(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Sugerencias:</span>
                {['CASUAL', 'LETRAS', 'BORDADA', 'LOGO PEQUEÑO', 'ESTAMPADO'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDetail(s)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                      detail.toUpperCase() === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 2: Color(es), Talla, Stock Inicial y Botón Agregar */}
          <div className="grid grid-cols-12 gap-3 items-start pt-1">
            {/* Color(es) - Desplegable + Botón + para Bicolor/Multicolor hacia la derecha */}
            <div className="col-span-12 sm:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Color(es) · Bicolor / Multicolor
                </label>
                {selectedColors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedColors([])}
                    className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                  >
                    Limpiar colores
                  </button>
                )}
              </div>

              {/* Selector desplegable con botón + */}
              <div className="flex items-center gap-1.5">
                {!showCustomColorInput ? (
                  <select
                    value={currentColorSelect}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__CUSTOM__') {
                        setShowCustomColorInput(true);
                        setCurrentColorSelect('');
                      } else if (val) {
                        handleAddColor(val);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Seleccionar Color --</option>
                    {dynamicColorOptions.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✍️ + Escribir otro color...</option>
                  </select>
                ) : (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Escribe el color..."
                      value={customColorInput}
                      onChange={e => setCustomColorInput(e.target.value.toUpperCase())}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddColor(customColorInput);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-indigo-400 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:bg-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomColorInput(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      title="Volver a lista"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (showCustomColorInput) {
                      handleAddColor(customColorInput);
                    } else if (currentColorSelect) {
                      handleAddColor(currentColorSelect);
                    }
                  }}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                  title="Añadir color a la prenda"
                >
                  <Plus size={14} />
                  <span>Añadir</span>
                </button>
              </div>

              {/* Colores Seleccionados (se agregan hacia la derecha) */}
              <div className="min-h-[30px] p-1.5 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center gap-1.5 flex-wrap">
                {selectedColors.length > 0 ? (
                  selectedColors.map((c, idx) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-black shadow-xs animate-in fade-in"
                    >
                      {idx > 0 && <span className="opacity-60 text-[9px] mr-0.5">/</span>}
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(c)}
                        className="text-indigo-200 hover:text-white ml-0.5 p-0.5 rounded cursor-pointer"
                        title={`Quitar ${c}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-400 italic px-1">
                    Elige un color arriba. Para bicolores (ej: Negro y Rojo), agrega uno y luego el otro.
                  </span>
                )}
              </div>

              {/* Píldoras de colores ya existentes en esta referencia para clic directo */}
              {existingReferenceColors.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase mr-0.5">En esta ref:</span>
                  {existingReferenceColors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleAddColor(c)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                      title={`Agregar ${c}`}
                    >
                      + {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Talla */}
            <div className="col-span-6 sm:col-span-3 space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Talla
              </label>
              <input
                type="text"
                list="common-sizes"
                placeholder="Ej: M, L, XL"
                value={size}
                onChange={e => setSize(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                required
              />
              <datalist id="common-sizes">
                {dynamicSizeOptions.map(s => <option key={s} value={s} />)}
              </datalist>

              {/* Botones de selección rápida de tallas */}
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {['M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`px-2 py-0.5 rounded text-[9px] font-black border transition-all cursor-pointer ${
                      size === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Cantidad Inicial & Botón Agregar */}
            <div className="col-span-6 sm:col-span-4 flex items-end gap-2.5">
              <div className="flex-1 space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer h-[38px]"
                title="Agregar Variante"
              >
                {submitting ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={16} />}
                <span>Crear Variante</span>
              </button>
            </div>
          </div>

          {/* Fila 3: Asignar Foto desde la Referencia o Subir Nueva */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Camera size={13} className="text-indigo-600" />
                <span>Foto para esta variante (Opcional) · Asigna una foto de la referencia o sube desde el PC:</span>
              </label>
              {(selectedGalleryPhoto || newVariantPreview) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGalleryPhoto(null);
                    handleClearNewVariantPhoto();
                  }}
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  Desmarcar foto
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
              {/* Opción A: Subir desde PC */}
              <label
                htmlFor="new-variant-file"
                className={`relative w-14 h-14 rounded-xl border-2 border-dashed flex flex-col items-center justify-center shrink-0 cursor-pointer transition-all ${
                  newVariantPreview 
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100'
                }`}
                title="Subir foto desde este equipo"
              >
                {newVariantPreview ? (
                  <>
                    <img src={newVariantPreview} alt="Nueva" className="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClearNewVariantPhoto(); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs"
                      title="Quitar"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <>
                    <Camera size={16} className="text-slate-400" />
                    <span className="text-[8px] font-black uppercase text-slate-500 mt-0.5">Desde PC</span>
                  </>
                )}
              </label>
              <input
                id="new-variant-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectNewVariantPhoto}
              />

              {/* Opción B: Fotos ya existentes en la referencia / variantes */}
              {availableReferencePhotos.map((photoUrl, idx) => {
                const isSelected = selectedGalleryPhoto === photoUrl && !newVariantPreview;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleClearNewVariantPhoto();
                      setSelectedGalleryPhoto(isSelected ? null : photoUrl);
                    }}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer bg-white group ${
                      isSelected 
                        ? 'border-indigo-600 ring-2 ring-indigo-500/50 scale-105 shadow-md' 
                        : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                    }`}
                    title={isSelected ? 'Foto seleccionada para esta variante' : 'Clic para asignar esta foto a la variante'}
                  >
                    <img
                      src={normalizeImageUrl(photoUrl)}
                      alt={`Foto ref ${idx+1}`}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <Check size={14} />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}

              {availableReferencePhotos.length === 0 && !newVariantPreview && (
                <span className="text-[10px] text-slate-400 italic px-2">
                  La prenda base no tiene fotos cargadas aún. Puedes subir una desde el PC con el botón de la izquierda.
                </span>
              )}
            </div>
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

          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Variantes Actuales ({existingVariants.length})
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncColorPhotos}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title="Copia la foto del mismo color a todas las tallas que aún no tengan imagen"
              >
                <span>⚡ Heredar fotos por color</span>
              </button>
              <span className="text-[10px] font-normal text-slate-400 hidden sm:inline">
                💡 Asigna la foto exacta o usa el lápiz
              </span>
            </div>
          </div>

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
                            {v.description && v.description !== baseProduct.description && (
                              <span className="text-[9px] font-bold uppercase bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span>✨ {v.description}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Color: <span className="font-bold text-slate-700">{v.color || 'N/A'}</span> · Talla: <span className="font-bold text-indigo-700 font-mono">{v.size || 'N/A'}</span>
                          </p>

                          {/* Botón para asignar foto desde las fotos disponibles de la referencia */}
                          {availableReferencePhotos.length > 0 && !hasVariantImage && (
                            <button
                              type="button"
                              onClick={() => setPickingGalleryFor(isPickingGallery ? null : v.id)}
                              className="text-[9px] font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                            >
                              <ImageIcon size={10} />
                              {isPickingGallery ? 'Cerrar selector' : `📸 Asignar de fotos de la referencia (${availableReferencePhotos.length})`}
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
                          title="Editar variante (marca, color, talla, SKU, precio, detalle)"
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

                    {/* Selector Desplegable de Fotos de la Referencia */}
                    {isPickingGallery && availableReferencePhotos.length > 0 && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-150">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-slate-600">
                            Selecciona una foto para la variante <span className="font-mono text-indigo-600 font-black">{v.ref}</span>:
                          </p>
                          <button
                            type="button"
                            onClick={() => setPickingGalleryFor(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                          >
                            Cerrar
                          </button>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                          {availableReferencePhotos.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAssignBaseGalleryPhoto(v.id, imgUrl)}
                              className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-600 shrink-0 transition-all hover:scale-105 cursor-pointer bg-white group shadow-2xs"
                              title="Clic para asignar esta foto a la variante"
                            >
                              <img
                                src={normalizeImageUrl(imgUrl)}
                                alt={`Foto ref ${idx+1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Check size={16} className="text-white drop-shadow" />
                              </div>
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
        dynamicBrands={dynamicBrandOptions}
        onClose={() => setEditingVariant(null)}
        onSuccess={async () => {
          setEditingVariant(null);
          if (onRefresh) await onRefresh();
        }}
      />
    </div>
  );
}
