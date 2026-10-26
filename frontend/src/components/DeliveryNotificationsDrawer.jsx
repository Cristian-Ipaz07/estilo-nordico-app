import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  User,
  Phone,
  MapPin,
  AlertCircle,
  Calendar,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  DollarSign,
  Share2,
  Trash2,
  Check,
  Send
} from 'lucide-react';
import { API_URL } from '../config/api';
import { normalizeImageUrl } from '../utils/imageOptimizer';
import { FINANCIAL_ACCOUNTS } from '../utils/accounts';
import SwapVariantModal from './SwapVariantModal';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// Helper para extraer campos estructurados de delivery_notes (TEL, ENTREGA, HORA, NOTAS)
export const parseDeliveryNotes = (notes) => {
  if (!notes) return { phone: '', date: '', time: '', notes: '', raw: '' };
  const raw = String(notes);
  const parts = raw.split('|').map(p => p.trim());
  let phone = '';
  let date = '';
  let time = '';
  let extraNotes = [];

  parts.forEach(p => {
    if (p.startsWith('TEL:')) phone = p.replace('TEL:', '').trim();
    else if (p.startsWith('ENTREGA:')) date = p.replace('ENTREGA:', '').trim();
    else if (p.startsWith('FECHA:')) date = p.replace('FECHA:', '').trim();
    else if (p.startsWith('HORA:')) time = p.replace('HORA:', '').trim();
    else if (p.startsWith('NOTAS:')) extraNotes.push(p.replace('NOTAS:', '').trim());
    else if (!p.startsWith('[')) extraNotes.push(p);
  });

  return {
    phone,
    date,
    time,
    notes: extraNotes.join(' - '),
    raw
  };
};

// Helper para fetch con reintentos automáticos (ideal para cold-starts de Render)
const fetchWithRetry = async (url, options, retries = 2, delayMs = 1200) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
};

