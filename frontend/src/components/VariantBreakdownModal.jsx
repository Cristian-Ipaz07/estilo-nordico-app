import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Trash2, Check, RefreshCw, AlertCircle, Layers, Tag, 
  ShieldCheck, Camera, Image as ImageIcon, UploadCloud, Pencil,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { API_URL } from '../config/api';
import { 
  normalizeImageUrl, 
  optimizeImageToWebP, 
  uploadProductImage, 
  removeProductImage,
  extractImageName
} from '../utils/imageOptimizer';
import EditVariantModal from './EditVariantModal';

const COMMON_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '30', '32', '34', '36'];
const COMMON_COLORS = ['NEGRO', 'AZUL', 'AZUL OSCURO', 'BLANCO', 'BEIGE', 'VERDE', 'VERDE MILITAR', 'ROJO', 'VINOTINTO', 'GRIS', 'CAMEL'];
const QUICK_BRANDS = ['THE NORTH FACE', 'COLUMBIA', 'MONCLER', 'DIESEL', 'ARMANI', 'ESTILO NÓRDICO'];

export default function VariantBreakdownModal({ baseProduct, allProducts, isOpen, onClose, onRefresh }) {
  if (!isOpen || !baseProduct) return null;

  // Estados de formulario nueva variante
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [brand, setBrand] = useState('');
  const [detail, setDetail] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [currentColorSelect, setCurrentColorSelect] = useState('');
  const [showCustomColorInput, setShowCustomColorInput] = useState(false);
  const [customColorInput, setCustomColorInput] = useState('');
  
  // Detectar si la referencia base es un accesorio o prenda que habitualmente no usa talla
  const isNonSizedProduct = useMemo(() => {
    const text = `${baseProduct.subcategory || ''} ${baseProduct.name || ''} ${baseProduct.category || ''} ${baseProduct.product_type || ''}`.toUpperCase();
    return ['CORREA', 'CORREAS', 'CINTURON', 'CINTURONES', 'GORRA', 'GORRAS', 'RELOJ', 'RELOJES', 'PERFUME', 'PERFUMES', 'LOCION', 'LOCIONES', 'GAFAS', 'BILLETERA', 'BILLETERAS', 'ACCESORIO', 'ACCESORIOS', 'PULSERA', 'CADENA', 'EVILLA', 'HEBILLA'].some(k => text.includes(k));
  }, [baseProduct]);

  const [size, setSize] = useState(() => (isNonSizedProduct ? '' : 'M'));

  useEffect(() => {
    if (isNonSizedProduct) {
      setSize('');
    }
  }, [isNonSizedProduct]);

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tempQty, setTempQty] = useState('');

  // Estados para asignación y carga de fotos de variantes
  const [uploadingVariantId, setUploadingVariantId] = useState(null);
  const [pickingPhotoForVariant, setPickingPhotoForVariant] = useState(null);
  const [selectedVariantPhotos, setSelectedVariantPhotos] = useState([]);
  const [variantSortBy, setVariantSortBy] = useState('creation'); // 'creation' | 'az' | 'size' | 'stock'
  const [bulkUploadingToRef, setBulkUploadingToRef] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ current: 0, total: 0 });

  // Bloquear scroll del fondo mientras el modal esté abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Sincronizar fotos seleccionadas al abrir el selector de variante
  useEffect(() => {
    if (pickingPhotoForVariant) {
      setSelectedVariantPhotos(Array.isArray(pickingPhotoForVariant.images) ? pickingPhotoForVariant.images : []);
    } else {
      setSelectedVariantPhotos([]);
    }
  }, [pickingPhotoForVariant]);
  const [showNewFormPhotoPicker, setShowNewFormPhotoPicker] = useState(false);
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState(null);
  const [newVariantFile, setNewVariantFile] = useState(null);
  const [newVariantPreview, setNewVariantPreview] = useState(null);

  // Estado para modal de edición completa de una variante
  const [editingVariant, setEditingVariant] = useState(null);

  // Estados para corrección en lote de variantes con 'ESTILO NÓRDICO'
  const [targetBatchBrand, setTargetBatchBrand] = useState('THE NORTH FACE');
  const [batchFixing, setBatchFixing] = useState(false);

  // Obtener producto base más actualizado desde el catálogo general
  const currentBaseProduct = useMemo(() => {
    return (allProducts || []).find(p => p.id === baseProduct.id) || baseProduct;
  }, [allProducts, baseProduct]);

  // Encuentra variantes existentes que pertenezcan a este producto base
  // ORDEN ESTILO NÓRDICO:
  // 1. Por COLOR estricto en orden alfabético (A -> Z). Así todas las Azules van seguidas, luego Azul Cobalto, Beige, etc.
  // 2. Por TALLA estándar (S, M, L, XL, XXL, XXXL...)
  // 3. Por MARCA / Submodelo
  const existingVariants = useMemo(() => {
    const prefix = `${baseProduct.ref}-`.toLowerCase();
    const list = (allProducts || []).filter(p => 
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

  // Colores específicos ya creados en esta referencia (para chips de selección rápida)
  const existingReferenceColors = useMemo(() => {
    const set = new Set();
    existingVariants.forEach(v => {
      const c = (v.color || '').trim().toUpperCase();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [existingVariants]);

  // Ordenamiento canónico de tallas (de menor a mayor)
  const SIZE_ORDER = {
    'UNICA': 0, 'ÚNICA': 0, 'ONE SIZE': 0,
    'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6, '2XL': 6, 'XXXL': 7, '3XL': 7, '4XL': 8,
    '28': 10, '30': 11, '32': 12, '34': 13, '36': 14, '38': 15, '40': 16
  };

  const getSortSizeRank = (size) => {
    if (!size) return 999;
    const s = String(size).trim().toUpperCase();
    if (SIZE_ORDER[s] !== undefined) return SIZE_ORDER[s];
    const num = parseInt(s, 10);
    if (!isNaN(num)) return 100 + num;
    return 500;
  };

  const sortedVariants = useMemo(() => {
    const list = [...existingVariants];
    if (variantSortBy === 'az') {
      return list.sort((a, b) => (a.ref || '').localeCompare(b.ref || ''));
    }
    if (variantSortBy === 'size') {
      return list.sort((a, b) => {
        const rankA = getSortSizeRank(a.size);
        const rankB = getSortSizeRank(b.size);
        if (rankA !== rankB) return rankA - rankB;
        return (a.color || '').localeCompare(b.color || '');
      });
    }
    if (variantSortBy === 'stock') {
      return list.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    }
    // 'creation' (orden ID)
    return list.sort((a, b) => a.id - b.id);
  }, [existingVariants, variantSortBy]);

  // TODAS LAS FOTOS EXISTENTES EN ESTA REFERENCIA (PRENDA BASE + VARIANTES EXISTENTES)
  const availableReferencePhotos = useMemo(() => {
    const set = new Set();
    // 1. Fotos de la prenda base
    if (Array.isArray(currentBaseProduct.images)) {
      currentBaseProduct.images.forEach(img => {
        if (img && typeof img === 'string') set.add(img);
      });
    }
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
  }, [currentBaseProduct.images, baseProduct.images, existingVariants]);

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
    setSelectedGalleryPhoto(null);
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
      setPickingPhotoForVariant(null);
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
      setPickingPhotoForVariant(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Error al quitar la imagen');
    } finally {
      setUploadingVariantId(null);
    }
  };

  // Subir fotos en lote a la referencia base
  const handleBulkUploadToRef = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBulkUploadingToRef(true);
    setBulkUploadProgress({ current: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i++) {
        setBulkUploadProgress({ current: i + 1, total: files.length });
        const file = files[i];
        const webpFile = await optimizeImageToWebP(file);
        await uploadProductImage(baseProduct.id, webpFile, false);
      }
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error al subir fotos a la referencia');
    } finally {
      setBulkUploadingToRef(false);
      setBulkUploadProgress({ current: 0, total: 0 });
      e.target.value = '';
    }
  };

  // Guardar fotos múltiples asignadas a una variante
  const handleSaveVariantPhotos = async () => {
    if (!pickingPhotoForVariant) return;
    setUploadingVariantId(pickingPhotoForVariant.id);
    try {
      const res = await fetch(`${API_URL}/products/${pickingPhotoForVariant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ images: selectedVariantPhotos })
      });
      if (res.ok) {
        setPickingPhotoForVariant(null);
        if (onRefresh) await onRefresh();
      } else {
        alert('No se pudieron guardar las fotos de la variante');
      }
    } catch (e) {
      console.error(e);
      alert('Error al guardar fotos de la variante');
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
        setPickingPhotoForVariant(null);
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

    // SKU estándar: [REF]-[MARCA?]-[DETALLE?]-[COLOR]-[TALLA]
    const brandSlug = (cleanBrand && cleanBrand !== 'ESTILO NÓRDICO' && cleanBrand !== 'ESTILO NORDICO')
      ? cleanBrand.replace(/\s+/g, '-')
      : '';

    let skuParts = [baseProduct.ref];
    if (brandSlug) skuParts.push(brandSlug);
    if (detailSlug) skuParts.push(detailSlug);
    if (cleanColorSlug) skuParts.push(cleanColorSlug);
    if (cleanSize) skuParts.push(cleanSize);
    const sku = skuParts.join('-');

    const brandForName = brandSlug ? ` ${cleanBrand}` : '';
    const detailForName = cleanDetail ? ` ${cleanDetail}` : '';
    const colorForName = finalColorName ? ` ${finalColorName}` : '';
    const sizeForName = cleanSize ? ` ${cleanSize}` : '';
    const variantName = `${baseProduct.name.trim()}${brandForName}${detailForName}${colorForName}${sizeForName}`.trim();

    // Validar si ya existe por SKU exacto
    const existsBySku = (allProducts || []).find(p => p.ref && p.ref.toUpperCase() === sku.toUpperCase());
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
      const sizeMsg = cleanSize ? ` y Talla: '${cleanSize}'` : '';
      alert(`⚠️ ¡ATENCIÓN! Ya existe la variante con Color: '${finalColorName}'${sizeMsg} (${existsBySameSpecs.ref}).\n\nNo se permite duplicar la misma prenda. Puedes editar sus unidades directamente en la lista de abajo.`);
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
        size: cleanSize || null,
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
        setShowNewFormPhotoPicker(false);
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
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        
        {/* Header Superior */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
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
        <div className="px-5 sm:px-6 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-xs shrink-0">
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

        {/* Barra Toggle para Formulario de Nueva Variante */}
        <div className="px-5 sm:px-6 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateForm(prev => !prev)}
            className="text-[11px] font-black uppercase tracking-wider text-slate-600 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center">
              {showCreateForm ? <ChevronUp size={13} /> : <Plus size={13} />}
            </div>
            <span>Crear Nueva Variante / Talla</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(prev => !prev)}
            className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
          >
            {showCreateForm ? 'Ocultar formulario' : '+ Mostrar formulario'}
          </button>
        </div>

        {/* Formulario de Nueva Variante (Compacto) */}
        {showCreateForm && (
          <form onSubmit={handleAddVariant} className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3 shrink-0 animate-in fade-in duration-150">
            {/* Fila 1: Marca & Detalle/Estampado Opcional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Columna 1: Marca con autocompletado y filtro dinámico */}
              <div className="space-y-1">
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
                  placeholder="Escribe o busca marca (ej: THE NORTH FACE)"
                  value={brand}
                  onChange={e => setBrand(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                />
                <datalist id="all-system-brands">
                  {dynamicBrandOptions.map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>

                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pt-0.5 scrollbar-thin">
                  <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0 mr-0.5">Rápidas:</span>
                  {QUICK_BRANDS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className={`shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                        brand.toUpperCase() === b ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columna 2: Estampado / Detalle / Letras (Opcional) */}
              <div className="space-y-1">
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
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                />
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pt-0.5 scrollbar-thin">
                  <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0 mr-0.5">Sugerencias:</span>
                  {['CASUAL', 'LETRAS', 'BORDADA', 'LOGO PEQUEÑO', 'ESTAMPADO'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDetail(s)}
                      className={`shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
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
              {/* Color(es) */}
              <div className="col-span-12 sm:col-span-5 space-y-1">
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
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
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
                        className="w-full px-3 py-1.5 bg-slate-50 border border-indigo-400 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:bg-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomColorInput(false)}
                        className="p-1 text-slate-400 hover:text-slate-600"
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
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                    title="Añadir color a la prenda"
                  >
                    <Plus size={14} />
                    <span>Añadir</span>
                  </button>
                </div>

                {/* Colores Seleccionados para la prenda */}
                <div className="min-h-[26px] p-1 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center gap-1.5 flex-wrap">
                  {selectedColors.length > 0 ? (
                    selectedColors.map((c, idx) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-black shadow-xs animate-in fade-in"
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

                {/* Píldoras de colores ya existentes en esta referencia: SCROLL HORIZONTAL EN UNA FILA */}
                {existingReferenceColors.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pt-1 pb-1 scrollbar-thin">
                    <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">En esta ref:</span>
                    {existingReferenceColors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleAddColor(c)}
                        className="shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                        title={`Agregar ${c}`}
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Talla */}
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Talla (Opcional)
                  </label>
                  {size && (
                    <button
                      type="button"
                      onClick={() => setSize('')}
                      className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Sin talla
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="common-sizes"
                  placeholder={isNonSizedProduct ? "Sin talla (Opcional)" : "Ej: M, L, XL"}
                  value={size}
                  onChange={e => setSize(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                />
                <datalist id="common-sizes">
                  {dynamicSizeOptions.map(s => <option key={s} value={s} />)}
                </datalist>

                {/* Botones de selección rápida de tallas */}
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pt-0.5 scrollbar-thin">
                  {['M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-black border transition-all cursor-pointer ${
                        size === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSize('ÚNICA')}
                    className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                      size === 'ÚNICA' ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ÚNICA
                  </button>
                  <button
                    type="button"
                    onClick={() => setSize('')}
                    className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                      !size ? 'bg-slate-800 text-white border-slate-800 shadow-2xs' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                    title="Para prendas o accesorios sin talla"
                  >
                    Sin talla
                  </button>
                </div>
              </div>

              {/* Cantidad Inicial & Botón Agregar & Foto Opcional Compacta */}
              <div className="col-span-6 sm:col-span-4 flex items-end gap-2">
                <div className="w-20 space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                    required
                  />
                </div>

                {/* Selector Opcional de Foto en Formulario (Chip Compacto) */}
                {(selectedGalleryPhoto || newVariantPreview) ? (
                  <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl h-[34px] shrink-0">
                    <img
                      src={newVariantPreview || normalizeImageUrl(selectedGalleryPhoto)}
                      alt=""
                      className="w-6 h-6 object-cover rounded-lg border border-indigo-300"
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedGalleryPhoto(null); handleClearNewVariantPhoto(); }}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      title="Quitar foto preseleccionada"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : availableReferencePhotos.length > 0 ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowNewFormPhotoPicker(prev => !prev)}
                      className="h-[34px] px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Asignar foto a esta variante al crear"
                    >
                      <Camera size={13} className="text-slate-400" />
                      <span className="hidden sm:inline">+ Foto</span>
                    </button>
                    {showNewFormPhotoPicker && (
                      <div className="absolute right-0 bottom-full mb-1 z-30 bg-white p-2.5 rounded-2xl shadow-xl border border-slate-200 w-64 animate-in fade-in">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-black uppercase text-slate-400">Fotos de la referencia:</span>
                          <button
                            type="button"
                            onClick={() => setShowNewFormPhotoPicker(false)}
                            className="text-[9px] font-bold text-slate-400 hover:text-slate-600"
                          >
                            Cerrar
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {availableReferencePhotos.map((imgUrl, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setSelectedGalleryPhoto(imgUrl);
                                handleClearNewVariantPhoto();
                                setShowNewFormPhotoPicker(false);
                              }}
                              className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-600 transition-all cursor-pointer"
                            >
                              <img src={normalizeImageUrl(imgUrl)} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer h-[34px]"
                  title="Agregar Variante"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={13} /> : <Plus size={15} />}
                  <span className="truncate">Crear Variante</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Lista de Variantes Existentes con Scroll Propio y Máximo Espacio */}
        <div className="flex-1 min-h-[350px] overflow-y-auto overscroll-contain p-4 sm:p-6 pb-28 space-y-3 custom-scrollbar">
          
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Variantes Actuales ({existingVariants.length})
              </p>
              {/* Controles de ordenamiento */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setVariantSortBy('az')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${variantSortBy === 'az' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  title="Ordenar de la A a la Z"
                >
                  🔤 A - Z
                </button>
                <button
                  type="button"
                  onClick={() => setVariantSortBy('size')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${variantSortBy === 'size' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  title="Ordenar canónicamente por talla (S, M, L, XL, etc.)"
                >
                  📏 Por Talla
                </button>
                <button
                  type="button"
                  onClick={() => setVariantSortBy('stock')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${variantSortBy === 'stock' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  title="Ordenar por mayor stock"
                >
                  📦 Stock
                </button>
                <button
                  type="button"
                  onClick={() => setVariantSortBy('creation')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${variantSortBy === 'creation' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  title="Orden original de creación"
                >
                  🕒 Orden ID
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón para subir fotos en lote a la referencia */}
              <label 
                className="text-[10px] font-bold text-slate-700 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Sube múltiples fotos de la prenda a la referencia de una sola vez"
              >
                {bulkUploadingToRef ? <RefreshCw className="animate-spin text-indigo-600" size={12} /> : <UploadCloud size={12} className="text-indigo-600" />}
                <span>{bulkUploadingToRef ? `Subiendo (${bulkUploadProgress.current}/${bulkUploadProgress.total})...` : '📁 + Subir Fotos a la Ref (Lote)'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={bulkUploadingToRef}
                  onChange={handleBulkUploadToRef}
                />
              </label>

              <button
                type="button"
                onClick={handleSyncColorPhotos}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title="Copia la foto del mismo color a todas las tallas que aún no tengan imagen"
              >
                <span>⚡ Heredar fotos por color</span>
              </button>
            </div>
          </div>

          {existingVariants.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <AlertCircle size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
              Esta referencia no tiene variantes desglosadas aún.<br />
              Agrega los colores, marcas y tallas arriba para desglosarla.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
              {sortedVariants.map(v => {
                const hasVariantImage = Array.isArray(v.images) && v.images.length > 0;
                const isUploadingThis = uploadingVariantId === v.id;

                return (
                  <div key={v.id} className="p-3 bg-white hover:bg-slate-50/80 flex flex-col gap-2 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail / Asignador de Foto de la Variante */}
                        <button
                          type="button"
                          onClick={() => setPickingPhotoForVariant(v)}
                          className="relative group w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:border-indigo-500 hover:ring-2 hover:ring-indigo-200 transition-all shadow-2xs"
                          title="Clic para ver, asignar o cambiar foto de esta variante"
                        >
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
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera size={14} className="text-white drop-shadow" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50/50 transition-colors p-1 text-center">
                              <Camera size={16} className="mb-0.5" />
                              <span className="text-[7px] font-black uppercase leading-none">
                                + Foto
                              </span>
                            </div>
                          )}
                        </button>

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
                            Color: <span className="font-bold text-slate-700">{v.color || 'N/A'}</span>
                            {v.size ? (
                              <> · Talla: <span className="font-bold text-indigo-700 font-mono">{v.size}</span></>
                            ) : (
                              <> · <span className="text-slate-400 font-semibold italic text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">Sin Talla</span></>
                            )}
                          </p>

                          {/* Botón directo para abrir el selector de fotos */}
                          <button
                            type="button"
                            onClick={() => setPickingPhotoForVariant(v)}
                            className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 transition-colors cursor-pointer w-fit ${
                              hasVariantImage
                                ? 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                                : 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
                            }`}
                          >
                            <Camera size={11} />
                            <span>{hasVariantImage ? 'Cambiar foto' : `📸 Elegir foto de la ref (${availableReferencePhotos.length})`}</span>
                          </button>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
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

      {/* Modal / Selector de Fotos para Variante Específica (Asignación Múltiple + Nombres Clave) */}
      {pickingPhotoForVariant && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPickingPhotoForVariant(null); }}
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overscroll-contain"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
          >
            {/* Header Modal Selector de Fotos */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                    {pickingPhotoForVariant.ref}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Color: <span className="text-indigo-600 uppercase font-black">{pickingPhotoForVariant.color || 'N/A'}</span>
                  </span>
                  {pickingPhotoForVariant.size && (
                    <span className="text-xs font-bold text-slate-500">
                      · Talla: <span className="font-mono text-slate-800 font-black">{pickingPhotoForVariant.size}</span>
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-slate-800 mt-1">
                  Asignar Fotos a esta Variante ({selectedVariantPhotos.length} seleccionada{selectedVariantPhotos.length === 1 ? '' : 's'})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPickingPhotoForVariant(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del Selector: Cuadrícula de Fotos de la Referencia */}
            <div className="p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 custom-scrollbar">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Fotos de la Referencia #{baseProduct.ref} ({availableReferencePhotos.length})
                </p>
                <span className="text-[10px] text-indigo-600 font-bold">
                  Selecciona 1, 2 o más fotos (Frente, Espalda, Detalle)
                </span>
              </div>

              {availableReferencePhotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {availableReferencePhotos.map((photoUrl, idx) => {
                    const isSelected = selectedVariantPhotos.includes(photoUrl);
                    const photoOrder = selectedVariantPhotos.indexOf(photoUrl) + 1;
                    const imgName = extractImageName(photoUrl);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedVariantPhotos(prev => 
                            prev.includes(photoUrl) 
                              ? prev.filter(u => u !== photoUrl) 
                              : [...prev, photoUrl]
                          );
                        }}
                        className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group bg-slate-50 ${
                          isSelected 
                            ? 'border-emerald-500 ring-4 ring-emerald-100 shadow-md scale-95' 
                            : 'border-slate-200 hover:border-indigo-600 hover:shadow-md hover:scale-102'
                        }`}
                        title={imgName ? `${imgName} · Clic para ${isSelected ? 'deseleccionar' : 'asignar'}` : (isSelected ? 'Deseleccionar' : 'Asignar')}
                      >
                        <img
                          src={normalizeImageUrl(photoUrl)}
                          alt={imgName || `Foto ref ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {/* Etiqueta de nombre clave en la parte inferior */}
                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 p-1 text-center backdrop-blur-2xs pointer-events-none">
                          <p className="text-[8px] font-black text-white truncate px-0.5">{imgName || `FOTO #${idx+1}`}</p>
                        </div>

                        {isSelected ? (
                          <div className="absolute top-1 right-1 flex items-center gap-1 bg-emerald-600 text-white px-1.5 py-0.5 rounded-full shadow-md text-[9px] font-black">
                            <Check size={10} />
                            <span>#{photoOrder}</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-indigo-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-black text-white bg-indigo-600/90 px-2 py-1 rounded-lg shadow-sm">
                              + Añadir
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                  No hay fotos cargadas en la referencia base #{baseProduct.ref}.<br />
                  Sube fotos con el botón de abajo.
                </div>
              )}

              {/* Botón para subir fotos nuevas desde PC (Soporta Múltiple) */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <label
                  htmlFor="modal-variant-upload-file"
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:text-indigo-700 cursor-pointer transition-all shadow-2xs"
                >
                  {uploadingVariantId === pickingPhotoForVariant.id ? (
                    <RefreshCw className="animate-spin text-indigo-600" size={15} />
                  ) : (
                    <UploadCloud size={16} className="text-indigo-600" />
                  )}
                  <span>📁 Subir Fotos Nuevas desde mi Equipo (Selección Múltiple)</span>
                </label>
                <input
                  id="modal-variant-upload-file"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    setUploadingVariantId(pickingPhotoForVariant.id);
                    try {
                      const newUrls = [];
                      for (const file of files) {
                        const webpFile = await optimizeImageToWebP(file);
                        const res = await uploadProductImage(pickingPhotoForVariant.id, webpFile, false);
                        if (res.image_url) newUrls.push(res.image_url);
                      }
                      setSelectedVariantPhotos(prev => [...prev, ...newUrls]);
                      if (onRefresh) await onRefresh();
                    } catch (err) {
                      alert('Error subiendo fotos: ' + (err.message || ''));
                    } finally {
                      setUploadingVariantId(null);
                      e.target.value = '';
                    }
                  }}
                />

                {selectedVariantPhotos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedVariantPhotos([])}
                    className="w-full py-2 px-4 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Deseleccionar todas las fotos de esta variante</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer Modal Selector con Botón Guardar */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs shrink-0">
              <span className="text-[10px] text-slate-500 font-medium">
                {selectedVariantPhotos.length} foto{selectedVariantPhotos.length === 1 ? '' : 's'} asignada{selectedVariantPhotos.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickingPhotoForVariant(null)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveVariantPhotos}
                  disabled={uploadingVariantId === pickingPhotoForVariant.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>Guardar Fotos Asignadas ({selectedVariantPhotos.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
