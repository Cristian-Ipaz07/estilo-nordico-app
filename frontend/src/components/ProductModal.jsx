import { API_URL } from '../config/api';
import React, { useState, useEffect } from 'react';
import { X, Globe, Image as ImageIcon, RefreshCw, Check } from 'lucide-react';

export default function ProductModal({ product, isOpen, onClose, onSaved }) {
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

      onSaved();
      onClose();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
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
                    type="text"
                    required
                    placeholder="Ej. 5080-AZU-M"
                    value={formData.ref}
                    onChange={e => setFormData({ ...formData, ref: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Usa código con variante (ej: 5080-AZUL-M).</p>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Tipo de Producto *
                  </label>
                  <select
                    value={formData.product_type}
                    onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="CHAQUETA">CHAQUETA</option>
                    <option value="ROPA">ROPA (Camisetas, Jeans, etc.)</option>
                    <option value="PERFUME">PERFUME</option>
                    <option value="RELOJ">RELOJ</option>
                    <option value="ACCESORIO">ACCESORIO</option>
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
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Categoría</label>
                  <input
                    type="text"
                    placeholder="Hombre / Mujer"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Subcategoría</label>
                  <input
                    type="text"
                    placeholder="Rompevientos..."
                    value={formData.subcategory}
                    onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
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
                  Galería de Fotos (URLs)
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/foto-chaqueta.jpg"
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    + Agregar Foto
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                      <img src={img} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
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
