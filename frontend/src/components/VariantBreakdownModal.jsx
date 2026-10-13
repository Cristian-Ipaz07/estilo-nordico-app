import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Check, RefreshCw, AlertCircle, Layers, Tag } from 'lucide-react';

const COMMON_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '30', '32', '34', '36'];
const COMMON_COLORS = ['NEGRO', 'AZUL', 'AZUL OSCURO', 'BLANCO', 'BEIGE', 'VERDE', 'VERDE MILITAR', 'ROJO', 'VINOTINTO', 'GRIS', 'CAMEL'];

export default function VariantBreakdownModal({ baseProduct, allProducts, isOpen, onClose, onRefresh }) {
  if (!isOpen || !baseProduct) return null;

  const [color, setColor] = useState('');
  const [size, setSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tempQty, setTempQty] = useState('');

  // Encuentra variantes existentes que pertenezcan a este producto base
  const existingVariants = useMemo(() => {
    const prefix = `${baseProduct.ref}-`.toLowerCase();
    return allProducts.filter(p => 
      p.id !== baseProduct.id && 
      (p.parent_id === baseProduct.id || (p.ref && p.ref.toLowerCase().startsWith(prefix)))
    );
  }, [allProducts, baseProduct]);

  const totalAssignedStock = existingVariants.reduce((sum, v) => sum + (v.stock || 0), 0);

  const handleAddVariant = async (e) => {
    e.preventDefault();
    const cleanColor = color.trim().toUpperCase().replace(/\s+/g, '-');
    const cleanSize = size.trim().toUpperCase();

    if (!cleanColor) {
      alert('Por favor ingresa un color.');
      return;
    }

    // SKU estándar: [REF]-[COLOR]-[TALLA]
    const sku = `${baseProduct.ref}-${cleanColor}-${cleanSize}`;
    const variantName = `${baseProduct.name.trim()} ${cleanColor} ${cleanSize}`;

    // Validar si ya existe
    const exists = allProducts.find(p => p.ref.toUpperCase() === sku);
    if (exists) {
      alert(`La variante ${sku} ya existe en el inventario. Puedes editar su stock abajo.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ref: sku,
        name: variantName,
        category: baseProduct.category || 'Hombre',
        subcategory: baseProduct.subcategory || '',
        brand: baseProduct.brand || 'Estilo Nórdico',
        origin: baseProduct.origin || 'Propio',
        color: cleanColor,
        size: cleanSize,
        parent_id: baseProduct.id,
        price_sale: baseProduct.price_sale || 0,
        my_cost: baseProduct.my_cost || 0,
        stock: Number(quantity) || 0,
        product_type: baseProduct.product_type || 'ROPA',
        is_published: false
      };

      const res = await fetch('http://localhost:8000/products/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setColor('');
        setQuantity(1);
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
      const res = await fetch(`http://localhost:8000/products/${variantId}`, {
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
      const res = await fetch(`http://localhost:8000/products/${variantId}`, {
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
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg">
                  REF: {baseProduct.ref}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase">{baseProduct.category}</span>
              </div>
              <h3 className="font-black text-slate-800 text-base">{baseProduct.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Resumen de Stock Base vs Variantes */}
        <div className="px-6 py-3 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Stock Total Desglosado:</span>
            <span className="font-black text-indigo-700 font-mono text-sm bg-white px-2.5 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
              {totalAssignedStock} un.
            </span>
          </div>
          <div>
            <span className="font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded border border-indigo-100">
              {existingVariants.length} variantes / SKUs creados
            </span>
          </div>
        </div>

        {/* Formulario de Nueva Variante */}
        <form onSubmit={handleAddVariant} className="p-6 border-b border-slate-100 bg-white space-y-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-600" /> Crear Nueva Variante / Talla
          </p>

          <div className="grid grid-cols-12 gap-3 items-end">
            {/* Color */}
            <div className="col-span-5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Color
              </label>
              <input
                type="text"
                list="common-colors"
                placeholder="Ej: NEGRO, AZUL"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
              <datalist id="common-colors">
                {COMMON_COLORS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Talla */}
            <div className="col-span-4">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Talla
              </label>
              <input
                type="text"
                list="common-sizes"
                placeholder="Ej: M, L, 32"
                value={size}
                onChange={e => setSize(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
              <datalist id="common-sizes">
                {COMMON_SIZES.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            {/* Cantidad Inicial */}
            <div className="col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Stock Inicial
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shrink-0 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Botones de selección rápida de tallas comunes */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Tallas Rápidas:</span>
            {COMMON_SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                  size === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </form>

        {/* Lista de Variantes Existentes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
            Variantes Actuales ({existingVariants.length})
          </p>

          {existingVariants.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <AlertCircle size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
              Esta referencia no tiene variantes desglosadas aún.<br />
              Agrega los colores y tallas arriba para desglosarla.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {existingVariants.map(v => (
                <div key={v.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-mono font-bold text-xs flex items-center justify-center">
                      {v.size || '-'}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 font-mono">{v.ref}</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Color: <span className="font-bold text-slate-600">{v.color || 'N/A'}</span> · Talla: <span className="font-bold text-slate-600">{v.size || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Stock & Acciones */}
                  <div className="flex items-center gap-3">
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
                        title="Clic para editar stock"
                      >
                        {v.stock} un.
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteVariant(v.id, v.ref)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar variante"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
}
