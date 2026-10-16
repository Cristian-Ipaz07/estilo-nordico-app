import { API_URL } from '../config/api';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { EditLayawayModal } from '../pages/LayawayPage';
import {
  Search, ShoppingCart, Trash2, X, User, Calendar, Tag, Lock, Wallet, ArrowDownRight, ArrowUpRight,
  AlertCircle, CheckCircle2, Package, DollarSign, Clock,
  Plus, ChevronRight, ArrowRight, RefreshCw, Edit2, Edit3, Save,
  History, Truck, RotateCcw
} from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// Helper para fecha hoy en Colombia (YYYY-MM-DD) — robusto con toLocaleString
const getTodayCO = () => {
  const d = new Date();
  const co = new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
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
    try {
      const stickyValue = window.localStorage.getItem(key);
      if (!stickyValue || stickyValue === 'undefined' || stickyValue === 'null') return defaultValue;
      return JSON.parse(stickyValue);
    } catch (e) {
      console.warn(`Error al leer clave ${key} de localStorage:`, e);
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      if (value !== undefined) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn(`Error al guardar clave ${key} en localStorage:`, e);
    }
  }, [key, value]);
  return [value, setValue];
}

function useInventory(isOpen) {
  const [inventory, setInventory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    fetch(`${API_URL}/products/`, {
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
  const isAdmin = user?.role === 'Admin';
  const [sellers, setSellers] = useState([]);
  const [vendedorId, setVendedorId] = useStickyState(user?.id || '', 'en_terminal_vendedor');

  useEffect(() => {
    if (user?.id) {
      if (!isAdmin || !vendedorId) {
        setVendedorId(user.id);
      }
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetch(`${API_URL}/users/`, {
         headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
           setSellers(data.filter(u => u.status === 'Activo'));
        }
      })
      .catch(console.error);
    }
  }, [isAdmin]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [saleDate, setSaleDate] = useState(getTodayCO());
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const searchRef = useRef(null);

  const KNOWN_SIZES = useMemo(() => new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '28', '30', '32', '34', '36', '38']), []);

  useEffect(() => {
    const raw = search.trim().toLowerCase();
    if (!raw) { setFilteredResults([]); return; }
    
    // Separar palabras clave
    const kws = raw.split(/\s+/).filter(Boolean);

    const results = inventory.filter(item => {
      const itemSize = (item.size || '').trim().toLowerCase();
      const itemColor = (item.color || '').trim().toLowerCase();
      const itemRef = (item.ref || '').trim().toLowerCase();
      const itemName = (item.name || item.producto || '').trim().toLowerCase();
      const itemCat = (item.category || '').trim().toLowerCase();
      const itemSubcat = (item.subcategory || '').trim().toLowerCase();
      const itemBrand = (item.brand || '').trim().toLowerCase();

      // Texto general sin la talla para que 'L' no coincida con 'impermeabLe' ni 'M' con 'hoMbre'
      const generalText = `${itemRef} ${itemName} ${itemCat} ${itemSubcat} ${itemBrand} ${itemColor}`.toLowerCase();

      for (const kw of kws) {
        if (KNOWN_SIZES.has(kw)) {
          // Si el usuario escribió una talla específica (ej: 'l', 'm', 's', 'xl', 'xxl'):
          // Debe coincidir exactamente con la talla del producto o el sufijo de la referencia
          const matchesSize = itemSize === kw || 
            itemRef.endsWith(`-${kw}`) || 
            itemRef.includes(`-${kw}-`);
          if (!matchesSize) return false;
        } else {
          // Búsqueda general en ref, nombre, color, etc.
          if (!generalText.includes(kw)) {
            return false;
          }
        }
      }
      return true;
    });

    // Ordenar resultados: Disponibles con stock primero, luego alfabético
    results.sort((a, b) => {
      const sA = (a.stock || 0) > 0 ? 1 : 0;
      const sB = (b.stock || 0) > 0 ? 1 : 0;
      if (sA !== sB) return sB - sA;
      return (a.name || a.ref || '').localeCompare(b.name || b.ref || '', 'es');
    });

    setFilteredResults(results.slice(0, 30));
  }, [search, inventory, KNOWN_SIZES]);

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
      const numVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
      const u = { ...item, [field]: numVal };
      if (field === 'qty' || field === 'original_price') {
        const q = typeof u.qty === 'number' ? u.qty : 1;
        const p = typeof u.original_price === 'number' ? u.original_price : 0;
        u.total_item = q * p;
      }
      return u;
    }));
  };

  const updateRowTotal = (id, val) => {
    setCart(cart.map(i => {
      if (i.id !== id) return i;
      if (val === '') return { ...i, total_item: '' };
      return { ...i, total_item: Math.max(0, parseInt(val, 10) || 0) };
    }));
  };

  const totalVenta = cart.reduce((a, i) => a + (i.total_item || 0), 0);
  const hasStockError = cart.some(i => i.qty < 1 || i.stock <= 0 || i.qty > i.stock);

  useEffect(() => { setAmountPaid(totalVenta); }, [totalVenta]);

  const handleFinalizar = async () => {
    if (cart.length === 0 || hasStockError || isSubmitting) return;
    setIsSubmitting(true);
    if (isDelivery && !deliveryAddress.trim()) {
      alert("Por favor ingresa la dirección de entrega para el domicilio.");
      return;
    }

    const chosenUserId = isAdmin ? (Number(vendedorId) || user?.id || null) : (user?.id || null);

    const saleStatus = isDelivery 
      ? "en_domicilio" 
      : (!isAdmin ? "por_confirmar" : (Number(amountPaid) < totalVenta ? "separado" : "pagado"));

    const payload = {
      customer_name: (customer || "CLIENTE FINAL").trim(),
      total_price: totalVenta,
      sale_channel: isDelivery ? "DOMICILIO" : "LOCAL",
      user_id: chosenUserId,
      amount_paid: Number(amountPaid || 0),
      sale_date: saleDate,
      status: saleStatus,
      delivery_address: isDelivery ? deliveryAddress.trim() : null,
      delivery_notes: isDelivery ? deliveryNotes.trim() : null,
      items: cart.map(i => ({
        product_id: i.id,
        quantity: i.qty,
        unit_price: i.qty > 0 ? Math.round(i.total_item / i.qty) : (i.original_price || 0),
      })),
    };

    try {
      const res = await fetch(`${API_URL}/sales/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = Array.isArray(errData.detail)
          ? errData.detail.map(d => `${d.loc?.join('.')} → ${d.msg}`).join('\n')
          : (errData.detail || `Error del servidor HTTP ${res.status}`);
        throw new Error(msg);
      }

      const isSep = Number(amountPaid) < totalVenta;
      const successText = isDelivery 
        ? '¡Domicilio registrado con éxito!' 
        : (!isAdmin ? '¡Pedido registrado por confirmar!' : (isSep ? '¡Separado registrado!' : '¡Venta finalizada!'));

      setSuccessMsg(successText);
      setTimeout(() => setSuccessMsg(''), 3500);
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      reloadInventory();
      setCart([]); 
      setCustomer('CLIENTE FINAL'); 
      setVendedorId(user?.id || ''); 
      setAmountPaid(0); 
      setSearch(''); 
      setFilteredResults([]);
      setDeliveryAddress('');
      setDeliveryNotes('');
      setIsDelivery(false);
    } catch (e) {
      alert(`Error al registrar el pedido:\n${e.message}`);
    } finally { 
      setIsSubmitting(false); 
    }
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
            <div className="absolute z-[110] w-full bg-white shadow-2xl rounded-2xl mt-2 border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100 py-1 animate-in fade-in duration-150">
              {filteredResults.map(p => {
                const isOutOfStock = (p.stock || 0) <= 0;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)}
                    className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-xs uppercase text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {p.name || p.producto}
                        </p>
                        {p.ref && (
                          <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">
                            {p.ref}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.color && (
                          <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60">
                            {p.color}
                          </span>
                        )}
                        {p.size && (
                          <span className="text-[9px] font-black font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                            Talla: {p.size}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 font-bold uppercase truncate">
                          {p.category} {p.subcategory ? `· ${p.subcategory}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-slate-900 font-mono">
                        ${fmt(p.price_sale || p.p_venta || 0)}
                      </p>
                      <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                        isOutOfStock 
                          ? 'bg-rose-50 text-rose-600' 
                          : p.stock < 3 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {isOutOfStock ? 'Agotado' : `${p.stock} un.`}
                      </span>
                    </div>
                  </div>
                );
              })}
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
            {isAdmin ? (
              <select className="bg-transparent text-[10px] font-black outline-none w-full text-slate-600 uppercase cursor-pointer"
                value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            ) : (
              <div className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-lg truncate">
                {user?.full_name || user?.username || 'Vendedor'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modalidad de Entrega: Local / Tienda vs Envío a Domicilio */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 mb-3 space-y-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
            <Truck size={14} className="text-indigo-600" /> Modalidad del Pedido:
          </span>
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setIsDelivery(false); setAmountPaid(totalVenta); }}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                !isDelivery 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛍️ Venta Local / Tienda
            </button>
            <button
              type="button"
              onClick={() => { setIsDelivery(true); setAmountPaid(0); }}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                isDelivery 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛵 Envío a Domicilio (Contraentrega)
            </button>
          </div>
        </div>

        {/* Campos obligatorios y adicionales para Domicilio */}
        {isDelivery && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-indigo-200 shadow-2xs">
              <Truck size={15} className="text-indigo-600 shrink-0" />
              <input
                type="text"
                placeholder="Dirección exacta y Barrio (ej: Cra 25 # 14-20 B/ Maridiaz)..."
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
              <AlertCircle size={15} className="text-amber-500 shrink-0" />
              <input
                type="text"
                placeholder="Teléfono y Notas (ej: 315 123 4567 - cobrar contraentrega)..."
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
              />
            </div>
          </div>
        )}
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
                    <input 
                      type="number" 
                      min="1" 
                      className="w-14 bg-slate-100 rounded-xl py-2 text-center font-black text-xs outline-none"
                      value={item.qty === '' ? '' : item.qty}
                      onFocus={(e) => e.target.select()}
                      onChange={e => updateCart(item.id, 'qty', e.target.value)}
                      onBlur={() => {
                        if (item.qty === '' || isNaN(item.qty) || item.qty < 1) {
                          updateCart(item.id, 'qty', 1);
                        }
                      }}
                    />
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
                        <input 
                          type="number" 
                          min="0" 
                          className="w-24 bg-transparent text-right font-black text-sm outline-none text-slate-900"
                          value={item.total_item === '' ? '' : item.total_item}
                          onFocus={(e) => e.target.select()}
                          onChange={e => updateRowTotal(item.id, e.target.value)}
                          onBlur={() => {
                            if (item.total_item === '' || isNaN(item.total_item)) {
                              updateRowTotal(item.id, (item.qty || 1) * (item.original_price || 0));
                            }
                          }}
                        />
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
              <input 
                type="number" 
                className="bg-transparent outline-none w-full text-center"
                value={amountPaid === '' ? '' : amountPaid}
                onFocus={(e) => e.target.select()}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '') {
                    setAmountPaid('');
                  } else {
                    setAmountPaid(parseInt(v, 10) || 0);
                  }
                }}
                onBlur={() => {
                  if (amountPaid === '' || isNaN(amountPaid)) {
                    setAmountPaid(totalVenta);
                  }
                }}
              />
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
              {isSubmitting ? 'Guardando...' : isDelivery ? '🛵 Apartar Domicilio' : !isAdmin ? '🛵 Registrar Pedido (Por Confirmar)' : amountPaid < totalVenta ? 'Registrar Separado' : 'Finalizar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO SEPARADOS ─────────────────────────────────────────────────────────
function ModuloSeparados() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [separados, setSeparados] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useStickyState(null, 'en_terminal_selected_layaway');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [abonoDate, setAbonoDate] = useState(getTodayCO());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);



  const loadSeparados = useCallback(() => {
    fetch(`${API_URL}/sales/`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => {
        setSeparados(Array.isArray(d) ? d.filter(s => s.balance_due > 0 || s.status === 'en_domicilio') : []);
      })
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
      
      const res = await fetch(`${API_URL}/sales/${selected.id}/payment?amount=${Number(abonoAmount)}${dateParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) throw new Error('Error al registrar abono');
      setMsg('¡Abono registrado!');
      setAbonoAmount('');
      loadSeparados();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      // No cerramos selección, actualizamos para ver el historial
      fetch(`${API_URL}/sales/${selected.id}`, {
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
    await fetch(`${API_URL}/sales/${selected.id}`, { 
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
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase">{selected.customer_name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Separado #{selected.id}</p>
                </div>
                {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Editar datos, fecha o abonos"
                >
                  <Edit3 size={11} /> Editar Separado
                </button>
              )}
              </div>
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

            {isAdmin && (
              <button onClick={handleCancelar}
                className="w-full border-2 border-rose-200 text-rose-500 rounded-2xl py-2.5 font-black text-[11px] hover:bg-rose-50 transition-all uppercase cursor-pointer">
                Cancelar separado (restituir stock)
              </button>
            )}
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
  const [newProd, setNewProd] = useStickyState({ ref: '', name: '', category: '', subcategory: '', brand: '', origin: '', color: '', size: '', stock: '', my_cost: '', price_sale: '' }, 'en_terminal_express_prod');
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
      const res = await fetch(`${API_URL}/products/${selected.id}/price?${params}`, { 
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
      const res = await fetch(`${API_URL}/products/`, {
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
      setNewProd({ ref: '', name: '', category: '', subcategory: '', brand: '', origin: '', color: '', size: '', stock: '', my_cost: '', price_sale: '' });
      selectProduct(data);
    } catch (e) { alert(e.message); }
    finally { setIsCreating(false); }
  };

  const handleRestock = async () => {
    if (!selected || !qtyIn || !newCost) return;
    setIsStocking(true);
    try {
      const res = await fetch(`${API_URL}/products/entries`, {
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
              <input placeholder="Marca" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.brand} onChange={e => setNewProd({...newProd, brand: e.target.value})} />
              <input placeholder="Origen (Ej: Propio/Amiga)" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.origin} onChange={e => setNewProd({...newProd, origin: e.target.value})} />
              <input placeholder="Color" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.color} onChange={e => setNewProd({...newProd, color: e.target.value})} />
              <input placeholder="Talla" className="p-3 rounded-2xl bg-white border font-bold text-sm"
                value={newProd.size} onChange={e => setNewProd({...newProd, size: e.target.value})} />
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

// ─── MÓDULO CAJA ──────────────────────────────────────────────
function ModuloCaja() {
  const [subTab, setSubTab] = useState('turno'); // 'turno' | 'historial'
  const [baseCaja, setBaseCaja] = useStickyState(150000, 'base_caja_terminal');
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [tempBase, setTempBase] = useState(baseCaja);

  // Formulario manual
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('SALIDA');
  const [category, setCategory] = useState('GASTO');
  const [manualDate, setManualDate] = useState(getTodayCO());

  // Modal Cierre de caja
  const [cierreModalOpen, setCierreModalOpen] = useState(false);
  const [cierreDate, setCierreDate] = useState(getTodayCO());
  const [cierreBaseSiguiente, setCierreBaseSiguiente] = useState(baseCaja);

  // Estados de datos
  const [movements, setMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = useCallback(() => {
    setIsLoading(true);
    Promise.all([
      fetch(`${API_URL}/sales/`, { headers: { 'Authorization': "Bearer " + localStorage.getItem('token') } }).then(r => r.json()),
      fetch(`${API_URL}/cash/`, { headers: { 'Authorization': "Bearer " + localStorage.getItem('token') } }).then(r => r.json())
    ]).then(([sData, cData]) => {
      setSales(Array.isArray(sData) ? sData : []);
      setMovements(Array.isArray(cData) ? cData : []);
    }).catch(console.error)
    .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('refresh-sales', loadData);
    window.addEventListener('refresh-cash', loadData);
    return () => {
      window.removeEventListener('refresh-sales', loadData);
      window.removeEventListener('refresh-cash', loadData);
    };
  }, [loadData]);

  // 1. Unificar todos los flujos de dinero (ventas, abonos, salidas/entradas físicas)
  const unifiedFlow = useMemo(() => {
    const list = [];

    // Ventas y sus abonos
    sales.forEach(s => {
      const history = s.payment_history || [];
      const historyTotal = history.reduce((sum, p) => sum + p.amount, 0);
      const initialPayment = (s.amount_paid || 0) - historyTotal;

      if (initialPayment > 0) {
        list.push({
          id: "sale-" + s.id + "-init",
          desc: "VENTA #" + s.id + " - " + (s.customer_name || 'CLIENTE FINAL'),
          amount: initialPayment,
          type: 'ENTRADA',
          cat: 'VENTA',
          date: s.created_at,
          isSale: true
        });
      }

      history.forEach(p => {
        list.push({
          id: "sale-" + s.id + "-pay-" + p.id,
          desc: "ABONO VENTA #" + s.id + " - " + (s.customer_name || 'CLIENTE FINAL'),
          amount: p.amount,
          type: 'ENTRADA',
          cat: 'ABONO',
          date: p.payment_date,
          isSale: true
        });
      });
    });

    // Movimientos físicos de caja (excluyendo 'VENTA' y cualquier movimiento de ajuste contable)
    movements.forEach(m => {
      const mCat = (m.category || '').toUpperCase();
      const mDesc = (m.description || '').toUpperCase();
      
      // Filtrar ventas duplicadas y ajustes de saldo histórico
      if (mCat === 'VENTA' || mCat === 'AJUSTE_CORTE' || mCat.includes('AJUSTE') || mDesc.includes('AJUSTE CORTE')) {
        return;
      }

      const mDate = m.payment_date || m.created_at;
      list.push({
        id: "csh-" + m.id,
        desc: m.description,
        amount: m.amount,
        type: m.type,
        cat: m.category,
        date: mDate,
        rawId: m.id
      });
    });

    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [sales, movements]);

  // 2. Cierres de caja registrados
  const closures = useMemo(() => {
    return unifiedFlow
      .filter(f => f.cat === 'CIERRE CAJA')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [unifiedFlow]);

  // Último cierre de caja ocurrido en el ciclo actual (desde el 06 de octubre de 2026)
  const lastActiveClosure = useMemo(() => {
    return closures.find(c => {
      const dStr = (c.date || '').split('T')[0];
      return dStr >= '2026-10-06';
    });
  }, [closures]);

  const shiftStartDate = useMemo(() => {
    if (lastActiveClosure) return new Date(lastActiveClosure.date);
    return new Date('2026-10-06T00:00:00');
  }, [lastActiveClosure]);

  // 3. Movimientos del turno activo actual (solo ciclo 06/10/2026 en adelante y posteriores al último cierre)
  const activeShiftFlow = useMemo(() => {
    return unifiedFlow
      .filter(f => {
        if (f.cat === 'CIERRE CAJA') return false;
        const dStr = (f.date || '').split('T')[0];
        if (dStr < '2026-10-06') return false;
        if (lastActiveClosure && new Date(f.date) <= new Date(lastActiveClosure.date)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [unifiedFlow, lastActiveClosure]);

  // Cálculos del turno activo
  const shiftTotalIn = useMemo(() => {
    return activeShiftFlow.filter(e => e.type === 'ENTRADA').reduce((sum, e) => sum + e.amount, 0);
  }, [activeShiftFlow]);

  const shiftTotalOut = useMemo(() => {
    return activeShiftFlow.filter(e => e.type === 'SALIDA').reduce((sum, e) => sum + e.amount, 0);
  }, [activeShiftFlow]);

  const shiftNetVentas = shiftTotalIn - shiftTotalOut; // Ganancia neta del periodo
  const totalEnCajon = (Number(baseCaja) || 0) + shiftNetVentas; // Efectivo total esperado en caja

  // Abrir modal de cierre
  const handleOpenCierreModal = () => {
    if (activeShiftFlow.length > 0) {
      const latestDateStr = activeShiftFlow[0].date;
      if (latestDateStr) {
        setCierreDate(String(latestDateStr).split('T')[0].split(' ')[0]);
      } else {
        setCierreDate(getTodayCO());
      }
    } else {
      setCierreDate(getTodayCO());
    }
    setCierreBaseSiguiente(baseCaja);
    setCierreModalOpen(true);
  };

  // Confirmar Cierre de Caja
  const handleConfirmCierre = async () => {
    setIsSubmitting(true);
    try {
      const closureDateTime = cierreDate + "T23:59:59";
      const descText = "CIERRE DE CAJA (Ventas: $" + fmt(shiftTotalIn) + " - Gastos: $" + fmt(shiftTotalOut) + " = Guardado: $" + fmt(shiftNetVentas) + " | Base: $" + fmt(cierreBaseSiguiente) + ")";
      const res = await fetch(`${API_URL}/cash/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': "Bearer " + localStorage.getItem('token')
        },
        body: JSON.stringify({
          description: descText,
          amount: 0,
          type: 'ENTRADA',
          category: 'CIERRE CAJA',
          payment_date: closureDateTime
        })
      });
      if (!res.ok) throw new Error('Error al registrar el cierre de caja');

      if (Number(cierreBaseSiguiente) !== Number(baseCaja)) {
        setBaseCaja(Number(cierreBaseSiguiente));
      }

      setCierreModalOpen(false);
      setMsg('¡Caja cerrada con éxito! Turno archivado y reiniciado.');
      loadData();
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      setTimeout(() => setMsg(''), 4000);
    } catch(e) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar un cierre (deshacer cierre)
  const handleDeleteClosure = async (closureItem) => {
    if (!window.confirm("¿Seguro que deseas eliminar este cierre del " + fmtDateTime(closureItem.date) + "? El turno volverá a abrirse.")) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/cash/` + closureItem.rawId, {
        method: 'DELETE',
        headers: { 'Authorization': "Bearer " + localStorage.getItem('token') }
      });
      if (!res.ok) throw new Error('Error al eliminar cierre');
      setMsg('Cierre eliminado. Turno reabierto.');
      loadData();
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar movimiento manual
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!desc || !amount) return;
    setIsSubmitting(true);
    try {
      const payload = {
        description: desc.toUpperCase(),
        amount: Number(amount),
        type,
        category
      };
      if (manualDate) payload.payment_date = manualDate + "T12:00:00";
      const res = await fetch(`${API_URL}/cash/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': "Bearer " + localStorage.getItem('token')
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al registrar movimiento');
      setMsg('¡Movimiento agregado al turno!');
      setDesc('');
      setAmount('');
      loadData();
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full gap-4 p-6 overflow-hidden relative">
      {/* MODAL DE CIERRE DE CAJA */}
      {cierreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Arqueo de Turno</span>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Cerrar Caja</h3>
              </div>
              <button 
                onClick={() => setCierreModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl">
                <p className="text-[9px] font-black text-emerald-600 uppercase">Ventas / Entradas</p>
                <p className="text-base font-black text-emerald-700">+${fmt(shiftTotalIn)}</p>
              </div>
              <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-2xl">
                <p className="text-[9px] font-black text-rose-600 uppercase">Gastos / Salidas</p>
                <p className="text-base font-black text-rose-700">-${fmt(shiftTotalOut)}</p>
              </div>
              <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-2xl col-span-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black text-indigo-600 uppercase">Dinero Neto a Guardar / Retirar</p>
                    <p className="text-xl font-black text-indigo-900">${fmt(shiftNetVentas)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Efectivo Total en Cajón</p>
                    <p className="text-sm font-black text-slate-700">${fmt(totalEnCajon)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs de Cierre */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                  Fecha de Corte del Cierre
                </label>
                <input 
                  type="date" 
                  value={cierreDate} 
                  onChange={e => setCierreDate(e.target.value)} 
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-2.5 font-bold text-xs outline-none focus:border-indigo-500 bg-slate-50"
                />
                <p className="text-[9px] text-slate-400 mt-1">
                  * Todos los movimientos hasta esta fecha quedarán cerrados y archivados.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                  Base que queda en caja para el siguiente turno
                </label>
                <div className="flex items-center border-2 border-slate-200 rounded-2xl px-4 py-2.5 bg-slate-50">
                  <span className="font-black text-slate-400 mr-2">$</span>
                  <input 
                    type="number" 
                    value={cierreBaseSiguiente} 
                    onChange={e => setCierreBaseSiguiente(e.target.value)} 
                    className="w-full bg-transparent outline-none font-black text-sm text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setCierreModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmCierre}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-black transition-all shadow-lg disabled:opacity-40"
              >
                {isSubmitting ? 'Cerrando...' : 'Confirmar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL IZQUIERDO: LISTA Y ESTADÍSTICAS (58%) */}
      <div className="w-[58%] flex flex-col bg-slate-50 rounded-[30px] border shadow-sm p-4 relative overflow-hidden">
        {/* SUBTABS */}
        <div className="flex justify-between items-center mb-3 px-2">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border shadow-xs">
            <button
              onClick={() => setSubTab('turno')}
              className={"px-3 py-1.5 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-1.5 " + (
                subTab === 'turno' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <Clock size={13} />
              Turno Activo
              <span className={"text-[9px] px-1.5 py-0.5 rounded-full font-black " + (subTab === 'turno' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500')}>
                {activeShiftFlow.length}
              </span>
            </button>
            <button
              onClick={() => setSubTab('historial')}
              className={"px-3 py-1.5 rounded-xl font-black text-[11px] uppercase transition-all flex items-center gap-1.5 " + (
                subTab === 'historial' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <History size={13} />
              Cierres Anteriores
              <span className={"text-[9px] px-1.5 py-0.5 rounded-full font-black " + (subTab === 'historial' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500')}>
                {closures.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
            <span className="text-[9px] font-black uppercase text-slate-400 bg-white px-2.5 py-1 rounded-xl border">
              Desde {fmtDateTime(shiftStartDate).split(',')[0]}
            </span>
          </div>
        </div>

        {/* METRICS RESUMEN DEL TURNO ACTIVO */}
        {subTab === 'turno' && (
          <div className="grid grid-cols-4 gap-2 mb-3 px-2">
            <div className="bg-white border rounded-2xl p-2.5 shadow-xs">
              <span className="text-[8px] font-black uppercase text-slate-400 block leading-tight">Base Caja</span>
              <span className="text-xs font-black text-slate-800">${fmt(baseCaja)}</span>
            </div>
            <div className="bg-white border rounded-2xl p-2.5 shadow-xs">
              <span className="text-[8px] font-black uppercase text-emerald-500 block leading-tight">Ventas (+)</span>
              <span className="text-xs font-black text-emerald-600">+${fmt(shiftTotalIn)}</span>
            </div>
            <div className="bg-white border rounded-2xl p-2.5 shadow-xs">
              <span className="text-[8px] font-black uppercase text-rose-500 block leading-tight">Gastos (-)</span>
              <span className="text-xs font-black text-rose-600">-${fmt(shiftTotalOut)}</span>
            </div>
            <div className="bg-white border border-indigo-100 rounded-2xl p-2.5 shadow-xs bg-indigo-50/30">
              <span className="text-[8px] font-black uppercase text-indigo-600 block leading-tight">Neto Retirar</span>
              <span className="text-xs font-black text-indigo-700">${fmt(shiftNetVentas)}</span>
            </div>
          </div>
        )}

        {/* LISTA SCROLL */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {subTab === 'turno' ? (
            activeShiftFlow.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 gap-2">
                <CheckCircle2 size={32} className="text-emerald-400" />
                <p className="text-xs font-bold uppercase tracking-wider">Caja al día y limpia</p>
                <p className="text-[10px] text-slate-400">No hay movimientos pendientes por cerrar en este turno.</p>
              </div>
            ) : (
              activeShiftFlow.map((f, i) => (
                <div key={"shift-" + f.id + "-" + i} className="bg-white p-3 rounded-2xl border flex justify-between items-center shadow-xs hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={"p-2 rounded-xl flex items-center justify-center " + (f.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                      {f.type === 'ENTRADA' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                    </div>
                    <div>
                      <p className="font-black text-xs text-slate-800 uppercase leading-snug">{f.desc}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {fmtDateTime(f.date)} · <span className="text-slate-600">{f.cat}</span>
                      </p>
                    </div>
                  </div>
                  <span className={"font-black text-sm " + (f.type === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600')}>
                    {f.type === 'ENTRADA' ? '+' : '-'}${fmt(f.amount)}
                  </span>
                </div>
              ))
            )
          ) : (
            closures.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-16 italic">No hay cierres de caja registrados en el historial.</p>
            ) : (
              closures.map((c, i) => (
                <div key={"closure-" + c.id + "-" + i} className="bg-white p-3.5 rounded-2xl border flex justify-between items-center shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase">
                        Cierre
                      </span>
                      <p className="font-black text-xs text-slate-800">{fmtDateTime(c.date)}</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">{c.desc}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteClosure(c)}
                    title="Eliminar cierre y reabrir turno"
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )
          )}
        </div>

        {/* BOTTOM ACTION BAR (SOLO EN PESTAÑA TURNO) */}
        {subTab === 'turno' && (
          <div className="border-t pt-3 mt-2 px-2 flex justify-between items-center">
            <div>
              <p className="text-[9px] uppercase font-black text-slate-400">Total Efectivo en Cajón</p>
              <p className="text-xl font-black text-slate-900">
                ${fmt(totalEnCajon)}
                <span className="text-[10px] font-bold text-slate-400 ml-1.5 font-normal">
                  (Base ${fmt(baseCaja)} + Neto ${fmt(shiftNetVentas)})
                </span>
              </p>
            </div>
            <button 
              onClick={handleOpenCierreModal} 
              disabled={isSubmitting || activeShiftFlow.length === 0}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase hover:bg-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-30 cursor-pointer"
            >
              <Lock size={14} /> Cerrar Caja (Corte)
            </button>
          </div>
        )}
      </div>

      {/* PANEL DERECHO: REGISTRO MANUAL & BASE DE CAJA (42%) */}
      <div className="w-[42%] flex flex-col pt-1 space-y-3">
        {/* CONFIGURACIÓN DE BASE DE CAJA */}
        <div className="bg-white border rounded-[25px] p-4 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Base Fija Predeterminada</span>
            {isEditingBase ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="font-black text-slate-400 text-xs">$</span>
                <input
                  type="number"
                  value={tempBase}
                  onChange={e => setTempBase(e.target.value)}
                  className="w-24 border rounded-lg px-2 py-1 font-black text-xs outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => { setBaseCaja(Number(tempBase) || 0); setIsEditingBase(false); }}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer"
                >
                  Guardar
                </button>
                <button
                  onClick={() => { setTempBase(baseCaja); setIsEditingBase(false); }}
                  className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <p className="text-lg font-black text-slate-800">${fmt(baseCaja)}</p>
            )}
          </div>
          {!isEditingBase && (
            <button
              onClick={() => { setTempBase(baseCaja); setIsEditingBase(true); }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-colors cursor-pointer"
            >
              Editar Base
            </button>
          )}
        </div>

        {/* FORMULARIO MANUAL DE MOVIMIENTOS */}
        <form onSubmit={handleManualSubmit} className="bg-white border rounded-[28px] p-5 shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-slate-800 text-sm uppercase">Registrar Gasto o Entrada</h3>
              <button 
                type="button" 
                onClick={() => { setDesc('BASE INICIAL EFECTIVO'); setAmount(''); setType('ENTRADA'); setCategory('OTROS'); }}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-black shadow-xs hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                + Base Inicial
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Descripción</label>
                <input 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  placeholder="Ej. Envío, Almuerzo, Taxis, Insumos..."
                  className="w-full border-2 border-slate-100 rounded-xl px-3.5 py-2 font-bold text-xs outline-none focus:border-indigo-400 uppercase bg-slate-50/50" 
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Monto</label>
                <div className="flex items-center border-2 border-slate-100 rounded-xl px-3.5 py-2 bg-slate-50/50">
                  <span className="font-black text-slate-400 mr-2">$</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    placeholder="0"
                    className="w-full bg-transparent outline-none font-black text-base text-slate-800" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                  <select 
                    value={type} 
                    onChange={e => setType(e.target.value)} 
                    className="w-full border-2 border-slate-100 rounded-xl px-2.5 py-2 font-bold text-[11px] outline-none bg-white"
                  >
                    <option value="SALIDA">SALIDA</option>
                    <option value="ENTRADA">ENTRADA</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Categoría</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                    className="w-full border-2 border-slate-100 rounded-xl px-2.5 py-2 font-bold text-[11px] outline-none bg-white"
                  >
                    {type === 'SALIDA' ? (
                      <>
                        <option value="GASTO">GASTO</option>
                        <option value="REINVERSION">REINVERSIÓN</option>
                        <option value="SALARIO">SALARIO</option>
                        <option value="ADELANTO">ADELANTO</option>
                        <option value="DEVOLUCION">DEVOLUCIÓN</option>
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
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Fecha</label>
                  <input 
                    type="date" 
                    value={manualDate} 
                    onChange={e => setManualDate(e.target.value)} 
                    className="w-full border-2 border-slate-100 rounded-xl px-2 py-2 font-bold text-[10px] outline-none bg-white" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting || !desc || !amount}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 font-black uppercase text-xs hover:bg-indigo-700 shadow-md disabled:opacity-30 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Registrando...' : 'Agregar Al Flujo'}
            </button>
            {msg && <p className="text-center font-black text-[10px] uppercase text-emerald-600 mt-2">{msg}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TERMINAL MODAL PRINCIPAL ─────────────────────────────────────────────────
export default function TerminalModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
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

  const tabs = useMemo(() => {
    if (isAdmin) {
      return [
        { id: 'ventas', icon: <ShoppingCart size={20} />, label: 'VENTAS' },
        { id: 'separados', icon: <Clock size={20} />, label: 'SEPARADOS' },
        { id: 'stock', icon: <Package size={20} />, label: 'STOCK' },
        { id: 'caja', icon: <DollarSign size={20} />, label: 'DIARIO' },
      ];
    }
    return [
      { id: 'ventas', icon: <ShoppingCart size={20} />, label: 'PEDIDOS / VENTAS' },
      { id: 'separados', icon: <Clock size={20} />, label: 'SEPARADOS' },
    ];
  }, [isAdmin]);

  const effectiveTab = (!isAdmin && (activeTab === 'stock' || activeTab === 'caja')) ? 'ventas' : activeTab;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="bg-white w-[98vw] max-w-7xl h-[95vh] rounded-[40px] shadow-2xl flex overflow-hidden border border-white/20">

        {/* CONTENIDO MÓDULO */}
        <div className="flex-[4] flex flex-col bg-white overflow-hidden">
          {effectiveTab === 'ventas' && <ModuloVentas inventory={inventory} reloadInventory={reloadInventory} refreshing={refreshing} />}
          {effectiveTab === 'separados' && <ModuloSeparados />}
          {isAdmin && effectiveTab === 'stock' && <ModuloStock inventory={inventory} reloadInventory={reloadInventory} />}
          {isAdmin && effectiveTab === 'caja' && <ModuloCaja />}
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