export default function DeliveryNotificationsDrawer({ isOpen, onClose, onOpenTerminal }) {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('todos'); // 'todos', 'por_alistar', 'alistado', 'en_camino'
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  // Modal para confirmar cobro
  const [confirmModalSale, setConfirmModalSale] = useState(null);
  const [confirmAccount, setConfirmAccount] = useState('EFECTIVO_TIENDA');
  const [isConfirming, setIsConfirming] = useState(false);
  const [swapModalData, setSwapModalData] = useState(null);

  const fetchSales = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setIsLoading(true);
    fetch(`${API_URL}/sales/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSales(data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSales();
    }
  }, [isOpen, fetchSales]);

  useEffect(() => {
    window.addEventListener('refresh-sales', fetchSales);
    return () => window.removeEventListener('refresh-sales', fetchSales);
  }, [fetchSales]);

  // Filtrar solo domicilios y pedidos activos (blindado contra descalibracion a 'separado')
  const activeDeliveries = useMemo(() => {
    return sales.filter(s => {
      const isDomi = s.sale_channel === 'DOMICILIO' || !!s.delivery_address || s.status === 'en_domicilio';
      const isActiveStatus = s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'alistado' || s.status === 'en_camino' || (s.status === 'entregado' && !s.cash_settled) || (isDomi && s.status === 'separado');
      return isDomi && isActiveStatus && s.status !== 'cancelado';
    });
  }, [sales]);

  const countPorAlistar = useMemo(() => {
    return activeDeliveries.filter(s => s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'separado').length;
  }, [activeDeliveries]);

  const countAlistados = useMemo(() => {
    return activeDeliveries.filter(s => s.status === 'alistado').length;
  }, [activeDeliveries]);

  const countEnCamino = useMemo(() => {
    return activeDeliveries.filter(s => s.status === 'en_camino').length;
  }, [activeDeliveries]);

  const countPorLiquidar = useMemo(() => {
    return activeDeliveries.filter(s => s.status === 'entregado' && !s.cash_settled).length;
  }, [activeDeliveries]);

  const filteredDeliveries = useMemo(() => {
    if (filterTab === 'por_alistar') {
      return activeDeliveries.filter(s => s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'separado');
    }
    if (filterTab === 'alistado') {
      return activeDeliveries.filter(s => s.status === 'alistado');
    }
    if (filterTab === 'en_camino') {
      return activeDeliveries.filter(s => s.status === 'en_camino');
    }
    if (filterTab === 'por_liquidar') {
      return activeDeliveries.filter(s => s.status === 'entregado' && !s.cash_settled);
    }
    return activeDeliveries;
  }, [activeDeliveries, filterTab]);

  // Cambiar estado de pedido (Alistado / En Camino)
  const handleUpdateStatus = async (saleId, newStatus) => {
    setActionLoading(saleId);
    // Actualización optimista inmediata en la UI
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: newStatus } : s));
    try {
      const res = await fetchWithRetry(`${API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Error al actualizar estado del domicilio');
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      fetchSales(); // revertir si falló
      alert(`Detalle de conexión:\n${e.message || 'El servidor tardó en responder'}. Si el servidor estaba suspendido, vuelve a intentarlo en un momento.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Confirmar cobro y entrega (asienta el dinero en caja)
  const handleConfirmDeliverySubmit = async () => {
    if (!confirmModalSale) return;
    setIsConfirming(true);
    try {
      const res = await fetchWithRetry(`${API_URL}/sales/${confirmModalSale.id}/confirm-delivery?account=${confirmAccount}&register_cash=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al asentar cobro');
      }
      setConfirmModalSale(null);
      fetchSales();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
    } catch (e) {
      alert(`Error al confirmar cobro:\n${e.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  // Anular domicilio y devolver prendas al stock
  const handleCancelDelivery = async (saleId) => {
    if (!window.confirm(`¿Seguro que deseas anular el domicilio #${saleId}? Las prendas volverán automáticamente al inventario.`)) return;
    setActionLoading(saleId);
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}/cancel-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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

  // Formatear texto para Telegram / Notion / WhatsApp y copiarlo
  const handleCopyGuide = (sale) => {
    const parsed = parseDeliveryNotes(sale.delivery_notes);
    const seller = sale.user?.full_name || sale.sale_channel || 'Sin asignar';
    const creator = sale.creator?.full_name || 'Admin';
    const saldoPendiente = Math.max(0, sale.total_sale - (sale.amount_paid || 0));

    const itemsText = (sale.items || []).map(i => {
      const p = i.product || {};
      const ref = p.ref || '';
      const name = p.name || 'Prenda';
      const size = p.size ? `Talla: ${p.size}` : '';
      const color = p.color ? `Color: ${p.color}` : '';
      const extra = [size, color].filter(Boolean).join(', ');
      return `• ${i.quantity}x ${name} (${ref}) ${extra ? `[${extra}]` : ''} - $${fmt(i.unit_price || i.price_at_sale)}`;
    }).join('\n');

    const msg = `🛵 *DOMICILIO ESTILO NÓRDICO #${sale.id}*\n` +
      `👤 *Cliente:* ${sale.customer_name}\n` +
      (parsed.phone ? `📞 *Teléfono:* ${parsed.phone}\n` : '') +
      (sale.delivery_address ? `📍 *Dirección:* ${sale.delivery_address}\n` : '') +
      (parsed.date ? `📅 *Entrega:* ${parsed.date}\n` : '') +
      (parsed.time ? `⏰ *Hora:* ${parsed.time}\n` : '') +
      `🏷️ *Vendedor (Comisión):* ${seller}\n` +
      `💻 *Registrado por:* ${creator}\n\n` +
      `🛍️ *Prendas a Entregar:*\n${itemsText}\n\n` +
      `💵 *TOTAL A COBRAR:* $${fmt(saldoPendiente)} (Contraentrega)\n` +
      (sale.amount_paid > 0 ? `🪙 *Abono previo:* $${fmt(sale.amount_paid)}\n` : '') +
      (parsed.notes ? `📝 *Notas:* ${parsed.notes}\n` : '');

    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(sale.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const toggleCheckItem = (saleId, itemId) => {
    const key = `${saleId}-${itemId}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 border-l border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header del Drawer */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <Truck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Domicilios & Entregas
                </h3>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-200">
                  {activeDeliveries.length} activos
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">
                Alistamiento en tienda y control de mensajería
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href="#/domicilio"
              onClick={onClose}
              className="p-2 hover:bg-purple-100 text-purple-700 rounded-xl transition flex items-center gap-1 text-xs font-black cursor-pointer"
              title="Abrir vista completa de Domicilios"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">Pantalla Completa</span>
            </a>
            <button
              onClick={fetchSales}
              disabled={isLoading}
              title="Actualizar lista"
              className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin text-purple-600' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Filtros E-Commerce */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => setFilterTab('todos')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'todos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({activeDeliveries.length})
          </button>
          <button
            onClick={() => setFilterTab('por_alistar')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'por_alistar'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <span>📋 Por Alistar</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-md text-[10px]">
              {countPorAlistar}
            </span>
          </button>
          <button
            onClick={() => setFilterTab('alistado')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'alistado'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            <span>📦 Alistados</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-md text-[10px]">
              {countAlistados}
            </span>
          </button>
          <button
            onClick={() => setFilterTab('en_camino')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'en_camino'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
            }`}
          >
            <span>🛵 En Camino</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-md text-[10px]">
              {countEnCamino}
            </span>
          </button>
          <button
            onClick={() => setFilterTab('por_liquidar')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'por_liquidar'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
            }`}
          >
            <span>💵 Por Liquidar</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-md text-[10px]">
              {countPorLiquidar}
            </span>
          </button>
        </div>

        {/* Lista de Domicilios */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {isLoading && activeDeliveries.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <RefreshCw size={24} className="animate-spin mx-auto text-purple-500" />
              <p className="text-xs font-bold">Cargando domicilios activos...</p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-sm border border-emerald-100">
                ✅
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800">¡Todo al día!</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  No hay domicilios pendientes en esta sección. Cuando registres un pedido a domicilio en el Terminal POS aparecerá aquí automáticamente.
                </p>
              </div>
              {onOpenTerminal && (
                <button
                  onClick={onOpenTerminal}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  + Nuevo Domicilio en POS
                </button>
              )}
            </div>
          ) : (
            filteredDeliveries.map(sale => {
              const parsed = parseDeliveryNotes(sale.delivery_notes);
              const sellerName = sale.user?.full_name || sale.sale_channel || 'Sin Asignar';
              const creatorName = sale.creator?.full_name || 'Admin';
              const saldoPendiente = Math.max(0, sale.total_sale - (sale.amount_paid || 0));
              const isPorAlistar = sale.status === 'en_domicilio' || sale.status === 'por_confirmar';
              const isAlistado = sale.status === 'alistado';
              const isEnCamino = sale.status === 'en_camino';
              const isPorLiquidar = sale.status === 'entregado' && !sale.cash_settled;

              const phoneClean = (parsed.phone || '').replace(/\D+/g, '');
              const whatsappUrl = phoneClean ? `https://wa.me/57${phoneClean}` : null;

              return (
                <div
                  key={sale.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                >
                  {/* Barra Superior de Estado */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-2.5 py-1 rounded-xl">
                        Venta #{sale.id}
                      </span>
                      {isPorAlistar && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 animate-pulse flex items-center gap-1">
                          <AlertCircle size={11} /> 📋 Por Alistar (Separar)
                        </span>
                      )}
                      {isAlistado && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                          <Package size={11} /> 📦 Alistado en Bolsa
                        </span>
                      )}
                      {isEnCamino && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                          <Truck size={11} /> 🛵 En Camino (Mensajero)
                        </span>
                      )}
                      {isPorLiquidar && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-purple-100 text-purple-950 border border-purple-300 animate-pulse flex items-center gap-1">
                          <Clock size={11} /> 🛵 Entregado en Calle (Por Liquidar en Caja)
                        </span>
                      )}
                    </div>

                    {/* Fecha y Hora Programada */}
                    <div className="text-right">
                      {parsed.date && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Calendar size={11} />
                          {parsed.date}
                        </span>
                      )}
                      {parsed.time && (
                        <span className="ml-1 text-[10px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          ⏰ {parsed.time}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Datos del Cliente y Dirección */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <User size={13} className="text-slate-400" />
                        <span className="uppercase">{sale.customer_name}</span>
                      </div>
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-2xs transition-colors"
                        >
                          <span>💬 WhatsApp</span>
                        </a>
                      )}
                    </div>

                    {parsed.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600 font-mono font-semibold text-[11px]">
                        <Phone size={12} className="text-slate-400" />
                        <span>{parsed.phone}</span>
                      </div>
                    )}

                    {sale.delivery_address && (
                      <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                        <MapPin size={13} className="text-purple-600 shrink-0 mt-0.5" />
                        <span className="font-semibold">{sale.delivery_address}</span>
                      </div>
                    )}

                    {parsed.notes && (
                      <div className="flex items-start gap-1.5 text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 text-[11px]">
                        <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                        <span><strong>Nota:</strong> {parsed.notes}</span>
                      </div>
                    )}

                    {/* Vendedor y Creador */}
                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                      <span>🏷️ Vendedor Comisión: <strong className="text-slate-800">{sellerName}</strong></span>
                      <span>Registrado por: <strong className="text-slate-700">{creatorName}</strong></span>
                    </div>
                  </div>

                  {/* Checklist de Prendas a Alistar del Perchero */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Prendas a Alistar del Perchero:
                    </span>
                    <div className="space-y-1">
                      {(sale.items || []).map(item => {
                        const p = item.product || {};
                        const itemKey = `${sale.id}-${item.id}`;
                        const isChecked = !!checkedItems[itemKey];

                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleCheckItem(sale.id, item.id)}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {isChecked && <Check size={12} strokeWidth={3} />}
                              </div>

                              <div className="min-w-0">
                                <p className={`font-bold truncate ${isChecked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  {p.name || 'Prenda'}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                  <span className="font-mono">{p.ref || ''}</span>
                                  {p.size && <span className="bg-slate-100 px-1 py-0.2 rounded font-bold text-slate-700">Talla {p.size}</span>}
                                  {p.color && <span>• {p.color}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSwapModalData({ sale, item });
                                }}
                                className="px-2 py-0.5 text-[10px] font-black text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition cursor-pointer"
                                title="Cambiar talla o prenda"
                              >
                                🔄 Talla
                              </button>
                              <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                                {item.quantity} un.
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resumen de Cobro Contraentrega */}
                  <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-900 block leading-tight">
                        Cobro Contraentrega
                      </span>
                      {sale.amount_paid > 0 && (
                        <span className="text-[9px] text-slate-500 font-semibold">
                          Abono previo: ${fmt(sale.amount_paid)}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black font-mono text-purple-700">
                        ${fmt(saldoPendiente)}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción Flujo E-Commerce */}
                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    {/* Botón 1: Marcar Alistado */}
                    {isPorAlistar && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(sale.id, 'alistado')}
                        disabled={actionLoading === sale.id}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        {actionLoading === sale.id ? <RefreshCw size={14} className="animate-spin" /> : <Package size={14} />}
                        <span>{actionLoading === sale.id ? 'Guardando...' : 'Marcar Alistado'}</span>
                      </button>
                    )}

                    {/* Botón 2: Marcar En Camino */}
                    {isAlistado && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(sale.id, 'en_camino')}
                        disabled={actionLoading === sale.id}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        {actionLoading === sale.id ? <RefreshCw size={14} className="animate-spin" /> : <Truck size={14} />}
                        <span>{actionLoading === sale.id ? 'Guardando...' : 'Marcar En Camino'}</span>
                      </button>
                    )}

                    {/* Botón 3: Confirmar Cobro & Entrega (finalizar) */}
                    <button
                      type="button"
                      onClick={() => setConfirmModalSale(sale)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>{isPorLiquidar ? 'Confirmar y Liquidar en Caja' : 'Confirmar Cobro'}</span>
                    </button>

                    {/* Botón de Copiar Guía para Telegram / Notion */}
                    <button
                      type="button"
                      onClick={() => handleCopyGuide(sale)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        copiedId === sale.id 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                      title="Copiar formato para Telegram / Notion"
                    >
                      {copiedId === sale.id ? <Check size={14} /> : <Share2 size={14} />}
                      <span className="hidden sm:inline text-[10px]">
                        {copiedId === sale.id ? '¡Copiado!' : 'Guía Telegram'}
                      </span>
                    </button>

                    {/* Botón Anular */}
                    <button
                      type="button"
                      onClick={() => handleCancelDelivery(sale.id)}
                      disabled={actionLoading === sale.id}
                      className="p-2 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl text-rose-500 transition-all cursor-pointer"
                      title="Anular y devolver stock"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE CAMBIO DE TALLA */}
      {swapModalData && (
        <SwapVariantModal
          isOpen={!!swapModalData}
          onClose={() => setSwapModalData(null)}
          sale={swapModalData.sale}
          itemToExchange={swapModalData.item}
          onSuccess={fetchSales}
        />
      )}

      {/* MODAL PARA CONFIRMAR COBRO Y ASENTAR EN CAJA */}
      {confirmModalSale && (
        <div className="fixed inset-0 z-[140] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Confirmar Cobro</h4>
                  <p className="text-xs text-slate-500">Domicilio #{confirmModalSale.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setConfirmModalSale(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                Monto Recibido
              </span>
              <p className="text-2xl font-black font-mono text-emerald-700 mt-0.5">
                ${fmt(Math.max(0, confirmModalSale.total_sale - (confirmModalSale.amount_paid || 0)))}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                Cliente: {confirmModalSale.customer_name}
              </span>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">
                ¿En qué cuenta entró el dinero?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'EFECTIVO_TIENDA', label: 'Efectivo Tienda', icon: '💵' },
                  { id: 'NEQUI_CRISTIAN', label: 'Nequi Cristian', icon: '📱' },
                  { id: 'NEQUI_DAVID', label: 'Nequi David', icon: '📱' },
                  { id: 'EFECTIVO_CASA', label: 'Efectivo Casa', icon: '🏠' }
                ].map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setConfirmAccount(acc.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      confirmAccount === acc.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-base">{acc.icon}</span>
                    <span className="truncate">{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-medium text-center">
              * Este cobro se registrará inmediatamente en el Flujo de Caja y pasará a ser una venta finalizada.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModalSale(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeliverySubmit}
                disabled={isConfirming}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isConfirming ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Asentar Cobro</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
