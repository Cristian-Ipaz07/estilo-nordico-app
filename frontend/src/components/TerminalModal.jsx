import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { API_URL } from '../config/api';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { EditLayawayModal } from '../pages/LayawayPage';
import { normalizeImageUrl } from '../utils/imageOptimizer';
import {
  Search, ShoppingCart, Trash2, X, User, Calendar, Tag, Lock, Wallet, ArrowDownRight, ArrowUpRight,
  AlertCircle, CheckCircle2, Check, Package, DollarSign, Clock,
  Plus, ChevronRight, ArrowRight, RefreshCw, Edit2, Edit3, Save, ExternalLink, Store,
  History, Truck, RotateCcw, Image as ImageIcon, ArrowLeftRight, Receipt, ChevronDown, ChevronUp
} from 'lucide-react';
import { FINANCIAL_ACCOUNTS, getAccountInfo, inferAccountFromDesc } from '../utils/accounts';
import TransferModal from './TransferModal';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// Helper para obtener la mejor imagen disponible de un producto o sus variantes hermanas
const getProductImage = (p, inv) => {
  if (!p) return null;
  if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) {
    return p.images[0];
  }
  if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim()) return p.image_url.trim();
  if (p.image && typeof p.image === 'string' && p.image.trim()) return p.image.trim();

  // Fallback inteligente: buscar en el inventario otra variante con la misma referencia base y mismo color
  if (inv && Array.isArray(inv)) {
    const pRef = (p.ref || '').trim().toLowerCase();
    const pColor = (p.color || '').trim().toLowerCase();
    const pName = (p.name || p.producto || '').trim().toLowerCase();
    const baseRef = pRef.split('-')[0];

    const match = inv.find(other => {
      if (other.id === p.id) return false;
      const hasImg = Array.isArray(other.images) && other.images.length > 0 && other.images[0];
      if (!hasImg) return false;

      const otherRef = (other.ref || '').trim().toLowerCase();
      const otherColor = (other.color || '').trim().toLowerCase();
      const otherName = (other.name || other.producto || '').trim().toLowerCase();

      if (baseRef && otherRef.startsWith(baseRef) && pColor && otherColor === pColor) {
        return true;
      }
      if (pName && otherName === pName && pColor && otherColor === pColor) {
        return true;
      }
      if (baseRef && otherRef.startsWith(baseRef) && !pColor) {
        return true;
      }
      return false;
    });

    if (match && Array.isArray(match.images) && match.images[0]) {
      return match.images[0];
    }
  }

  return null;
};

