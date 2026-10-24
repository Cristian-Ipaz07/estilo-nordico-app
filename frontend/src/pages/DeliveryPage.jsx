import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  MapPin,
  CheckCircle2,
  Navigation,
  X,
  Phone,
  MessageCircle,
  MessageSquareWarning,
  RefreshCw,
  Search,
  DollarSign,
  Share2,
  Trash2,
  Check,
  ArrowLeft,
  Shirt,
  Layers,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { parseDeliveryNotes } from '../components/DeliveryNotificationsDrawer';
import SwapVariantModal from '../components/SwapVariantModal';
import DeliveryMap from '../components/DeliveryMap';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function DeliveryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const token = localStorage.getItem('token');

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [filterTab, setFilterTab] = useState('activos'); // 'activos', 'por_alistar', 'alistado', 'en_camino', 'por_liquidar', 'entregados'
  const [copiedId, setCopiedId] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  // Modal para Domiciliario (Registrar entrega y cobro)
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [amountCollected, setAmountCollected] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // Modal para Cristian (Liquidar dinero en caja)
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAccount, setSettleAccount] = useState('EFECTIVO_TIENDA');
  const [isSettling, setIsSettling] = useState(false);

  // Modal para cambiar talla / prenda
  const [swapModalData, setSwapModalData] = useState(null); // { sale, item }

  // Cargar ventas de domicilios
  const fetchDeliveries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sales/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar pedidos del servidor');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSales(data);
      }
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  // Filtrar solo domicilios
  const deliverySales = useMemo(() => {
    return sales.filter(s => {
      const isDomi = s.sale_channel === 'DOMICILIO' || !!s.delivery_address || s.status === 'en_domicilio';
      return isDomi && s.status !== 'cancelado';
    });
  }, [sales]);

  // Contadores
  const countPorAlistar = useMemo(() => {
    return deliverySales.filter(s => s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'separado').length;
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

  // Ventas filtradas
  const filteredDeliveries = useMemo(() => {
    let list = deliverySales;
    if (filterTab === 'activos') {
      list = deliverySales.filter(s => s.status !== 'pagado');
    } else if (filterTab === 'por_alistar') {
      list = deliverySales.filter(s => s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'separado');
    } else if (filterTab === 'alistado') {
      list = deliverySales.filter(s => s.status === 'alistado');
    } else if (filterTab === 'en_camino') {
      list = deliverySales.filter(s => s.status === 'en_camino');
    } else if (filterTab === 'por_liquidar') {
      list = deliverySales.filter(s => s.status === 'entregado' && !s.cash_settled);
    } else if (filterTab === 'entregados') {
      list = deliverySales.filter(s => s.status === 'pagado' || (s.status === 'entregado' && s.cash_settled));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(s => 
        (s.customer_name || '').toLowerCase().includes(term) ||
        (s.delivery_address || '').toLowerCase().includes(term) ||
        String(s.id).includes(term)
      );
    }

    return list;
  }, [deliverySales, filterTab, searchTerm]);

  // Mantener sincronizado el pedido seleccionado
  useEffect(() => {
    if (filteredDeliveries.length > 0) {
      if (!selectedDelivery || !filteredDeliveries.some(d => d.id === selectedDelivery.id)) {
        setSelectedDelivery(filteredDeliveries[0]);
      } else {
        const updated = filteredDeliveries.find(d => d.id === selectedDelivery.id);
        if (updated) setSelectedDelivery(updated);
      }
    } else {
      setSelectedDelivery(null);
    }
  }, [filteredDeliveries]);

  // Métricas de ruta activa
  const activeDeliveries = useMemo(() => {
    return deliverySales.filter(d => ['alistado', 'en_camino', 'en_domicilio', 'separado'].includes(d.status));
  }, [deliverySales]);

  const estimatedRevenue = useMemo(() => {
    return activeDeliveries.reduce((sum, d) => {
      const balance = d.balance_due > 0 ? d.balance_due : (d.total_price - (d.amount_paid || 0));
      return sum + (balance > 0 ? balance : 0);
    }, 0);
  }, [activeDeliveries]);

  // 1. Marcar Alistado en Bolsa
  const handleMarkAlistado = async (saleId) => {
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'alistado' })
      });
      if (!res.ok) throw new Error('Error al alistar');
      fetchDeliveries();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    }
  };

  // 2. Iniciar Ruta (Marcar En Camino)
  const handleClaimDelivery = async (saleId) => {
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'en_camino', delivered_by: user?.id })
      });
      if (!res.ok) throw new Error('Error al iniciar ruta');
      fetchDeliveries();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    }
  };

  // 3. Abrir modal de cobro y entrega para el Domiciliario
  const handleOpenCompletionModal = (delivery) => {
    setSelectedDelivery(delivery);
    const balance = delivery.balance_due > 0 ? delivery.balance_due : (delivery.total_price - (delivery.amount_paid || 0));
    setAmountCollected(balance > 0 ? balance : 0);
    setPaymentMethod('EFECTIVO');
    setDeliveryNote('');
    setShowCompletionModal(true);
  };

  // 4. Confirmar cobro y entrega en calle
  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    if (!selectedDelivery) return;
    setIsSubmittingDelivery(true);

    try {
      const res = await fetch(`${API_URL}/sales/${selectedDelivery.id}/mark-delivered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_collected: Number(amountCollected),
          payment_method: paymentMethod,
          notes: deliveryNote
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al registrar entrega');
      }
      setShowCompletionModal(false);
      fetchDeliveries();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (err) {
      alert(err.message || 'Error al completar entrega');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // 5. Asentar dinero en caja por Cristian
  const handleSettleCash = async (e) => {
    e.preventDefault();
    if (!selectedDelivery) return;
    setIsSettling(true);

    try {
      const res = await fetch(`${API_URL}/sales/${selectedDelivery.id}/settle-cash?account=${settleAccount}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al liquidar en caja');
      }
      setShowSettleModal(false);
      fetchDeliveries();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
    } catch (err) {
      alert(err.message || 'Error al asentar dinero');
    } finally {
      setIsSettling(false);
    }
  };

  // 6. Cancelar pedido en puerta con devolución inmediata de stock
  const handleCancelDelivery = async (saleId) => {
    if (!window.confirm(`¿Seguro que el cliente rechazó o canceló la entrega #${saleId}? Las prendas volverán automáticamente al inventario.`)) return;

    try {
      const res = await fetch(`${API_URL}/sales/${saleId}/cancel-delivery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cancelar pedido');
      fetchDeliveries();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
    } catch (e) {
      alert(e.message);
    }
  };

  // Copiar guía de entrega
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

  const parsedNotes = selectedDelivery ? parseDeliveryNotes(selectedDelivery.delivery_notes) : null;
  const selectedBalance = selectedDelivery
    ? (selectedDelivery.balance_due > 0 ? selectedDelivery.balance_due : (selectedDelivery.total_price - (selectedDelivery.amount_paid || 0)))
    : 0;

  const cleanPhone = parsedNotes?.phone ? parsedNotes.phone.replace(/\D/g, '') : '';
  const googleMapsUrl = selectedDelivery?.delivery_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedDelivery.delivery_address + ' Pasto Nariño')}`
    : '#';

  const whatsappMessage = selectedDelivery
    ? `Hola ${selectedDelivery.customer_name}, soy Andrés de Estilo Nórdico. Voy en camino con tu entrega a ${selectedDelivery.delivery_address || 'tu dirección'}. ✨`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0c0c] text-white flex flex-col font-sans overflow-y-auto selection:bg-[#A3FF00] selection:text-black">
      
      {/* ── 1. TOP MASTER HEADER ──────────────────────────────────────────────── */}
      <header className="h-20 bg-[#141414] border-b border-white/5 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#1e1e1e] rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(163,255,0,0.1)]">
            <Truck className="w-6 h-6 text-[#A3FF00]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white">
                Ruta de Domicilios & Entregas
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#A3FF00]/10 text-[#A3FF00] border border-[#A3FF00]/20">
                Pasto
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium hidden sm:block">
              {activeDeliveries.length} paquetes activos para hoy • Mensajería y cobros en calle
            </p>
          </div>
        </div>

        {/* Botones Derecha: Refresh & Volver al Panel */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDeliveries}
            disabled={loading}
            className="h-11 px-4 bg-[#1e1e1e] hover:bg-[#282828] text-white rounded-full text-xs font-bold transition border border-white/5 flex items-center gap-2 cursor-pointer shadow-sm"
            title="Sincronizar pedidos"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#A3FF00] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Sincronizar</span>
          </button>

          {/* Botón X para volver al panel normal de la tienda */}
          <button
            onClick={() => navigate(isAdmin ? '/' : '/inventory')}
            className="h-11 px-5 bg-white hover:bg-gray-100 text-black font-black text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(255,255,255,0.15)] hover:scale-105"
            title="Volver a la vista principal de la tienda"
          >
            <X className="w-4 h-4 stroke-[3]" />
            <span>Volver al Panel</span>
          </button>
        </div>
      </header>

      {/* ── 2. STATS ROW (RAPPI / COURIER CARDS) ─────────────────────────────── */}
      <div className="p-4 lg:px-8 lg:pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Total a Recaudar */}
          <div className="bg-[#161616] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between h-32 shadow-xl relative overflow-hidden">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Total a Recaudar</p>
            <p className="text-3xl lg:text-4xl font-black text-white">
              <span className="text-gray-500 font-normal mr-1 text-2xl">$</span>
              {estimatedRevenue.toLocaleString('es-CO')}
            </p>
            <div className="absolute right-[-10px] bottom-[-15px] opacity-5 pointer-events-none">
              <DollarSign className="w-28 h-28 text-white" />
            </div>
          </div>

          {/* Card 2: Progreso de Entregas */}
          <div className="bg-[#161616] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between h-32 shadow-xl">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progreso de la Ruta</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl lg:text-4xl font-black text-white">
                {countEntregados} <span className="text-xl text-gray-500 font-normal">/ {deliverySales.length}</span>
              </p>
              <div className="w-36 h-2.5 bg-[#222] rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-[#A3FF00] rounded-full transition-all duration-500" 
                  style={{ width: `${deliverySales.length === 0 ? 0 : (countEntregados / deliverySales.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Siguiente Acción (Neon Card) */}
          <div className="bg-[#A3FF00] p-6 rounded-[2rem] flex flex-col justify-between h-32 text-black shadow-[0_0_30px_rgba(163,255,0,0.15)] relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-wider opacity-80">Siguiente Acción</p>
              <p className="text-xl font-black mt-1 leading-tight truncate">
                {activeDeliveries.length > 0 ? `Entregar a ${activeDeliveries[0].customer_name}` : '🎉 Ruta Finalizada'}
              </p>
            </div>
            <div className="relative z-10 text-[11px] font-bold opacity-75">
              {activeDeliveries.length > 0 ? activeDeliveries[0].delivery_address || 'Pasto' : 'Todos los pedidos entregados'}
            </div>
            <div className="absolute right-[-10%] bottom-[-20%] opacity-15 pointer-events-none">
              <Truck className="w-32 h-32" />
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. TABS DE ESTADOS DE RUTA ────────────────────────────────────────── */}
      <div className="px-4 lg:px-8 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
          <button
            onClick={() => setFilterTab('activos')}
            className={`px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap ${
              filterTab === 'activos'
                ? 'bg-white text-black font-black'
                : 'bg-[#181818] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            ACTIVOS ({deliverySales.filter(s => s.status !== 'pagado').length})
          </button>

          <button
            onClick={() => setFilterTab('por_alistar')}
            className={`px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'por_alistar'
                ? 'bg-amber-400 text-black font-black'
                : 'bg-[#181818] text-amber-300/80 hover:text-amber-200 border border-white/5'
            }`}
          >
            <span>📋 POR ALISTAR</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {countPorAlistar}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('alistado')}
            className={`px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'alistado'
                ? 'bg-sky-400 text-black font-black'
                : 'bg-[#181818] text-sky-300/80 hover:text-sky-200 border border-white/5'
            }`}
          >
            <span>📦 ALISTADOS</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {countAlistados}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('en_camino')}
            className={`px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'en_camino'
                ? 'bg-[#A3FF00] text-black font-black shadow-[0_0_15px_rgba(163,255,0,0.2)]'
                : 'bg-[#181818] text-[#A3FF00]/80 hover:text-[#A3FF00] border border-white/5'
            }`}
          >
            <span>🛵 EN CAMINO</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {countEnCamino}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('por_liquidar')}
            className={`px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'por_liquidar'
                ? 'bg-orange-500 text-white font-black'
                : 'bg-[#181818] text-orange-400 hover:text-orange-300 border border-white/5'
            }`}
          >
            <span>⚠️ POR LIQUIDAR</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {countPorLiquidar}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('entregados')}
            className={`px-4 py-2 rounded-full transition cursor-pointer whitespace-nowrap ${
              filterTab === 'entregados'
                ? 'bg-emerald-500 text-white font-black'
                : 'bg-[#181818] text-emerald-400 hover:text-emerald-300 border border-white/5'
            }`}
          >
            ✅ ENTREGADOS ({countEntregados})
          </button>
        </div>
      </div>

      {/* ── 4. MAIN SPLIT SCREEN WORKSPACE ─────────────────────────────────────── */}
      <div className="flex-1 p-4 lg:px-8 pb-8 flex flex-col lg:flex-row gap-6">

        {/* ── COLUMNA IZQUIERDA: MAPA Y LISTA DE PAQUETES ─────────────────────── */}
        <div className="w-full lg:w-[420px] bg-[#141414] rounded-[2.5rem] p-5 border border-white/5 flex flex-col gap-4 shadow-xl shrink-0">
          
          {/* MAPA INTERACTIVO DE PASTO (Leaflet) */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#A3FF00] flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Mapa de Entregas en Pasto
              </span>
              <span className="text-[10px] text-gray-500 font-bold">
                {filteredDeliveries.length} ubicaciones
              </span>
            </div>
            <DeliveryMap
              deliveries={filteredDeliveries}
              selectedDelivery={selectedDelivery}
              onSelectDelivery={(d) => setSelectedDelivery(d)}
            />
          </div>

          {/* Buscador de Clientes */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, barrio o venta..."
              className="w-full bg-[#1e1e1e] text-white rounded-full py-3 pl-11 pr-4 border border-white/5 focus:border-[#A3FF00] outline-none text-xs font-medium transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lista de Paquetes con Scroll */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[500px] pr-1 custom-scrollbar">
            {filteredDeliveries.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                No hay paquetes en esta vista.
              </div>
            ) : (
              filteredDeliveries.map((delivery) => {
                const isSelected = selectedDelivery?.id === delivery.id;
                const balance = delivery.balance_due > 0 ? delivery.balance_due : (delivery.total_price - (delivery.amount_paid || 0));
                const parsed = parseDeliveryNotes(delivery.delivery_notes);

                return (
                  <div
                    key={delivery.id}
                    onClick={() => setSelectedDelivery(delivery)}
                    className={`p-4 rounded-[1.8rem] transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#202020] border-[#A3FF00] shadow-[0_0_20px_rgba(163,255,0,0.1)]'
                        : 'bg-[#181818] border-white/5 hover:border-white/10 hover:bg-[#1c1c1c]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-black text-gray-400">
                        Venta #{delivery.id}
                      </span>
                      {/* Status Pills */}
                      {delivery.status === 'alistado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30">
                          📦 Alistado
                        </span>
                      )}
                      {delivery.status === 'en_camino' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#A3FF00]/20 text-[#A3FF00] border border-[#A3FF00]/30 animate-pulse">
                          🛵 En Camino
                        </span>
                      )}
                      {delivery.status === 'entregado' && !delivery.cash_settled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          ⚠️ Por Liquidar
                        </span>
                      )}
                      {delivery.status === 'pagado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✅ Entregado
                        </span>
                      )}
                      {['en_domicilio', 'por_confirmar', 'separado'].includes(delivery.status) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          📋 Por Alistar
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-white truncate">
                      {delivery.customer_name}
                    </h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {delivery.delivery_address || 'Pasto'}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                      <span className="text-[11px] font-bold text-gray-500">
                        {delivery.items?.length || 0} prendas
                      </span>
                      <span className="font-mono font-black text-sm text-[#A3FF00]">
                        {balance === 0 ? 'PAGADO' : `$${fmt(balance)}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: DETALLE COMPLETO Y ACCIONES RAPPI ───────────────── */}
        <div className="flex-1 bg-[#141414] rounded-[2.5rem] p-6 lg:p-8 border border-white/5 flex flex-col justify-between shadow-2xl overflow-y-auto">
          {selectedDelivery ? (
            <div className="space-y-6">
              
              {/* Encabezado del Detalle */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-[#A3FF00] uppercase tracking-wider">
                      Detalle de Pedido • Venta #{selectedDelivery.id}
                    </p>
                    {selectedDelivery.user && (
                      <span className="text-[10px] text-gray-400 font-bold bg-[#222] px-2 py-0.5 rounded-full">
                        Vendido por: {selectedDelivery.user.full_name}
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-black text-white mt-1">
                    {selectedDelivery.customer_name}
                  </h2>
                </div>

                {/* Botones de Contacto Directo */}
                <div className="flex items-center gap-2.5">
                  {cleanPhone && (
                    <>
                      <a
                        href={`tel:${cleanPhone}`}
                        className="h-13 w-13 rounded-full bg-[#202020] border border-white/10 flex items-center justify-center text-white hover:text-[#A3FF00] hover:bg-[#282828] transition shadow-md"
                        title="Llamar al cliente"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                      <a
                        href={`https://wa.me/57${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-13 w-13 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow-md"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </a>
                    </>
                  )}
                  {selectedDelivery.delivery_address && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-13 px-5 rounded-full bg-[#202020] border border-white/10 flex items-center justify-center gap-2 text-white hover:text-[#A3FF00] hover:bg-[#282828] transition shadow-md text-xs font-bold"
                      title="Navegar en Google Maps"
                    >
                      <Navigation className="w-4 h-4 text-[#A3FF00]" />
                      <span>Ruta Maps</span>
                    </a>
                  )}
                  <button
                    onClick={() => handleCopyGuide(selectedDelivery)}
                    className="h-13 px-4 rounded-full bg-[#202020] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
                    title="Copiar guía completa"
                  >
                    {copiedId === selectedDelivery.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Fila de Dirección y Saldo a Recaudar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Dirección */}
                <div className="bg-[#1c1c1c] rounded-[2rem] p-6 border border-white/5 flex items-start gap-4">
                  <div className="p-3.5 bg-[#262626] rounded-2xl text-[#A3FF00] shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Dirección de Entrega
                    </p>
                    <p className="text-base font-bold text-white leading-snug">
                      {selectedDelivery.delivery_address || 'Dirección en Pasto'}
                    </p>
                    {parsedNotes?.date && (
                      <p className="text-xs text-gray-400 mt-1 font-medium">
                        📅 Programada: {parsedNotes.date} {parsedNotes.time ? `• ⏰ ${parsedNotes.time}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Saldo a Recaudar (Neon Card) */}
                <div className="bg-[#A3FF00] rounded-[2rem] p-6 text-black flex flex-col justify-center shadow-[0_0_25px_rgba(163,255,0,0.15)]">
                  <p className="text-xs font-black uppercase tracking-wider opacity-80 mb-1">
                    Cobro Contraentrega
                  </p>
                  <p className="text-4xl font-black">
                    <span className="text-2xl opacity-60 mr-1">$</span>
                    {selectedBalance === 0 ? '0 (Pagado)' : selectedBalance.toLocaleString('es-CO')}
                  </p>
                  {selectedDelivery.amount_paid > 0 && (
                    <p className="text-xs font-bold opacity-75 mt-1">
                      Abono previo: ${fmt(selectedDelivery.amount_paid)}
                    </p>
                  )}
                </div>

              </div>

              {/* Instrucciones Especiales / Notas */}
              {parsedNotes?.notes && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <MessageSquareWarning className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      Instrucciones Especiales
                    </p>
                  </div>
                  <p className="text-sm text-amber-200/90 font-medium leading-relaxed">
                    {parsedNotes.notes}
                  </p>
                </div>
              )}

              {/* Lista de Prendas del Pedido con Botón de Cambio de Talla */}
              <div className="bg-[#1c1c1c] rounded-[2rem] p-6 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shirt className="w-4 h-4 text-[#A3FF00]" />
                    Prendas en esta Entrega ({selectedDelivery.items?.length || 0})
                  </p>
                  <span className="text-[11px] text-gray-500 font-bold">
                    Toca "Cambiar Talla" si el cliente eligió otra
                  </span>
                </div>

                <div className="space-y-2">
                  {(selectedDelivery.items || []).map((item) => {
                    const p = item.product || {};
                    const isChecked = !!checkedItems[`${selectedDelivery.id}-${item.id}`];

                    return (
                      <div
                        key={item.id}
                        className="bg-[#242424] p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-3 hover:border-white/10 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const key = `${selectedDelivery.id}-${item.id}`;
                              setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
                            }}
                            className="w-4 h-4 rounded text-[#A3FF00] focus:ring-[#A3FF00] bg-black/40 border-white/10 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className={`text-sm font-bold truncate ${isChecked ? 'line-through text-gray-500' : 'text-white'}`}>
                              {p.name || 'Prenda'}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                              <span>{p.ref}</span>
                              {p.size && (
                                <span className="bg-[#181818] px-2 py-0.2 rounded-md font-bold text-[#A3FF00] border border-white/5">
                                  TALLA {p.size}
                                </span>
                              )}
                              {p.color && <span>• {p.color}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Botón Cambiar Talla en Destino */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSwapModalData({ sale: selectedDelivery, item })}
                            className="px-3 py-1.5 bg-[#181818] hover:bg-[#2c2c2c] text-[#A3FF00] border border-[#A3FF00]/30 hover:border-[#A3FF00] rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="El cliente se probó otra talla y se queda con ella"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Cambiar Talla</span>
                          </button>

                          <span className="text-xs font-black text-gray-300 bg-[#181818] px-2.5 py-1 rounded-xl">
                            {item.quantity} un.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── BOTONES DE ACCIÓN PRINCIPALES (RAPPI PILLS) ───────────────── */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                
                {/* 1. Si está Por Alistar (Tienda) */}
                {['en_domicilio', 'por_confirmar', 'separado'].includes(selectedDelivery.status) && (
                  <button
                    onClick={() => handleMarkAlistado(selectedDelivery.id)}
                    className="w-full h-16 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-base transition-transform hover:scale-[1.01] shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>📦 Empacar y Marcar Alistado en Bolsa</span>
                  </button>
                )}

                {/* 2. Si está Alistado (Domiciliario sale en moto) */}
                {selectedDelivery.status === 'alistado' && (
                  <button
                    onClick={() => handleClaimDelivery(selectedDelivery.id)}
                    className="w-full h-16 rounded-full bg-[#A3FF00] hover:bg-[#8ee600] text-black font-black text-lg transition-transform hover:scale-[1.01] shadow-[0_0_30px_rgba(163,255,0,0.2)] flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Truck className="w-6 h-6" />
                    <span>Iniciar Entrega (Marcar En Camino)</span>
                  </button>
                )}

                {/* 3. Si está En Camino (Entrega o Cancelación) */}
                {selectedDelivery.status === 'en_camino' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleOpenCompletionModal(selectedDelivery)}
                      className="h-16 rounded-full bg-[#A3FF00] hover:bg-[#8ee600] text-black font-black text-lg transition-transform hover:scale-[1.01] shadow-[0_0_30px_rgba(163,255,0,0.2)] flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Registrar Entrega & Cobro</span>
                    </button>

                    <button
                      onClick={() => handleCancelDelivery(selectedDelivery.id)}
                      className="h-16 rounded-full bg-[#202020] hover:bg-[#2c2020] text-rose-400 border border-rose-500/30 hover:border-rose-500 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5 text-rose-500" />
                      <span>Cliente Canceló Pedido</span>
                    </button>
                  </div>
                )}

                {/* 4. Si está Entregado (Por Liquidar en Caja de Cristian) */}
                {selectedDelivery.status === 'entregado' && !selectedDelivery.cash_settled && (
                  <div className="bg-[#202020] rounded-[2rem] p-6 border border-orange-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-orange-400 uppercase tracking-wider">
                          ⚠️ Dinero Recaudado en Calle
                        </p>
                        <p className="text-lg font-black text-white mt-0.5">
                          ${fmt(selectedDelivery.amount_paid)} en poder de {selectedDelivery.delivery_person?.full_name || 'Andrés'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Pendiente entregar físicamente a Cristian en la tienda.
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full">
                        En Espera de Caja
                      </span>
                    </div>

                    {isAdmin ? (
                      <button
                        onClick={() => setShowSettleModal(true)}
                        className="w-full h-14 rounded-full bg-white hover:bg-gray-100 text-black font-black text-base transition-transform hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <DollarSign className="w-5 h-5" />
                        <span>Confirmar Dinero Recibido y Asentar en Caja</span>
                      </button>
                    ) : (
                      <div className="p-3 bg-black/40 rounded-xl text-center text-xs text-gray-400 font-bold">
                        Entrega este dinero a Cristian para cerrar el arqueo de tu turno.
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Si ya está Pagado y Liquidado */}
                {selectedDelivery.status === 'pagado' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-full h-16 flex items-center justify-center gap-2 text-emerald-400 font-black text-base">
                    <ShieldCheck className="w-6 h-6" />
                    <span>Venta Entregada & Liquidada en Caja Oficial</span>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 py-20">
              <Truck className="w-20 h-20 mb-4 opacity-20 text-[#A3FF00]" />
              <p className="text-lg font-bold">Selecciona un paquete para ver los detalles de entrega</p>
            </div>
          )}
        </div>

      </div>

      {/* ── MODAL: CONFIRMAR ENTREGA & COBRO (DOMICILIARIO EN CALLE) ───────────── */}
      {showCompletionModal && selectedDelivery && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="font-black text-2xl text-white">Confirmar Entrega</h3>
                <p className="text-xs text-[#A3FF00] font-bold uppercase mt-0.5">
                  Venta #{selectedDelivery.id} • {selectedDelivery.customer_name}
                </p>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="p-2.5 rounded-full bg-[#242424] text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteDelivery} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Valor Recibido en Calle ($)
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-2xl font-black">$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={amountCollected}
                    onChange={(e) => setAmountCollected(Number(e.target.value))}
                    className="w-full bg-[#121212] border border-white/10 rounded-full h-16 pl-14 pr-6 text-white font-black text-3xl focus:border-[#A3FF00] outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Medio de Pago Recibido
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-4 px-2 rounded-2xl text-xs font-black transition-all border cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-[#A3FF00] text-black border-[#A3FF00] shadow-[0_0_20px_rgba(163,255,0,0.3)]'
                          : 'bg-[#121212] text-gray-400 border-white/5 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Observación de Entrega (Opcional)
                </label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Ej. Recibido por el portero, todo perfecto"
                  className="w-full bg-[#121212] border border-white/10 rounded-full h-13 px-5 text-sm text-white font-medium focus:border-[#A3FF00] outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingDelivery}
                className="w-full h-16 rounded-full bg-[#A3FF00] hover:bg-[#8ee600] text-black font-black text-lg transition-transform hover:scale-[1.01] shadow-[0_0_30px_rgba(163,255,0,0.25)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isSubmittingDelivery ? 'Guardando...' : 'Finalizar Entrega'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LIQUIDACIÓN EN CAJA (CRISTIAN ADMIN) ────────────────────────── */}
      {showSettleModal && selectedDelivery && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="font-black text-2xl text-white">Asentar Dinero en Caja</h3>
                <p className="text-xs text-[#A3FF00] font-bold uppercase mt-0.5">
                  Confirmación de Arqueo en Tienda
                </p>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="p-2.5 rounded-full bg-[#242424] text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#222] p-4 rounded-2xl border border-white/5 text-xs font-bold space-y-1">
              <p className="text-gray-400">Venta #{selectedDelivery.id} — {selectedDelivery.customer_name}</p>
              <p className="text-white text-lg font-black">
                Monto Recibido: <span className="text-[#A3FF00]">${fmt(selectedDelivery.amount_paid || selectedDelivery.total_price)}</span>
              </p>
              <p className="text-gray-400">
                Entregado físicamente por: <span className="text-white">{selectedDelivery.delivery_person?.full_name || 'Andrés'}</span>
              </p>
            </div>

            <form onSubmit={handleSettleCash} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Cuenta donde Ingresa el Dinero
                </label>
                <select
                  value={settleAccount}
                  onChange={(e) => setSettleAccount(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded-2xl h-14 px-4 text-white text-sm font-bold focus:border-[#A3FF00] outline-none cursor-pointer"
                >
                  <option value="EFECTIVO_TIENDA">Efectivo Tienda (Gaveta Local)</option>
                  <option value="NEQUI_CRISTIAN">Nequi Cristian</option>
                  <option value="BANCOLOMBIA">Bancolombia</option>
                  <option value="EFECTIVO_CASA">Efectivo Casa (Caja Mayor)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSettling}
                className="w-full h-16 rounded-full bg-white hover:bg-gray-100 text-black font-black text-lg transition-transform hover:scale-[1.01] shadow-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <DollarSign className="w-5 h-5" />
                <span>{isSettling ? 'Asentando en Caja...' : 'Confirmar Ingreso a Caja'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CAMBIO DE TALLA EN DESTINO ──────────────────────────────────── */}
      {swapModalData && (
        <SwapVariantModal
          isOpen={!!swapModalData}
          onClose={() => setSwapModalData(null)}
          sale={swapModalData.sale}
          itemToExchange={swapModalData.item}
          onSuccess={fetchDeliveries}
        />
      )}

    </div>
  );
}
