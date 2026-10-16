import React, { useState, useEffect } from 'react';
import { X, Check, RefreshCw, AlertCircle, Pencil } from 'lucide-react';
import { API_URL } from '../config/api';

const QUICK_BRANDS = ['THE NORTH FACE', 'COLUMBIA', 'MONCLER', 'DIESEL', 'ARMANI', 'ESTILO NÓRDICO'];
const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '30', '32', '34', '36'];

export default function EditVariantModal({
  variant,
  baseProduct,
  allProducts = [],
  dynamicColors = [],
  referenceColors = [],
  dynamicSizes = [],
  isOpen,
  onClose,
  onSuccess
}) {
  if (!isOpen || !variant || !baseProduct) return null;

  const [brand, setBrand] = useState(variant.brand || '');
  const [color, setColor] = useState(variant.color || '');
  const [size, setSize] = useState(variant.size || '');
  const [sku, setSku] = useState(variant.ref || '');
  const [autoSyncSku, setAutoSyncSku] = useState(true);
  const [stock, setStock] = useState(variant.stock ?? 0);
  const [priceSale, setPriceSale] = useState(variant.price_sale ?? 0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sincronizar SKU automáticamente cuando cambie Marca, Color o Talla si autoSyncSku está activo
  useEffect(() => {
    if (!autoSyncSku) return;

    const cleanColor = (color || '').trim().toUpperCase().replace(/\s+/g, '-');
    const cleanSize = (size || '').trim().toUpperCase();
    const cleanBrand = (brand || '').trim().toUpperCase();

    // Si la marca es ESTILO NÓRDICO o está vacía, no agregamos slug de marca al SKU estándar
    const brandSlug = (cleanBrand && cleanBrand !== 'ESTILO NÓRDICO' && cleanBrand !== 'ESTILO NORDICO')
      ? cleanBrand.replace(/\s+/g, '-')
      : '';

    let generatedSku = '';
    if (brandSlug) {
      generatedSku = `${baseProduct.ref}-${brandSlug}-${cleanColor || 'COLOR'}-${cleanSize || 'TALLA'}`;
    } else {
      generatedSku = `${baseProduct.ref}-${cleanColor || 'COLOR'}-${cleanSize || 'TALLA'}`;
    }

    setSku(generatedSku);
  }, [brand, color, size, autoSyncSku, baseProduct.ref]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanColor = (color || '').trim().toUpperCase();
    const cleanSize = (size || '').trim().toUpperCase();
    const cleanBrand = (brand || '').trim().toUpperCase();
    const cleanSku = (sku || '').trim().toUpperCase();

    if (!cleanColor) {
      setErrorMsg('El color no puede estar vacío.');
      return;
    }
    if (!cleanSize) {
      setErrorMsg('La talla no puede estar vacía.');
      return;
    }
    if (!cleanSku) {
      setErrorMsg('El código SKU no puede estar vacío.');
      return;
    }

    // Validar si el SKU ya existe en otro producto distinto a esta variante
    const skuConflict = allProducts.find(
      p => p.id !== variant.id && p.ref && p.ref.toUpperCase() === cleanSku
    );
    if (skuConflict) {
      setErrorMsg(`⚠️ El SKU '${cleanSku}' ya está asignado a otro producto en inventario.`);
      return;
    }

    // Validar duplicado por Color + Talla + Marca en esta misma prenda base (excluyendo a sí misma)
    const duplicateVariant = allProducts.find(
      p => p.id !== variant.id &&
           p.parent_id === baseProduct.id &&
           (p.color || '').trim().toUpperCase() === cleanColor &&
           (p.size || '').trim().toUpperCase() === cleanSize &&
           (cleanBrand ? (p.brand || '').trim().toUpperCase() === cleanBrand : true)
    );
    if (duplicateVariant) {
      setErrorMsg(`⚠️ Ya existe otra variante con Color '${cleanColor}' y Talla '${cleanSize}' (${duplicateVariant.ref}). Evita duplicar prendas iguales.`);
      return;
    }

    setSaving(true);
    try {
      const brandForName = cleanBrand && cleanBrand !== 'ESTILO NÓRDICO' && cleanBrand !== 'ESTILO NORDICO'
        ? ` ${cleanBrand}`
        : '';
      const updatedName = `${baseProduct.name.trim()}${brandForName} ${cleanColor} ${cleanSize}`.trim();

      const payload = {
        ref: cleanSku,
        name: updatedName,
        brand: cleanBrand || baseProduct.brand || 'Estilo Nórdico',
        color: cleanColor,
        size: cleanSize,
        stock: Math.max(0, parseInt(stock, 10) || 0),
        price_sale: Math.max(0, parseFloat(priceSale) || 0)
      };

      const res = await fetch(`${API_URL}/products/${variant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (onSuccess) await onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'No se pudo actualizar la variante');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red al actualizar la variante');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Pencil size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm">Editar Prenda / Variante</h3>
              <p className="text-[10px] text-slate-400 font-mono">Original: {variant.ref}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Marca */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Marca (ej: THE NORTH FACE / COLUMBIA)
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
              value={brand}
              onChange={e => setBrand(e.target.value.toUpperCase())}
              placeholder="Ej: THE NORTH FACE"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Rápidas:</span>
              {QUICK_BRANDS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrand(b)}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                    brand.toUpperCase() === b
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Color & Talla */}
          <div className="grid grid-cols-2 gap-3">
            {/* Color */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Color
              </label>
              <input
                type="text"
                list="edit-modal-colors"
                value={color}
                onChange={e => setColor(e.target.value.toUpperCase())}
                placeholder="Ej: AZUL COBALTO"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
              <datalist id="edit-modal-colors">
                {dynamicColors.map(c => <option key={c} value={c} />)}
              </datalist>

              {/* Chips de colores existentes en esta prenda */}
              {referenceColors.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {referenceColors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        color.toUpperCase() === c
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Talla */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Talla
              </label>
              <input
                type="text"
                list="edit-modal-sizes"
                value={size}
                onChange={e => setSize(e.target.value.toUpperCase())}
                placeholder="Ej: M, L, XL"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
              <datalist id="edit-modal-sizes">
                {dynamicSizes.map(s => <option key={s} value={s} />)}
              </datalist>

              {/* Chips de tallas rápidas */}
              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                {['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black border transition-all cursor-pointer ${
                      size.toUpperCase() === s
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Código SKU */}
          <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                Código SKU
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-indigo-700 font-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSyncSku}
                  onChange={e => setAutoSyncSku(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                Auto-generar SKU
              </label>
            </div>
            <input
              type="text"
              value={sku}
              onChange={e => {
                setSku(e.target.value.toUpperCase());
                setAutoSyncSku(false);
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black font-mono text-slate-800 uppercase outline-none focus:border-indigo-500"
              required
            />
            <p className="text-[10px] text-slate-400">
              {autoSyncSku 
                ? '⚡ El SKU se actualiza automáticamente al cambiar Marca, Color o Talla.' 
                : '✏️ Modo manual activo. Puedes escribir un SKU personalizado.'}
            </p>
          </div>

          {/* Stock y Precio de Venta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Stock (Unidades)
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Precio de Venta ($)
              </label>
              <input
                type="number"
                min="0"
                value={priceSale}
                onChange={e => setPriceSale(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
