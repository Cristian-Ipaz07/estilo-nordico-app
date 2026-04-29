import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search, ShoppingCart, Trash2, X, User, Calendar, Tag,
  AlertCircle, CheckCircle2, Package, DollarSign, Clock,
  Plus, ChevronRight, ArrowRight, RefreshCw, Edit2, Save,
  History, Truck, RotateCcw
} from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// Helper para fecha hoy en Colombia (YYYY-MM-DD)
const getTodayCO = () => {
  const d = new Date();
  // Ajuste manual si el servidor está en UTC
  const co = new Date(d.getTime() - (5 * 60 * 60 * 1000)); 
  return co.toISOString().split('T')[0];
};

// Formatting date and time (AM/PM)
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { 
    day: '2-digit', 
    month: '2-digit', 
    year: '2-digit',
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

function useStickyState(defaultValue, key) {
  const [value, setValue] = useState(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

function useInventory(isOpen) {
  const [inventory, setInventory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    fetch('http://localhost:8000/products/', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => setInventory(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setTimeout(() => setRefreshing(false), 600));
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  // Escuchar restock desde cualquier módulo
  useEffect(() => {
    window.addEventListener('refresh-inventory', load);
    return () => window.removeEventListener('refresh-inventory', load);
  }, [load]);

  return { inventory, reloadInventory: load, refreshing };
}

// ─── MÓDULO VENTAS ────────────────────────────────────────────────────────────
function ModuloVentas({ inventory, reloadInventory, refreshing }) {
  const [search, setSearch] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [cart, setCart] = useStickyState([], 'en_terminal_cart');
  const [customer, setCustomer] = useStickyState('CLIENTE FINAL', 'en_terminal_customer');
const { user } = useAuth();
  const [sellers, setSellers] = useState([]);
  const [vendedorId, setVendedorId] = useStickyState(user?.id || '', 'en_terminal_vendedor');

  useEffect(() => {
    if (user && !vendedorId) setVendedorId(user.id);
  }, [user]);

  useEffect(() => {
    fetch('http://localhost:8000/users/', {
       headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) {
         setSellers(data.filter(u => u.status === 'Activo'));
      }
    })
    .catch(console.error);
  }, []);
  const [amountPaid, setAmountPaid] = useState(0);
  const [saleDate, setSaleDate] = useState(getTodayCO());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (!term) { setFilteredResults([]); return; }
    const kws = term.split(' ');
    setFilteredResults(inventory.filter(item => {
      const content = `${item.ref} ${item.name || item.producto || ''} ${item.category} ${item.subcategory}`.toLowerCase();
      return kws.every(k => content.includes(k));
    }));
  }, [search, inventory]);

  useEffect(() => {
    const fn = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setFilteredResults([]);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const addToCart = (p) => {
    const fixedPrice = p.price_sale || p.p_venta || 0;
    const existing = cart.find(i => i.id === p.id);
    if (existing) {
      setCart(cart.map(i => i.id === p.id
        ? { ...i, qty: i.qty + 1, total_item: (i.qty + 1) * i.original_price } : i));
    } else {
      setCart([...cart, { ...p, qty: 1, p_lista_real: fixedPrice, original_price: fixedPrice, total_item: fixedPrice }]);
    }
    setSearch(''); setFilteredResults([]);
  };

  const updateCart = (id, field, value) => {
    setCart(cart.map(item => {
      if (item.id !== id) return item;
      const u = { ...item, [field]: Number(value) };
      if (field === 'qty' || field === 'original_price') u.total_item = u.qty * u.original_price;
      return u;
    }));
  };

  const updateRowTotal = (id, val) =>
    setCart(cart.map(i => i.id === id ? { ...i, total_item: Number(val) } : i));

  const totalVenta = cart.reduce((a, i) => a + (i.total_item || 0), 0);
  const hasStockError = cart.some(i => i.qty < 1 || i.stock <= 0 || i.qty > i.stock);

  useEffect(() => { setAmountPaid(totalVenta); }, [totalVenta]);

  const handleFinalizar = async () => {
    if (cart.length === 0 || hasStockError || isSubmitting) return;
    setIsSubmitting(true);
    const payload = {
      customer_name: customer, 
      sale_channel: "LOCAL",
      user_id: Number(vendedorId),
      created_by: user.id,
      amount_paid: Number(amountPaid), sale_date: saleDate,
      items: cart.map(i => ({
        product_id: i.id, quantity: i.qty,
        original_price: i.original_price, total_item: i.total_item,
      })),
    };
    try {
      const res = await fetch('http://localhost:8000/sales/', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error'); }
      const isSep = Number(amountPaid) < totalVenta;
      setSuccessMsg(isSep ? '¡Separado registrado!' : '¡Venta finalizada!');
      setTimeout(() => setSuccessMsg(''), 3000);
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      reloadInventory();
      setCart([]); setCustomer('CLIENTE FINAL'); setVendedorId(user?.id || ''); setAmountPaid(0);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden relative">
      {refreshing && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-emerald-200 z-10 animate-pulse">
          <RefreshCw size={11} className="animate-spin" /> Sincronizando stock...
        </div>
      )}

      <div className="grid grid-cols-12 gap-3 mb-4">
        <div className="col-span-7 relative" ref={searchRef}>
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            autoFocus
            className="w-full pl-14 pr-6 py-4 bg-slate-100 rounded-[22px] outline-none font-bold text-slate-700 text-base border-2 border-transparent focus:border-emerald-500 transition-all"
            placeholder="Buscar producto: ref, nombre, categoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {filteredResults.length > 0 && (
            <div className="absolute z-[110] w-full bg-white shadow-2xl rounded-2xl mt-2 border border-slate-100 max-h-72 overflow-auto py-2">
              {filteredResults.map(p => (
                <div key={p.id} onClick={() => addToCart(p)}
                   className="px-5 py-3 hover:bg-emerald-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-black text-xs uppercase text-slate-800">
                      {p.name || p.producto} <span className="text-emerald-500">[{p.ref}]</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {p.category} • {p.subcategory} | Stock: {p.stock}
                    </p>
                  </div>
                  <p className="font-black text-sm text-slate-900">${fmt(p.price_sale || p.p_venta || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-5 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 border rounded-[20px] px-4">
            <Calendar size={16} className="text-slate-400 flex-shrink-0" />
            <input type="date" className="bg-transparent text-[11px] font-black outline-none w-full text-slate-600"
              value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          </div>
          <div className="flex-1 flex items-center gap-2 bg-slate-50 border rounded-[20px] px-4">
            <Tag size={16} className="text-slate-400 flex-shrink-0" />
            <select className="bg-transparent text-[10px] font-black outline-none w-full text-slate-600 uppercase"
              value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
              {sellers.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla carrito */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="pb-3 pl-4 text-left w-[35%]">Producto</th>
              <th className="pb-3 text-center">Stock</th>
              <th className="pb-3 text-center">Cant.</th>
              <th className="pb-3 text-center">P. Lista</th>
              <th className="pb-3 text-center text-emerald-600">Total Fila</th>
              <th className="pb-3 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => {
              const inventoryTotal = item.qty * item.p_lista_real;
              const hasDiscount = item.total_item < inventoryTotal;
              return (
                <tr key={item.id} className={`${item.stock <= 0 || item.qty > item.stock ? 'bg-rose-50' : 'bg-white'} border rounded-2xl shadow-sm`}>
                  <td className="py-3 pl-4 rounded-l-2xl border-y border-l">
                    <span className="font-black text-[11px] uppercase text-slate-800">{item.name || item.producto}</span>
                    <p className="text-[9px] text-slate-400 font-bold uppercase italic">{item.category} • {item.subcategory} ({item.ref})</p>
                  </td>
                  <td className={`py-3 text-center border-y font-black text-xs ${item.stock <= 0 ? 'text-rose-500' : 'text-slate-400'}`}>{item.stock}</td>
                  <td className="py-3 border-y text-center">
                    <input type="number" min="1" className="w-14 bg-slate-100 rounded-xl py-2 text-center font-black text-xs outline-none"
                      value={item.qty} onChange={e => updateCart(item.id, 'qty', e.target.value)} />
                  </td>
                  <td className="py-3 border-y text-center">
                    <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                      <span className="text-[10px] font-black text-slate-400 mr-1">$</span>
                      <input type="number" className="w-20 bg-transparent text-right font-bold text-xs outline-none text-slate-500"
                        value={item.original_price} onChange={e => updateCart(item.id, 'original_price', e.target.value)} />
                    </div>
                  </td>
                  <td className="py-3 border-y text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className={`inline-flex items-center rounded-xl px-3 py-1.5 border-2 ${hasDiscount ? 'border-emerald-400 bg-emerald-50' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[10px] font-black text-slate-400 mr-1">$</span>
                        <input type="number" min="0" className="w-24 bg-transparent text-right font-black text-sm outline-none text-slate-900"
                          value={item.total_item} onChange={e => updateRowTotal(item.id, e.target.value)} />
                      </div>
                      {hasDiscount && (
                        <span className="text-[9px] text-slate-400 line-through">${fmt(inventoryTotal)}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 rounded-r-2xl border-y border-r">
                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                      className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Ventas */}
      <div className="pt-4 border-t mt-2">
        {successMsg && (
          <div className="flex items-center gap-2 justify-center mb-3 bg-emerald-50 text-emerald-700 font-black text-xs p-2 rounded-xl uppercase">
            <CheckCircle2 size={14} /> {successMsg}
          </div>
        )}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 bg-slate-900 p-5 rounded-[30px] text-white flex flex-col justify-center">
            <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest mb-1 text-center">Total Venta</p>
            <p className="text-2xl font-black italic text-center">${fmt(totalVenta)}</p>
          </div>
          <div className="col-span-5 bg-emerald-50 border-2 border-emerald-100 p-5 rounded-[30px] flex flex-col justify-center">
            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 text-center">Abono Recibido</p>
            <div className="flex items-center justify-center text-3xl font-black text-emerald-700">
              <span className="mr-2 opacity-30 text-xl">$</span>
              <input type="number" className="bg-transparent outline-none w-full text-center"
                value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} />
            </div>
          </div>
          <div className="col-span-4 flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-slate-100 px-5 py-3 rounded-2xl border">
              <User size={18} className="text-slate-400" />
              <input placeholder="Nombre Cliente" className="bg-transparent font-bold text-xs outline-none w-full uppercase"
                value={customer} onChange={e => setCustomer(e.target.value)} />
            </div>
            <button disabled={cart.length === 0 || hasStockError || isSubmitting} onClick={handleFinalizar}
              className="flex-1 bg-slate-900 text-white rounded-[22px] font-black text-sm hover:bg-black transition-all disabled:opacity-20 flex items-center justify-center gap-2 uppercase tracking-tighter">
              {isSubmitting ? 'Guardando...' : amountPaid < totalVenta ? 'Registrar Separado' : 'Finalizar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO SEPARADOS ─────────────────────────────────────────────────────────
function ModuloSeparados() {
  const [separados, setSeparados] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useStickyState(null, 'en_terminal_selected_layaway');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [abonoDate, setAbonoDate] = useState(getTodayCO());



  const loadSeparados = useCallback(() => {
    fetch('http://localhost:8000/sales/', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => setSeparados(Array.isArray(d) ? d.filter(s => s.balance_due > 0) : []))
      .catch(console.error);
  }, []);

  useEffect(() => { loadSeparados(); }, [loadSeparados]);

  useEffect(() => {
    window.addEventListener('refresh-sales', loadSeparados);
    return () => window.removeEventListener('refresh-sales', loadSeparados);
  }, [loadSeparados]);

  const filtered = separados.filter(s => {
    const q = search.toLowerCase();
    return !q || s.customer_name?.toLowerCase().includes(q) || String(s.id).includes(q);
  });

  const handleAbono = async () => {
    if (!selected || !abonoAmount || Number(abonoAmount) <= 0) return;
    setIsSaving(true);
    try {
      // Si la fecha seleccionada es hoy, no enviamos payment_date para que el backend 
      // use el valor por defecto que incluye hora y minutos reales.
      const isToday = abonoDate === getTodayCO();
      const dateParam = isToday ? '' : `&payment_date=${abonoDate}`;
      
      const res = await fetch(`http://localhost:8000/sales/${selected.id}/payment?amount=${Number(abonoAmount)}${dateParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) throw new Error('Error al registrar abono');
      setMsg('¡Abono registrado!');
      setAbonoAmount('');
      loadSeparados();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      // No cerramos selección, actualizamos para ver el historial
      fetch(`http://localhost:8000/sales/${selected.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(r => r.json())
        .then(setSelected)
        .catch(console.error);
      
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert(e.message); }
    finally { setIsSaving(false); }
  };


  const handleCancelar = async () => {
    if (!selected) return;
    if (!window.confirm(`¿Cancelar separado #${selected.id}? Se restituirá el stock.`)) return;
    await fetch(`http://localhost:8000/sales/${selected.id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    setSelected(null);
    loadSeparados();
    window.dispatchEvent(new CustomEvent('refresh-sales'));
    window.dispatchEvent(new CustomEvent('refresh-inventory')); // Refresh stock lists
  };

  return (
    <div className="flex h-full gap-4 p-6 overflow-hidden">
      {/* Lista de separados */}
      <div className="w-[55%] flex flex-col">
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="w-full pl-11 pr-4 py-3 bg-slate-100 rounded-2xl outline-none text-sm font-bold text-slate-700 border-2 border-transparent focus:border-amber-400 transition-all"
            placeholder="Buscar cliente o ID..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-slate-300 text-sm italic">
              {search ? 'Sin resultados' : '¡No hay separados pendientes!'}
            </div>
          )}
          {filtered.map(s => (
            <div key={s.id} onClick={() => setSelected(s)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selected?.id === s.id ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black text-sm text-slate-900">{s.customer_name || 'Sin nombre'}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">#{s.id} · {s.seller || 'LOCAL'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm text-rose-600">${fmt(s.balance_due)}</p>
                  <p className="text-[9px] text-slate-400">saldo pendiente</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">Total: ${fmt(s.total_sale)}</span>
                <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase">Abonado: ${fmt(s.amount_paid)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de acción Separados */}
      <div className="w-[45%] flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
            <Clock size={40} strokeWidth={1.5} />
            <p className="text-xs font-bold text-center italic">Selecciona un separado<br />para registrar un abono</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
            <div className="bg-slate-50 rounded-2xl p-4 border shrink-0">
              <p className="text-xs font-black text-slate-800 uppercase">{selected.customer_name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-3">Separado #{selected.id}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold">Total venta</span>
                  <span className="font-black text-slate-800">${fmt(selected.total_sale)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold">Abonado</span>
                  <span className="font-black text-emerald-600">${fmt(selected.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-rose-500 font-bold">Saldo pendiente</span>
                  <span className="font-black text-rose-600">${fmt(selected.balance_due)}</span>
                </div>
              </div>
            </div>

            {/* Historial de Abonos */}
            {selected.payment_history && selected.payment_history.length > 0 && (
              <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-3 max-h-32 overflow-y-auto">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <DollarSign size={10} /> Historial de Abonos
                </p>
                <div className="space-y-1">
                  {selected.payment_history.map(p => (
                    <div key={p.id} className="flex justify-between items-center text-[10px] border-b border-emerald-100/50 last:border-0 py-1">
                      <span className="text-slate-500 font-bold">{fmtDateTime(p.payment_date)}</span>
                      <span className="font-black text-emerald-700">${fmt(p.amount)}</span>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {selected.items && selected.items.length > 0 && (
              <div className="bg-white rounded-2xl border p-3 max-h-32 overflow-y-auto">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Productos</p>
                {selected.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-[11px] font-bold text-slate-700">{item.product?.name || `ID ${item.product_id}`}</p>
                      <p className="text-[9px] text-slate-400 uppercase">{item.product?.category} · x{item.quantity}</p>
                    </div>
                    <span className="text-xs font-black text-slate-900">${fmt(item.total_item)}</span>
                  </div>
                ))}
              </div>
            )}


            {msg && <div className="text-center text-emerald-700 font-black text-xs bg-emerald-50 p-2 rounded-xl uppercase">
              <CheckCircle2 size={14} className="inline mr-2" />{msg}
            </div>}

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Valor del abono</p>
                <div className="flex items-center bg-emerald-50 border-2 border-emerald-300 rounded-2xl px-4 py-3 h-[52px]">
                  <span className="text-emerald-500 font-black mr-2">$</span>
                  <input type="number" className="bg-transparent outline-none w-full font-black text-xl text-emerald-700"
                    placeholder="0" value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} />
                </div>
              </div>
              <div className="col-span-4">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Fecha</p>
                <div className="flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-2 h-[52px]">
                  <input type="date" className="bg-transparent outline-none w-full font-black text-[10px] text-slate-600"
                    value={abonoDate} onChange={e => setAbonoDate(e.target.value)} />
                </div>
              </div>
            </div>

            <button disabled={!abonoAmount || Number(abonoAmount) <= 0 || isSaving} onClick={handleAbono}
              className="w-full bg-slate-900 text-white rounded-2xl py-3 font-black text-sm hover:bg-black transition-all disabled:opacity-20 uppercase">
              {isSaving 
                ? 'Registrando...' 
                : Number(abonoAmount) >= selected.balance_due && Number(abonoAmount) > 0
                  ? `✓ Finalizar Pago $${fmt(Number(abonoAmount))}`
                  : `Abonar $${fmt(Number(abonoAmount || 0))}`}
            </button>

            <button onClick={handleCancelar}
              className="w-full border-2 border-rose-200 text-rose-500 rounded-2xl py-2.5 font-black text-[11px] hover:bg-rose-50 transition-all uppercase">
              Cancelar separado (restituir stock)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MÓDULO STOCK ──────────────────────────────────────────────────────────────
function ModuloStock({ inventory, reloadInventory }) {
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qtyIn, setQtyIn] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newPriceSale, setNewPriceSale] = useState('');
  const [provider, setProvider] = useState('');
  const [paidFromCash, setPaidFromCash] = useState(false);
  const [isStocking, setIsStocking] = useState(false);
  const [stockMsg, setStockMsg] = useState('');
  
  // Edición rápida inline
  const [editCost, setEditCost] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Creación express
  const [showCreate, setShowCreate] = useState(false);
  const [newProd, setNewProd] = useStickyState({ ref: '', name: '', category: '', subcategory: '', stock: '', my_cost: '', price_sale: '' }, 'en_terminal_express_prod');
  const [refError, setRefError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Cálculo ponderado en tiempo real
  const weightedPreview = (() => {
    if (!selected || !qtyIn || !newCost) return null;
    const sa = selected.stock || 0;
    const ca = selected.my_cost || 0;
    const qi = Number(qtyIn);
    const nc = Number(newCost);
    if (qi <= 0 || nc <= 0) return null;
    return (sa * ca + qi * nc) / (sa + qi);
  })();

  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (!term) { setFiltered([]); return; }
    const kws = term.split(' ');
    setFiltered(inventory.filter(p => {
       const c = `${p.ref} ${p.name || ''}`.toLowerCase();
       return kws.every(k => c.includes(k));
    }).slice(0, 15));
  }, [search, inventory]);

  const selectProduct = (p) => {
    setSelected(p);
    setEditCost(p.my_cost || '');
    setEditPrice(p.price_sale || '');
    setQtyIn(''); setNewCost(''); setNewPriceSale('');
    setProvider(''); setPaidFromCash(false);
    setStockMsg('');
  };

  const handleSavePrice = async () => {
    if (!selected) return;
    setIsSavingPrice(true);
    try {
      const params = new URLSearchParams();
      if (editPrice !== '') params.append('price_sale', editPrice);
      if (editCost !== '') params.append('my_cost', editCost);
      const res = await fetch(`http://localhost:8000/products/${selected.id}/price?${params}`, { 
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setSelected(prev => ({ ...prev, price_sale: Number(editPrice), my_cost: Number(editCost) }));
      reloadInventory();
      window.dispatchEvent(new CustomEvent('refresh-inventory'));
      setStockMsg('Precios actualizados');
      setTimeout(() => setStockMsg(''), 2500);
    } catch (e) { alert(e.message); }
    finally { setIsSavingPrice(false); }
  };

  const handleCreateProduct = async () => {
    if (!newProd.ref || !newProd.name || !newProd.price_sale) {
      alert("Por favor completa los campos obligatorios (Referencia, Nombre, Precio)");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('http://localhost:8000/products/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...newProd,
          stock: Number(newProd.stock) || 0,
          my_cost: Number(newProd.my_cost) || 0,
          price_sale: Number(newProd.price_sale),
        }),
      });
      if (!res.ok) throw new Error('Error al crear producto');
      const data = await res.json();
      reloadInventory();
      window.dispatchEvent(new CustomEvent('refresh-inventory'));
      setStockMsg(`¡Producto ${data.name} creado!`);
      setShowCreate(false);
      setNewProd({ ref: '', name: '', category: '', subcategory: '', stock: '', my_cost: '', price_sale: '' });
      selectProduct(data);
    } catch (e) { alert(e.message); }
    finally { setIsCreating(false); }
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
      
      const data = await res.json();
      if (data && data.stock !== undefined) {
          setSelected(prev => ({ ...prev, stock: data.stock, my_cost: data.my_cost, price_sale: data.price_sale }));
          setEditCost(data.my_cost); setEditPrice(data.price_sale);
          setStockMsg(`✓ Ingreso Exitoso | Costo Pond: $${fmt(data.weighted_cost || data.my_cost)}`);
      } else {
          setStockMsg('✓ Ingreso Exitoso Registrado');
      }
      
      reloadInventory();
      window.dispatchEvent(new CustomEvent('refresh-inventory'));
      if (paidFromCash) window.dispatchEvent(new CustomEvent('refresh-sales'));
      
      setQtyIn(''); setNewCost(''); setNewPriceSale(''); setProvider(''); setPaidFromCash(false);
      setTimeout(() => setStockMsg(''), 4000);
    } catch (e) { alert(e.message); }
    finally { setIsStocking(false); }
  };

  return (
    <div className="flex h-full gap-4 p-6 overflow-hidden">
      <div className="w-[45%] flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div className="relative flex-1 mr-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="w-full pl-11 pr-4 py-3 bg-slate-100 rounded-2xl outline-none text-sm font-bold text-slate-700 border-2 border-transparent focus:border-indigo-400 transition-all"
              placeholder="Buscar por Referencia o Nombre..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => { setShowCreate(!showCreate); setSelected(null); }}
            className={`p-3 rounded-2xl border-2 transition-all ${showCreate ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'}`}>
            {showCreate ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filtered.map(p => (
            <div key={p.id} onClick={() => selectProduct(p)}
              className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${selected?.id === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-black text-[11px] uppercase text-slate-800 truncate w-40">{p.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{p.ref} • {p.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${p.stock <= 0 ? 'text-rose-500' : 'text-slate-700'}`}>{p.stock} uds</p>
                  <p className="text-[9px] text-slate-400">${fmt(p.price_sale)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-[55%] flex flex-col overflow-y-auto space-y-4">
        {showCreate ? (
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-[30px] p-6 shadow-sm flex flex-col gap-4">
            <p className="font-black text-indigo-700 uppercase tracking-widest text-center">Creación Express de Producto</p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Referencia (Obligatorio)" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.ref} onChange={e => setNewProd({...newProd, ref: e.target.value})} />
              <input placeholder="Nombre (Obligatorio)" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} />
              <input placeholder="Categoría" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value})} />
              <input placeholder="Subcategoría" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.subcategory} onChange={e => setNewProd({...newProd, subcategory: e.target.value})} />
              <input placeholder="Stock Inicial" type="number" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.stock} onChange={e => setNewProd({...newProd, stock: e.target.value})} />
              <input placeholder="Costo Unitario" type="number" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.my_cost} onChange={e => setNewProd({...newProd, my_cost: e.target.value})} />
              <div className="col-span-2">
                <input placeholder="Precio de Venta (Obligatorio)" type="number" className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 font-black text-lg text-emerald-800 text-center w-full"
                  value={newProd.price_sale} onChange={e => setNewProd({...newProd, price_sale: e.target.value})} />
              </div>
            </div>
            <button onClick={handleCreateProduct} disabled={isCreating}
              className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black uppercase text-sm hover:bg-indigo-700 transition-all shadow-lg">
              {isCreating ? 'Creando...' : 'Crear Producto e Ingresar'}
            </button>
          </div>
        ) : selected ? (
          <>
            {stockMsg && <div className="text-center text-emerald-700 font-black text-xs bg-emerald-50 p-2 rounded-xl uppercase animate-bounce"><CheckCircle2 size={12} className="inline mr-1"/>{stockMsg}</div>}
            
            <div className="bg-slate-900 text-white rounded-[25px] p-5 shadow-xl">
              <p className="font-black text-sm uppercase mb-1">{selected.name}</p>
              <p className="text-slate-400 text-[10px] font-bold uppercase">{selected.ref} • {selected.category}</p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-white/10 rounded-2xl p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Stock</p>
                  <p className={`text-2xl font-black ${selected.stock <= 3 ? 'text-amber-400' : 'text-white'}`}>{selected.stock}</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Costo</p>
                  <p className="text-lg font-black">${fmt(selected.my_cost)}</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Manual P. Venta</p>
                  <p className="text-lg font-black text-emerald-400">${fmt(selected.price_sale)}</p>
                </div>
              </div>
            </div>

            {/* Edición Rápida */}
            <div className="bg-slate-50 border rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Edición Rápida de Precios</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 font-black uppercase">Costo Actual</label>
                  <input type="number" className="w-full bg-white border rounded-xl px-3 py-2 mt-0.5 font-bold text-sm outline-none focus:border-indigo-300"
                    value={editCost} onChange={e => setEditCost(e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 font-black uppercase">Precio Venta</label>
                  <input type="number" className="w-full bg-white border rounded-xl px-3 py-2 mt-0.5 font-bold text-sm outline-none focus:border-indigo-300"
                    value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                </div>
              </div>
              <button onClick={handleSavePrice} disabled={isSavingPrice}
                className="mt-3 w-full bg-slate-800 text-white rounded-xl py-2 text-[10px] font-black hover:bg-black transition-all flex items-center justify-center gap-2">
                <Save size={12} /> {isSavingPrice ? 'Guardando...' : 'Actualizar Precios'}
              </button>
            </div>

            {/* Restock Ponderado */}
            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 relative overflow-hidden flex flex-col gap-3">
               <div className="absolute -top-4 -right-4 bg-indigo-200 w-16 h-16 rounded-full blur-2xl opacity-40"></div>
              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Ingresar Mercancía (Entrada)</p>
              
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Cant. Entrada" className="w-full bg-white border rounded-xl px-3 py-2 font-bold text-sm outline-none border-indigo-200 focus:border-indigo-500"
                  value={qtyIn} onChange={e => setQtyIn(e.target.value)} />
                <input type="number" placeholder="Costo Unit. Compra" className="w-full bg-white border rounded-xl px-3 py-2 font-bold text-sm outline-none border-indigo-200 focus:border-indigo-500"
                  value={newCost} onChange={e => setNewCost(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="relative">
                    <Truck size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" />
                    <input placeholder="Proveedor / Nota..." className="w-full bg-white border rounded-xl pl-8 pr-3 py-2 font-bold text-xs outline-none border-indigo-200 focus:border-indigo-500"
                    value={provider} onChange={e => setProvider(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 h-[34px] px-2 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-400 transition-colors" onClick={() => setPaidFromCash(!paidFromCash)}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${paidFromCash ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                        {paidFromCash && <CheckCircle2 size={10} className="text-white"/>}
                    </div>
                    <span className={`text-[9px] font-black uppercase ${paidFromCash ? 'text-indigo-700' : 'text-slate-400'}`}>¿Sale de Caja?</span>
                </div>
              </div>

              {weightedPreview && (
                <div className="bg-white/80 rounded-xl p-3 text-center border-2 border-dashed border-indigo-200">
                  <p className="text-[9px] font-black text-indigo-300 uppercase">Costo Promedio Ponderado Estimado</p>
                  <p className="text-xl font-black text-indigo-700 mt-0.5">${fmt(Math.round(weightedPreview))}</p>
                </div>
              )}

              <input type="number" placeholder="Ajustar Precio Venta (Opcional)" className="w-full bg-white border rounded-xl px-3 py-2 font-bold text-sm outline-none border-indigo-200"
                  value={newPriceSale} onChange={e => setNewPriceSale(e.target.value)} />
              
              <button disabled={!qtyIn || !newCost || isStocking} onClick={handleRestock}
                className="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-black text-xs uppercase hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-1">
                {isStocking ? <RefreshCw className="animate-spin" size={14} /> : <ArrowRight size={14} />} 
                {isStocking ? 'Procesando Entrada...' : 'Registrar Entrada de Stock'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3 border-2 border-dashed border-slate-100 rounded-[35px]">
            <Package size={40} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase text-center tracking-widest">Selecciona un producto<br />o usa el botón (+) para crear uno nuevo</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── MÓDULO CAJA ──────────────────────────────────────────────────────────────
function ModuloCaja() {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('SALIDA');
  const [category, setCategory] = useState('GASTO');
  const [date, setDate] = useState(getTodayCO());
  const [movements, setMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = useCallback(() => {
    setIsLoading(true);
    Promise.all([
      fetch('http://localhost:8000/sales/', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
      fetch('http://localhost:8000/cash/', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json())
    ]).then(([sData, cData]) => {
      setSales(Array.isArray(sData) ? sData : []);
      setMovements(Array.isArray(cData) ? cData : []);
    }).catch(console.error)
    .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('refresh-sales', loadData);
    return () => window.removeEventListener('refresh-sales', loadData);
  }, [loadData]);

  const isToday = (dateField) => {
    if (!dateField) return false;
    // Si la fecha viene de la DB sin 'Z', el navegador la asume local. 
    // Forzamos 'Z' para que sepa que es UTC y la convierta correctamente a Bogotá.
    let dStr = dateField;
    if (typeof dStr === 'string' && !dStr.includes('Z') && !dStr.includes('+')) {
      dStr += 'Z';
    }
    
    const d = new Date(dStr);
    const co = d.toLocaleString("en-US", {timeZone: "America/Bogota", year: 'numeric', month: 'numeric', day: 'numeric'});
    const now = new Date().toLocaleString("en-US", {timeZone: "America/Bogota", year: 'numeric', month: 'numeric', day: 'numeric'});
    
    return co === now;
  };

  const toDate = (dateField) => {
    let dStr = dateField;
    if (typeof dStr === 'string' && !dStr.includes('Z') && !dStr.includes('+')) dStr += 'Z';
    return new Date(dStr);
  };

  const todayFlowRaw = [];
  movements.forEach(m => {
    const mDate = m.payment_date ? m.payment_date : m.created_at;
    let dStr = mDate;
    if (typeof dStr === 'string' && !dStr.includes('Z') && !dStr.includes('+')) dStr += 'Z';
    const mDay = new Date(dStr).toLocaleString("en-US", {timeZone: "America/Bogota", year: 'numeric', month: 'numeric', day: 'numeric'});
    const selectedDay = new Date(date + "T12:00:00Z").toLocaleString("en-US", {timeZone: "America/Bogota", year: 'numeric', month: 'numeric', day: 'numeric'});

    if(mDay === selectedDay) {
      todayFlowRaw.push({ id: `CSH-${m.id}`, desc: m.description, amount: m.amount, type: m.type, cat: m.category, date: mDate });
    }
  });

  // Identificar el último cierre del día para "limpiar" la pantalla
  const lastTodayClosure = [...todayFlowRaw]
    .filter(f => f.cat === 'CIERRE CAJA')
    .sort((a,b) => toDate(b.date) - toDate(a.date))[0];

  // Mostramos movimientos posteriores al cierre, o todos si no hay cierre
  // Usamos >= y excluimos por ID para no perder movimientos del mismo segundo
  const todayFlow = lastTodayClosure 
    ? todayFlowRaw.filter(f => toDate(f.date) >= toDate(lastTodayClosure.date) && f.id !== lastTodayClosure.id)
    : todayFlowRaw;

  todayFlow.sort((a,b) => toDate(b.date) - toDate(a.date));

  const totalIn = todayFlow.filter(e => e.type === 'ENTRADA').reduce((a,b) => a + b.amount, 0);
  const totalOut = todayFlow.filter(e => e.type === 'SALIDA').reduce((a,b) => a + b.amount, 0);
  const netCaja = totalIn - totalOut;

  const handleCierre = async () => {
    if (!window.confirm(`¿Seguro que quieres cerrar caja con este saldo neto? $${fmt(netCaja)}`)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/cash/', {
        method: 'POST', headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ description: `CIERRE DE CAJA ($${fmt(netCaja)})`, amount: 0, type: 'ENTRADA', category: 'CIERRE CAJA' })
      });
      if(!res.ok) throw new Error('Error al cerrar');
      setMsg('Caja cerrada con éxito. Flujo reiniciado.');
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch(e) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!desc || !amount) return;
    setIsSubmitting(true);
    try {
      const payload = { description: desc.toUpperCase(), amount: Number(amount), type, category };
      if (date !== getTodayCO()) payload.payment_date = date;
      const res = await fetch('http://localhost:8000/cash/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error('Error al registrar');
      setMsg('¡Movimiento agregado!');
      setDesc(''); setAmount('');
      loadData();
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex h-full gap-4 p-6 overflow-hidden">
      {/* List */}
      <div className="w-[55%] flex flex-col bg-slate-50 rounded-[30px] border shadow-sm p-4 relative">
        <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="font-black text-slate-800 text-sm uppercase">Flujo del {date === getTodayCO() ? 'Hoy' : date}</h3>
            {isLoading && <RefreshCw size={12} className="animate-spin text-slate-400" />}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
           {todayFlow.length === 0 && <p className="text-center text-slate-400 text-xs py-10 italic">Aún no hay movimientos en esta fecha</p>}
           {todayFlow.map((f, i) => (
             <div key={`${f.id}-${i}`} className="bg-white p-3 rounded-2xl border flex justify-between items-center shadow-sm">
               <div>
                 <p className="font-black text-xs text-slate-800 uppercase">{f.desc}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{fmtDateTime(f.date)} · {f.cat}</p>
               </div>
               <span className={`font-black text-sm ${f.type === 'ENTRADA' ? 'text-emerald-500' : 'text-rose-500'}`}>
                 {f.type === 'ENTRADA' ? '+' : '-'}${fmt(f.amount)}
               </span>
             </div>
           ))}
        </div>
        <div className="border-t pt-4 mt-2 px-2 flex justify-between items-end">
           <div>
             <p className="text-[10px] uppercase font-black text-slate-400">Neto Actual Caja</p>
             <p className="text-2xl font-black text-slate-800">${fmt(netCaja)}</p>
           </div>
           <button onClick={handleCierre} disabled={isSubmitting || netCaja <= 0}
             className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-black transition-all shadow-lg disabled:opacity-30">
             Cerrar Caja
           </button>
        </div>
      </div>

      {/* Form */}
      <div className="w-[45%] flex flex-col pt-2">
         <div className="flex justify-between items-center mb-4">
             <h3 className="font-black text-slate-800 text-lg uppercase">Registro Manual</h3>
             <button type="button" onClick={() => { setDesc('BASE DE CAJA'); setAmount(''); setType('ENTRADA'); setCategory('OTROS'); }}
               className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-black shadow-sm hover:bg-emerald-100 transition-colors">
               + Base Inicial
             </button>
         </div>
         <form onSubmit={handleSubmit} className="bg-white border rounded-[30px] p-6 shadow-sm space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Descripción</label>
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ej. Taxis, Cafés, Adelantos..."
                 className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-400 uppercase" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Monto</label>
              <div className="flex items-center border-2 border-slate-100 rounded-2xl px-4 py-3 bg-slate-50">
                <span className="font-black text-slate-400 mr-2">$</span>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"
                   className="w-full bg-transparent outline-none font-black text-lg text-slate-800" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                <select value={type} onChange={e=>setType(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl px-3 py-3 font-bold text-xs outline-none bg-white">
                  <option value="SALIDA">SALIDA</option>
                  <option value="ENTRADA">ENTRADA</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Categoría</label>
                <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl px-3 py-3 font-bold text-xs outline-none bg-white">
                  {type === 'SALIDA' ? (
                    <>
                      <option value="GASTO">GASTO</option>
                      <option value="SALARIO">SALARIO</option>
                      <option value="ADELANTO">ADELANTO</option>
                      <option value="DEVOLUCION">DEVOLUCION</option>
                      <option value="REINVERSION">REINVERSIÓN</option>
                      <option value="PRESTAMO">PRÉSTAMO</option>
                      <option value="OTRO">OTRO</option>
                    </>
                  ) : (
                    <>
                      <option value="GANANCIA">GANANCIA</option>
                      <option value="OTRA ENTRADA">OTRA ENTRADA</option>
                      <option value="PRESTAMO">PRÉSTAMO</option>
                      <option value="OTROS">OTROS</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl px-3 py-3 font-bold text-xs outline-none bg-white" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting || !desc || !amount}
              className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black uppercase text-xs hover:bg-indigo-700 shadow-lg disabled:opacity-30 transition-all mt-4">
              {isSubmitting ? 'Registrando...' : 'Agregar Al Flujo'}
            </button>
            {msg && <p className="text-center font-black text-[10px] uppercase text-emerald-600 mt-2">{msg}</p>}
         </form>
      </div>
    </div>
  );
}

// ─── TERMINAL MODAL PRINCIPAL ─────────────────────────────────────────────────
export default function TerminalModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('ventas');
  const inventoryData = useInventory(isOpen);
  const { inventory, reloadInventory, refreshing } = inventoryData;

  useEffect(() => {
    const fn = (e) => { 
      if (e.key === 'Escape' && isOpen) onClose(); 
      if (e.ctrlKey && e.key === 'k') {
         // Shortcut inside shortcut is handled by parent App.jsx, but let's be safe
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  // EL GUARD SIEMPRE VA DESPUÉS DE LOS HOOKS
  if (!isOpen) return null;

  const tabs = [
    { id: 'ventas', icon: <ShoppingCart size={20} />, label: 'VENTAS' },
    { id: 'separados', icon: <Clock size={20} />, label: 'SEPARADOS' },
    { id: 'stock', icon: <Package size={20} />, label: 'STOCK' },
    { id: 'caja', icon: <DollarSign size={20} />, label: 'DIARIO' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="bg-white w-[98vw] max-w-7xl h-[95vh] rounded-[40px] shadow-2xl flex overflow-hidden border border-white/20">

        {/* CONTENIDO MÓDULO */}
        <div className="flex-[4] flex flex-col bg-white overflow-hidden">
          {activeTab === 'ventas' && <ModuloVentas inventory={inventory} reloadInventory={reloadInventory} refreshing={refreshing} />}
          {activeTab === 'separados' && <ModuloSeparados />}
          {activeTab === 'stock' && <ModuloStock inventory={inventory} reloadInventory={reloadInventory} />}
          {activeTab === 'caja' && <ModuloCaja />}
        </div>

        {/* NAVEGACIÓN LATERAL */}
        <div className="flex-1 bg-slate-50 border-l p-8 flex flex-col min-w-[220px]">
          <div className="flex justify-between items-center mb-12">
            <h1 className="font-black italic text-base tracking-tighter text-slate-900">ESTILO NÓRDICO</h1>
            <button onClick={onClose}
              className="p-3 bg-white shadow-sm border rounded-2xl hover:text-rose-500 transition-all">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-3 flex-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 p-5 rounded-[25px] font-black text-[11px] uppercase transition-all ${
                  activeTab === tab.id
                    ? `bg-white shadow-xl border text-slate-900 border-slate-100`
                    : 'text-slate-400 hover:bg-white/50'
                }`}>
                <span className={activeTab === tab.id ? (tab.id === 'ventas' ? 'text-emerald-500' : tab.id === 'separados' ? 'text-amber-500' : 'text-indigo-500') : ''}>
                  {tab.icon}
                </span> 
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-200 space-y-1">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Terminal v2.0</p>
            <p className="text-[9px] text-slate-300">Pasto · Samaniego</p>
          </div>
        </div>

      </div>
    </div>
  );
}