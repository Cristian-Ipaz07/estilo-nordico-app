import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, RefreshCw, Package, UploadCloud, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, History, ArrowRight, Truck, CheckCircle2, RotateCcw, TrendingUp, Edit3 } from 'lucide-react';

// ── Card de Valoración Real del Inventario ────────────────────────────────────
function AssetValuationCard({ products }) {
  const STORAGE_KEY = 'inv_ajuste_creditos_externos';
  const [expanded, setExpanded] = useState(false);
  const [creditosExternos, setCreditosExternos] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE_KEY) || 0); } catch { return 0; }
  });
  const [inputVal, setInputVal] = useState(creditosExternos || '');
  const [saved, setSaved] = useState(false);

  const valorSistema = useMemo(() =>
    products.reduce((acc, p) => acc + ((p.my_cost || 0) * (p.stock || 0)), 0),
    [products]
  );

  const valorTotal = valorSistema + creditosExternos;

  const handleSave = () => {
    const val = Number(inputVal) || 0;
    setCreditosExternos(val);
    localStorage.setItem(STORAGE_KEY, val.toString());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fmt = (n) => Number(n).toLocaleString('es-CO');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mt-4 shrink-0 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><TrendingUp size={18} /></div>
          <div className="text-left">
            <p className="text-sm font-black text-slate-900">Valoración Real del Inventario</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Sistema: ${fmt(valorSistema)} · Total estimado: ${fmt(valorTotal)}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor en Sistema</p>
              <p className="text-xl font-black text-slate-900">${fmt(valorSistema)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Costo × Stock de {products.length} productos</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Créditos / Mercancía Extra</p>
              <p className="text-xl font-black text-amber-700">${fmt(creditosExternos)}</p>
              <p className="text-[10px] text-amber-400 mt-1">Ingresado manualmente</p>
            </div>
            <div className="bg-indigo-600 rounded-xl p-4">
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Valor Total Estimado</p>
              <p className="text-xl font-black text-white">${fmt(valorTotal)}</p>
              <p className="text-[10px] text-indigo-200 mt-1">Sistema + Externos</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Créditos Externos / Mercancía fuera del sistema
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Usa este campo para ajustar el valor total real del inventario (Ej: mercancía a consignación, en tránsito o registrada solo en Excel). Se guarda localmente.
            </p>
            <div className="flex gap-2">
              <div className="flex items-center border-2 border-amber-200 rounded-xl px-4 py-3 bg-amber-50 focus-within:border-amber-400 transition-all flex-1">
                <span className="text-amber-400 font-black mr-2">$</span>
                <input
                  type="number" min="0"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="Ej. 2000000"
                  className="bg-transparent outline-none w-full font-bold text-amber-700"
                />
              </div>
              <button onClick={handleSave}
                className={`px-5 rounded-xl font-black text-sm transition-all flex items-center gap-2
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                {saved ? <><CheckCircle2 size={16} /> Guardado</> : <><Edit3 size={16} /> Aplicar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fmt = (num) => Number(num).toLocaleString('es-CO');
const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString("en-US", {timeZone: "America/Bogota", day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit', hour12: true});
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [activeTab, setActiveTab] = useState('stock');

  // 1. Función para cargar inventario desde el backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/products/');
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error("Error cargando inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // 2. Función para manejar la subida del Excel
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/products/upload-excel', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("¡Inventario actualizado con éxito desde el Excel!");
        fetchInventory(); // Recargar la tabla
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || "No se pudo procesar el archivo"}`);
      }
    } catch (error) {
      console.error("Error en la subida:", error);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
      event.target.value = null; // Limpiar el input
    }
  };

  // 3. Manejo de Ordenamiento
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 4. Lógica de Filtrado Global y Ordenamiento Optimizado con useMemo
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filtro Global Multicolumna
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(lowerSearch) || 
        p.ref?.toLowerCase().includes(lowerSearch) ||
        p.category?.toLowerCase().includes(lowerSearch) ||
        p.subcategory?.toLowerCase().includes(lowerSearch)
      );
    }

    // Ordenamiento
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        
        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [products, searchTerm, sortConfig]);

  // Icono de flecha según el estado del ordenamiento
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={14} className="opacity-30 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-slate-900" /> 
      : <ChevronDown size={14} className="text-slate-900" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-6rem)] flex flex-col">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventario</h2>
          <p className="text-slate-500 text-sm">Gestión de mercancía, entradas y costos</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Stock Actual
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Historial de Entradas
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'stock' && (
            <>
              <input type="file" id="excel-upload" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xlsm" />
              <button onClick={() => document.getElementById('excel-upload').click()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all active:scale-95">
                <UploadCloud size={16} className="text-blue-600" /> Importar Excel
              </button>
            </>
          )}

          <button onClick={fetchInventory} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'stock' ? (
          <>
            {/* Barra de Búsqueda Global */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar por REF, Producto, Categoría..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            {/* Tabla de Productos con Sorting */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left relative">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-sm">
                    <tr>
                      {[
                        { label: 'REF', key: 'ref' }, { label: 'Producto', key: 'name' }, { label: 'Subcategoría', key: 'subcategory' },
                        { label: 'Categoría', key: 'category' }, { label: 'Costo Unit.', key: 'my_cost' }, { label: 'P. Venta', key: 'price_sale' },
                        { label: 'Stock', key: 'stock' }
                      ].map((col) => (
                        <th key={col.key} onClick={() => handleSort(col.key)}
                          className="px-6 py-4 text-xs font-bold text-slate-400 uppercase cursor-pointer hover:bg-slate-100 transition-colors group">
                          <div className="flex items-center gap-2">{col.label} <SortIcon columnKey={col.key} /></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedProducts.length > 0 ? (
                      filteredAndSortedProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-mono text-slate-600 font-medium whitespace-nowrap">{p.ref}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">{p.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{p.subcategory || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-400 italic">{p.category}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">${fmt(p.my_cost)}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600">${fmt(p.price_sale)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                p.stock <= 0 ? 'bg-rose-100 text-rose-600' : p.stock < 5 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>{p.stock} un.</span>
                              {p.stock < 3 && <AlertCircle size={14} className="text-rose-500" />}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-10 text-center text-slate-400">
                          <Package className="mx-auto mb-2 opacity-20" size={40} />
                          No se encontraron productos que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <AssetValuationCard products={products} />
          </>
        ) : (
          <HistoryTab inventory={products} reloadInventory={fetchInventory} />
        )}
      </div>
    </div>
  );
}

// ─── TAB HISTORIAL DE ENTRADAS & RESTOCK ─────────────────────────────────────────
function HistoryTab({ inventory, reloadInventory }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  
  // Filtros de Historial
  const [filterType, setFilterType] = useState('dia'); // dia, semana, mes, todo, range
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Restock Form
  const [qtyIn, setQtyIn] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newPriceSale, setNewPriceSale] = useState('');
  const [provider, setProvider] = useState('');
  const [paidFromCash, setPaidFromCash] = useState(false);
  const [isStocking, setIsStocking] = useState(false);
  const [stockMsg, setStockMsg] = useState('');

  // History
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const kws = term.split(' ');
    return inventory.filter(p => {
       const c = `${p.ref} ${p.name || ''}`.toLowerCase();
       return kws.every(k => c.includes(k));
    }).slice(0, 50);
  }, [search, inventory]);

  const loadHistory = useCallback(async (productId = null) => {
    setIsLoadingHistory(true);
    try {
      let url = `http://localhost:8000/products/entries?filter_type=${filterType}`;
      if (productId) url += `&product_id=${productId}`;
      if (filterType === 'range' && dateRange.start && dateRange.end) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }

      const res = await fetch(url, {
         headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Error al cargar historial');
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
    finally { setIsLoadingHistory(false); }
  }, [filterType, dateRange]);

  useEffect(() => {
    loadHistory(selected?.id);
  }, [selected, loadHistory]);

  const selectProduct = (p) => {
    setSelected(p);
    setQtyIn(''); setNewCost(''); setNewPriceSale('');
    setProvider(''); setPaidFromCash(false);
    setStockMsg('');
  };

  const handleRestock = async () => {
    if (!selected || !qtyIn || !newCost) return;
    setIsStocking(true);
    try {
      const res = await fetch('http://localhost:8000/products/entries', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: selected.id, 
          quantity: Number(qtyIn),
          unit_cost: Number(newCost),
          provider: provider || 'S/P',
          paid_from_cash: paidFromCash,
          new_price_sale: newPriceSale ? Number(newPriceSale) : null,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      
      reloadInventory();
      loadHistory(selected.id);
      
      setStockMsg(`✓ Ingreso Exitoso Registrado`);
      setQtyIn(''); setNewCost(''); setNewPriceSale(''); setProvider(''); setPaidFromCash(false);
      
      const data = await res.json();
      if (data && data.stock) {
          setSelected(prev => ({...prev, stock: data.stock, my_cost: data.my_cost, price_sale: data.price_sale || prev.price_sale }));
      }
      setTimeout(() => setStockMsg(''), 4000);
    } catch (e) { alert(e.message); }
    finally { setIsStocking(false); }
  };

  const handleCancelEntry = async (entryId) => {
    if (!window.confirm('¿Seguro que deseas anular esta entrada? Se restará el stock y se revertirá el pago en caja si aplica.')) return;
    try {
      const res = await fetch(`http://localhost:8000/products/entries/${entryId}/cancel`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      setStockMsg('✓ Entrada Anulada Correctamente');
      reloadInventory();
      loadHistory(selected?.id);
      
      const cancelled = history.find(h => h.id === entryId);
      if (cancelled && selected && selected.id === cancelled.product_id) {
          setSelected(prev => ({...prev, stock: prev.stock - cancelled.quantity}));
      }
      setTimeout(() => setStockMsg(''), 4000);
    } catch(e) { alert(e.message); }
  };

  const weightedPreview = (() => {
    if (!selected || !qtyIn || !newCost) return null;
    const sa = (selected.stock || 0);
    const ca = (selected.my_cost || 0);
    const qi = Number(qtyIn);
    const nc = Number(newCost);
    if (qi <= 0 || nc <= 0) return null;
    return (sa * ca + qi * nc) / (sa + qi);
  })();

  const goToProduct = (pName) => {
    // Intentar extraer la REF si viene como "REF - Nombre"
    let searchPart = pName;
    if (pName.includes(' - ')) searchPart = pName.split(' - ')[0];
    
    const found = inventory.find(p => p.ref === searchPart || p.name === pName);
    if (found) {
        selectProduct(found);
        setSearch(''); // Limpiar búsqueda lateral
    } else {
        // Si no se encuentra exacto, ponemos el nombre en el buscador
        setSearch(searchPart);
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
        {/* Lado izquierdo: Búsqueda y Selección */}
        <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-sm">Buscar Producto</h3>
                {selected && (
                    <button onClick={() => setSelected(null)} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 transition-colors">
                        Ver Todo el Historial
                    </button>
                )}
            </div>
            <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl outline-none text-sm font-semibold text-slate-700 border focus:border-indigo-400 focus:bg-white transition-all"
                    placeholder="Referencia o Nombre..."
                    value={search} onChange={e => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filtered.length === 0 && search.length > 0 && <p className="text-center text-xs text-slate-400 py-4">No hay resultados</p>}
                {filtered.length === 0 && search.length === 0 && (
                    <div className="text-center py-8 opacity-50">
                        <Package size={32} className="mx-auto text-slate-300 mb-2"/>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mostrando vista global</p>
                        <p className="text-[9px] text-slate-400 mt-1">Selecciona un producto a la izquierda <br/> para registrar una nueva entrada.</p>
                    </div>
                )}
                
                {filtered.map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                        className={`p-3 rounded-xl border border-slate-100 cursor-pointer transition-all ${selected?.id === p.id ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'bg-slate-50 hover:bg-white hover:border-slate-200'}`}>
                        <p className="font-bold text-xs text-slate-800 truncate">{p.name}</p>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{p.ref}</p>
                            <p className="text-[10px] font-black text-slate-700">{p.stock} uds | ${fmt(p.my_cost)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Lado derecho: Formulario e Historial */}
        <div className="w-2/3 flex flex-col bg-slate-50 border border-slate-200 rounded-2xl shadow-sm p-6 overflow-y-auto custom-scrollbar">
            
            <div className="max-w-4xl mx-auto w-full space-y-6">
                
                {selected ? (
                    <>
                        {/* Cabecera del Producto */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                                            <RotateCcw size={16} />
                                        </button>
                                        <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 mt-1 ml-9">
                                        <span className="bg-slate-100 px-2 rounded">{selected.ref}</span>
                                        <span>{selected.category}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Stock Actual</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none">{selected.stock}</p>
                                </div>
                            </div>
                        </div>

                        {stockMsg && (
                            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-3 rounded-xl font-bold text-sm uppercase flex items-center gap-2">
                                <CheckCircle2 size={16} /> {stockMsg}
                            </div>
                        )}

                        {/* Formulario Nueva Entrada */}
                        <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                            <h3 className="font-black text-indigo-800 text-sm uppercase mb-4 tracking-wider flex items-center gap-2">
                                <Package size={16} /> Nueva Entrada de Mercancía
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cantidad</label>
                                    <input type="number" placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    value={qtyIn} onChange={e => setQtyIn(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Costo Unitario Compra</label>
                                    <input type="number" placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    value={newCost} onChange={e => setNewCost(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4 items-end">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Proveedor / Nota</label>
                                    <input placeholder="Ej. Mayorista X..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-semibold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    value={provider} onChange={e => setProvider(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-3 h-[46px] px-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-400 transition-colors shadow-sm" onClick={() => setPaidFromCash(!paidFromCash)}>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${paidFromCash ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                        {paidFromCash && <CheckCircle2 size={12} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs font-bold uppercase select-none ${paidFromCash ? 'text-indigo-800' : 'text-slate-500'}`}>¿Pagado con Caja?</span>
                                </div>
                            </div>
                            {weightedPreview && (
                                <div className="bg-indigo-50/50 rounded-xl p-4 mb-4 border border-indigo-100 flex justify-between items-center">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Ponderado Estimado:</p>
                                    <p className="text-2xl font-black text-indigo-700">${fmt(Math.round(weightedPreview))}</p>
                                </div>
                            )}
                            <button disabled={!qtyIn || !newCost || isStocking} onClick={handleRestock}
                                className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-black text-sm uppercase hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                {isStocking ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />} 
                                {isStocking ? 'Procesando...' : 'Registrar Entrada'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-lg relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                         <h2 className="text-2xl font-black uppercase tracking-tight">Historial de Mercancía</h2>
                         <p className="text-indigo-100 text-sm font-medium">Control global de ingresos, costos y proveedores.</p>
                    </div>
                )}

                {/* Listado de Entradas (Global o Local) */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-1">
                        <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2">
                            <History size={16} className="text-slate-500" /> {selected ? 'Entradas de este Producto' : 'Últimas Entradas Globales'}
                        </h3>
                        
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} 
                                className="bg-transparent text-[10px] font-black uppercase text-slate-600 outline-none px-2 py-1 cursor-pointer">
                                <option value="dia">Hoy</option>
                                <option value="semana">Semana</option>
                                <option value="mes">Mes</option>
                                <option value="todo">Todo</option>
                                <option value="range">Rango...</option>
                            </select>
                            {filterType === 'range' && (
                                <div className="flex items-center gap-1 border-l pl-2 border-slate-100">
                                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="text-[9px] font-bold outline-none bg-slate-50 rounded p-1" />
                                    <span className="text-slate-300">-</span>
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="text-[9px] font-bold outline-none bg-slate-50 rounded p-1" />
                                </div>
                            )}
                            <button onClick={() => loadHistory(selected?.id)} className="p-1.5 hover:bg-slate-50 rounded-lg text-indigo-500 transition-colors">
                                <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                        {isLoadingHistory ? (
                             <div className="p-20 text-center"><RefreshCw size={40} className="animate-spin mx-auto text-slate-200 mb-4"/><p className="text-slate-400 font-bold uppercase text-xs">Cargando Historial...</p></div>
                        ) : history.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase">Detalle y Producto</th>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Cant.</th>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">Costo Unit.</th>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map(h => (
                                        <tr key={h.id} className={`hover:bg-slate-50 transition-colors group ${h.is_cancelled ? 'opacity-40 grayscale italic' : ''}`}>
                                            <td className="px-5 py-4">
                                                <p className="font-bold text-slate-800 text-sm">{fmtDateTime(h.created_at)}</p>
                                                {!selected ? (
                                                    <button onClick={() => goToProduct(h.product_name)} 
                                                        className="text-[10px] text-indigo-600 font-bold uppercase mt-1 hover:underline flex items-center gap-1">
                                                        <Package size={10} /> {h.product_name}
                                                    </button>
                                                ) : (
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
                                                        <Truck size={10} /> {h.provider || 'Sin Proveedor'}
                                                    </p>
                                                )}
                                                {!selected && h.provider && h.provider !== 'S/P' && (
                                                     <p className="text-[9px] text-slate-400 font-medium mt-0.5 italic">Prov: {h.provider}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black ${h.is_cancelled ? 'bg-slate-100 text-slate-400 line-through' : 'bg-indigo-50 text-indigo-700'}`}>
                                                    +{h.quantity}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <p className="font-bold text-slate-800">${fmt(h.unit_cost)}</p>
                                                {h.paid_from_cash && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-black uppercase ml-1">Caja</span>}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {!h.is_cancelled ? (
                                                    <button onClick={() => handleCancelEntry(h.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Anulado</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-16 text-center">
                                <History size={48} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay movimientos en este periodo</p>
                                <p className="text-xs text-slate-400 mt-2">Prueba cambiando el filtro de tiempo o registrando una entrada.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}