import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Trash2, Check, RefreshCw, AlertCircle, Layers, Truck, 
  DollarSign, Calculator, PackageCheck, Sparkles, Search, CheckCircle2,
  Calendar
} from 'lucide-react';
import { API_URL } from '../config/api';

const COMMON_SIZES_LETTER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const COMMON_SIZES_NUMBER = ['28', '30', '32', '34', '36', '38'];
const COMMON_COLORS = [
  'BEIGE', 'NEGRO', 'AZUL', 'AZUL OSCURO', 'VERDE MILITAR', 
  'GRIS CLARO', 'GRIS RATON', 'ROJO', 'CAMEL', 'BLANCO', 'VINOTINTO'
];

const fmt = (num) => Number(num || 0).toLocaleString('es-CO');

export default function BatchStockEntryModal({ 
  isOpen, 
  onClose, 
  products = [], 
  onSuccess,
  initialRef = ''
}) {
  if (!isOpen) return null;

  // 1. Estados de Referencia Base
  const [mode, setMode] = useState('existing'); // 'existing' o 'new'
  const [searchTerm, setSearchTerm] = useState(initialRef || '');
  const [selectedBase, setSelectedBase] = useState(null);
  const [existingBatchBrand, setExistingBatchBrand] = useState('THE NORTH FACE');

  // Campos para Nueva Prenda Base
  const [newRef, setNewRef] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Hombre');
  const [newSubcategory, setNewSubcategory] = useState('Chaqueta Impermeable');
  const [newBrand, setNewBrand] = useState('Estilo Nórdico');
  const [newPriceSale, setNewPriceSale] = useState('');

  // 2. Estados Financieros / Landed Cost
  const [totalInvoice, setTotalInvoice] = useState('506000');
  const [freightCost, setFreightCost] = useState('95000');
  const [manualUnitCost, setManualUnitCost] = useState('');
  const [useManualCost, setUseManualCost] = useState(false);
  const [provider, setProvider] = useState('Bogotá');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paidFromCash, setPaidFromCash] = useState(false); // Default: NO pagar de caja chica

  // 3. Matriz de Colores y Tallas
  const [sizeType, setSizeType] = useState('letter'); // 'letter' o 'number'
  const sizes = sizeType === 'letter' ? COMMON_SIZES_LETTER : COMMON_SIZES_NUMBER;

  // Lista de colores activos en la matriz
  const [activeRows, setActiveRows] = useState([
    { color: 'BEIGE', quantities: {} }
  ]);
  const [customColorInput, setCustomColorInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openAnticipos, setOpenAnticipos] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetch(`${API_URL}/cash/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const pendientes = data.filter(m => 
              m.type === 'ENTRADA' && 
              (m.category === 'ANTICIPO PREVENTA' || m.category === 'ANTICIPO') &&
              !m.description.includes('(✅ ENTREGADO')
            );
            setOpenAnticipos(pendientes);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-cargar si se pasa initialRef
  useEffect(() => {
    if (initialRef && products.length > 0) {
      const found = products.find(p => !p.parent_id && p.ref.toUpperCase() === initialRef.toUpperCase());
      if (found) {
        setSelectedBase(found);
        setSearchTerm(found.ref);
      }
    }
  }, [initialRef, products]);

  // Lista de productos base para el buscador
  const baseProducts = useMemo(() => {
    return products.filter(p => !p.parent_id);
  }, [products]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return baseProducts.filter(p => 
      p.ref.toLowerCase().includes(term) || 
      (p.name && p.name.toLowerCase().includes(term))
    ).slice(0, 8);
  }, [searchTerm, baseProducts]);

  // Si seleccionamos una prenda base, precargar sus colores existentes
  const handleSelectBase = (p) => {
    setSelectedBase(p);
    setSearchTerm(`${p.ref} - ${p.name}`);
    if (p.price_sale && !newPriceSale) {
      setNewPriceSale(p.price_sale);
    }

    // Detectar marca de variantes hijas o de la prenda base
    const children = products.filter(child => child.parent_id === p.id);
    const nonEstiloNordicoBrands = children
      .map(c => c.brand?.toUpperCase())
      .filter(b => b && b !== 'ESTILO NÓRDICO' && b !== 'ESTILO NORDICO');
    
    if (nonEstiloNordicoBrands.length > 0) {
      setExistingBatchBrand(nonEstiloNordicoBrands[0]);
    } else if (p.brand && p.brand !== 'Estilo Nórdico') {
      setExistingBatchBrand(p.brand.toUpperCase());
    } else {
      setExistingBatchBrand('THE NORTH FACE');
    }

    const existingColors = Array.from(new Set(children.map(c => c.color?.toUpperCase()).filter(Boolean)));
    if (existingColors.length > 0) {
      setActiveRows(existingColors.map(c => ({ color: c, quantities: {} })));
    }
  };

  // 4. Cálculos en tiempo real
  const allColorsInCatalog = useMemo(() => {
    const set = new Set();
    (products || []).forEach(p => {
      if (p.color && p.color.trim()) set.add(p.color.trim().toUpperCase());
    });
    COMMON_COLORS.forEach(c => set.add(c.trim().toUpperCase()));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [products]);

  const totalUnits = useMemo(() => {
    let count = 0;
    activeRows.forEach(row => {
      Object.values(row.quantities || {}).forEach(qty => {
        const n = Number(qty);
        if (!isNaN(n) && n > 0) count += n;
      });
    });
    return count;
  }, [activeRows]);

  const calculatedTotalCost = useMemo(() => {
    const inv = Number(totalInvoice) || 0;
    const freight = Number(freightCost) || 0;
    return inv + freight;
  }, [totalInvoice, freightCost]);

  const unitCostResult = useMemo(() => {
    if (useManualCost && manualUnitCost) {
      return Number(manualUnitCost) || 0;
    }
    if (totalUnits > 0 && calculatedTotalCost > 0) {
      return Math.round(calculatedTotalCost / totalUnits);
    }
    return 0;
  }, [useManualCost, manualUnitCost, totalUnits, calculatedTotalCost]);

  // Manejo de la Matriz
  const handleAddColor = (colorName) => {
    const clean = colorName.trim().toUpperCase();
    if (!clean) return;
    if (activeRows.some(r => r.color === clean)) return;
    setActiveRows(prev => [...prev, { color: clean, quantities: {} }]);
    setCustomColorInput('');
  };

  const handleRemoveColor = (colorName) => {
    setActiveRows(prev => prev.filter(r => r.color !== colorName));
  };

  const handleQtyChange = (color, size, value) => {
    const val = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    setActiveRows(prev => prev.map(row => {
      if (row.color !== color) return row;
      const updated = { ...row.quantities };
      if (val === '' || val === 0) {
        delete updated[size];
      } else {
        updated[size] = val;
      }
      return { ...row, quantities: updated };
    }));
  };

  // 5. Enviar Recepción al Backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validaciones
    const baseRef = mode === 'existing' ? selectedBase?.ref : newRef.trim().toUpperCase();
    if (!baseRef) {
      setErrorMsg('Debes seleccionar o ingresar una Referencia Base.');
      return;
    }

    if (totalUnits <= 0) {
      setErrorMsg('Debes ingresar al menos 1 unidad en la matriz de tallas.');
      return;
    }

    if (unitCostResult <= 0) {
      setErrorMsg('El costo unitario resultante debe ser mayor a 0. Revisa el valor de la factura.');
      return;
    }

    // Aplanar los ítems con cantidad > 0
    const items = [];
    activeRows.forEach(row => {
      Object.entries(row.quantities || {}).forEach(([size, qty]) => {
        const n = Number(qty);
        if (n > 0) {
          items.push({
            color: row.color,
            size: size,
            quantity: n,
            brand: mode === 'existing' ? (existingBatchBrand.trim().toUpperCase() || selectedBase?.brand || 'THE NORTH FACE') : newBrand,
            new_price_sale: newPriceSale ? Number(newPriceSale) : null
          });
        }
      });
    });

    const payload = {
      product_id: mode === 'existing' ? selectedBase?.id : null,
      base_ref: baseRef,
      is_new_base: mode === 'new',
      base_name: mode === 'new' ? newName.trim() : (selectedBase?.name || ''),
      category: mode === 'new' ? newCategory : (selectedBase?.category || 'Hombre'),
      subcategory: mode === 'new' ? newSubcategory : (selectedBase?.subcategory || ''),
      brand: mode === 'new' ? newBrand : (existingBatchBrand.trim().toUpperCase() || selectedBase?.brand || 'THE NORTH FACE'),
      base_price_sale: newPriceSale ? Number(newPriceSale) : null,
      total_invoice: Number(totalInvoice) || 0,
      freight_cost: Number(freightCost) || 0,
      unit_cost: unitCostResult,
      provider: provider.trim() || 'PROVEEDOR GENÉRICO',
      entry_date: entryDate || null,
      paid_from_cash: paidFromCash,
      items: items
    };

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/products/batch-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al procesar la entrada en bloque');
      }

      const data = await res.json();
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Recepción de Pedido en Bloque
                <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  Cálculo Landed Cost
                </span>
              </h2>
              <p className="text-xs text-indigo-200">
                Ingresa múltiples tallas y colores de un pedido. El costo se prorratea automáticamente.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl flex items-center gap-2 font-bold text-xs animate-in fade-in">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* BANNER INFORMATIVO DE ANTICIPOS PENDIENTES */}
          {openAnticipos.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 text-teal-800 p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">🔖</span>
                <div>
                  <p className="text-xs font-black uppercase">
                    Hay {openAnticipos.length} anticipo{openAnticipos.length > 1 ? 's' : ''} pendiente{openAnticipos.length > 1 ? 's' : ''} de entrega
                  </p>
                  <p className="text-[10px] text-teal-600 font-medium">
                    Al recibir esta mercancía, podrás cruzar la venta de inmediato en el Terminal POS sin duplicar dinero.
                  </p>
                </div>
              </div>
              <div className="text-[11px] font-bold bg-white/80 border border-teal-200 px-3 py-1 rounded-xl text-teal-900">
                Total en anticipos: ${fmt(openAnticipos.reduce((s, a) => s + (a.amount || 0), 0))}
              </div>
            </div>
          )}

          {/* 1. SECCIÓN FINANCIERA & CALCULADORA DE COSTO PUESTO EN TIENDA */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <Calculator size={15} className="text-indigo-600" /> 1. Costo del Pedido, Flete & Fecha
              </h3>
              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useManualCost} 
                  onChange={e => setUseManualCost(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Ingresar costo unitario manual
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Factura Pedido ($) *
                </label>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:border-indigo-500 shadow-sm">
                  <span className="text-slate-400 text-xs font-bold mr-1">$</span>
                  <input
                    type="number"
                    min="0"
                    value={totalInvoice}
                    onChange={e => setTotalInvoice(e.target.value)}
                    placeholder="Ej. 506000"
                    disabled={useManualCost}
                    className="w-full font-bold text-slate-800 outline-none text-sm disabled:bg-transparent disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Flete / Envío ($)
                </label>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:border-indigo-500 shadow-sm">
                  <span className="text-slate-400 text-xs font-bold mr-1">$</span>
                  <input
                    type="number"
                    min="0"
                    value={freightCost}
                    onChange={e => setFreightCost(e.target.value)}
                    placeholder="Ej. 95000"
                    disabled={useManualCost}
                    className="w-full font-bold text-slate-800 outline-none text-sm disabled:bg-transparent disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar size={11} className="text-slate-400" /> Fecha Llegada *
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none text-xs focus:border-indigo-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Proveedor / Origen
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  placeholder="Ej. Bogotá"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none text-xs focus:border-indigo-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  {useManualCost ? 'Costo Unitario Fijado' : 'Costo Unit. Calculado'}
                </label>
                {useManualCost ? (
                  <div className="flex items-center bg-white border border-amber-300 rounded-xl px-3 py-2 shadow-sm">
                    <span className="text-amber-500 text-xs font-bold mr-1">$</span>
                    <input
                      type="number"
                      min="0"
                      value={manualUnitCost}
                      onChange={e => setManualUnitCost(e.target.value)}
                      placeholder="Ej. 54636"
                      className="w-full font-black text-amber-700 outline-none text-xs"
                    />
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-600">Unit:</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">
                      ${fmt(unitCostResult)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Configuración Cristalina de Caja Chica (Sin Confusiones) */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs font-medium">
                      Inversión Lote: <strong className="text-slate-800 font-black">${fmt(calculatedTotalCost)}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 text-xs font-medium">
                      Prendas en Matriz: <strong className="text-indigo-600 font-black">{totalUnits} uds</strong>
                    </span>
                  </div>
                </div>

                {/* Checkbox explícito */}
                <label className="flex items-center gap-2.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={paidFromCash}
                    onChange={e => setPaidFromCash(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-black text-slate-800">
                    Descontar este pago de Caja Chica ahora
                  </span>
                </label>
              </div>

              {/* Mensaje de confirmación del estado de caja */}
              <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                paidFromCash 
                  ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {paidFromCash ? (
                  <>
                    <AlertCircle size={14} className="shrink-0 text-amber-600" />
                    <span>⚠️ Se registrará una <strong>SALIDA de ${fmt(totalUnits * unitCostResult)}</strong> en tu Caja Chica.</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                    <span>✓ <strong>Caja Protegida:</strong> No se restará dinero de caja chica (ideal si ya anotaste el gasto previamente en Flujo de Caja).</span>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* 2. SECCIÓN REFERENCIA BASE (EXISTENTE O NUEVA) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <PackageCheck size={15} className="text-indigo-600" /> 2. Referencia de la Prenda
              </h3>
              
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    mode === 'existing' 
                      ? 'bg-white text-indigo-600 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Referencia Existente
                </button>
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    mode === 'new' 
                      ? 'bg-white text-indigo-600 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  + Nueva Prenda
                </button>
              </div>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setSelectedBase(null);
                    }}
                    placeholder="Buscar referencia existente (ej. 5080, impermeable, bermuda...)"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                {/* Dropdown de Resultados */}
                {!selectedBase && searchResults.length > 0 && (
                  <div className="border border-slate-200 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectBase(p)}
                        className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{p.ref} · {p.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-800">${fmt(p.price_sale)}</p>
                          <p className="text-[10px] text-slate-400">Stock: {p.stock || 0} uds</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prenda Seleccionada */}
                {selectedBase && (
                  <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                    <div>
                      <p className="font-black text-sm text-indigo-950">{selectedBase.name}</p>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-2 mt-0.5">
                        <span className="bg-indigo-100 px-2 py-0.5 rounded font-mono">{selectedBase.ref}</span>
                        <span>{selectedBase.category}</span>
                        {selectedBase.brand && <span>· Marca: {selectedBase.brand}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">PVP Actual / Ajustar</label>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                          <span className="text-slate-400 text-xs font-bold mr-1">$</span>
                          <input
                            type="number"
                            min="0"
                            value={newPriceSale}
                            onChange={e => setNewPriceSale(e.target.value)}
                            placeholder={selectedBase.price_sale?.toString()}
                            className="w-24 font-bold text-slate-800 outline-none text-xs"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBase(null);
                          setSearchTerm('');
                        }}
                        className="p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
                        title="Cambiar referencia"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Selector de Marca para este lote */}
                    <div className="w-full pt-2.5 mt-2 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-slate-500">Marca para este lote:</span>
                        <input
                          type="text"
                          value={existingBatchBrand}
                          onChange={e => setExistingBatchBrand(e.target.value.toUpperCase())}
                          placeholder="Ej: THE NORTH FACE"
                          className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-black text-indigo-950 uppercase outline-none focus:border-indigo-500 w-44"
                        />
                        <div className="flex items-center gap-1 flex-wrap">
                          {['THE NORTH FACE', 'COLUMBIA', 'MONCLER', 'DIESEL', 'ARMANI', 'ESTILO NÓRDICO'].map(b => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setExistingBatchBrand(b)}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all cursor-pointer ${
                                existingBatchBrand === b 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* MODO NUEVA PRENDA BASE */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Código de Referencia (REF) *
                  </label>
                  <input
                    type="text"
                    value={newRef}
                    onChange={e => setNewRef(e.target.value.toUpperCase())}
                    placeholder="Ej. 5090"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Nombre de la Prenda *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Ej. IMPERMEABLE ROMPEVIENTOS"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Precio de Venta Sugerido ($) *
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-indigo-500 focus-within:bg-white">
                    <span className="text-slate-400 text-xs font-bold mr-1">$</span>
                    <input
                      type="number"
                      min="0"
                      value={newPriceSale}
                      onChange={e => setNewPriceSale(e.target.value)}
                      placeholder="Ej. 90000"
                      className="w-full font-bold text-slate-800 outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Subcategoría
                  </label>
                  <input
                    type="text"
                    value={newSubcategory}
                    onChange={e => setNewSubcategory(e.target.value)}
                    placeholder="Ej. Chaqueta Impermeable"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Marca / Submodelo
                  </label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={e => setNewBrand(e.target.value)}
                    placeholder="Ej. Estilo Nórdico / The North Face"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. MATRIZ DE COLORES Y TALLAS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={15} className="text-indigo-600" /> 3. Desglose de Variantes (Colores y Tallas)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ingresa las cantidades de cada talla. Las variantes que no existan se crearán automáticamente.
                </p>
              </div>

              {/* Selector de tipo de tallas */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Tallas:</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSizeType('letter')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      sizeType === 'letter' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    S - XXXL
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeType('number')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      sizeType === 'number' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    28 - 38
                  </button>
                </div>
              </div>
            </div>

            {/* Chips de Colores Comunes */}
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
                Añadir Colores al Pedido:
              </p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {COMMON_COLORS.map(c => {
                  const isAdded = activeRows.some(r => r.color === c);
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={isAdded}
                      onClick={() => handleAddColor(c)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isAdded
                          ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
                          : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700'
                      }`}
                    >
                      + {c}
                    </button>
                  );
                })}

                {/* Input para color personalizado */}
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 focus-within:bg-white focus-within:border-indigo-400">
                  <input
                    type="text"
                    list="batch-all-colors"
                    value={customColorInput}
                    onChange={e => setCustomColorInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddColor(customColorInput);
                      }
                    }}
                    placeholder="Otro color..."
                    className="w-24 text-[11px] font-bold text-slate-800 outline-none uppercase bg-transparent"
                  />
                  <datalist id="batch-all-colors">
                    {allColorsInCatalog.map(c => <option key={c} value={c} />)}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => handleAddColor(customColorInput)}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla Matriz */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 min-w-[140px]">Color</th>
                    {sizes.map(s => (
                      <th key={s} className="px-3 py-3 text-center min-w-[65px]">{s}</th>
                    ))}
                    <th className="px-3 py-3 text-center min-w-[70px]">Subtotal</th>
                    <th className="px-3 py-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                  {activeRows.map(row => {
                    const rowSubtotal = Object.values(row.quantities || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
                    return (
                      <tr key={row.color} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                            {row.color}
                          </span>
                        </td>
                        
                        {sizes.map(s => {
                          const val = row.quantities[s] || '';
                          return (
                            <td key={s} className="px-2 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={val}
                                onChange={e => handleQtyChange(row.color, s, e.target.value)}
                                placeholder="0"
                                className={`w-14 text-center py-1.5 rounded-lg border font-black text-sm outline-none transition-all ${
                                  val > 0
                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-400 focus:border-indigo-400 focus:text-slate-800'
                                }`}
                              />
                            </td>
                          );
                        })}

                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-black px-2 py-1 rounded-md ${
                            rowSubtotal > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'
                          }`}>
                            {rowSubtotal} uds
                          </span>
                        </td>

                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveColor(row.color)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar este color de la matriz"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

        </div>

        {/* Footer Barra Fija de Acción */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Lote</p>
              <p className="font-black text-slate-900 text-sm">
                {totalUnits} prendas · <span className="text-indigo-600">${fmt(totalUnits * unitCostResult)}</span>
              </p>
            </div>
            <div className="border-l pl-4 border-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-400">Costo Unitario Real</p>
              <p className="font-black text-emerald-600 text-sm">
                ${fmt(unitCostResult)} / ud
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors w-full sm:w-auto cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || totalUnits === 0 || unitCostResult === 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Procesando Pedido...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Ingresar Lote Completo ({totalUnits} prendas)
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
