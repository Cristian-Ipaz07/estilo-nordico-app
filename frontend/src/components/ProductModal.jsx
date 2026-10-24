import { API_URL } from '../config/api';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Globe, Image as ImageIcon, RefreshCw, Check, UploadCloud } from 'lucide-react';
import { normalizeImageUrl, optimizeImageToWebP, uploadProductImage, extractImageName } from '../utils/imageOptimizer';

import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export default function ProductModal({ product, isOpen, onClose, onSaved }) {
  useBodyScrollLock(isOpen);
  const isEdit = Boolean(product && product.id);
  const [formData, setFormData] = useState({
    ref: '',
    name: '',
    category: 'Hombre',
    subcategory: '',
    brand: 'Estilo Nórdico',
    origin: 'Propio',
    color: '',
    size: '',
    price_sale: '',
    compare_price: '',
    my_cost: '',
    stock: '',
    product_type: 'ROPA',
    is_published: false,
    description: '',
    images: [],
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Opciones inteligentes desplegables extraídas del inventario y catálogos estándar
  const { categoryOptions, subcategoryOptions, refOptions } = useMemo(() => {
    let prods = [];
    try {
      const cached = localStorage.getItem('nordic_cached_products');
      if (cached) prods = JSON.parse(cached);
    } catch {}

    const cats = new Set(['HOMBRE', 'MUJER', 'UNISEX', 'NIÑOS', 'ACCESORIOS', 'CALZADO', 'HOGAR']);
    const subs = new Set(['BERMUDA', 'BUSO', 'CAMISETA', 'CHAQUETA', 'JEANS', 'PANTALON', 'BILLETERA', 'CORREA', 'HEBILLA', 'GORRA', 'RELOJ', 'PERFUME', 'LOCION', 'GAFAS', 'SHORT', 'BLUSA', 'POLO', 'BOXER', 'JOGGER', 'CHALECO']);
    const refs = new Set();

    prods.forEach(p => {
      if (p.category) cats.add(p.category.trim().toUpperCase());
      if (p.subcategory) subs.add(p.subcategory.trim().toUpperCase());
      if (p.ref) refs.add(p.ref.trim());
    });

    return {
      categoryOptions: Array.from(cats).sort(),
      subcategoryOptions: Array.from(subs).sort(),
      refOptions: Array.from(refs).sort()
    };
  }, []);

  const handleUploadFromPC = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!isEdit || !product?.id) {
      alert('Para subir fotos directamente a la nube, primero guarda la prenda base con su referencia.');
      return;
    }

    setUploadingPhoto(true);
    setUploadProgress({ current: 0, total: files.length });

    const newUploaded = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });
        const file = files[i];
        const webpFile = await optimizeImageToWebP(file);
        const res = await uploadProductImage(product.id, webpFile);
        if (res.image_url) {
          newUploaded.push(res.image_url);
        }
      }

      if (newUploaded.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...newUploaded]
        }));
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error al subir fotos');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress({ current: 0, total: 0 });
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (product) {
      setFormData({
        ref: product.ref || '',
        name: product.name || '',
        category: product.category || 'Hombre',
        subcategory: product.subcategory || '',
        brand: product.brand || 'Estilo Nórdico',
        origin: product.origin || 'Propio',
        color: product.color || '',
        size: product.size || '',
        price_sale: product.price_sale ?? '',
        compare_price: product.compare_price ?? '',
        my_cost: product.my_cost ?? '',
        stock: product.stock ?? '',
        product_type: product.product_type || 'ROPA',
        is_published: Boolean(product.is_published),
        description: product.description || '',
        images: Array.isArray(product.images) ? product.images : [],
      });
    } else {
      setFormData({
        ref: '',
        name: '',
        category: 'Hombre',
        subcategory: '',
        brand: 'Estilo Nórdico',
        origin: 'Propio',
        color: '',
        size: '',
        price_sale: '',
        compare_price: '',
        my_cost: '',
        stock: '',
        product_type: 'ROPA',
        is_published: false,
        description: '',
        images: [],
      });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setFormData(prev => ({ ...prev, images: [...prev.images, newImageUrl.trim()] }));
    setNewImageUrl('');
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ref.trim() || !formData.name.trim()) {
      alert("La Referencia (REF) y el Nombre son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const url = isEdit 
        ? `${API_URL}/products/${product.id}` 
        : `${API_URL}/products/`;
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ref: formData.ref.trim(),
        name: formData.name.trim(),
        category: formData.category,
        subcategory: formData.subcategory,
        brand: formData.brand,
        origin: formData.origin,
        color: formData.color,
        size: formData.size,
        price_sale: formData.price_sale === '' ? 0 : Number(formData.price_sale),
        compare_price: formData.compare_price === '' ? null : Number(formData.compare_price),
        my_cost: formData.my_cost === '' ? 0 : Number(formData.my_cost),
        stock: formData.stock === '' ? 0 : Number(formData.stock),
        product_type: formData.product_type,
        is_published: formData.is_published,
        description: formData.description,
        images: formData.images,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al guardar producto');
      }

      const savedData = await res.json().catch(() => payload);
      onSaved(savedData);
      onClose();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {isEdit ? `Editando #${product.ref}` : 'Nuevo Registro'}
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              {isEdit ? formData.name || 'Editar Prenda' : 'Agregar Prenda al Catálogo'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-6 bg-white gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            1. Datos Básicos & Stock
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('web')}
            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'web' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <Globe size={13} /> 2. Ficha Web & Fotos ({formData.images.length})
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Referencia / SKU *
                  </label>
                  <input
                    list="product-modal-refs-list"
                    type="text"
                    required
                    placeholder="Ej. 770 o 5080"
                    value={formData.ref}
                    onChange={e => setFormData({ ...formData, ref: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <datalist id="product-modal-refs-list">
                    {refOptions.map(r => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                  <p className="text-[10px] text-slate-400 mt-1">Código único de la referencia o SKU.</p>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Tipo de Producto *
                  </label>
                  <select
                    value={formData.product_type}
                    onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                  >
                    <option value="CHAQUETA">CHAQUETA</option>
                    <option value="ROPA">ROPA (Camisetas, Jeans, Busos, Bermudas)</option>
                    <option value="PERFUME">PERFUME</option>
                    <option value="RELOJ">RELOJ</option>
                    <option value="ACCESORIO">ACCESORIO (Correas, Billeteras, Hebillas)</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Chaqueta Rompevientos Térmica"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Categoría (Desplegable)
                  </label>
                  <select
                    value={formData.category ? formData.category.toUpperCase() : 'HOMBRE'}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Subcategoría
                  </label>
                  <input
                    list="product-modal-subcat-list"
                    type="text"
                    placeholder="Elegir o escribir..."
                    value={formData.subcategory || ''}
                    onChange={e => setFormData({ ...formData, subcategory: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <datalist id="product-modal-subcat-list">
                    {subcategoryOptions.map(sub => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Color</label>
                  <input
                    type="text"
                    placeholder="Azul, Negro..."
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Talla</label>
                  <input
                    type="text"
                    placeholder="S, M, L, XL..."
                    value={formData.size}
                    onChange={e => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">Precio Venta ($)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.price_sale}
                    onChange={e => setFormData({ ...formData, price_sale: e.target.value })}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl font-black text-sm text-emerald-700 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Precio Tachado Web</label>
                  <input
                    type="number"
                    placeholder="Ej. 150000"
                    value={formData.compare_price}
                    onChange={e => setFormData({ ...formData, compare_price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs text-slate-600 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-1">Mi Costo Compra ($)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.my_cost}
                    onChange={e => setFormData({ ...formData, my_cost: e.target.value })}
                    className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl font-black text-sm text-indigo-700 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">Stock Disponible</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase">Publicar en Tienda Web</p>
                  <p className="text-[11px] text-slate-500">
                    Si está activado, este producto se expondrá en la API pública para la web de Estilo N?rdico.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_published: !formData.is_published })}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-all ${formData.is_published ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <div className="bg-white w-6 h-6 rounded-full shadow-md"></div>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Descripción Comercial para la Web
                </label>
                <textarea
                  rows={3}
                  placeholder="Material, características, impermeable, tallaje exacto..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Galería de Fotos
                </label>

                {/* Botón de subida rápida desde el PC con conversión a WebP */}
                {isEdit && (
                  <div className="mb-3">
                    <label
                      htmlFor="product-modal-file-upload"
                      className={`w-full py-2.5 px-4 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        uploadingPhoto ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {uploadingPhoto ? (
                        <>
                          <RefreshCw className="animate-spin text-indigo-600" size={15} />
                          <span>Subiendo fotos a la nube ({uploadProgress.current} de {uploadProgress.total})...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={16} className="text-indigo-600" />
                          <span>📁 Subir Fotos desde mi PC (Selección Múltiple a WebP)</span>
                        </>
                      )}
                    </label>
                    <input
                      id="product-modal-file-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleUploadFromPC}
                      disabled={uploadingPhoto}
                    />
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <input
                    type="url"
                    placeholder="O pega un enlace de foto externa..."
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer"
                  >
                    + Agregar Enlace
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {formData.images.map((img, idx) => (
                    <div key={idx} title={extractImageName(img)} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 shadow-2xs">
                      <img src={normalizeImageUrl(img)} alt={`Foto ${idx+1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { e.target.style.display = 'none'; }} />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-1 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[8px] font-black text-white truncate px-1">{extractImageName(img)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {formData.images.length === 0 && (
                    <div className="col-span-4 p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                      <ImageIcon className="mx-auto mb-1 opacity-40" size={24} />
                      <p className="text-[11px] font-semibold">No hay fotos agregadas aún.</p>
                      <p className="text-[9px] text-slate-400">Pega un enlace de foto arriba para mostrarla en el cat?logo y la web.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
              {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
