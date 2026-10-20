import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Edit2,
  Trash2,
  X,
  CalendarRange,
  Plus,
  Filter,
  Search,
  Download,
  Store,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  Tag,
  ArrowLeftRight,
  Landmark
} from 'lucide-react';
import { FINANCIAL_ACCOUNTS, getAccountInfo, inferAccountFromDesc } from '../utils/accounts';
import TransferModal from '../components/TransferModal';
import { API_URL } from '../config/api';
import { useDateRange, getTodayCO } from '../context/DateRangeContext';

// Formato de moneda colombiana
const fmt = (num) => Number(num || 0).toLocaleString('es-CO');

// Extraer clave YYYY-MM-DD sin desfaces de zona horaria
const toDateKey = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    return val.split('T')[0].split(' ')[0];
  }
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

// Formato de fecha para visualización (DD/MM/YYYY)
const fmtDateDisplay = (dateStr) => {
  const k = toDateKey(dateStr);
  if (!k || k.length < 10) return '-';
  const [y, m, d] = k.split('-');
  return `${d}/${m}/${y}`;
};

export default function CashFlow() {
  const [movements, setMovements] = useState(() => {
    try {
      const cached = localStorage.getItem('nordic_cached_cash_movements');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [sales, setSales] = useState(() => {
    try {
      const cached = localStorage.getItem('nordic_cached_sales');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('nordic_cached_cash_movements');
      return !(cached && JSON.parse(cached).length > 0);
    } catch {
      return true;
    }
  });
  const [refreshing, setRefreshing] = useState(false);

  // Filtros de fecha globales y locales
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  
  // Filtros interactivos tipo Excel
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedType, setSelectedType] = useState('TODOS'); // 'TODOS' | 'ENTRADA' | 'SALIDA'
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('TODAS'); // 'TODAS' | accountId

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);

  // Formulario de nuevo movimiento de caja mayor / contable
  const [newMovement, setNewMovement] = useState({
    type: 'SALIDA',
    amount: '',
    category: 'GASTO',
    description: '',
    payment_date: getTodayCO(),
    account: 'EFECTIVO_CASA',
    origin: 'Efectivo en Casa'
  });
  const [submitting, setSubmitting] = useState(false);

  // Carga de datos
  const loadData = useCallback(async () => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      setRefreshing(true);
      const [cashRes, salesRes] = await Promise.all([
        fetch(`${API_URL}/cash/`, { headers }),
        fetch(`${API_URL}/sales/`, { headers })
      ]);
      const cashData = await cashRes.json();
      const salesData = await salesRes.json();

      if (Array.isArray(cashData)) {
        setMovements(cashData);
        try { localStorage.setItem('nordic_cached_cash_movements', JSON.stringify(cashData)); } catch {}
      }
      if (Array.isArray(salesData)) {
        setSales(salesData);
        try { localStorage.setItem('nordic_cached_sales', JSON.stringify(salesData)); } catch {}
      }
    } catch (err) {
      console.error('Error cargando contabilidad:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Escuchar eventos de actualización de terminal y ventas
    window.addEventListener('refresh-cash', loadData);
    window.addEventListener('refresh-sales', loadData);
    return () => {
      window.removeEventListener('refresh-cash', loadData);
      window.removeEventListener('refresh-sales', loadData);
    };
  }, [loadData]);

  // Unificar movimientos físicos + ventas automáticas
  const allMovements = useMemo(() => {
    const virtualSales = [];
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

      if (freshPayment > 0) {
        virtualSales.push({
          id: `sale-${s.id}-init`,
          description: `VENTA #${s.id} - ${s.customer_name || 'CLIENTE FINAL'}${antCruzado > 0 ? ' (PARCIAL ANTICIPO)' : ''}`,
          amount: freshPayment,
          type: 'ENTRADA',
          category: 'VENTA',
          account: (initialPayments.length > 0 && initialPayments[0].account) ? initialPayments[0].account : (s.payment_method || 'EFECTIVO_TIENDA'),
          payment_date: s.created_at,
          created_at: s.created_at,
          isVirtual: true,
          channel: 'VENTA POS'
        });
      }

      subsequentAbonos.forEach(p => {
        virtualSales.push({
          id: `sale-${s.id}-pay-${p.id}`,
          description: `ABONO VENTA #${s.id} - ${s.customer_name || 'CLIENTE FINAL'}`,
          amount: p.amount || 0,
          type: 'ENTRADA',
          category: 'VENTA',
          account: p.account || s.payment_method || 'EFECTIVO_TIENDA',
          payment_date: p.payment_date || p.created_at,
          created_at: p.payment_date || p.created_at,
          isVirtual: true,
          channel: 'ABONO POS'
        });
      });
    });

    // Filtramos registros manuales que el usuario haya hecho usando 'VENTA' para evitar duplicidad
    const realMovements = movements.filter(m => m.category !== 'VENTA').map(m => {
      let acc = m.account;
      if (!acc || acc === 'EFECTIVO_TIENDA') {
        acc = inferAccountFromDesc(m.description, acc || 'EFECTIVO_TIENDA');
      }
      return { ...m, account: acc };
    });

    return [...realMovements, ...virtualSales].sort((a, b) => {
      const dateA = toDateKey(a.payment_date || a.created_at);
      const dateB = toDateKey(b.payment_date || b.created_at);
      
      // 1. Si son fechas distintas, ordenar cronológicamente por fecha YYYY-MM-DD
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      // 2. En la misma fecha, si uno es CIERRE DE CAJA, el cierre siempre representa la culminación del día
      // Por ende cronológicamente ocurre AL FINAL (después de todas las ventas y egresos de esa fecha)
      const isCierreA = (a.category || '').toUpperCase() === 'CIERRE CAJA' || (a.description || '').toUpperCase().startsWith('CIERRE DE CAJA');
      const isCierreB = (b.category || '').toUpperCase() === 'CIERRE CAJA' || (b.description || '').toUpperCase().startsWith('CIERRE DE CAJA');
      if (isCierreA && !isCierreB) return 1;  // 'a' (cierre) va después de las ventas del día
      if (!isCierreA && isCierreB) return -1; // 'b' (cierre) va después de las ventas del día

      // 3. Ordenar por timestamp real dentro del mismo día si ambos o ninguno son cierre
      const rawA = a.payment_date || a.created_at;
      const rawB = b.payment_date || b.created_at;
      const timeA = rawA ? new Date(rawA).getTime() : 0;
      const timeB = rawB ? new Date(rawB).getTime() : 0;
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;

      // 4. Desempate seguro por ID numérico (extrayendo dígitos para IDs como 'sale-296-init')
      const idA = typeof a.id === 'number' ? a.id : (parseInt(String(a.id).replace(/\D+/g, ''), 10) || 0);
      const idB = typeof b.id === 'number' ? b.id : (parseInt(String(b.id).replace(/\D+/g, ''), 10) || 0);
      return idA - idB;
    });
  }, [movements, sales]);

  // Arqueo global de bolsas / cuentas en tiempo real (Histórico total)
  const treasuryBalances = useMemo(() => {
    const b = {
      EFECTIVO_TIENDA: 0,
      NEQUI_CRISTIAN: 0,
      NEQUI_DAVID: 0,
      EFECTIVO_CASA: 0,
      BANCOLOMBIA: 0
    };
    allMovements.forEach(m => {
      const acc = m.account || 'EFECTIVO_TIENDA';
      const amt = Number(m.amount) || 0;
      if (b[acc] !== undefined) {
        if (m.type === 'ENTRADA') b[acc] += amt;
        else b[acc] -= amt;
      }
    });
    const total = Object.values(b).reduce((sum, v) => sum + v, 0);
    return { balances: b, total };
  }, [allMovements]);

  // Procesar saldo arrastrado y filtrado por fecha
  const processedByDate = useMemo(() => {
    const effectiveEnd = endDate || getTodayCO();
    let initialBalance = 0;
    const inRange = [];

    allMovements.forEach(m => {
      const d = toDateKey(m.payment_date || m.created_at);
      const isEntrada = m.type === 'ENTRADA';
      const amt = Number(m.amount) || 0;

      if (d < startDate) {
        // Movimientos antes del corte suman al saldo arrastrado
        if (isEntrada) initialBalance += amt;
        else initialBalance -= amt;
      } else if (d <= effectiveEnd) {
        inRange.push(m);
      }
    });

    return { initialBalance, inRange };
  }, [allMovements, startDate, endDate]);

  // Lista de todas las categorías disponibles para el filtro Excel
  const availableCategories = useMemo(() => {
    const set = new Set();
    processedByDate.inRange.forEach(m => {
      if (m.category) set.add(m.category.toUpperCase());
    });
    return Array.from(set).sort();
  }, [processedByDate.inRange]);

  // Aplicar filtros interactivos tipo Excel (Buscador, Categoría, Tipo)
  const filteredMovements = useMemo(() => {
    let list = processedByDate.inRange;

    // Filtro por Tipo (Entrada / Salida)
    if (selectedType !== 'TODOS') {
      list = list.filter(m => m.type === selectedType);
    }

    // Filtro por Categoría
    if (selectedCategory !== 'TODAS') {
      list = list.filter(m => (m.category || '').toUpperCase() === selectedCategory);
    }

    // Filtro por Cuenta / Bolsa
    if (selectedAccountFilter !== 'TODAS') {
      list = list.filter(m => (m.account || 'EFECTIVO_TIENDA') === selectedAccountFilter);
    }

    // Buscador en vivo
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(m => {
        const text = `${m.description || ''} ${m.category || ''} ${m.type || ''}`.toLowerCase();
        return text.includes(term);
      });
    }

    return list;
  }, [processedByDate.inRange, selectedType, selectedCategory, selectedAccountFilter, search]);

  // Calcular filas con saldo acumulado progresivo
  const { tableRows, currentBalance, totalEntradas, totalSalidas } = useMemo(() => {
    const rows = [];
    let runningBalance = processedByDate.initialBalance;
    let sumEntradas = 0;
    let sumSalidas = 0;

    // Fila virtual de Saldo Inicial Arrastrado (siempre al inicio)
    if (selectedType === 'TODOS' && selectedCategory === 'TODAS' && !search) {
      rows.push({
        id: 'saldo-inicial',
        fechaStr: fmtDateDisplay(startDate),
        description: 'SALDO ANTERIOR (ARRASTRE DE CAJA)',
        entrada: null,
        salida: null,
        saldo: runningBalance,
        category: 'INICIO',
        type: 'INICIO',
        isInitial: true,
        isVirtual: true
      });
    }

    processedByDate.inRange.forEach(m => {
      const isEntrada = m.type === 'ENTRADA';
      const amt = Number(m.amount) || 0;

      if (isEntrada) {
        runningBalance += amt;
        sumEntradas += amt;
      } else {
        runningBalance -= amt;
        sumSalidas += amt;
      }

      // Solo incluimos en las filas mostradas si cumple con los filtros activos
      const matchesFilter = filteredMovements.some(f => f.id === m.id);
      if (matchesFilter) {
        rows.push({
          ...m,
          rawDate: toDateKey(m.payment_date || m.created_at),
          fechaStr: fmtDateDisplay(m.payment_date || m.created_at),
          entrada: isEntrada ? amt : null,
          salida: !isEntrada ? amt : null,
          saldo: runningBalance
        });
      }
    });

    return {
      tableRows: rows,
      currentBalance: runningBalance,
      totalEntradas: sumEntradas,
      totalSalidas: sumSalidas
    };
  }, [processedByDate, filteredMovements, selectedType, selectedCategory, search, startDate]);

  // Resumen por Categoría (Pivot Table)
  const categorySummary = useMemo(() => {
    const map = {};
    processedByDate.inRange.forEach(m => {
      const cat = (m.category || 'VARIOS').toUpperCase();
      if (!map[cat]) map[cat] = { category: cat, entradas: 0, salidas: 0, count: 0 };
      const amt = Number(m.amount) || 0;
      if (m.type === 'ENTRADA') map[cat].entradas += amt;
      else map[cat].salidas += amt;
      map[cat].count += 1;
    });
    return Object.values(map).sort((a, b) => (b.entradas + b.salidas) - (a.entradas + a.salidas));
  }, [processedByDate.inRange]);

  // Manejo de creación de movimiento
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(newMovement.amount);
    if (!amt || amt <= 0) {
      alert('Ingresa un monto válido mayor a 0');
      return;
    }
    if (!newMovement.description.trim()) {
      alert('Ingresa una descripción para el movimiento');
      return;
    }

    setSubmitting(true);
    try {
      const fullDesc = newMovement.origin 
        ? `${newMovement.description.trim().toUpperCase()} (${newMovement.origin.toUpperCase()})`
        : newMovement.description.trim().toUpperCase();

      const payload = {
        description: fullDesc,
        amount: amt,
        type: newMovement.type,
        category: newMovement.category.toUpperCase(),
        account: newMovement.account || 'EFECTIVO_CASA',
        payment_date: newMovement.payment_date ? `${newMovement.payment_date}T12:00:00` : undefined
      };

      const res = await fetch(`${API_URL}/cash/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewMovement({
          type: 'SALIDA',
          amount: '',
          category: 'GASTO',
          description: '',
          payment_date: getTodayCO(),
          account: 'EFECTIVO_CASA',
          origin: 'Efectivo en Casa'
        });
        await loadData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al guardar el movimiento');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  // Manejo de edición
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMovement) return;

    try {
      const res = await fetch(`${API_URL}/cash/${editingMovement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          description: editingMovement.description.toUpperCase(),
          amount: Number(editingMovement.amount),
          type: editingMovement.type,
          category: editingMovement.category.toUpperCase(),
          account: editingMovement.account || 'EFECTIVO_TIENDA',
          payment_date: editingMovement.payment_date ? `${editingMovement.payment_date}T12:00:00` : undefined
        })
      });

      if (res.ok) {
        setEditingMovement(null);
        await loadData();
      } else {
        alert('No se pudo actualizar el movimiento');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manejo de eliminación
  const handleDelete = async (id) => {
    if (String(id).startsWith('sale-') || id === 'saldo-inicial') return;
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento del flujo contable?')) return;

    try {
      const res = await fetch(`${API_URL}/cash/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        await loadData();
      } else {
        alert('No se pudo eliminar el movimiento');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Exportar tabla a CSV / Excel
  const handleExportCSV = () => {
    const headers = ['FECHA', 'DESCRIPCION', 'CATEGORIA', 'TIPO', 'ENTRADA', 'SALIDA', 'SALDO'];
    const rows = tableRows.map(r => [
      r.fechaStr || '',
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.category || '',
      r.type || '',
      r.entrada || 0,
      r.salida || 0,
      r.saldo || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Flujo_Caja_EstiloNordico_${startDate}_a_${endDate || getTodayCO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Botones de filtro rápido de fecha
  const setQuickRange = (type) => {
    const today = getTodayCO();
    if (type === 'hoy') {
      setStartDate(today);
      setEndDate(today);
    } else if (type === 'semana') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (type === 'mes') {
      const d = new Date();
      d.setDate(1); // Primer día del mes
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (type === 'todo') {
      setStartDate('2026-05-01');
      setEndDate('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-3">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <p className="font-bold text-slate-500 text-sm">Cargando contabilidad y flujo de caja global...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Header Principal con Botones Separados */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contabilidad en Vivo</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Flujo de Caja Global</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Registro contable de gastos de casa/caja mayor, reinversiones, nómina, ventas y arqueos.
          </p>
        </div>

        {/* Botones de Acción Claramente Separados */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botón 1: Traslado entre Cuentas */}
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md cursor-pointer"
            title="Trasladar fondos entre Nequi Cristian, Nequi David, Efectivo Tienda, Casa o Banco"
          >
            <ArrowLeftRight size={15} />
            <span>Traslado entre Cuentas</span>
          </button>

          {/* Botón 2: Registrar Movimiento de Caja Mayor / Flujo */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-indigo-100 cursor-pointer"
            title="Registrar un gasto, reinversión, adelanto o entrada de dinero guardado"
          >
            <Plus size={16} />
            <span>Registrar Movimiento</span>
          </button>

          {/* Botón 2: Abrir Terminal Diario POS */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-terminal'))}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border border-slate-200 shadow-2xs"
            title="Abrir el terminal del día (caja diaria de la tienda física y base de $150k)"
          >
            <Store size={15} className="text-slate-500" />
            <span className="hidden sm:inline">Terminal Diario POS</span>
          </button>

          {/* Botón 3: Exportar Excel */}
          <button
            onClick={handleExportCSV}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-emerald-700 rounded-2xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
            title="Descargar informe Excel/CSV"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* ARQUEO GLOBAL DE BOLSAS DE DINERO (5 Cuentas + Patrimonio Total) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
              Arqueo Global de Cuentas & Bolsas
            </h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black border border-indigo-100">
              En Vivo
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Filtrar tabla por cuenta:</span>
            {selectedAccountFilter !== 'TODAS' && (
              <button
                onClick={() => setSelectedAccountFilter('TODAS')}
                className="text-[10px] font-black text-indigo-600 hover:underline uppercase"
              >
                Ver Todas
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FINANCIAL_ACCOUNTS.map(acc => {
            const bal = treasuryBalances.balances[acc.id] || 0;
            const isSelected = selectedAccountFilter === acc.id;

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountFilter(prev => prev === acc.id ? 'TODAS' : acc.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
                  isSelected 
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40 shadow-xs' 
                    : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{acc.icon}</span>
                  {isSelected && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-indigo-600 text-white rounded-md">
                      Filtro
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-black uppercase text-slate-500 truncate leading-tight">
                  {acc.label}
                </p>
                <p className={`text-base font-black font-mono tracking-tight mt-0.5 ${bal >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  ${fmt(bal)}
                </p>
              </div>
            );
          })}

          {/* Tarjeta Patrimonio Total */}
          <div 
            onClick={() => setSelectedAccountFilter('TODAS')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none bg-slate-900 text-white border-slate-800 shadow-sm ${
              selectedAccountFilter === 'TODAS' ? 'ring-2 ring-emerald-400/40' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-base">💎</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 rounded-md">
                Total
              </span>
            </div>
            <p className="text-[10px] font-black uppercase text-slate-300 truncate leading-tight">
              Patrimonio Disponible
            </p>
            <p className="text-base font-black font-mono text-emerald-400 tracking-tight mt-0.5">
              ${fmt(treasuryBalances.total)}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards: Entradas, Salidas, Saldo Neto y Saldo Total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Entradas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Total Entradas (Período)
            </span>
            <h3 className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
              ${fmt(totalEntradas)}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Ventas e ingresos</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={24} />
          </div>
        </div>

        {/* Total Salidas / Gastos */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Total Salidas / Gastos
            </span>
            <h3 className="text-2xl font-black text-rose-600 font-mono tracking-tight">
              ${fmt(totalSalidas)}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Gastos, envíos y compras</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowDownRight size={24} />
          </div>
        </div>

        {/* Flujo Neto del Período */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Flujo Neto del Período
            </span>
            <h3 className={`text-2xl font-black font-mono tracking-tight ${
              (totalEntradas - totalSalidas) >= 0 ? 'text-indigo-600' : 'text-rose-600'
            }`}>
              ${fmt(totalEntradas - totalSalidas)}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Entradas menos Salidas</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Saldo Real Acumulado */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-md text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Saldo Real en Caja
            </span>
            <h3 className="text-2xl font-black text-white font-mono tracking-tight">
              ${fmt(currentBalance)}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Arrastre anterior + neto</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros Tipo Excel */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        {/* Fila 1: Filtro de fechas con botones rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-indigo-600 mr-2">
              <CalendarRange size={16} />
              <span className="text-[11px] font-black uppercase tracking-wider">Período Contable:</span>
            </div>

            <div className="flex items-center gap-2">
              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">a</span>
              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Botones de Rango Rápido */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Rápidos:</span>
            <button
              onClick={() => setQuickRange('hoy')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
            >
              Hoy
            </button>
            <button
              onClick={() => setQuickRange('semana')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
            >
              Última Semana
            </button>
            <button
              onClick={() => setQuickRange('mes')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
            >
              Este Mes
            </button>
            <button
              onClick={() => setQuickRange('todo')}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
            >
              Todo
            </button>
          </div>
        </div>

        {/* Fila 2: Filtros dinámicos (Buscador, Tipo y Categoría) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Buscador de texto en tiempo real */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar en operaciones: cliente, concepto, categoría, flete..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro por Tipo */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setSelectedType('TODOS')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedType === 'TODOS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedType('ENTRADA')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedType === 'ENTRADA' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-white/50'
                }`}
              >
                🟢 Entradas
              </button>
              <button
                onClick={() => setSelectedType('SALIDA')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedType === 'SALIDA' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-white/50'
                }`}
              >
                🔴 Salidas
              </button>
            </div>

            {/* Filtro por Categoría tipo Excel */}
            <div className="flex items-center gap-1">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="TODAS">📂 Todas las Categorías ({availableCategories.length})</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Limpiar filtros si hay alguno activo */}
            {(selectedCategory !== 'TODAS' || selectedType !== 'TODOS' || search) && (
              <button
                onClick={() => { setSelectedCategory('TODAS'); setSelectedType('TODOS'); setSearch(''); }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-[10px] font-black uppercase transition-colors flex items-center gap-1"
                title="Restablecer filtros"
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla del Historial de Operaciones (Ancho Completo, Elegante y sin Columnas Escondidas) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
              Historial de Operaciones
            </h3>
            <span className="text-xs text-slate-400 font-bold ml-1">
              ({tableRows.filter(r => !r.isInitial).length} registros en corte)
            </span>
          </div>

          <div className="text-[11px] font-bold text-slate-400">
            {refreshing ? 'Sincronizando...' : 'Orden cronológico inverso'}
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="px-4 py-3.5 text-center w-28">Fecha</th>
                <th className="px-4 py-3.5">Concepto / Descripción</th>
                <th className="px-4 py-3.5 text-center w-36">Cuenta / Bolsa</th>
                <th className="px-4 py-3.5 text-center w-32">Categoría</th>
                <th className="px-4 py-3.5 text-right w-36">Entradas (+)</th>
                <th className="px-4 py-3.5 text-right w-36">Salidas (-)</th>
                <th className="px-4 py-3.5 text-right w-36">Saldo Resultante</th>
                <th className="px-4 py-3.5 text-center w-20">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
              {tableRows.slice().reverse().map((row, i) => {
                const isSalida = row.type === 'SALIDA';
                const isEntrada = row.type === 'ENTRADA';

                return (
                  <tr 
                    key={row.id || i} 
                    className={`transition-colors hover:bg-slate-50/80 ${
                      row.isInitial ? 'bg-amber-50/40 font-bold' : ''
                    } ${isSalida ? 'bg-rose-50/10' : ''}`}
                  >
                    {/* Fecha */}
                    <td className="px-4 py-3 text-center whitespace-nowrap font-mono text-xs text-slate-600 font-bold">
                      {row.fechaStr}
                    </td>

                    {/* Descripción con badge de canal */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 uppercase">
                          {row.description}
                        </span>
                        {row.channel && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {row.channel}
                          </span>
                        )}
                        {row.isInitial && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            Base Arrastre
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cuenta / Bolsa */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.isInitial ? (
                        <span className="text-[10px] text-slate-400 font-bold">-</span>
                      ) : (() => {
                        const accInfo = getAccountInfo(row.account);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${accInfo.badgeClass}`}>
                            <span>{accInfo.icon}</span>
                            <span>{accInfo.label}</span>
                          </span>
                        );
                      })()}
                    </td>

                    {/* Categoría */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        row.category === 'VENTA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        row.category === 'TRASLADO_INTERNO' ? 'bg-sky-50 text-sky-700 border border-sky-300 font-black' :
                        row.category === 'ANTICIPO PREVENTA' || row.category === 'ANTICIPO' ? 'bg-teal-50 text-teal-800 border border-teal-200' :
                        row.category === 'CRUCE ANTICIPO' ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                        row.category === 'CIERRE CAJA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        row.category === 'REINVERSION' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        row.category === 'GASTO' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        row.category === 'ADELANTO' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        row.category === 'SALARIO' ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {row.category === 'TRASLADO_INTERNO' ? '🔀 TRASLADO' : row.category}
                      </span>
                    </td>

                    {/* Entradas (+) */}
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-black text-sm text-emerald-600">
                      {row.entrada ? `+$${fmt(row.entrada)}` : <span className="text-slate-200 font-normal">-</span>}
                    </td>

                    {/* Salidas (-) */}
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-black text-sm text-rose-600">
                      {row.salida ? `-$${fmt(row.salida)}` : <span className="text-slate-200 font-normal">-</span>}
                    </td>

                    {/* Saldo Resultante */}
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-black text-sm text-slate-800 bg-slate-50/50">
                      ${fmt(row.saldo)}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {!row.isVirtual && !row.isInitial ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingMovement({
                              id: row.id,
                              description: row.description,
                              amount: row.amount,
                              type: row.type,
                              category: row.category,
                              account: row.account || 'EFECTIVO_TIENDA',
                              payment_date: toDateKey(row.payment_date || row.created_at)
                            })}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar movimiento"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar movimiento"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase">Automático</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {tableRows.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 text-xs font-bold">
                    No se encontraron operaciones en el rango o con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer de Totales */}
            <tfoot>
              <tr className="bg-slate-100/80 font-black text-xs text-slate-800 border-t-2 border-slate-200">
                <td colSpan="3" className="px-4 py-3 text-right uppercase tracking-wider">
                  Totales del Período:
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700 text-sm">
                  +${fmt(totalEntradas)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-rose-700 text-sm">
                  -${fmt(totalSalidas)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-900 text-base bg-slate-200/60">
                  ${fmt(currentBalance)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Resumen por Categoría (Estilo Tarjetas / Análisis) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Tag size={18} className="text-indigo-600" /> Resumen Consolidado por Categoría
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Suma total de entradas vs salidas clasificadas en el período.</p>
          </div>
          <span className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
            {categorySummary.length} categorías registradas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categorySummary.map((item, i) => {
            const neto = item.entradas - item.salidas;
            return (
              <div key={i} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                    {item.category}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {item.count} mov.
                  </span>
                </div>

                <div className="space-y-1 text-xs font-mono">
                  {item.entradas > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="text-[10px] font-sans text-slate-500">Entradas:</span>
                      <span className="font-bold">+${fmt(item.entradas)}</span>
                    </div>
                  )}
                  {item.salidas > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span className="text-[10px] font-sans text-slate-500">Salidas:</span>
                      <span className="font-bold">-${fmt(item.salidas)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-black text-slate-900">
                    <span className="text-[10px] font-sans text-slate-400">Neto:</span>
                    <span>${fmt(neto)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: REGISTRAR MOVIMIENTO CONTABLE / CAJA MAYOR            */}
      {/* ============================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Registrar Movimiento Contable</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Gasto de casa/caja mayor, nómina, reinversión o aporte</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {/* Selector de Tipo (Salida vs Entrada) */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setNewMovement({ ...newMovement, type: 'SALIDA', category: 'GASTO' })}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      newMovement.type === 'SALIDA' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDownRight size={16} />
                    <span>Salida / Gasto (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewMovement({ ...newMovement, type: 'ENTRADA', category: 'OTRA ENTRADA' })}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      newMovement.type === 'ENTRADA' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowUpRight size={16} />
                    <span>Entrada / Ingreso (+)</span>
                  </button>
                </div>
              </div>

              {/* Monto ($) */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Monto en Pesos ($)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="Ej: 95000"
                    value={newMovement.amount}
                    onChange={e => setNewMovement({ ...newMovement, amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-lg font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Fila: Fecha y Categoría */}
              <div className="grid grid-cols-2 gap-3">
                {/* Fecha */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Fecha del Movimiento
                  </label>
                  <input
                    type="date"
                    required
                    value={newMovement.payment_date}
                    onChange={e => setNewMovement({ ...newMovement, payment_date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Categoría
                  </label>
                  <select
                    value={newMovement.category}
                    onChange={e => setNewMovement({ ...newMovement, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {newMovement.type === 'SALIDA' ? (
                      <>
                        <option value="GASTO">GASTO OPERATIVO (Fletes, envíos, insumos)</option>
                        <option value="CRUCE ANTICIPO">CRUCE ANTICIPO (Compensación de preventa)</option>
                        <option value="REINVERSION">REINVERSIÓN (Compra de mercancía / ropa)</option>
                        <option value="ADELANTO">ADELANTO DE SUELDO</option>
                        <option value="SALARIO">SALARIO / NÓMINA</option>
                        <option value="ARRIENDO Y SERVICIOS">ARRIENDO Y SERVICIOS</option>
                        <option value="DEVOLUCION">DEVOLUCIÓN DE DINERO</option>
                        <option value="PRESTAMO">PRÉSTAMO</option>
                        <option value="OTRO">OTRO</option>
                      </>
                    ) : (
                      <>
                        <option value="ANTICIPO PREVENTA">ANTICIPO / PREVENTA (Cliente por encargo)</option>
                        <option value="OTRA ENTRADA">APORTE / DINERO EN CASA</option>
                        <option value="VENTA EXTERNA">VENTA EXTERNA / DIRECTA</option>
                        <option value="GANANCIA">GANANCIA / RENDIMIENTOS</option>
                        <option value="PRESTAMO">PRÉSTAMO RECIBIDO</option>
                        <option value="OTROS">OTROS INGRESOS</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Cuenta / Bolsa Afectada */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Cuenta / Bolsa de Fondos Afectada
                </label>
                <select
                  value={newMovement.account}
                  onChange={e => {
                    const acc = e.target.value;
                    const info = getAccountInfo(acc);
                    setNewMovement({ ...newMovement, account: acc, origin: info.label });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {FINANCIAL_ACCOUNTS.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.fullLabel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Descripción o Concepto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Envío chaquetas 5080, Adelanto Cristian, Pago arriendo..."
                  value={newMovement.description}
                  onChange={e => setNewMovement({ ...newMovement, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              {/* Botón Guardar */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  <span>Guardar Movimiento Contable</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDITAR MOVIMIENTO                                      */}
      {/* ============================================================== */}
      {editingMovement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-black text-slate-900 text-sm">Editar Movimiento</h3>
              <button onClick={() => setEditingMovement(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-3.5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  value={editingMovement.description}
                  onChange={e => setEditingMovement({ ...editingMovement, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Monto ($)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingMovement.amount}
                    onChange={e => setEditingMovement({ ...editingMovement, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono font-black text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={editingMovement.payment_date}
                    onChange={e => setEditingMovement({ ...editingMovement, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tipo</label>
                  <select
                    value={editingMovement.type}
                    onChange={e => setEditingMovement({ ...editingMovement, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none"
                  >
                    <option value="SALIDA">SALIDA (-)</option>
                    <option value="ENTRADA">ENTRADA (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Categoría</label>
                  <input
                    type="text"
                    required
                    value={editingMovement.category}
                    onChange={e => setEditingMovement({ ...editingMovement, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cuenta / Bolsa</label>
                <select
                  value={editingMovement.account || 'EFECTIVO_TIENDA'}
                  onChange={e => setEditingMovement({ ...editingMovement, account: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none"
                >
                  {FINANCIAL_ACCOUNTS.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.fullLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMovement(null)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 shadow-sm cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TRASLADO ENTRE CUENTAS */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransferSuccess={loadData}
      />

    </div>
  );
}