// Helper para fecha hoy en Colombia (YYYY-MM-DD) — robusto y exacto con Intl
const getTodayCO = () => {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

// Helper para fecha de mañana en Colombia (YYYY-MM-DD)
const getTomorrowCO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
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
  const [inventory, setInventory] = useState(() => {
    try {
      const cached = localStorage.getItem('nordic_cached_products');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const lastVersionRef = useRef('');

  const load = useCallback(() => {
    setRefreshing(true);
    fetch(`${API_URL}/products/`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setInventory(d);
          try { localStorage.setItem('nordic_cached_products', JSON.stringify(d)); } catch {}
        }
      })
      .catch(console.error)
      .finally(() => setTimeout(() => setRefreshing(false), 600));
  }, []);

  const checkVersionAndSync = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/products/sync-version`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          if (lastVersionRef.current && lastVersionRef.current !== data.version) {
            // Detectada venta o actualización en otro dispositivo -> sincronizar
            load();
          }
          lastVersionRef.current = data.version;
          return;
        }
      }
    } catch (e) {
      // Fallback silencioso en caso de conexión intermitente
    }
  }, [load]);

  useEffect(() => { 
    if (!isOpen) return;
    load(); 

    // Polling ultra-ligero cada 3.5 segundos para sincronización automática en vivo entre asesores
    const versionInterval = setInterval(() => {
      checkVersionAndSync();
    }, 3500);

    // Salvaguarda periódica relajada a 5 minutos (checkVersionAndSync ya sincroniza en vivo si hay cambios)
    const fullInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) load();
    }, 300000);

    const onFocus = () => {
      checkVersionAndSync();
      load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(versionInterval);
      clearInterval(fullInterval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [isOpen, load, checkVersionAndSync]);

  // Escuchar restock desde cualquier módulo
  useEffect(() => {
    window.addEventListener('refresh-inventory', load);
    return () => window.removeEventListener('refresh-inventory', load);
  }, [load]);

  return { inventory, reloadInventory: load, refreshing };
}

// ─── MÓDULO VENTAS ────────────────────────────────────────────────────────────
function ModuloVentas({ inventory, reloadInventory, refreshing, initialDeliveryMode = false }) {
  const [search, setSearch] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const [clickPreview, setClickPreview] = useState(null);
  const [cart, setCart] = useStickyState([], 'en_terminal_cart');
  const [customer, setCustomer] = useStickyState('CLIENTE FINAL', 'en_terminal_customer');
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [sellers, setSellers] = useState([]);
  const [vendedorId, setVendedorId] = useStickyState(user?.id || '', 'en_terminal_vendedor');
  const [nextSaleNumber, setNextSaleNumber] = useState('...');

  const loadNextSaleNumber = useCallback(() => {
    fetch(`${API_URL}/sales/`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const maxId = Math.max(...data.map(s => Number(s.id) || 0));
          if (maxId > 0) setNextSaleNumber(maxId + 1);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadNextSaleNumber();
    window.addEventListener('refresh-sales', loadNextSaleNumber);
    return () => window.removeEventListener('refresh-sales', loadNextSaleNumber);
  }, [loadNextSaleNumber]);

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
  const [paymentAccount, setPaymentAccount] = useState('EFECTIVO_TIENDA');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({
    EFECTIVO_TIENDA: '',
    NEQUI_CRISTIAN: '',
    NEQUI_DAVID: '',
    EFECTIVO_CASA: '',
    BANCOLOMBIA: ''
  });

  const splitTotal = useMemo(() => {
    return Object.values(splitAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [splitAmounts]);

  useEffect(() => {
    if (isSplitPayment) {
      setAmountPaid(splitTotal);
    }
  }, [isSplitPayment, splitTotal]);

  const [useAnticipo, setUseAnticipo] = useState(false);
  const [anticiposList, setAnticiposList] = useState([]);
  const [selectedAnticipoId, setSelectedAnticipoId] = useState('');
  const [anticipoAmount, setAnticipoAmount] = useState(0);
  const [cobroEfectivoHoy, setCobroEfectivoHoy] = useState(0);

  const loadAnticipos = useCallback(() => {
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
          setAnticiposList(pendientes);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadAnticipos();
    window.addEventListener('refresh-cash', loadAnticipos);
    return () => window.removeEventListener('refresh-cash', loadAnticipos);
  }, [loadAnticipos]);
  // Limpiar claves obsoletas de fecha en localStorage para que no se peguen fechas viejas
  useEffect(() => {
    try {
      window.localStorage.removeItem('en_terminal_sale_date');
      window.localStorage.removeItem('en_terminal_delivery_date');
    } catch (_) {}
  }, []);

  // La fecha SIEMPRE arranca en la fecha actual (hoy).
  // Si el usuario la cambia manualmente para una venta en curso, se mantiene durante esa venta,
  // pero al finalizar la venta o cerrar/abrir el Terminal se restaura a la fecha de hoy.
  const [saleDate, setSaleDate] = useState(() => getTodayCO());
  const [isDelivery, setIsDelivery] = useStickyState(false, 'en_terminal_is_delivery');

  // Cada vez que se monta ModuloVentas, garantizar que la fecha arranque SIEMPRE en HOY (Bogotá)
  useEffect(() => {
    setSaleDate(getTodayCO());
    setDeliveryDate(getTodayCO());
  }, []);

  useEffect(() => {
    if (initialDeliveryMode) {
      setIsDelivery(true);
      setAmountPaid(0);
    }
  }, [initialDeliveryMode]);


  const [deliveryAddress, setDeliveryAddress] = useStickyState('', 'en_terminal_delivery_address');
  const [deliveryPhone, setDeliveryPhone] = useStickyState('', 'en_terminal_delivery_phone');
  const [deliveryNotes, setDeliveryNotes] = useStickyState('', 'en_terminal_delivery_notes');
  const [deliveryDate, setDeliveryDate] = useState(() => getTodayCO());
  const [deliveryTime, setDeliveryTime] = useStickyState('', 'en_terminal_delivery_time');

  // Contador en vivo de domicilios pendientes
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);

  const loadPendingDeliveries = useCallback(() => {
    fetch(`${API_URL}/sales/`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const pending = data.filter(s => {
            const isDomi = s.sale_channel === 'DOMICILIO' || !!s.delivery_address || s.status === 'en_domicilio';
            const isActiveStatus = s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'alistado' || s.status === 'en_camino' || (isDomi && s.status === 'separado');
            return isDomi && isActiveStatus && s.status !== 'cancelado';
          });
          setPendingDeliveriesCount(pending.length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPendingDeliveries();
    window.addEventListener('refresh-sales', loadPendingDeliveries);
    return () => window.removeEventListener('refresh-sales', loadPendingDeliveries);
  }, [loadPendingDeliveries]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const searchRef = useRef(null);

  // Identificar prendas base que tienen variantes hijas (ej. 'IMPORTADA 7647' que ya fue desglosada en variantes)
  const parentIds = useMemo(() => {
    const set = new Set();
    inventory.forEach(item => {
      if (item.parent_id) {
        set.add(item.parent_id);
      }
    });
    return set;
  }, [inventory]);

  // Sincronizar el stock del carrito en vivo cuando otro asesor venda o cambie el inventario
  useEffect(() => {
    if (!inventory || inventory.length === 0) return;
    setCart(prevCart => {
      let changed = false;
      const nextCart = prevCart.map(item => {
        const fresh = inventory.find(p => p.id === item.id);
        if (fresh && fresh.stock !== item.stock) {
          changed = true;
          return { ...item, stock: fresh.stock };
        }
        return item;
      });
      return changed ? nextCart : prevCart;
    });
  }, [inventory, setCart]);

  const KNOWN_SIZES = useMemo(() => new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '28', '30', '32', '34', '36', '38']), []);

  useEffect(() => {
    const raw = search.trim().toLowerCase();
    if (!raw) { 
      setFilteredResults([]); 
      setIsDropdownOpen(false);
      return; 
    }
    
    // Separar palabras clave
    const kws = raw.split(/\s+/).filter(Boolean);

    const results = inventory.filter(item => {
      // 1. Descartar prendas base que ya tienen variantes hijas (para no duplicar ni vender el padre sin talla/color)
      if (parentIds.has(item.id)) {
        return false;
      }

      // 2. Descartar productos agotados físicamente o cuyo stock disponible ya fue cargado al carrito actual
      const inCartItem = cart.find(i => i.id === item.id);
      const qtyInCart = inCartItem ? (Number(inCartItem.qty) || 0) : 0;
      const availableStock = (item.stock || 0) - qtyInCart;

      if (availableStock <= 0) {
        return false;
      }

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

    // Ordenar alfabéticamente por nombre / referencia
    results.sort((a, b) => {
      return (a.name || a.ref || '').localeCompare(b.name || b.ref || '', 'es');
    });

    setFilteredResults(results.slice(0, 30));
    setIsDropdownOpen(true);
  }, [search, inventory, cart, parentIds, KNOWN_SIZES]);

  useEffect(() => {
    const fn = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const addToCart = (p) => {
    const fixedPrice = p.price_sale || p.p_venta || 0;
    const existing = cart.find(i => i.id === p.id);
    const currentQty = existing ? (Number(existing.qty) || 0) : 0;
    const maxStock = p.stock || 0;

    // Validación: si ya está todo el stock físico en el carrito, no permitir agregar más
    if (currentQty >= maxStock) {
      return;
    }

    if (existing) {
      setCart(cart.map(i => i.id === p.id
        ? { ...i, qty: i.qty + 1, total_item: (i.qty + 1) * i.original_price } : i));
    } else {
      setCart([...cart, { ...p, qty: 1, p_lista_real: fixedPrice, original_price: fixedPrice, total_item: fixedPrice }]);
    }
    // IMPORTANTE: NO limpiamos search ni cerramos el desplegable para permitir
    // agregar múltiples productos de la misma búsqueda sin interrupción.
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

  useEffect(() => {
    if (isDelivery) {
      // En domicilio contraentrega, el cobro inicial por defecto es 0 a menos que cruce con anticipo
      if (useAnticipo && anticipoAmount > 0) {
        const resto = Math.max(0, totalVenta - anticipoAmount);
        setCobroEfectivoHoy(resto);
      } else {
        setAmountPaid(0);
        setCobroEfectivoHoy(0);
      }
    } else {
      // Venta local directa
      if (!useAnticipo) {
        setAmountPaid(totalVenta);
        setCobroEfectivoHoy(0);
      } else {
        const resto = Math.max(0, totalVenta - (anticipoAmount || 0));
        setCobroEfectivoHoy(resto);
      }
    }
  }, [totalVenta, useAnticipo, anticipoAmount, isDelivery]);

  const handleSelectAnticipo = (id) => {
    setSelectedAnticipoId(id);
    if (!id) {
      setAnticipoAmount(0);
      setCobroEfectivoHoy(totalVenta);
      return;
    }
    const found = anticiposList.find(a => String(a.id) === String(id));
    if (found) {
      const amt = Number(found.amount) || 0;
      setAnticipoAmount(amt);

      const descUpper = (found.description || '').toUpperCase();
      let extractedName = '';
      if (descUpper.includes('CLIENTE:')) {
        extractedName = descUpper.split('CLIENTE:')[1].trim();
      } else if (descUpper.includes(' - ')) {
        const parts = descUpper.split(' - ');
        extractedName = parts[parts.length - 1].trim();
      }
      if (extractedName && (!customer || customer === 'CLIENTE FINAL')) {
        setCustomer(extractedName.replace(/[\(\)].*/g, '').trim());
      }

      const resto = Math.max(0, totalVenta - amt);
      setCobroEfectivoHoy(resto);
    }
  };

  const handleFinalizar = async () => {
    if (cart.length === 0 || hasStockError || isSubmitting) return;

    if (isDelivery) {
      if (!deliveryAddress || !deliveryAddress.trim()) {
        alert("Por favor ingresa la dirección exacta de entrega.");
        return;
      }
    }

    setIsSubmitting(true);

    const chosenVendedorId = Number(vendedorId) || user?.id || null;
    const creatorUserId = user?.id || null;

    const saleStatus = isDelivery 
      ? "en_domicilio" 
      : (!isAdmin ? "por_confirmar" : (Number(amountPaid) < totalVenta ? "separado" : "pagado"));

    let effectiveAmountPaid = Number(amountPaid || 0);

    // Si es contraentrega y no pagó anticipo/abono previo, amount_paid es 0 (no entra a caja hoy)
    if (isDelivery && !useAnticipo && (!amountPaid || amountPaid === 0)) {
      effectiveAmountPaid = 0;
    }

    // Estructurar notas completas para Domicilio
    let notesParts = [];
    if (deliveryPhone && deliveryPhone.trim()) {
      notesParts.push(`TEL: ${deliveryPhone.trim()}`);
    }
    if (deliveryDate) {
      const isTomorrow = deliveryDate === getTomorrowCO();
      notesParts.push(`ENTREGA: ${deliveryDate}${isTomorrow ? ' (Mañana)' : ''}`);
    }
    if (deliveryTime && deliveryTime.trim()) {
      notesParts.push(`HORA: ${deliveryTime.trim()}`);
    }
    if (deliveryNotes && deliveryNotes.trim()) {
      notesParts.push(`NOTAS: ${deliveryNotes.trim()}`);
    }

    if (useAnticipo && anticipoAmount > 0) {
      const appliedAnticipoVal = Math.min(totalVenta, anticipoAmount);
      const cashReceivedToday = Number(cobroEfectivoHoy || 0);
      effectiveAmountPaid = appliedAnticipoVal + cashReceivedToday;
      const tag = `[ANTICIPO_CRUZADO:${appliedAnticipoVal}${selectedAnticipoId ? '|ID:' + selectedAnticipoId : ''}]`;
      notesParts.push(tag);
    }

    const structuredDeliveryNotes = notesParts.join(' | ');

    const effectivePayments = isSplitPayment
      ? Object.entries(splitAmounts)
          .filter(([_, v]) => Number(v) > 0)
          .map(([acc, v]) => ({ account: acc, amount: Number(v) }))
      : (effectiveAmountPaid > 0 ? [{ account: paymentAccount, amount: effectiveAmountPaid }] : []);

    const payload = {
      customer_name: (customer || "CLIENTE FINAL").trim(),
      total_price: totalVenta,
      sale_channel: isDelivery ? "DOMICILIO" : "LOCAL",
      user_id: chosenVendedorId,
      created_by: creatorUserId,
      amount_paid: effectiveAmountPaid,
      payment_method: isSplitPayment ? "DIVIDIDO" : paymentAccount,
      payments: effectivePayments,
      sale_date: isDelivery && deliveryDate ? deliveryDate : saleDate,
      status: saleStatus,
      delivery_address: isDelivery ? deliveryAddress.trim() : null,
      delivery_notes: isDelivery ? (structuredDeliveryNotes || null) : (deliveryNotes?.trim() || null),
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

      const createdSale = await res.json().catch(() => ({}));

      // Si se usó un anticipo registrado, actualizar su nota para marcarlo como entregado
      if (useAnticipo && selectedAnticipoId) {
        try {
          const ant = anticiposList.find(a => String(a.id) === String(selectedAnticipoId));
          if (ant) {
            await fetch(`${API_URL}/cash/${selectedAnticipoId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                description: `${ant.description} (✅ ENTREGADO EN VENTA #${createdSale.id || ''})`
              })
            });
            window.dispatchEvent(new CustomEvent('refresh-cash'));
          }
        } catch (err) {
          console.error("Error actualizando nota del anticipo:", err);
        }
      }

      const isSep = effectiveAmountPaid < totalVenta;
      const saleNum = createdSale.id ? `#${createdSale.id}` : (nextSaleNumber ? `#${nextSaleNumber}` : '');
      const successText = isDelivery 
        ? `¡Domicilio ${saleNum} registrado con éxito!` 
        : (!isAdmin ? `¡Pedido ${saleNum} registrado por confirmar!` : (isSep ? `¡Separado ${saleNum} registrado!` : `¡Venta ${saleNum} finalizada con éxito!`));

      setSuccessMsg(successText);
      setTimeout(() => setSuccessMsg(''), 3500);
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      reloadInventory();
      setCart([]); 
      setCustomer('CLIENTE FINAL'); 
      setVendedorId(user?.id || ''); 
      setAmountPaid(0); 
      setPaymentAccount('EFECTIVO_TIENDA');
      setIsSplitPayment(false);
      setSplitAmounts({ EFECTIVO_TIENDA: '', NEQUI_CRISTIAN: '', NEQUI_DAVID: '', EFECTIVO_CASA: '', BANCOLOMBIA: '' });
      setSearch(''); 
      setFilteredResults([]);
      setIsDropdownOpen(false);
      setDeliveryAddress('');
      setDeliveryPhone('');
      setDeliveryNotes('');
      setDeliveryTime('');
      setDeliveryDate(getTodayCO());
      setSaleDate(getTodayCO());
      setIsDelivery(false);
      setUseAnticipo(false);
      setSelectedAnticipoId('');
      setAnticipoAmount(0);
      setCobroEfectivoHoy(0);
    } catch (e) {
      alert(`Error al registrar el pedido:\n${e.message}`);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="flex flex-col h-full p-3 sm:p-4 md:p-6 overflow-hidden relative">
      {refreshing && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-emerald-200 z-10 animate-pulse">
          <RefreshCw size={11} className="animate-spin" /> Sincronizando stock...
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-3 mb-3 sm:mb-4 shrink-0">
        <div className="xl:col-span-6 2xl:col-span-7 flex items-center gap-2" ref={searchRef}>
          <div className="relative flex-1">
            <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <input
              autoFocus
              className="w-full pl-11 sm:pl-14 pr-10 py-3 sm:py-4 bg-slate-100 rounded-2xl sm:rounded-[22px] outline-none font-bold text-slate-700 text-sm sm:text-base border-2 border-transparent focus:border-emerald-500 transition-all placeholder:text-slate-400"
              placeholder="Buscar producto: ref, nombre, color, categoría..."
              value={search}
              onFocus={() => {
                if (filteredResults.length > 0) setIsDropdownOpen(true);
              }}
              onChange={e => {
                setSearch(e.target.value);
                setIsDropdownOpen(true);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsDropdownOpen(false);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const firstAvail = filteredResults.find(p => {
                    const q = cart.find(i => i.id === p.id)?.qty || 0;
                    return ((p.stock || 0) - q) > 0;
                  });
                  if (firstAvail) addToCart(firstAvail);
                }
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setFilteredResults([]); setIsDropdownOpen(false); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 rounded-full transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}

            {isDropdownOpen && filteredResults.length > 0 && (
              <div className="absolute left-0 top-full z-[110] w-full bg-white shadow-2xl rounded-2xl mt-2 border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100 py-1 animate-in fade-in duration-150">
                {filteredResults.map(p => {
                  const inCartItem = cart.find(i => i.id === p.id);
                  const qtyInCart = inCartItem ? (Number(inCartItem.qty) || 0) : 0;
                  const availableStock = Math.max(0, (p.stock || 0) - qtyInCart);
                  const isTotallyExhausted = availableStock <= 0;
                  const isPhysicalOutOfStock = (p.stock || 0) <= 0;
                  const itemImg = getProductImage(p, inventory);

                  return (
                    <div 
                      key={p.id} 
                      onClick={() => addToCart(p)}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 transition-colors group select-none hover:bg-slate-50 cursor-pointer active:bg-slate-100"
                    >
                      {/* Mini Botón de Foto (Hover en PC / Clic en Celular) */}
                      <div className="shrink-0 relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (itemImg) {
                              setClickPreview(prev => prev?.id === p.id ? null : { ...p, previewImage: itemImg });
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (itemImg) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoverPreview({ ...p, previewImage: itemImg, pos: { x: rect.right, y: rect.top } });
                            }
                          }}
                          onMouseLeave={() => setHoverPreview(null)}
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all relative overflow-hidden ${
                            itemImg 
                              ? 'bg-white border-slate-200 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 shadow-2xs cursor-pointer' 
                              : 'bg-slate-100 border-slate-200/60 opacity-40 cursor-default'
                          }`}
                          title={itemImg ? "Ver foto (hover en PC o clic en celular)" : "Sin imagen asignada"}
                        >
                          {itemImg ? (
                            <img 
                              src={normalizeImageUrl(itemImg)} 
                              alt="" 
                              className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                            />
                          ) : (
                            <ImageIcon size={14} className="text-slate-400" />
                          )}
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-xs uppercase truncate transition-colors text-slate-900 group-hover:text-indigo-600">
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
                        
                        {qtyInCart > 0 ? (
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full inline-block mt-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200">
                            En caja ({qtyInCart}) · {availableStock} disp.
                          </span>
                        ) : (
                          <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                            availableStock < 3 
                              ? 'bg-amber-50 text-amber-700' 
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {availableStock} un.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => reloadInventory()}
            disabled={refreshing}
            title="Actualizar catálogo y stock de otros asesores"
            className="h-[56px] w-[56px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-[20px] transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer border border-slate-200/50 shadow-2xs"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
        <div className="xl:col-span-6 2xl:col-span-5 flex items-center gap-2 flex-wrap">
          {/* Consecutivo prominente AL FRENTE para que NUNCA se desborde ni se corte */}
          <div 
            className="px-3.5 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-2xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 shrink-0 shadow-sm whitespace-nowrap select-none" 
            title="Número consecutivo de la venta actual para tu cuaderno físico"
          >
            <Receipt size={15} className="text-indigo-200 shrink-0" />
            <span>Venta #{nextSaleNumber}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 shrink-0 shadow-2xs">
            <Calendar size={15} className={saleDate !== getTodayCO() ? "text-amber-500 shrink-0" : "text-slate-400 shrink-0"} />
            <input type="date" className="bg-transparent text-[11px] font-black outline-none text-slate-700 cursor-pointer"
              value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            {saleDate !== getTodayCO() && (
              <button
                type="button"
                onClick={() => setSaleDate(getTodayCO())}
                title="Restablecer a fecha de hoy"
                className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors"
              >
                Hoy
              </button>
            )}
          </div>

          <div className="flex-1 min-w-[130px] sm:min-w-[150px] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
            <Tag size={15} className="text-slate-400 shrink-0" />
            <div className="w-full min-w-0">
              <span className="text-[8px] font-black uppercase text-slate-400 block leading-tight truncate">Vendedor (Comisión)</span>
              <select className="bg-transparent text-[11px] font-black outline-none w-full text-slate-800 uppercase cursor-pointer truncate"
                value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                {sellers.length > 0 ? (
                  sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name || s.username}</option>
                  ))
                ) : (
                  <option value={user?.id || ''}>{user?.full_name || user?.username || 'Vendedor'}</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Modalidad de Entrega: Local / Tienda vs Envío a Domicilio */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 mb-3 space-y-2.5 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Truck size={14} className="text-indigo-600" /> Modalidad del Pedido:
            </span>
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200/80 rounded-lg text-[10px] font-black font-mono">
              Venta #{nextSaleNumber}
            </span>
          </div>
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
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer relative ${
                isDelivery 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🛵 Envío a Domicilio (Contraentrega)</span>
              {pendingDeliveriesCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full animate-pulse">
                  {pendingDeliveriesCount} pend.
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Campos detallados y estructurados para Domicilio */}
        {isDelivery && (
          <div className="space-y-2 pt-2 border-t border-slate-200/70 animate-in fade-in duration-150">
            {/* Fila 1: Dirección y Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-8 flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-purple-200 shadow-2xs">
                <Truck size={15} className="text-purple-600 shrink-0" />
                <input
                  type="text"
                  placeholder="Dirección exacta y Barrio (ej: Carrera 15a #1-59 Caicedo Alto)..."
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
                />
              </div>

              <div className="md:col-span-4 flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-sm">📞</span>
                <input
                  type="tel"
                  placeholder="Teléfono (ej: 3137296423)..."
                  value={deliveryPhone}
                  onChange={e => setDeliveryPhone(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400 font-mono"
                />
              </div>
            </div>

            {/* Fila 2: Fecha de entrega, Hora y Notas */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              {/* Fecha programada de entrega con botones rápidos Hoy / Mañana */}
              <div className="md:col-span-5 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">📅 Entrega:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDeliveryDate(getTodayCO())}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      deliveryDate === getTodayCO()
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryDate(getTomorrowCO())}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      deliveryDate === getTomorrowCO()
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🚀 Mañana
                  </button>
                </div>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="text-[11px] font-bold text-slate-700 bg-transparent outline-none ml-auto"
                />
              </div>

              {/* Hora programada */}
              <div className="md:col-span-3 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <Clock size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Hora (ej: 3:00 PM)..."
                  value={deliveryTime}
                  onChange={e => setDeliveryTime(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
                />
              </div>

              {/* Notas adicionales */}
              <div className="md:col-span-4 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Notas (cambio de 100k, etc.)..."
                  value={deliveryNotes}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Aviso informativo de Contraentrega */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] text-purple-900">
              <span className="font-semibold">
                ℹ️ Al apartar domicilio, <strong>las prendas se apartan del inventario</strong> y el cobro queda <strong>pendiente contraentrega</strong> (no entra a caja hoy).
              </span>
              <span className="font-black font-mono text-purple-700 uppercase bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                Cobro: ${fmt(totalVenta - Number(amountPaid || 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabla carrito con scroll suave */}
      <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[520px] border-separate border-spacing-y-2">
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
                    <div className="flex items-center gap-3">
                      {/* Mini Botón de Foto en la fila del Carrito */}
                      {(() => {
                        const cartImg = getProductImage(item, inventory);
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cartImg) {
                                setClickPreview(prev => prev?.id === item.id ? null : { ...item, previewImage: cartImg });
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (cartImg) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverPreview({ ...item, previewImage: cartImg, pos: { x: rect.right, y: rect.top } });
                              }
                            }}
                            onMouseLeave={() => setHoverPreview(null)}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 overflow-hidden ${
                              cartImg 
                                ? 'bg-white border-slate-200 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 shadow-2xs cursor-pointer' 
                                : 'bg-slate-100 border-slate-200/60 opacity-40 cursor-default'
                            }`}
                            title={cartImg ? "Ver foto (hover en PC o clic en celular)" : "Sin imagen asignada"}
                          >
                            {cartImg ? (
                              <img src={normalizeImageUrl(cartImg)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={14} className="text-slate-400" />
                            )}
                          </button>
                        );
                      })()}
                      <div className="min-w-0">
                        <span className="font-black text-[11px] uppercase text-slate-800 block truncate">{item.name || item.producto}</span>
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic truncate">{item.category} • {item.subcategory} ({item.ref})</p>
                      </div>
                    </div>
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

        {/* BARRA COLAPSABLE PARA CRUZAR CON ANTICIPO PREVIO */}
        <div className="mb-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2 shadow-2xs transition-all">
          <button
            type="button"
            onClick={() => {
              const next = !useAnticipo;
              setUseAnticipo(next);
              if (!next) {
                setSelectedAnticipoId('');
                setAnticipoAmount(0);
                setAmountPaid(totalVenta);
                setCobroEfectivoHoy(0);
              }
            }}
            className="w-full flex items-center justify-between text-left cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                <span>🔖 ¿Deseas cruzar con un anticipo previo?</span>
              </span>
              {anticiposList.length > 0 && (
                <span className="bg-teal-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                  {anticiposList.length} disp.
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-700 uppercase">
              {useAnticipo && anticipoAmount > 0 && (
                <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-lg font-mono font-black mr-1">
                  -${fmt(anticipoAmount)}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-slate-500 font-bold">
                {useAnticipo ? <>Ocultar <ChevronUp size={13} /></> : <>Seleccionar <ChevronDown size={13} /></>}
              </span>
            </div>
          </button>

          {useAnticipo && (
            <div className="pt-2 mt-2 border-t border-slate-200/70 flex flex-col md:flex-row items-center gap-2 w-full animate-in fade-in duration-150">
              <select
                value={selectedAnticipoId}
                onChange={e => handleSelectAnticipo(e.target.value)}
                className="flex-1 bg-white border border-teal-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 w-full"
              >
                <option value="">-- Seleccionar Anticipo Registrado --</option>
                {anticiposList.map(a => (
                  <option key={a.id} value={a.id}>
                    ${fmt(a.amount)} - {a.description} ({(a.payment_date || a.created_at || '').split('T')[0]})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-3 py-1 rounded-xl shrink-0">
                <span className="text-[9px] font-black text-teal-700 uppercase">Anticipo:</span>
                <span className="text-xs font-black text-teal-800 font-mono">${fmt(anticipoAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* SELECTOR DE CUENTA / MÉTODO DE PAGO LIMPIO (SOLO CAJA TIENDA, NEQUI Y MIXTO) */}
        <div className="mb-2 bg-slate-50 border border-slate-200/90 rounded-2xl p-2.5 flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <span>💳 Método de Pago:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'EFECTIVO_TIENDA', label: 'Efectivo', icon: '💵' },
                { id: 'NEQUI_CRISTIAN', label: 'Nequi Cristian', icon: '📱' },
                { id: 'NEQUI_DAVID', label: 'Nequi David', icon: '📱' }
              ].map(acc => {
                const isSelected = !isSplitPayment && paymentAccount === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setIsSplitPayment(false);
                      setPaymentAccount(acc.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/10'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{acc.icon}</span>
                    <span>{acc.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsSplitPayment(!isSplitPayment)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer border flex items-center gap-1.5 ${
                  isSplitPayment
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                    : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <span>🔀</span>
                <span>Pago Mixto</span>
              </button>
            </div>
          </div>

          {/* Panel Desplegable para Pago Dividido */}
          {isSplitPayment && (
            <div className="pt-2 border-t border-slate-200/60 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {[
                  { id: 'EFECTIVO_TIENDA', label: 'Efectivo Tienda', icon: '💵' },
                  { id: 'NEQUI_CRISTIAN', label: 'Nequi Cristian', icon: '📱' },
                  { id: 'NEQUI_DAVID', label: 'Nequi David', icon: '📱' },
                  { id: 'BANCOLOMBIA', label: 'Bancolombia', icon: '🏦' }
                ].map(acc => (
                  <div key={acc.id} className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-black uppercase text-slate-500 block truncate mb-1">
                      {acc.icon} {acc.label}
                    </span>
                    <div className="flex items-center">
                      <span className="text-[10px] text-slate-400 font-bold mr-1">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={splitAmounts[acc.id] || ''}
                        onChange={e => {
                          const v = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setSplitAmounts({ ...splitAmounts, [acc.id]: v });
                        }}
                        className="w-full bg-transparent outline-none font-black text-xs text-slate-800"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] px-1 font-bold">
                <span className="text-slate-500">
                  Total Asignado: <strong className="font-mono text-slate-900">${fmt(splitTotal)}</strong>
                </span>
                <span className={splitTotal >= totalVenta ? 'text-emerald-600' : 'text-amber-600'}>
                  {splitTotal >= totalVenta ? '✅ Total cubierto' : `Faltan: $${fmt(Math.max(0, totalVenta - splitTotal))}`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
          <div className="sm:col-span-4 md:col-span-3 bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-[30px] text-white flex sm:flex-col justify-between sm:justify-center items-center sm:items-stretch shadow-md">
            <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest sm:text-center">Total Venta</p>
            <p className="text-xl sm:text-2xl font-black italic sm:text-center">${fmt(totalVenta)}</p>
          </div>
          {useAnticipo && anticipoAmount > 0 ? (
            <div className="sm:col-span-4 md:col-span-5 bg-teal-50 border-2 border-teal-200 p-3 sm:p-4 rounded-2xl sm:rounded-[30px] flex flex-col justify-center shadow-xs">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[9px] font-black text-teal-700 uppercase tracking-widest">Cobro Hoy en Caja</p>
                <span className="text-[9px] font-bold bg-teal-200/60 text-teal-800 px-2 py-0.5 rounded-md">
                  Anticipo -${fmt(anticipoAmount)}
                </span>
              </div>
              <div className="flex items-center justify-center text-2xl sm:text-3xl font-black text-teal-900">
                <span className="mr-1.5 opacity-30 text-lg sm:text-xl">$</span>
                <input 
                  type="number" 
                  className="bg-transparent outline-none w-full text-center font-black"
                  value={cobroEfectivoHoy}
                  onFocus={(e) => e.target.select()}
                  onChange={e => {
                    const v = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                    setCobroEfectivoHoy(v);
                  }}
                />
              </div>
              <p className="text-[8px] font-bold text-center text-teal-600 mt-1 uppercase">
                {cobroEfectivoHoy === 0 ? '✅ Cubierto 100% por anticipo (No suma dinero hoy)' : '⚠️ Solo se sumará a caja el saldo recibido hoy'}
              </p>
            </div>
          ) : (
            <div className="sm:col-span-4 md:col-span-5 bg-emerald-50 border-2 border-emerald-100 p-3 sm:p-5 rounded-2xl sm:rounded-[30px] flex flex-col justify-center shadow-xs">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 text-center">Abono Recibido</p>
              <div className="flex items-center justify-center text-2xl sm:text-3xl font-black text-emerald-700">
                <span className="mr-1.5 opacity-30 text-lg sm:text-xl">$</span>
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
          )}
          <div className="sm:col-span-4 md:col-span-4 flex flex-col gap-2">
            <div className="flex items-center gap-2.5 bg-slate-100 px-4 py-2.5 sm:py-3 rounded-2xl border border-slate-200">
              <User size={16} className="text-slate-400 shrink-0" />
              <input placeholder="Nombre Cliente" className="bg-transparent font-bold text-xs outline-none w-full uppercase"
                value={customer} onChange={e => setCustomer(e.target.value)} />
            </div>
            <button 
              disabled={cart.length === 0 || hasStockError || isSubmitting} 
              onClick={handleFinalizar}
              className={`py-3 sm:py-0 flex-1 rounded-2xl sm:rounded-[22px] font-black text-xs sm:text-sm transition-all disabled:opacity-20 flex items-center justify-center gap-2 uppercase tracking-tight cursor-pointer shadow-md active:scale-98 ${
                isDelivery 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20' 
                  : 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin" /> Guardando...
                </span>
              ) : isDelivery ? (
                amountPaid > 0 
                  ? `🛵 Apartar Domicilio (Abono ${fmt(amountPaid)})` 
                  : `🛵 Apartar Domicilio (${fmt(totalVenta)} Contraentrega)`
              ) : !isAdmin ? (
                '🛵 Registrar Pedido (Por Confirmar)'
              ) : amountPaid < totalVenta ? (
                'Registrar Separado'
              ) : (
                'Finalizar Venta'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* VISTA PREVIA FLOTANTE (HOVER EN PC) */}
      {hoverPreview && !clickPreview && (
        <div 
          className="fixed z-[300] pointer-events-none transition-opacity duration-150 animate-in fade-in"
          style={{
            top: hoverPreview.pos ? `${Math.min(window.innerHeight - 360, Math.max(16, hoverPreview.pos.y - 40))}px` : '100px',
            left: hoverPreview.pos ? `${Math.min(window.innerWidth - 290, hoverPreview.pos.x + 12)}px` : '400px',
          }}
        >
          <div className="w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-indigo-500/20 overflow-hidden p-2.5">
            <div className="relative aspect-square w-full rounded-xl bg-slate-50 overflow-hidden border border-slate-100 flex items-center justify-center">
              <img 
                src={normalizeImageUrl(hoverPreview.previewImage)} 
                alt={hoverPreview.name}
                className="w-full h-full object-contain p-1.5" 
              />
            </div>
            <div className="p-2 space-y-1">
              <p className="font-black text-xs uppercase text-slate-900 truncate">
                {hoverPreview.name || hoverPreview.producto}
              </p>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono font-bold text-slate-400 truncate max-w-[120px]">{hoverPreview.ref}</span>
                <span className="font-black font-mono text-emerald-600 shrink-0">${fmt(hoverPreview.price_sale || hoverPreview.p_venta || 0)}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {hoverPreview.color && (
                  <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                    {hoverPreview.color}
                  </span>
                )}
                {hoverPreview.size && (
                  <span className="text-[9px] font-black font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                    Talla: {hoverPreview.size}
                  </span>
                )}
                <span className="text-[9px] font-bold uppercase text-slate-400 truncate">
                  {hoverPreview.category}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERACTIVO DE FOTO (CLIC EN CELULAR O PC) */}
      {clickPreview && (
        <div 
          className="fixed inset-0 z-[350] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setClickPreview(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
              <img 
                src={normalizeImageUrl(clickPreview.previewImage)} 
                alt={clickPreview.name}
                className="w-full h-full object-contain p-3" 
              />
              <button
                type="button"
                onClick={() => setClickPreview(null)}
                className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all cursor-pointer shadow-md"
                title="Cerrar vista previa"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-sm text-slate-900 uppercase truncate">
                    {clickPreview.name || clickPreview.producto}
                  </h4>
                  <p className="text-[10px] font-mono font-bold text-slate-400">
                    {clickPreview.ref}
                  </p>
                </div>
                <p className="font-black text-base text-slate-900 font-mono shrink-0">
                  ${fmt(clickPreview.price_sale || clickPreview.p_venta || 0)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {clickPreview.color && (
                  <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                    {clickPreview.color}
                  </span>
                )}
                {clickPreview.size && (
                  <span className="text-[10px] font-black font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                    Talla: {clickPreview.size}
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  {clickPreview.category} {clickPreview.subcategory ? `· ${clickPreview.subcategory}` : ''}
                </span>
              </div>

              {(() => {
                const inCartItem = cart.find(i => i.id === clickPreview.id);
                const qtyInCart = inCartItem ? (Number(inCartItem.qty) || 0) : 0;
                const availableStock = Math.max(0, (clickPreview.stock || 0) - qtyInCart);
                const isExhausted = availableStock <= 0;

                return (
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClickPreview(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase transition-colors cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={isExhausted}
                      onClick={() => {
                        addToCart(clickPreview);
                        setClickPreview(null);
                      }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <ShoppingCart size={15} /> 
                      {isExhausted ? 'Sin stock disp.' : (qtyInCart > 0 ? 'Agregar otra unidad' : 'Agregar a la Caja')}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO SEPARADOS ─────────────────────────────────────────────────────────
function ModuloSeparados({ initialLayawayId = null }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [separados, setSeparados] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useStickyState(null, 'en_terminal_selected_layaway');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoAccount, setAbonoAccount] = useState('EFECTIVO_TIENDA');
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
    if (initialLayawayId && separados.length > 0) {
      const target = separados.find(s => s.id === Number(initialLayawayId));
      if (target) setSelected(target);
    }
  }, [initialLayawayId, separados]);

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
      
      const res = await fetch(`${API_URL}/sales/${selected.id}/payment?amount=${Number(abonoAmount)}${dateParam}&account=${abonoAccount}`, {
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
              <div className="col-span-7">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Valor del abono</p>
                <div className="flex items-center bg-emerald-50 border-2 border-emerald-300 rounded-2xl px-4 py-3 h-[52px]">
                  <span className="text-emerald-500 font-black mr-2">$</span>
                  <input type="number" className="bg-transparent outline-none w-full font-black text-xl text-emerald-700"
                    placeholder="0" value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} />
                </div>
              </div>
              <div className="col-span-5">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Cuenta de cobro</p>
                <select
                  value={abonoAccount}
                  onChange={e => setAbonoAccount(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-2.5 h-[52px] text-xs font-black text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {FINANCIAL_ACCOUNTS.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">Fecha:</span>
              <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 font-black text-[10px] text-slate-600 outline-none"
                value={abonoDate} onChange={e => setAbonoDate(e.target.value)} />
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

      {isEditModalOpen && selected && (
        <EditLayawayModal
          item={selected}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={() => {
            setIsEditModalOpen(false);
            loadSeparados();
            fetch(`${API_URL}/sales/${selected.id}`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
              .then(r => r.json())
              .then(setSelected)
              .catch(console.error);
          }}
        />
      )}
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
  const [expandedShiftSaleId, setExpandedShiftSaleId] = useState(null);

  // Modal corrección de cuenta / método de pago
  const [accountModalTarget, setAccountModalTarget] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('EFECTIVO_TIENDA');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const handleDeletePaymentFromFlow = async (f) => {
    if (!f.saleId || !f.paymentId) return;
    if (!window.confirm(`¿Eliminar este cobro/abono de $${fmt(f.amount)} de la Venta #${f.saleId}? Se restará de la venta y desaparecerá de la caja de hoy.`)) return;
    try {
      const res = await fetch(`${API_URL}/sales/${f.saleId}/payments/${f.paymentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al eliminar el abono');
      }
      alert(`Cobro de $${fmt(f.amount)} eliminado con éxito`);
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenChangeAccountModal = (item) => {
    setAccountModalTarget(item);
    setSelectedAccount(item.account || 'EFECTIVO_TIENDA');
  };

  const handleSaveAccountChange = async () => {
    if (!accountModalTarget || !selectedAccount) return;
    setIsSavingAccount(true);
    try {
      if (accountModalTarget.cat === 'ABONO') {
        const res = await fetch(`${API_URL}/sales/${accountModalTarget.saleId}/payments/${accountModalTarget.paymentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            account: selectedAccount,
            notes: `Abono registrado (${selectedAccount})`
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Error al actualizar cuenta del abono');
        }
      } else if (accountModalTarget.cat === 'VENTA') {
        const res = await fetch(`${API_URL}/sales/${accountModalTarget.saleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            payment_method: selectedAccount
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Error al actualizar cuenta de la venta');
        }
        if (accountModalTarget.paymentId) {
          await fetch(`${API_URL}/sales/${accountModalTarget.saleId}/payments/${accountModalTarget.paymentId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              account: selectedAccount,
              notes: `Pago venta (${selectedAccount})`
            })
          }).catch(console.error);
        }
      } else if (accountModalTarget.rawMovementId) {
        const res = await fetch(`${API_URL}/cash/${accountModalTarget.rawMovementId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            account: selectedAccount
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Error al actualizar cuenta del movimiento');
        }
      }

      setMsg('¡Método de pago / cuenta actualizado con éxito!');
      setAccountModalTarget(null);
      loadData();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      setTimeout(() => setMsg(''), 3500);
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Formulario manual
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('SALIDA');
  const [category, setCategory] = useState('GASTO');
  const [manualAccount, setManualAccount] = useState('EFECTIVO_TIENDA');
  const [manualDate, setManualDate] = useState(getTodayCO());
  const [isTransferOpen, setIsTransferOpen] = useState(false);

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
      const initialPayments = history.filter(p => (p.notes || '').startsWith('Pago inicial') || p.notes?.includes('Pago inicial'));
      const subsequentAbonos = history.filter(p => !((p.notes || '').startsWith('Pago inicial') || p.notes?.includes('Pago inicial')));

      let initialPayment = 0;
      if (initialPayments.length > 0) {
        initialPayment = initialPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      } else {
        const abonosTotal = subsequentAbonos.reduce((sum, p) => sum + (p.amount || 0), 0);
        initialPayment = Math.max(0, (s.amount_paid || 0) - abonosTotal);
      }

      // Descontar anticipo previo si fue cruzado para evitar duplicar dinero
      const notes = s.delivery_notes || '';
      const match = notes.match(/\[ANTICIPO_CRUZADO:(\d+)/i);
      const antCruzado = match ? Number(match[1]) : 0;
      const freshPayment = Math.max(0, initialPayment - antCruzado);

      const sAcc = s.payment_method || 'EFECTIVO_TIENDA';

      const sellerName = s.user ? (s.user.full_name || s.user.username) : (s.sale_channel && s.sale_channel !== 'LOCAL' && s.sale_channel !== 'DOMICILIO' ? s.sale_channel : 'Tienda');
      const creatorName = s.creator ? (s.creator.full_name || s.creator.username) : null;

      if (freshPayment > 0) {
        list.push({
          id: "sale-" + s.id + "-init",
          saleId: s.id,
          paymentId: initialPayments.length > 0 ? initialPayments[0].id : null,
          desc: "VENTA #" + s.id + " - " + (s.customer_name || 'CLIENTE FINAL') + (antCruzado > 0 ? ' (PARCIAL ANTICIPO)' : ''),
          amount: freshPayment,
          type: 'ENTRADA',
          cat: 'VENTA',
          account: (initialPayments.length > 0 && initialPayments[0].account) ? initialPayments[0].account : sAcc,
          date: s.created_at,
          isSale: true,
          sale: s,
          sellerName,
          creatorName
        });
      }

      subsequentAbonos.filter(p => p.account !== 'ANTICIPO_CRUZADO').forEach(p => {
        list.push({
          id: "sale-" + s.id + "-pay-" + p.id,
          saleId: s.id,
          paymentId: p.id,
          payment: p,
          desc: "ABONO VENTA #" + s.id + " - " + (s.customer_name || 'CLIENTE FINAL'),
          amount: p.amount,
          type: 'ENTRADA',
          cat: 'ABONO',
          account: p.account || sAcc,
          date: p.payment_date,
          isSale: true,
          sale: s,
          sellerName,
          creatorName
        });
      });
    });

    // Movimientos de caja (incluyendo traslados y gastos)
    movements.forEach(m => {
      const mCat = (m.category || '').toUpperCase();
      const mDesc = (m.description || '').toUpperCase();
      
      // Filtrar ventas duplicadas y ajustes de saldo histórico
      if (mCat === 'VENTA' || mCat === 'AJUSTE_CORTE' || mCat.includes('AJUSTE') || mDesc.includes('AJUSTE CORTE')) {
        return;
      }

      let acc = m.account;
      if (!acc || acc === 'EFECTIVO_TIENDA') {
        acc = inferAccountFromDesc(m.description, acc || 'EFECTIVO_TIENDA');
      }

      const mDate = m.payment_date || m.created_at;
      list.push({
        id: "csh-" + m.id,
        rawMovementId: m.id,
        desc: m.description,
        amount: m.amount,
        type: m.type,
        cat: m.category,
        account: acc,
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

        // Filtrar movimientos pertenecientes a CASA (Caja Mayor / Nómina de cortes / Reinversiones)
        const fAcc = f.account || '';
        const fDesc = (f.desc || '').toUpperCase();
        if (
          fAcc === 'EFECTIVO_CASA' || 
          fAcc === 'NEQUI_CASA' || 
          fAcc === 'BANCOLOMBIA' ||
          fDesc.includes('(NEQUI EN CASA)') ||
          fDesc.includes('NEQUI CASA') ||
          fDesc.includes('(EFECTIVO EN CASA)') ||
          fDesc.includes('EFECTIVO CASA') ||
          fDesc.includes('(CAJA MAYOR)') ||
          fDesc.includes('CAJA MAYOR') ||
          fDesc.includes('CORTE ANTERIOR')
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [unifiedFlow, lastActiveClosure]);

  // Cálculos del turno activo - EXCLUSIVAMENTE EFECTIVO FÍSICO DE TIENDA
  const physicalShiftFlow = useMemo(() => {
    return activeShiftFlow.filter(f => (f.account || 'EFECTIVO_TIENDA') === 'EFECTIVO_TIENDA');
  }, [activeShiftFlow]);

  const shiftTotalIn = useMemo(() => {
    return physicalShiftFlow.filter(e => e.type === 'ENTRADA').reduce((sum, e) => sum + e.amount, 0);
  }, [physicalShiftFlow]);

  const shiftTotalOut = useMemo(() => {
    return physicalShiftFlow.filter(e => e.type === 'SALIDA').reduce((sum, e) => sum + e.amount, 0);
  }, [physicalShiftFlow]);

  const shiftNetVentas = shiftTotalIn - shiftTotalOut; // Dinero físico neto del cajón
  const totalEnCajon = (Number(baseCaja) || 0) + shiftNetVentas; // Efectivo físico real en caja

  // Ventas totales de este turno (Efectivo físico + Cobros digitales)
  const shiftTotalAllSales = useMemo(() => {
    return activeShiftFlow.filter(e => e.type === 'ENTRADA').reduce((sum, e) => sum + e.amount, 0);
  }, [activeShiftFlow]);

  // Desglose de abonos vs ventas directas para el detalle del corte
  const shiftAbonos = useMemo(() => {
    return activeShiftFlow.filter(e => e.type === 'ENTRADA' && e.cat === 'ABONO').reduce((sum, e) => sum + e.amount, 0);
  }, [activeShiftFlow]);

  const shiftVentasDirectas = useMemo(() => {
    return activeShiftFlow.filter(e => e.type === 'ENTRADA' && e.cat === 'VENTA').reduce((sum, e) => sum + e.amount, 0);
  }, [activeShiftFlow]);

  const shiftPhysicalVentas = useMemo(() => {
    return physicalShiftFlow.filter(e => e.type === 'ENTRADA' && e.cat === 'VENTA').reduce((sum, e) => sum + e.amount, 0);
  }, [physicalShiftFlow]);

  // Desglose de cobros digitales en este turno (Nequi Cristian, Nequi David, Bancolombia, etc.)
  const digitalShiftSummary = useMemo(() => {
    const digitals = activeShiftFlow.filter(f => (f.account || 'EFECTIVO_TIENDA') !== 'EFECTIVO_TIENDA');
    const byAccount = {};
    digitals.forEach(d => {
      const acc = d.account;
      if (!byAccount[acc]) byAccount[acc] = 0;
      if (d.type === 'ENTRADA') byAccount[acc] += d.amount;
      else byAccount[acc] -= d.amount;
    });
    const totalDigital = Object.values(byAccount).reduce((s, v) => s + v, 0);
    return { byAccount, totalDigital, count: digitals.length };
  }, [activeShiftFlow]);

  // Saldo disponible en el turno activo según la cuenta seleccionada
  const getShiftAccountBalance = (acc) => {
    if (acc === 'EFECTIVO_TIENDA') return totalEnCajon;
    if (acc === 'NEQUI_CRISTIAN') return digitalShiftSummary.byAccount?.NEQUI_CRISTIAN || 0;
    if (acc === 'NEQUI_DAVID') return digitalShiftSummary.byAccount?.NEQUI_DAVID || 0;
    return 0;
  };

  // Abrir modal de cierre - SIEMPRE arrancar con la fecha real de hoy en Colombia
  const handleOpenCierreModal = () => {
    setCierreDate(getTodayCO());
    setCierreBaseSiguiente(baseCaja);
    setCierreModalOpen(true);
  };

  // Confirmar Cierre de Caja
  const handleConfirmCierre = async () => {
    setIsSubmitting(true);
    try {
      const closureDateTime = cierreDate + "T23:59:59";
      const descText = "CIERRE DE CAJA (Ventas Totales: $" + fmt(shiftTotalAllSales) + " | Efectivo Tienda: $" + fmt(shiftTotalIn) + " - Gastos: $" + fmt(shiftTotalOut) + " = Guardado: $" + fmt(shiftNetVentas) + " | Nequi: $" + fmt(digitalShiftSummary.totalDigital) + " | Base: $" + fmt(cierreBaseSiguiente) + ")";
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

    if (type === 'SALIDA') {
      const avail = getShiftAccountBalance(manualAccount);
      if (Number(amount) > avail) {
        const accInfo = getAccountInfo(manualAccount);
        alert(`Fondos insuficientes en el turno actual: La cuenta "${accInfo.fullLabel}" solo dispone de $${fmt(avail)}. No es posible realizar un gasto por $${fmt(Number(amount))}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        description: desc.toUpperCase(),
        amount: Number(amount),
        type,
        category,
        account: manualAccount
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

            {/* Resumen del Corte de Caja con Total Facturado y Desglose Completo */}
            <div className="space-y-2.5">
              {/* Tarjeta 1: Total Facturado / Recaudado en el Turno */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Total Facturado en el Turno (Todo)
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-black">
                    Ventas + Abonos
                  </span>
                </div>
                <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
                  ${fmt(shiftTotalAllSales)}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-slate-300 flex-wrap">
                  <span>💵 Efectivo: <strong className="font-mono text-white">${fmt(shiftTotalIn)}</strong></span>
                  <span>·</span>
                  <span>📱 Nequi: <strong className="font-mono text-white">${fmt(digitalShiftSummary.totalDigital)}</strong></span>
                  <span>·</span>
                  <span>🏷️ Abonos: <strong className="font-mono text-white">${fmt(shiftAbonos)}</strong></span>
                </div>
              </div>

              {/* Tarjeta 2: Desglose Efectivo Físico vs Nequi Digital */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-2.5 rounded-2xl">
                  <span className="text-[8px] font-black uppercase text-emerald-800 block">Efectivo Físico Retirar (Casa)</span>
                  <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">${fmt(shiftNetVentas)}</span>
                  <span className="text-[8px] text-emerald-600 block mt-0.5 font-bold">Ventas ${fmt(shiftTotalIn)} - Gastos ${fmt(shiftTotalOut)}</span>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-200/80 p-2.5 rounded-2xl">
                  <span className="text-[8px] font-black uppercase text-indigo-800 block">Nequi que pasa a Casa</span>
                  <span className="text-base font-black text-indigo-700 font-mono mt-0.5 block">+${fmt(digitalShiftSummary.totalDigital)}</span>
                  <span className="text-[8px] text-indigo-600 block mt-0.5 font-bold">Se consolida en Caja Mayor</span>
                </div>
              </div>

              {/* Tarjeta 3: Arqueo del Cajón Físico de Tienda */}
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] font-black text-amber-900 uppercase block">Total Efectivo en Cajón Hoy</span>
                  <p className="text-lg font-black text-amber-950 font-mono mt-0.5">${fmt(totalEnCajon)}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-amber-900 space-y-0.5">
                  <p>🔒 Retiras en efectivo a Casa: <strong className="font-mono">${fmt(shiftNetVentas)}</strong></p>
                  <p>🪙 Dejas en gaveta como Base: <strong className="font-mono">${fmt(cierreBaseSiguiente)}</strong></p>
                </div>
              </div>

              {/* Tarjeta 4: Total que se consolida en Casa */}
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between text-xs">
                <span className="text-[9px] font-black uppercase text-slate-600">🏠 Total Consolidado a Casa hoy:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  ${fmt(shiftNetVentas + digitalShiftSummary.totalDigital)}
                  <span className="text-[9px] font-normal text-slate-500 ml-1">
                    (Ef. ${fmt(shiftNetVentas)} + Nequi ${fmt(digitalShiftSummary.totalDigital)})
                  </span>
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Período a Cerrar:</span>
              <span className="font-black text-indigo-900 text-[11px] font-mono">
                {lastActiveClosure ? fmtDateTime(lastActiveClosure.date).split(',')[0] : fmtDateTime(shiftStartDate).split(',')[0]} → {cierreDate}
              </span>
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
            <button
              type="button"
              onClick={() => setIsTransferOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Trasladar fondos entre Nequi, Caja Tienda, Casa o Bancolombia"
            >
              <ArrowLeftRight size={12} />
              <span>Traslado / Retiro</span>
            </button>
            {isLoading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
            <div className="bg-white border border-slate-200/80 px-3 py-1.5 rounded-2xl shadow-xs flex items-center gap-2">
              <Calendar size={13} className="text-indigo-600" />
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-indigo-700 block leading-tight">
                  Corte: {lastActiveClosure ? fmtDateTime(lastActiveClosure.date).split(',')[0] : fmtDateTime(shiftStartDate).split(',')[0]} → Hoy
                </span>
                {lastActiveClosure && (
                  <span className="text-[8px] font-bold text-slate-400 block leading-none">
                    Último corte: {fmtDateTime(lastActiveClosure.date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RESUMEN DEL FLUJO Y CORTE DEL TURNO */}
        {subTab === 'turno' && (
          <div className="space-y-2 mb-3 px-2">
            {/* Banner Principal del Turno: Total del Flujo Facturado */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 block">
                  Total Flujo del Turno (Ventas + Abonos)
                </span>
                <p className="text-2xl font-black font-mono text-emerald-400 tracking-tight mt-0.5">
                  +${fmt(shiftTotalAllSales)}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-300 flex-wrap">
                  <span className="bg-white/10 px-2 py-0.5 rounded-md">
                    📱 Nequi: ${fmt(digitalShiftSummary.totalDigital)}
                  </span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md">
                    🏷️ Abonos: ${fmt(shiftAbonos)}
                  </span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md">
                    🛍️ Mostrador: ${fmt(shiftPhysicalVentas)}
                  </span>
                </div>
              </div>
              <div className="text-right border-l border-white/10 pl-3">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                  Efectivo Físico Neto
                </span>
                <p className="text-base font-black font-mono text-white mt-0.5">
                  ${fmt(shiftNetVentas)}
                </p>
                <span className="text-[9px] text-indigo-200 block">
                  (a guardar en Casa)
                </span>
              </div>
            </div>

            {/* Fila de 3 Indicadores Rápidos: Efectivo Cajón, En Nequi y Gastos */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-emerald-100 rounded-2xl p-2.5 shadow-xs bg-emerald-50/20">
                <span className="text-[8px] font-black uppercase text-emerald-600 block leading-tight">Total Efectivo en Cajón</span>
                <span className="text-xs font-black text-emerald-700 font-mono mt-0.5 block">${fmt(totalEnCajon)}</span>
                <span className="text-[8px] font-bold text-slate-400 block truncate">Base ${fmt(baseCaja)} + Neto ${fmt(shiftNetVentas)}</span>
              </div>

              <div className="bg-white border border-indigo-100 rounded-2xl p-2.5 shadow-xs bg-indigo-50/20">
                <span className="text-[8px] font-black uppercase text-indigo-600 block leading-tight">En Nequi (Turno)</span>
                <span className="text-xs font-black text-indigo-700 font-mono mt-0.5 block">+${fmt(digitalShiftSummary.totalDigital)}</span>
                <span className="text-[8px] font-bold text-slate-400 block truncate">Se traslada a Casa al cerrar</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs">
                <span className="text-[8px] font-black uppercase text-rose-500 block leading-tight">Gastos del Turno (-)</span>
                <span className="text-xs font-black text-rose-600 font-mono mt-0.5 block">-${fmt(shiftTotalOut)}</span>
                <span className="text-[8px] font-bold text-slate-400 block truncate">{shiftTotalOut > 0 ? 'Salidas registradas' : 'Sin egresos'}</span>
              </div>
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
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                        <span>{fmtDateTime(f.date)}</span>
                        <span>·</span>
                        <span className="text-slate-600">{f.cat}</span>
                        {f.account && (
                          <button
                            type="button"
                            onClick={() => handleOpenChangeAccountModal(f)}
                            title="Clic para corregir cuenta o método de cobro"
                            className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ml-1 hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer ${getAccountInfo(f.account).badgeClass}`}
                          >
                            <span>{getAccountInfo(f.account).icon} {getAccountInfo(f.account).label}</span>
                            <Edit3 size={9} className="opacity-60" />
                          </button>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={"font-black text-sm " + (f.type === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600')}>
                      {f.type === 'ENTRADA' ? '+' : '-'}${fmt(f.amount)}
                    </span>
                    {f.saleId && (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = `#/sales?search=${f.saleId}`;
                          if (typeof onClose === 'function') onClose();
                        }}
                        title={`Ir a ver o modificar Venta #${f.saleId} en Portal Ventas`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenChangeAccountModal(f)}
                      title="Cambiar método o cuenta de este movimiento"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    {f.saleId && f.paymentId && (
                      <button
                        type="button"
                        onClick={() => handleDeletePaymentFromFlow(f)}
                        title="Eliminar este abono o cobro si fue registrado por error"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
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
              <div className="flex items-center gap-1.5">
                <button 
                  type="button" 
                  onClick={() => { setDesc('ANTICIPO CHAQUETA - CLIENTE: '); setAmount(''); setType('ENTRADA'); setCategory('ANTICIPO PREVENTA'); }}
                  className="px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[10px] font-black shadow-xs hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  + Anticipo
                </button>
                <button 
                  type="button" 
                  onClick={() => { setDesc('BASE INICIAL EFECTIVO'); setAmount(''); setType('ENTRADA'); setCategory('OTROS'); }}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-black shadow-xs hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  + Base Inicial
                </button>
              </div>
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

              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Cuenta / Origen de Fondos</label>
                <select
                  value={manualAccount}
                  onChange={e => setManualAccount(e.target.value)}
                  className="w-full border-2 border-slate-100 rounded-xl px-2.5 py-2 font-bold text-[11px] outline-none bg-white cursor-pointer"
                >
                  <optgroup label="🏪 Fondos del Turno de Hoy (Caja Local)">
                    {FINANCIAL_ACCOUNTS.filter(a => a.scope === 'TIENDA').map(a => (
                      <option key={a.id} value={a.id}>
                        {a.icon} {a.fullLabel} (Turno: ${fmt(getShiftAccountBalance(a.id))})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🏠 Cuentas de Casa (Caja Mayor)">
                    {FINANCIAL_ACCOUNTS.filter(a => a.scope === 'CASA').map(a => (
                      <option key={a.id} value={a.id}>
                        {a.icon} {a.fullLabel}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className="flex items-center justify-between text-[10px] px-1 mt-1">
                  <span className="font-bold text-slate-400 uppercase text-[9px]">Saldo disponible en turno:</span>
                  <span className={`font-mono font-black ${getShiftAccountBalance(manualAccount) <= 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    ${fmt(getShiftAccountBalance(manualAccount))}
                  </span>
                </div>
              </div>

              {/* Alerta de fondos insuficientes en turno */}
              {type === 'SALIDA' && Number(amount) > getShiftAccountBalance(manualAccount) && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <AlertCircle size={14} className="shrink-0 text-rose-600" />
                  <span>Fondos insuficientes en turno: Disponible: ${fmt(getShiftAccountBalance(manualAccount))}.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                  <select 
                    value={type} 
                    onChange={e => {
                      const newType = e.target.value;
                      setType(newType);
                      setCategory(newType === 'SALIDA' ? 'GASTO' : 'ANTICIPO PREVENTA');
                    }} 
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
                        <option value="CRUCE ANTICIPO">CRUCE ANTICIPO</option>
                        <option value="REINVERSION">REINVERSIÓN</option>
                        <option value="SALARIO">SALARIO</option>
                        <option value="ADELANTO">ADELANTO</option>
                        <option value="DEVOLUCION">DEVOLUCIÓN</option>
                        <option value="PRESTAMO">PRÉSTAMO</option>
                        <option value="OTRO">OTRO</option>
                      </>
                    ) : (
                      <>
                        <option value="ANTICIPO PREVENTA">ANTICIPO / PREVENTA</option>
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
              disabled={isSubmitting || !desc || !amount || (type === 'SALIDA' && (Number(amount) > getShiftAccountBalance(manualAccount) || getShiftAccountBalance(manualAccount) <= 0))}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 font-black uppercase text-xs hover:bg-indigo-700 shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Registrando...' : 'Agregar Al Flujo'}
            </button>
            {msg && <p className="text-center font-black text-[10px] uppercase text-emerald-600 mt-2">{msg}</p>}
          </div>
        </form>
      </div>
      {/* MODAL DE TRASLADO ENTRE CUENTAS EN MODULO CAJA */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        defaultSource="EFECTIVO_TIENDA"
        defaultDest="NEQUI_CRISTIAN"
        context="terminal"
        onTransferSuccess={loadData}
        balances={{
          EFECTIVO_TIENDA: totalEnCajon,
          NEQUI_CRISTIAN: digitalShiftSummary.byAccount?.NEQUI_CRISTIAN || 0,
          NEQUI_DAVID: digitalShiftSummary.byAccount?.NEQUI_DAVID || 0,
          EFECTIVO_CASA: 0,
          NEQUI_CASA: 0,
          BANCOLOMBIA: 0
        }}
      />

      {/* MODAL DE EDICIÓN RÁPIDA DE CUENTA / MÉTODO DE PAGO */}
      {accountModalTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Corrección de Cuenta
                </span>
                <h3 className="text-base font-black text-slate-800 mt-1">Cambiar Método de Cobro</h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
              <p className="font-black text-slate-800 uppercase leading-snug">{accountModalTarget.desc}</p>
              <p className="text-slate-500 font-bold mt-1">
                Monto: <span className="font-black text-emerald-600">${fmt(accountModalTarget.amount)}</span>
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
                ¿En qué cuenta ingresó o salió este dinero?
              </label>
              <div className="space-y-1.5">
                {FINANCIAL_ACCOUNTS.map(acc => {
                  const isSelected = selectedAccount === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccount(acc.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{acc.icon}</span>
                        <div>
                          <p className="text-xs font-black text-slate-800">{acc.fullLabel}</p>
                          <p className="text-[10px] text-slate-400">{acc.label}</p>
                        </div>
                      </div>
                      {isSelected && <Check size={16} className="text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAccountModalTarget(null)}
                disabled={isSavingAccount}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAccountChange}
                disabled={isSavingAccount || selectedAccount === accountModalTarget.account}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                {isSavingAccount ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isSavingAccount ? 'Guardando...' : 'Confirmar Cambio'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TERMINAL MODAL PRINCIPAL ─────────────────────────────────────────────────
export default function TerminalModal({ isOpen, onClose, initialDeliveryMode = false, initialTab = null, initialLayawayId = null }) {
  useBodyScrollLock(isOpen);
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [activeTab, setActiveTab] = useState('ventas');
  const inventoryData = useInventory(isOpen);
  const { inventory, reloadInventory, refreshing } = inventoryData;

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

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // TODOS LOS HOOKS SE HAN LLAMADO. AHORA SÍ EL GUARD DE SALIDA:
  if (!isOpen) return null;

  const effectiveTab = (!isAdmin && (activeTab === 'stock' || activeTab === 'caja')) ? 'ventas' : activeTab;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-0 sm:p-2 md:p-4">
      <div className="bg-white w-full h-full sm:w-[98vw] sm:h-[96vh] max-w-7xl rounded-none sm:rounded-[32px] md:rounded-[40px] shadow-2xl flex flex-col lg:flex-row overflow-hidden border border-white/20">

        {/* BARRA SUPERIOR PARA MÓVIL Y TABLET (< lg) */}
        <div className="lg:hidden bg-slate-900 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2 shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-xl">
                <Store size={18} />
              </div>
              <div>
                <h1 className="font-black italic text-sm tracking-tight leading-tight text-white">ESTILO NÓRDICO</h1>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Terminal v2.0 · Pasto / Samaniego</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Cerrar Terminal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Pestañas de navegación horizontal */}
          <nav className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar-x py-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-tight shrink-0 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <span className={activeTab === tab.id ? (tab.id === 'ventas' ? 'text-emerald-400' : tab.id === 'separados' ? 'text-amber-400' : 'text-indigo-400') : 'text-slate-400'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* CONTENIDO MÓDULO */}
        <div className="flex-1 lg:flex-[4] flex flex-col bg-white overflow-hidden min-w-0">
          {effectiveTab === 'ventas' && <ModuloVentas inventory={inventory} reloadInventory={reloadInventory} refreshing={refreshing} initialDeliveryMode={initialDeliveryMode} />}
          {effectiveTab === 'separados' && <ModuloSeparados initialLayawayId={initialLayawayId} />}
          {isAdmin && effectiveTab === 'stock' && <ModuloStock inventory={inventory} reloadInventory={reloadInventory} />}
          {isAdmin && effectiveTab === 'caja' && <ModuloCaja />}
        </div>

        {/* NAVEGACIÓN LATERAL EXCLUSIVA PARA DESKTOP (>= lg) */}
        <div className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 bg-slate-50 border-l border-slate-200 p-6 xl:p-8 shrink-0">
          <div className="flex justify-between items-center mb-8 xl:mb-12">
            <h1 className="font-black italic text-base tracking-tighter text-slate-900">ESTILO NÓRDICO</h1>
            <button onClick={onClose}
              className="p-3 bg-white shadow-sm border border-slate-200 rounded-2xl hover:text-rose-500 hover:border-rose-200 transition-all cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-3 flex-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 p-4 xl:p-5 rounded-[25px] font-black text-[11px] uppercase transition-all cursor-pointer ${
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