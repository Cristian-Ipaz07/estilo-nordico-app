import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck, Package, CheckCircle2, Clock, User, Phone, MapPin, AlertCircle,
  Calendar, RefreshCw, DollarSign, Share2, Trash2, Check, Send, Navigation,
  MessageCircle, ExternalLink, ArrowRight, Shield, ShieldCheck, ChevronDown,
  Layers, ShoppingBag, X
} from 'lucide-react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { parseDeliveryNotes } from '../components/DeliveryNotificationsDrawer';
import SwapVariantModal from '../components/SwapVariantModal';
import { FINANCIAL_ACCOUNTS } from '../utils/accounts';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function DeliveryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isDriver = user?.can_deliver || isAdmin;
  const token = localStorage.getItem('token');

  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('todos'); // 'todos', 'por_alistar', 'alistado', 'en_camino', 'por_liquidar', 'entregados'
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  // Modal para que el Domiciliario registre la entrega y recaudo
  const [deliverModalSale, setDeliverModalSale] = useState(null);
  const [deliverAmount, setDeliverAmount] = useState(0);
  const [deliverMethod, setDeliverMethod] = useState('EFECTIVO');
  const [deliverNote, setDeliverNote] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);

  // Modal para que Cristian liquide el dinero en caja
  const [settleModalSale, setSettleModalSale] = useState(null);
  const [settleAccount, setSettleAccount] = useState('EFECTIVO_TIENDA');
  const [isSettling, setIsSettling] = useState(false);

  // Modal de cambio de prenda / talla
  const [swapModalData, setSwapModalData] = useState(null); // { sale, item }

  // Cargar ventas
  const fetchSales = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${API_URL}/sales/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSales(data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    fetchSales();
    window.addEventListener('refresh-sales', fetchSales);
    return () => window.removeEventListener('refresh-sales', fetchSales);
  }, [fetchSales]);

  // Filtrar domicilios
  const deliverySales = useMemo(() => {
    return sales.filter(s => {
      const isDomi = s.sale_channel === 'DOMICILIO' || !!s.delivery_address || s.status === 'en_domicilio';
      return isDomi;
    });
  }, [sales]);

  // Contadores
  const countPorAlistar = useMemo(() => {
    return deliverySales.filter(s => (s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'separado') && s.status !== 'cancelado').length;
  }, [deliverySales]);

  const countAlistados = useMemo(() => {
    return deliverySales.filter(s => s.status === 'alistado').length;
  }, [deliverySales]);

  const countEnCamino = useMemo(() => {
    return deliverySales.filter(s => s.status === 'en_camino').length;
  }, [deliverySales]);

  const countPorLiquidar = useMemo(() => {
    return deliverySales.filter(s => s.status === 'entregado' && !s.cash_settled).length;
  }, [deliverySales]);

  const countEntregados = useMemo(() => {
    return deliverySales.filter(s => s.status === 'pagado' || (s.status === 'entregado' && s.cash_settled)).length;
  }, [deliverySales]);

  // Ventas según pestaña activa
  const filteredSales = useMemo(() => {
    if (filterTab === 'por_alistar') {
      return deliverySales.filter(s => (s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'separado') && s.status !== 'cancelado');
    }
    if (filterTab === 'alistado') {
      return deliverySales.filter(s => s.status === 'alistado');
    }
    if (filterTab === 'en_camino') {
      return deliverySales.filter(s => s.status === 'en_camino');
    }
    if (filterTab === 'por_liquidar') {
      return deliverySales.filter(s => s.status === 'entregado' && !s.cash_settled);
    }
    if (filterTab === 'entregados') {
      return deliverySales.filter(s => s.status === 'pagado' || (s.status === 'entregado' && s.cash_settled));
    }
    // Todos activos
    return deliverySales.filter(s => s.status !== 'cancelado');
  }, [deliverySales, filterTab]);

  // Cambiar estado a 'alistado' (quien está en tienda)
  const handleMarkAlistado = async (saleId) => {
    setActionLoading(saleId);
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'alistado' })
      });
      if (!res.ok) throw new Error('Error al marcar alistado');
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Cambiar estado a 'en_camino' (domiciliario sale a ruta)
  const handleMarkEnCamino = async (saleId) => {
    setActionLoading(saleId);
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'en_camino', delivered_by: user?.id })
      });
      if (!res.ok) throw new Error('Error al iniciar ruta de entrega');
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Abrir modal de entrega para el domiciliario
  const openDeliverModal = (sale) => {
    setDeliverModalSale(sale);
    const balance = sale.balance_due > 0 ? sale.balance_due : (sale.total_price - sale.amount_paid);
    setDeliverAmount(balance > 0 ? balance : 0);
    setDeliverMethod('EFECTIVO');
    setDeliverNote('');
  };

  // Domiciliario confirma entrega y recaudo
  const handleDeliverSubmit = async (e) => {
    e.preventDefault();
    if (!deliverModalSale) return;
    setIsDelivering(true);
    try {
      const res = await fetch(`${API_URL}/sales/${deliverModalSale.id}/mark-delivered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_collected: Number(deliverAmount),
          payment_method: deliverMethod,
          notes: deliverNote
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al registrar entrega');
      }
      setDeliverModalSale(null);
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    } finally {
      setIsDelivering(false);
    }
  };

  // Abrir modal de liquidación en caja para Cristian (Admin)
  const openSettleModal = (sale) => {
    setSettleModalSale(sale);
    setSettleAccount('EFECTIVO_TIENDA');
  };

  // Cristian asienta el dinero en caja
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settleModalSale) return;
    setIsSettling(true);
    try {
      const res = await fetch(`${API_URL}/sales/${settleModalSale.id}/settle-cash?account=${settleAccount}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al liquidar en caja');
      }
      setSettleModalSale(null);
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSettling(false);
    }
  };

  // Anular domicilio y devolver prendas al inventario instantáneamente
  const handleCancelDelivery = async (saleId) => {
    if (!window.confirm(`¿Seguro que el cliente canceló o rechazó el domicilio #${saleId}? Las prendas volverán de inmediato al inventario disponible.`)) return;
    setActionLoading(saleId);
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}/cancel-delivery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al anular domicilio');
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Copiar ficha de entrega
  const handleCopyGuide = (sale) => {
    const parsed = parseDeliveryNotes(sale.delivery_notes);
    const seller = sale.user?.full_name || 'Estilo Nórdico';
    const itemsList = (sale.items || [])
      .map(it => `• 1x ${it.product?.name || 'Prenda'} (${it.product?.ref || ''}) ${it.product?.size ? `TALLA: ${it.product.size}` : ''}`)
      .join('\n');
    const balance = sale.balance_due > 0 ? sale.balance_due : (sale.total_price - sale.amount_paid);

    const text = `🛵 *GUÍA DE DOMICILIO — VENTA #${sale.id}*\n\n` +
      `👤 *Cliente:* ${sale.customer_name}\n` +
      `📱 *Teléfono:* ${parsed.phone || 'N/A'}\n` +
      `📍 *Dirección:* ${sale.delivery_address || 'Pasto'}\n` +
      (parsed.notes ? `⚠️ *Instrucciones:* ${parsed.notes}\n` : '') +
      `\n📦 *PRENDAS:*\n${itemsList}\n\n` +
      `💵 *A COBRAR:* $${fmt(balance)} ${balance === 0 ? '(PAGADO)' : ''}\n` +
      `🏷️ *Vendedor:* ${seller}`;

    navigator.clipboard.writeText(text);
    setCopiedId(sale.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleCheck = (saleId, itemId) => {
    const key = `${saleId}-${itemId}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 bg-purple-600 text-white rounded-2xl shadow-md shadow-purple-200">
            <Truck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Domicilios & Entregas
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-700">
                Pasto
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              Alistamiento en tienda, ruta de mensajería y liquidación en caja
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSales}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Recargar entregas"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs de Filtro */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar text-xs font-black">
        <button
          onClick={() => setFilterTab('todos')}
          className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition cursor-pointer ${
            filterTab === 'todos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          TODOS ({deliverySales.filter(s => s.status !== 'cancelado').length})
        </button>

        <button
          onClick={() => setFilterTab('por_alistar')}
          className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            filterTab === 'por_alistar'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          <span>📋 POR ALISTAR</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-black">
            {countPorAlistar}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('alistado')}
          className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            filterTab === 'alistado'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50'
          }`}
        >
          <span>📦 ALISTADOS</span>
          <span className="px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-900 font-black">
            {countAlistados}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('en_camino')}
          className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            filterTab === 'en_camino'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
          }`}
        >
          <span>🛵 EN CAMINO</span>
          <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-900 font-black">
            {countEnCamino}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('por_liquidar')}
          className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            filterTab === 'por_liquidar'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
          }`}
        >
          <span>⚠️ POR LIQUIDAR</span>
          <span className="px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-900 font-black">
            {countPorLiquidar}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('entregados')}
          className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            filterTab === 'entregados'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <span>✅ ENTREGADOS ({countEntregados})</span>
        </button>
      </div>

      {/* Listado de Domicilios */}
      {filteredSales.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Truck size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-black text-slate-700 text-base">No hay domicilios en este estado</h3>
          <p className="text-xs text-slate-400 mt-1">
            Los pedidos con canal "DOMICILIO" aparecerán automáticamente aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {filteredSales.map(sale => {
            const parsed = parseDeliveryNotes(sale.delivery_notes);
            const balance = sale.balance_due > 0 ? sale.balance_due : (sale.total_price - sale.amount_paid);
            const isAlistado = sale.status === 'alistado';
            const isEnCamino = sale.status === 'en_camino';
            const isEntregado = sale.status === 'entregado';
            const isPagado = sale.status === 'pagado';
            const isPorAlistar = !isAlistado && !isEnCamino && !isEntregado && !isPagado;
            const cleanPhone = (parsed.phone || '').replace(/\D/g, '');
            const encodedAddr = encodeURIComponent(`${sale.delivery_address || ''} Pasto Nariño`);

            return (
              <div
                key={sale.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Cabecera Tarjeta */}
                <div className="p-5 border-b border-slate-100 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-base">
                        Venta #{sale.id}
                      </span>
                      {/* Estado Badge */}
                      {isPorAlistar && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">
                          📋 POR ALISTAR
                        </span>
                      )}
                      {isAlistado && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 text-sky-800">
                          📦 ALISTADO EN BOLSA
                        </span>
                      )}
                      {isEnCamino && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800">
                          🛵 EN CAMINO
                        </span>
                      )}
                      {isEntregado && !sale.cash_settled && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-800">
                          ⚠️ RECAUDADO (POR LIQUIDAR)
                        </span>
                      )}
                      {isPagado && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                          ✅ ENTREGADO & LIQUIDADO
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleCopyGuide(sale)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                      title="Copiar guía de entrega"
                    >
                      {copiedId === sale.id ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
                    </button>
                  </div>

                  {/* Cliente y Acciones de Contacto */}
                  <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-sm truncate">
                        {sale.customer_name}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={12} />
                        {parsed.phone || 'Sin teléfono'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {cleanPhone && (
                        <>
                          <a
                            href={`https://wa.me/57${cleanPhone}?text=${encodeURIComponent(`Hola ${sale.customer_name}, soy Andrés de Estilo Nórdico. Voy en camino con tu entrega a ${sale.delivery_address || 'tu dirección'}. ✨`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition shadow-xs"
                            title="Escribir al WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </a>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="p-2 bg-slate-800 hover:bg-black text-white rounded-xl transition shadow-xs"
                            title="Llamar"
                          >
                            <Phone size={15} />
                          </a>
                        </>
                      )}
                      {sale.delivery_address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodedAddr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition border border-indigo-200"
                          title="Abrir en Google Maps"
                        >
                          <Navigation size={15} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Dirección */}
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-slate-800">{sale.delivery_address || 'Dirección no especificada'}</span>
                      {parsed.date && (
                        <span className="block text-[11px] font-bold text-slate-400 mt-0.5">
                          📅 Fecha programada: {parsed.date} {parsed.time ? `• ⏰ ${parsed.time}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Observaciones destacadas */}
                  {parsed.notes && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 font-bold flex items-start gap-2">
                      <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-amber-700 font-black block">Nota Especial:</span>
                        <span>{parsed.notes}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prendas a Entregar */}
                <div className="p-5 bg-slate-50/50 space-y-2 border-b border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Prendas del Pedido:
                  </p>
                  <div className="space-y-2">
                    {(sale.items || []).map(item => {
                      const checkKey = `${sale.id}-${item.id}`;
                      const isChecked = !!checkedItems[checkKey];
                      const p = item.product;

                      return (
                        <div
                          key={item.id}
                          className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheck(sale.id, item.id)}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className={`text-xs font-black truncate ${isChecked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {p?.name || 'Prenda'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                                <span>{p?.ref}</span>
                                {p?.size && (
                                  <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-sm font-black">
                                    TALLA {p.size}
                                  </span>
                                )}
                                {p?.color && <span>• {p.color}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Botón para cambiar de talla en destino */}
                            <button
                              type="button"
                              onClick={() => setSwapModalData({ sale, item })}
                              className="px-2.5 py-1 text-[11px] font-black text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition flex items-center gap-1 cursor-pointer"
                              title="El cliente se probó otra talla y se queda con ella"
                            >
                              <RefreshCw size={11} />
                              <span>Cambiar Talla</span>
                            </button>

                            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                              {item.quantity} un.
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Saldo y Botones de Acción */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Cobro Contraentrega
                      </p>
                      <p className="text-xl font-black text-slate-900">
                        ${fmt(balance)}
                        {balance === 0 && <span className="text-xs font-bold text-emerald-600 ml-1.5">(Pagado)</span>}
                      </p>
                    </div>

                    {sale.user && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Vendedor</p>
                        <p className="text-xs font-bold text-slate-700">{sale.user.full_name}</p>
                      </div>
                    )}
                  </div>

                  {/* Acciones según el estado del pedido */}
                  <div className="flex flex-col gap-2">
                    {/* 1. Alistamiento en Tienda */}
                    {isPorAlistar && (
                      <button
                        onClick={() => handleMarkAlistado(sale.id)}
                        disabled={actionLoading === sale.id}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Package size={15} />
                        <span>Empacar y Marcar Alistado en Bolsa</span>
                      </button>
                    )}

                    {/* 2. Domiciliario toma el paquete y sale en la moto */}
                    {isAlistado && (
                      <button
                        onClick={() => handleMarkEnCamino(sale.id)}
                        disabled={actionLoading === sale.id}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Truck size={15} />
                        <span>Marcar En Camino (Iniciar Ruta)</span>
                      </button>
                    )}

                    {/* 3. En Camino: Entregar y Cobrar O Cancelar */}
                    {isEnCamino && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openDeliverModal(sale)}
                          className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 size={15} />
                          <span>Entregar & Cobrar</span>
                        </button>

                        <button
                          onClick={() => handleCancelDelivery(sale.id)}
                          disabled={actionLoading === sale.id}
                          className="py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-2xl border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Cliente Canceló</span>
                        </button>
                      </div>
                    )}

                    {/* 4. Entregado por Domiciliario: Liquidación en Caja */}
                    {isEntregado && !sale.cash_settled && (
                      <div className="space-y-2">
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-xs text-orange-950 font-bold">
                          🛵 Dinero recaudado por {sale.delivery_person?.full_name || 'Andrés'}: ${fmt(sale.amount_paid)}
                          <p className="text-[11px] text-orange-700 font-normal mt-0.5">
                            Pendiente entrega física del dinero a Cristian en tienda.
                          </p>
                        </div>

                        {isAdmin ? (
                          <button
                            onClick={() => openSettleModal(sale)}
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <DollarSign size={15} />
                            <span>Recibir Dinero y Asentar en Caja</span>
                          </button>
                        ) : (
                          <p className="text-[11px] text-slate-400 text-center font-bold">
                            Esperando confirmación de caja por Cristian
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para que el Domiciliario registre entrega y recaudo */}
      {deliverModalSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Registrar Entrega & Recaudo</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase">Venta #{deliverModalSale.id} — {deliverModalSale.customer_name}</p>
              </div>
              <button
                onClick={() => setDeliverModalSale(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeliverSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  Monto Recibido del Cliente ($)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={deliverAmount}
                  onChange={e => setDeliverAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1.5">
                  Medio de Pago Recibido
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDeliverMethod(m)}
                      className={`py-2.5 rounded-xl text-xs font-black transition border cursor-pointer ${
                        deliverMethod === m
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  Observaciones de Entrega (Opcional)
                </label>
                <input
                  type="text"
                  value={deliverNote}
                  onChange={e => setDeliverNote(e.target.value)}
                  placeholder="Ej. Recibido por la mamá de Carmen"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeliverModalSale(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDelivering}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>{isDelivering ? 'Guardando...' : 'Confirmar Entrega'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para que Cristian asiente en caja */}
      {settleModalSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Liquidar Entrega en Caja</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase">Confirmación en Manos de Cristian</p>
              </div>
              <button
                onClick={() => setSettleModalSale(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-xs font-bold text-purple-950 space-y-1">
              <p>Venta #{settleModalSale.id} — {settleModalSale.customer_name}</p>
              <p>Monto a Ingresar: <span className="text-base font-black">${fmt(settleModalSale.total_price)}</span></p>
              <p className="text-[11px] text-purple-700">Entregado por: {settleModalSale.delivery_person?.full_name || 'Andrés'}</p>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1.5">
                  Cuenta donde Ingresa el Dinero
                </label>
                <select
                  value={settleAccount}
                  onChange={e => setSettleAccount(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="EFECTIVO_TIENDA">Efectivo Tienda (Gaveta)</option>
                  <option value="NEQUI_CRISTIAN">Nequi Cristian</option>
                  <option value="BANCOLOMBIA">Bancolombia</option>
                  <option value="EFECTIVO_CASA">Efectivo Casa (Caja Mayor)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettleModalSale(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <DollarSign size={15} />
                  <span>{isSettling ? 'Asentando...' : 'Asentar en Caja'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Cambio de Talla en Destino */}
      {swapModalData && (
        <SwapVariantModal
          isOpen={!!swapModalData}
          onClose={() => setSwapModalData(null)}
          sale={swapModalData.sale}
          itemToExchange={swapModalData.item}
          onSuccess={fetchSales}
        />
      )}
    </div>
  );
}
