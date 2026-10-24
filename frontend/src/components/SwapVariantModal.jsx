import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, Check, AlertCircle, Shirt, Search, Tag, ArrowRight } from 'lucide-react';
import { API_URL } from '../config/api';

export default function SwapVariantModal({ isOpen, onClose, sale, itemToExchange, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Cargar productos del inventario
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg(null);
    setSelectedProductId(null);
    setSearchTerm('');
    setNotes('');

    const token = localStorage.getItem('token');
    fetch(`${API_URL}/products/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
      })
      .catch(err => {
        console.error('Error al cargar productos:', err);
        setErrorMsg('No se pudo cargar el inventario.');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Identificar el producto actual y sus variantes hermanas (misma línea/nombre/marca)
  const currentProduct = itemToExchange?.product || null;

  const siblingVariants = useMemo(() => {
    if (!currentProduct || !products.length) return [];
    
    // Normalizar nombre base o ref base
    const baseName = (currentProduct.name || '').toLowerCase().trim();
    const baseRef = (currentProduct.ref || '').split('-').slice(0, 3).join('-').toLowerCase();

    return products.filter(p => {
      if (p.id === currentProduct.id) return false; // Excluir la misma prenda actual
      const pName = (p.name || '').toLowerCase().trim();
      const pRef = (p.ref || '').toLowerCase();

      // Mismo parent_id, mismo nombre base, o misma raíz de referencia
      const matchesParent = currentProduct.parent_id && p.parent_id === currentProduct.parent_id;
      const matchesName = baseName && pName === baseName;
      const matchesRef = baseRef && pRef.startsWith(baseRef);

      return matchesParent || matchesName || matchesRef;
    });
  }, [currentProduct, products]);

  // Filtrado por buscador para casos donde el cliente pide otra referencia
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      if (p.id === currentProduct?.id) return false;
      const name = (p.name || '').toLowerCase();
      const ref = (p.ref || '').toLowerCase();
      const size = (p.size || '').toLowerCase();
      const color = (p.color || '').toLowerCase();
      return name.includes(term) || ref.includes(term) || size.includes(term) || color.includes(term);
    }).slice(0, 15);
  }, [searchTerm, products, currentProduct]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  // Manejar el intercambio
  const handleExchangeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !sale || !itemToExchange) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    const token = localStorage.getItem('token');

    try {
      const defaultNote = `Cambio de talla en domicilio (${currentProduct?.size || 'Actual'} -> ${selectedProduct?.size || 'Nueva'})`;
      const finalNote = notes.trim() ? `${defaultNote} | ${notes.trim()}` : defaultNote;

      const res = await fetch(`${API_URL}/sales/${sale.id}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          item_id: itemToExchange.id,
          new_product_id: selectedProductId,
          new_price: selectedProduct.price_sale || itemToExchange.unit_price,
          difference_paid: 0,
          account: 'EFECTIVO_TIENDA',
          notes: finalNote
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al cambiar la talla');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar el cambio');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Encabezado */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl">
              <RefreshCw size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Cambio de Talla / Prenda</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Venta #{sale?.id} — {sale?.customer_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Prenda Actual */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Prenda Asignada Actualmente (A Devolver al Stock)
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 text-sm">
                  {currentProduct?.name || 'Prenda'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {currentProduct?.ref}
                  </span>
                  {currentProduct?.size && (
                    <span className="text-[11px] font-black px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md">
                      TALLA {currentProduct.size}
                    </span>
                  )}
                  {currentProduct?.color && (
                    <span className="text-[11px] font-bold text-slate-600">
                      {currentProduct.color}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                  +1 Vuelve al Stock
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Variantes Hermanas (Mismo modelo, otras tallas/colores) */}
          {siblingVariants.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2.5 flex items-center gap-1.5">
                <Shirt size={14} className="text-purple-600" />
                Tallas disponibles de esta misma prenda:
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {siblingVariants.map(v => {
                  const isSelected = selectedProductId === v.id;
                  const hasStock = (v.stock || 0) > 0;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={!hasStock}
                      onClick={() => setSelectedProductId(v.id)}
                      className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/80 shadow-xs ring-2 ring-purple-600/20'
                          : hasStock
                          ? 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                          : 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">
                          {v.size ? `TALLA ${v.size}` : v.ref}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          hasStock ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {hasStock ? `${v.stock} disp.` : 'Agotada'}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 mt-1 truncate">
                        {v.color || v.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buscador de otras referencias si aplica */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
              O buscar otra prenda / referencia:
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Ej. The North Face XXL, Moncler..."
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-2xl max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white shadow-md">
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if ((p.stock || 0) > 0) {
                        setSelectedProductId(p.id);
                        setSearchTerm('');
                      }
                    }}
                    className={`p-2.5 text-xs flex items-center justify-between transition cursor-pointer ${
                      selectedProductId === p.id
                        ? 'bg-purple-50 text-purple-900 font-bold'
                        : (p.stock || 0) > 0
                        ? 'hover:bg-slate-50'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {p.ref} {p.size ? `• Talla: ${p.size}` : ''} {p.color ? `• ${p.color}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {(p.stock || 0)} un.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prenda Seleccionada para Entrega */}
          {selectedProduct && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1">
                <Check size={12} />
                Nueva Prenda a Dejar al Cliente:
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-purple-950 text-xs">
                    {selectedProduct.name}
                  </p>
                  <p className="text-[10px] font-bold text-purple-700 mt-0.5">
                    {selectedProduct.ref} • {selectedProduct.size ? `Talla: ${selectedProduct.size}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                    -1 Descontar Stock
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notas Opcionales */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Observación Adicional (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej. Se probó ambas y la XXL le quedó perfecta"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedProductId || isSubmitting}
            onClick={handleExchangeSubmit}
            className="px-5 py-2.5 text-xs font-black bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            <span>Confirmar Cambio</span>
          </button>
        </div>
      </div>
    </div>
  );
}
