import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, Users, DollarSign, Wallet, TrendingUp, TrendingDown,
  Printer, PieChart, Activity, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw, Package
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDateRange } from '../context/DateRangeContext';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

// ── Selector de Rango Global ──────────────────────────────────────────────────
const DateRangeBar = ({ startDate, endDate, setStartDate, setEndDate }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-end shadow-sm mb-6 print:hidden">
    <div className="flex items-center gap-2 mr-2">
      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Período del Corte</span>
    </div>
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Desde</label>
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-indigo-400" />
    </div>
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hasta</label>
      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-indigo-400" />
    </div>
    <div className="ml-auto text-[10px] font-bold text-slate-400 italic">
      Este rango afecta Finanzas, Dashboard y Caja
    </div>
  </div>
);

// ── Tab Button ────────────────────────────────────────────────────────────────
const TabBtn = ({ label, active, onClick, icon: Icon }) => (
  <button onClick={onClick}
    className={`flex items-center gap-2 pb-4 text-sm font-black uppercase tracking-wider transition-all relative whitespace-nowrap
      ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
    <Icon size={15} />
    {label}
    {active && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" />}
  </button>
);

// ── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = 'emerald', icon: Icon }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-500',
    indigo: 'bg-indigo-50 text-indigo-500',
    amber: 'bg-amber-50 text-amber-500',
    slate: 'bg-slate-900 text-white',
  };
  return (
    <div className={`p-5 rounded-2xl border border-slate-100 shadow-sm ${color === 'slate' ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="flex justify-between items-start mb-3">
        <p className={`text-[10px] font-black uppercase tracking-widest ${color === 'slate' ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
        {Icon && <div className={`p-2 rounded-xl ${colors[color]}`}><Icon size={16} /></div>}
      </div>
      <p className={`text-2xl font-black ${color === 'slate' ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${color === 'slate' ? 'text-slate-400' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑA 1: BALANCE GENERAL
// ══════════════════════════════════════════════════════════════════════════════
const TabBalance = ({ sales, cashFlow, startDate, endDate, token }) => {
  const [cogs, setCogs] = useState(0);

  // Fetch COGS desde el backend cada vez que cambia el rango
  useEffect(() => {
    fetch(`http://localhost:8000/sales/cogs?start=${startDate}&end=${endDate}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setCogs(d.cogs_total || 0))
      .catch(() => setCogs(0));
  }, [startDate, endDate, token]);

  // Filtrar ventas por rango
  const ventas = useMemo(() => sales.filter(s => {
    const d = (s.created_at || '').split('T')[0];
    return d >= startDate && d <= endDate;
  }), [sales, startDate, endDate]);

  const caja = useMemo(() => cashFlow.filter(c => {
    const d = (c.payment_date || c.created_at || '').split('T')[0];
    return d >= startDate && d <= endDate;
  }), [cashFlow, startDate, endDate]);

  const metrics = useMemo(() => {
    // RECAUDO por categoría de producto (Hombre / Mujer) — precio de venta
    let recaudoHombre = 0, recaudoMujer = 0, recaudoOtros = 0;
    ventas.forEach(s => {
      (s.items || []).forEach(item => {
        const cat = (item.product?.category || '').toLowerCase();
        const val = item.total_item || (item.quantity * (item.price_at_sale || item.unit_price || 0));
        if (cat.includes('hombre') || cat.includes('masculin')) recaudoHombre += val;
        else if (cat.includes('mujer') || cat.includes('femenin') || cat.includes('dama')) recaudoMujer += val;
        else recaudoOtros += val;
      });
    });
    // Total Ventas = precio de venta (supuesto contable)
    const totalVentasSistema = recaudoHombre + recaudoMujer + recaudoOtros;
    const totalRecaudo = totalVentasSistema;

    // TOTAL EFECTIVO = dinero realmente cobrado (amount_paid acumulado en el período)
    // Refleja el flujo real de caja desde las ventas
    const totalEfectivo = ventas.reduce((a, s) => a + (s.amount_paid || 0), 0);

    // INGRESOS EXTERNOS (abonos manuales, base de caja, préstamos, etc.)
    const ingresoExterno = caja
      .filter(c => c.type === 'ENTRADA')
      .reduce((a, c) => a + c.amount, 0);

    // COSTO MERCANCÍA REAL (COGS) — viene del endpoint /sales/cogs
    // cogs = SUM(item.quantity × product.my_cost) para las ventas del período
    // Se pasa como prop desde el useState externo al useMemo
    const costoMercancia = cogs;

    // MARGEN BRUTO (como Excel) = Total Ventas - COGS
    const totalGanancia = totalVentasSistema - costoMercancia;

    // GASTOS OPERATIVOS (informativos — no restan del margen bruto del Excel)
    const EXCLUIR_GASTOS = new Set(['REINVERSION', 'RETIRO DUEÑO', 'SALARIO', 'INGRESO_VENTA_EXTERNA']);
    const gastosPorCat = {};
    caja
      .filter(c => c.type === 'SALIDA' && !EXCLUIR_GASTOS.has(c.category))
      .forEach(c => {
        if (!gastosPorCat[c.category]) gastosPorCat[c.category] = 0;
        gastosPorCat[c.category] += c.amount;
      });
    const totalGastos = Object.values(gastosPorCat).reduce((a, b) => a + b, 0);

    // REINVERSION (restock de mercancía — informativo)
    const reinversion = caja
      .filter(c => c.type === 'SALIDA' && c.category === 'REINVERSION')
      .reduce((a, c) => a + c.amount, 0);

    // SALARIOS pagados en período
    const totalSalarios = caja
      .filter(c => c.type === 'SALIDA' && c.category === 'SALARIO')
      .reduce((a, c) => a + c.amount, 0);

    // PIVOT de caja para tabla resumen
    const pivotEntradas = {};
    const pivotSalidas = {};
    caja.forEach(c => {
      const cat = c.category || 'OTROS';
      if (c.type === 'ENTRADA') {
        if (!pivotEntradas[cat]) pivotEntradas[cat] = 0;
        pivotEntradas[cat] += c.amount;
      } else {
        if (!pivotSalidas[cat]) pivotSalidas[cat] = 0;
        pivotSalidas[cat] += c.amount;
      }
    });

    return {
      recaudoHombre, recaudoMujer, recaudoOtros,
      totalVentasSistema, totalEfectivo, ingresoExterno,
      totalRecaudo, costoMercancia, reinversion,
      gastosPorCat, totalGastos, totalSalarios,
      totalGanancia, pivotEntradas, pivotSalidas
    };
  }, [ventas, caja, cogs]);


  const { recaudoHombre, recaudoMujer, totalVentasSistema, totalEfectivo, ingresoExterno,
    totalRecaudo, costoMercancia, reinversion, gastosPorCat, totalGastos, totalSalarios,
    totalGanancia, pivotEntradas, pivotSalidas } = metrics;

  const totalPivotEntradas = Object.values(pivotEntradas).reduce((a, b) => a + b, 0);
  const totalPivotSalidas = Object.values(pivotSalidas).reduce((a, b) => a + b, 0);
  
  const liquidezTotal = totalEfectivo + ingresoExterno;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPIs superiores — fila 1: ventas por género + efectivo + margen */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-emerald-500 text-white rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Venta Hombres</p>
          <p className="text-2xl font-black mt-1">${fmt(recaudoHombre)}</p>
          <p className="text-[10px] opacity-60 mt-1">Precio de venta</p>
        </div>
        <div className="bg-pink-500 text-white rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Venta Mujeres</p>
          <p className="text-2xl font-black mt-1">${fmt(recaudoMujer)}</p>
          <p className="text-[10px] opacity-60 mt-1">Precio de venta</p>
        </div>
        <div className="bg-slate-700 text-white rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Ventas</p>
          <p className="text-2xl font-black mt-1">${fmt(totalRecaudo)}</p>
          <p className="text-[10px] opacity-60 mt-1">{ventas.length} ventas registradas</p>
        </div>
        <div className="bg-teal-600 text-white rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Efectivo</p>
          <p className="text-2xl font-black mt-1">${fmt(totalEfectivo)}</p>
          <p className="text-[10px] opacity-60 mt-1">Cobrado (Abonos ventas)</p>
        </div>
        <div className="bg-indigo-600 text-white rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Ganancia Bruta</p>
          <p className="text-2xl font-black mt-1">${fmt(totalGanancia)}</p>
          <p className="text-[10px] opacity-60 mt-1">Ventas − COGS</p>
        </div>
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Costo Mercancía</p>
          <p className="text-2xl font-black text-rose-600 mt-1">${fmt(costoMercancia)}</p>
          <p className="text-[10px] text-slate-400 mt-1">COGS × cantidad</p>
        </div>
        <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-lg border-2 border-blue-400">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-90">Liquidez Total</p>
          <p className="text-2xl font-black mt-1">${fmt(liquidezTotal)}</p>
          <p className="text-[10px] opacity-80 mt-1">Efectivo + Ingresos Ext.</p>
        </div>
      </div>

      {/* KPI secundario — ingresos externos informativo */}
      {ingresoExterno > 0 && (
        <div className="flex gap-3">
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-[11px] font-black text-violet-700 uppercase tracking-wider">Ingresos Externos (caja)</span>
            <span className="text-sm font-black text-violet-900">${fmt(ingresoExterno)}</span>
            <span className="text-[10px] text-violet-400">abonos históricos — solo informativo</span>
          </div>
          {reinversion > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">Reinversión</span>
              <span className="text-sm font-black text-amber-900">${fmt(reinversion)}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GASTOS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-5 py-3 text-xs font-black uppercase tracking-widest">Gastos Operativos</div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                <th className="px-5 py-2 text-left">Concepto</th>
                <th className="px-5 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gastosPorCat).map(([cat, val]) => (
                <tr key={cat} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-2 text-xs font-bold text-slate-700 uppercase">{cat}</td>
                  <td className="px-5 py-2 text-right text-xs font-black text-rose-600">${fmt(val)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-5 py-3 text-xs font-black text-slate-800 uppercase">Total Gastos</td>
                <td className="px-5 py-3 text-right text-sm font-black text-slate-900">${fmt(totalGastos)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PIVOT DE CAJA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#1e7e9e] text-white px-5 py-3 text-xs font-black uppercase tracking-widest">Resumen Caja — Entradas vs Salidas</div>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase bg-slate-50">
                <th className="px-5 py-2 text-left">Categoría</th>
                <th className="px-5 py-2 text-right text-emerald-600">Entradas</th>
                <th className="px-5 py-2 text-right text-rose-500">Salidas</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set([...Object.keys(pivotEntradas), ...Object.keys(pivotSalidas)])).sort().map(cat => (
                <tr key={cat} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-2 text-xs font-bold text-slate-700 uppercase">{cat}</td>
                  <td className="px-5 py-2 text-right text-xs font-black text-emerald-600">
                    {pivotEntradas[cat] ? `${fmt(pivotEntradas[cat])}` : '—'}
                  </td>
                  <td className="px-5 py-2 text-right text-xs font-black text-rose-500">
                    {pivotSalidas[cat] ? `${fmt(pivotSalidas[cat])}` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-[#d9f1fa]">
                <td className="px-5 py-3 text-xs font-black text-slate-800">TOTAL GENERAL</td>
                <td className="px-5 py-3 text-right text-sm font-black text-emerald-700">{fmt(totalPivotEntradas)}</td>
                <td className="px-5 py-3 text-right text-sm font-black text-rose-700">{fmt(totalPivotSalidas)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑA 2: NÓMINA HORARIA
// ══════════════════════════════════════════════════════════════════════════════
const TabNomina = ({ startDate, endDate, token, onPaymentMade }) => {
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/corte/payroll?start=${startDate}&end=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setPayroll(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [startDate, endDate, token]);

  useEffect(() => { loadPayroll(); }, [loadPayroll]);

  const handleFieldChange = (id, field, value) => {
    setPayroll(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: Number(value) };
      updated.total_salario = Math.round((updated.horas || 0) * (updated.valor_hora || 0));
      return updated;
    }));
  };

  const handleSave = async (rec) => {
    setSaving(p => ({ ...p, [rec.id]: true }));
    try {
      await fetch(`http://localhost:8000/corte/payroll/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ horas: rec.horas, valor_hora: rec.valor_hora })
      });
      showToast(`✓ Guardado: ${rec.user?.full_name}`);
    } catch (e) { showToast('Error al guardar'); }
    finally { setSaving(p => ({ ...p, [rec.id]: false })); }
  };

  const handlePagar = async (rec) => {
    if (!window.confirm(`¿Confirmar pago de $${fmt(rec.total_salario)} a ${rec.user?.full_name}? Esto se registrará en Caja.`)) return;
    setSaving(p => ({ ...p, [rec.id]: 'paying' }));
    try {
      const res = await fetch(`http://localhost:8000/corte/payroll/${rec.id}/pagar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`✓ Pago de $${fmt(rec.total_salario)} registrado en Caja`);
        loadPayroll();
        if (onPaymentMade) onPaymentMade();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Error al pagar');
      }
    } catch (e) { showToast('Error de conexión'); }
    finally { setSaving(p => ({ ...p, [rec.id]: false })); }
  };

  const totalHoras = payroll.reduce((a, r) => a + (r.horas || 0), 0);
  const totalSalarios = payroll.reduce((a, r) => a + (r.total_salario || 0), 0);
  const totalPagado = payroll.filter(r => r.pagado).reduce((a, r) => a + (r.total_salario || 0), 0);

  if (loading) return <div className="py-20 text-center text-slate-400 font-bold">Cargando nómina...</div>;

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" /> {toast}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Horas Trabajadas" value={`${totalHoras}h`} icon={Clock} color="indigo" />
        <KpiCard label="Total Nómina del Período" value={`$${fmt(totalSalarios)}`} icon={DollarSign} color="amber" />
        <KpiCard label="Ya Pagado a Caja" value={`$${fmt(totalPagado)}`} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800">Liquidación de Nómina — Horaria</h3>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">
              Período: {startDate} al {endDate} · Valor base: $5.000/hora
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(
                    `http://localhost:8000/corte/payroll/sync?start=${startDate}&end=${endDate}`,
                    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
                  );
                  if (res.ok) {
                    const data = await res.json();
                    setPayroll(data);
                    showToast('✓ Empleados sincronizados correctamente');
                  } else {
                    showToast('Error al sincronizar empleados');
                  }
                } catch (e) { showToast('Error de conexión'); }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-indigo-600 text-[10px] font-black uppercase tracking-wider transition-all"
              title="Agregar empleados nuevos al período actual sin borrar los existentes"
            >
              <Users size={12} /> Sincronizar empleados
            </button>
            <button onClick={loadPayroll} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-all" title="Recargar">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-3 text-left">Empleado</th>
                <th className="px-6 py-3 text-center">Horas</th>
                <th className="px-6 py-3 text-center">Valor/Hora</th>
                <th className="px-6 py-3 text-right">Total Salario</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payroll.map(rec => (
                <tr key={rec.id} className={`hover:bg-slate-50/50 transition-colors ${rec.pagado ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-900">{rec.user?.full_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{rec.user?.username}</p>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number" min="0" disabled={rec.pagado}
                      value={rec.horas || 0}
                      onChange={e => handleFieldChange(rec.id, 'horas', e.target.value)}
                      className="w-24 text-center border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400 mx-auto block"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number" min="0" step="500" disabled={rec.pagado}
                      value={rec.valor_hora || 5000}
                      onChange={e => handleFieldChange(rec.id, 'valor_hora', e.target.value)}
                      className="w-28 text-center border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400 mx-auto block"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-black text-slate-900">${fmt(rec.total_salario)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {rec.pagado
                      ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full uppercase"><CheckCircle2 size={10} /> Pagado</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full uppercase"><Clock size={10} /> Pendiente</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!rec.pagado && (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleSave(rec)}
                          disabled={saving[rec.id]}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-lg transition-all disabled:opacity-40"
                        >
                          {saving[rec.id] === true ? '...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => handlePagar(rec)}
                          disabled={saving[rec.id] || !rec.total_salario}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-lg transition-all disabled:opacity-40 flex items-center gap-1"
                        >
                          <DollarSign size={12} />
                          {saving[rec.id] === 'paying' ? 'Pagando...' : 'Marcar Pagado'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-6 py-3 text-xs font-black text-slate-700 uppercase">Total General</td>
                <td className="px-6 py-3 text-center text-xs font-black text-indigo-600">{totalHoras}h</td>
                <td />
                <td className="px-6 py-3 text-right text-sm font-black text-slate-900">${fmt(totalSalarios)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑA 3: DISTRIBUCIÓN DE SOCIOS
// ══════════════════════════════════════════════════════════════════════════════
const TabDistribucion = ({ sales, cashFlow, startDate, endDate, token }) => {
  const [config, setConfig] = useState({
    pct_cristian: 16.0, pct_david: 51.0, pct_estefania: 33.0,
    monto_distribuir: 0, ajuste_inventario: 0
  });
  const [savedConfig, setSavedConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Cargar config guardada para este período
  useEffect(() => {
    fetch(`http://localhost:8000/corte/config?start=${startDate}&end=${endDate}`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setConfig({
            pct_cristian: data.pct_cristian,
            pct_david: data.pct_david,
            pct_estefania: data.pct_estefania,
            monto_distribuir: data.monto_distribuir || 0,
            ajuste_inventario: data.ajuste_inventario || 0
          });
          setSavedConfig(data);
        }
      }).catch(console.error);
  }, [startDate, endDate, token]);

  // Calcular utilidad neta del período — incluye ingresos externos de caja
  const { utilidadNeta, totalSalarios, totalGastos, costoMercancia, totalRecaudo, ingresoExterno } = useMemo(() => {
    const ventas = sales.filter(s => {
      const d = (s.created_at || '').split('T')[0];
      return d >= startDate && d <= endDate;
    });
    const caja = cashFlow.filter(c => {
      const d = (c.payment_date || c.created_at || '').split('T')[0];
      return d >= startDate && d <= endDate;
    });

    // Ventas registradas en el sistema
    const totalVentasSistema = ventas.reduce((a, s) => a + (s.total_sale || s.total_price || 0), 0);

    // Ingresos externos (abonos manuales, base de caja, préstamos, etc.)
    const ingresoExterno = caja
      .filter(c => c.type === 'ENTRADA')
      .reduce((a, c) => a + c.amount, 0);

    // Total recaudo global (lo que cuadra con el Excel)
    const totalRecaudo = totalVentasSistema + ingresoExterno;

    const costoMercancia = caja.filter(c => c.type === 'SALIDA' && c.category === 'REINVERSION').reduce((a, c) => a + c.amount, 0);
    const totalGastos = caja.filter(c => c.type === 'SALIDA' && !['REINVERSION', 'RETIRO DUEÑO', 'SALARIO'].includes(c.category)).reduce((a, c) => a + c.amount, 0);
    const totalSalarios = caja.filter(c => c.type === 'SALIDA' && c.category === 'SALARIO').reduce((a, c) => a + c.amount, 0);
    const utilidadNeta = totalRecaudo - costoMercancia - totalGastos - totalSalarios;
    return { utilidadNeta, totalSalarios, totalGastos, costoMercancia, totalRecaudo, ingresoExterno };
  }, [sales, cashFlow, startDate, endDate]);

  const totalPct = config.pct_cristian + config.pct_david + config.pct_estefania;
  const monto = config.monto_distribuir || utilidadNeta;

  const socios = [
    { key: 'pct_cristian', nombre: 'Cristian', pct: config.pct_cristian, color: 'indigo' },
    { key: 'pct_david',    nombre: 'David',    pct: config.pct_david,    color: 'emerald' },
    { key: 'pct_estefania',nombre: 'Estefanía',pct: config.pct_estefania,color: 'pink' },
  ];
  const colorsMap = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', pink: 'bg-pink-500' };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:8000/corte/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ periodo_start: startDate, periodo_end: endDate, ...config })
      });
      if (res.ok) { showToast('✓ Configuración guardada para este corte'); setSavedConfig(await res.json()); }
    } catch (e) { showToast('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {savedConfig && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-xs font-bold text-indigo-700 flex items-center gap-2">
          <CheckCircle2 size={14} /> Configuración guardada para el período {startDate} — {endDate}
        </div>
      )}

      {/* Resumen financiero del período */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Total Recaudado" value={`$${fmt(totalRecaudo)}`} icon={TrendingUp} color="emerald"
          sub={ingresoExterno > 0 ? `Incl. $${fmt(ingresoExterno)} externos` : undefined} />
        <KpiCard label="Ingresos Externos" value={`$${fmt(ingresoExterno)}`} icon={Wallet} color="indigo"
          sub="Abonos manuales caja" />
        <KpiCard label="Costo Mercancía" value={`$${fmt(costoMercancia)}`} icon={Package} color="rose" />
        <KpiCard label="Gastos + Salarios" value={`$${fmt(totalGastos + totalSalarios)}`} icon={TrendingDown} color="rose" />
        <KpiCard label="Utilidad Neta Estimada" value={`$${fmt(utilidadNeta)}`} icon={DollarSign} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de configuración */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h3 className="font-black text-slate-900 mb-1">Parámetros del Corte</h3>
            <p className="text-xs text-slate-400">Los porcentajes se guardan por corte para preservar el historial contable.</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monto a Distribuir</label>
            <p className="text-[10px] text-slate-400 mb-2">Déjalo en 0 para usar la Utilidad Neta calculada (${fmt(utilidadNeta)})</p>
            <div className="flex items-center border-2 border-indigo-200 rounded-xl px-4 py-3 bg-indigo-50 focus-within:border-indigo-500 transition-all">
              <span className="text-indigo-400 font-black mr-2">$</span>
              <input type="number" min="0"
                value={config.monto_distribuir}
                onChange={e => setConfig(p => ({ ...p, monto_distribuir: Number(e.target.value) }))}
                placeholder={`${utilidadNeta.toFixed(0)} (Auto)`}
                className="bg-transparent outline-none w-full font-black text-lg text-indigo-700" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">% Participación Socios</label>
            {socios.map(s => (
              <div key={s.key} className="flex items-center gap-3 mb-3">
                <div className={`w-3 h-3 rounded-full ${colorsMap[s.color]}`} />
                <span className="text-sm font-bold text-slate-700 w-24">{s.nombre}</span>
                <input type="number" min="0" max="100" step="0.5"
                  value={config[s.key]}
                  onChange={e => setConfig(p => ({ ...p, [s.key]: Number(e.target.value) }))}
                  className="w-20 text-center border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-indigo-400"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            ))}
            {Math.abs(totalPct - 100) > 0.5 && (
              <div className="flex items-center gap-2 text-amber-600 text-xs font-bold mt-2">
                <AlertCircle size={14} /> Los porcentajes suman {totalPct.toFixed(1)}% (debería ser 100%)
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-slate-900 text-white rounded-xl py-3 font-black text-sm hover:bg-black transition-all disabled:opacity-40">
            {saving ? 'Guardando...' : '💾 Guardar Configuración del Corte'}
          </button>
        </div>

        {/* Tabla de distribución */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-5 py-3 text-xs font-black uppercase tracking-widest">
            Distribución de Utilidades — ${fmt(monto || utilidadNeta)}
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                <th className="px-5 py-3 text-left">Socio</th>
                <th className="px-5 py-3 text-center">%</th>
                <th className="px-5 py-3 text-right">Monto Invertido*</th>
                <th className="px-5 py-3 text-right">A Recibir</th>
              </tr>
            </thead>
            <tbody>
              {socios.map(s => {
                const base = monto || utilidadNeta;
                const montoSocio = Math.round(base * (s.pct / 100));
                const invertido = Math.round(utilidadNeta * (s.pct / 100));
                return (
                  <tr key={s.key} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${colorsMap[s.color]}`} />
                        <span className="text-sm font-black text-slate-900">{s.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-1 rounded-md">{fmtPct(s.pct)}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-500">${fmt(invertido)}</td>
                    <td className="px-5 py-4 text-right text-sm font-black text-emerald-600">${fmt(montoSocio)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-5 py-3 text-xs font-black text-slate-800" colSpan={2}>TOTAL</td>
                <td className="px-5 py-3 text-right text-xs font-black text-slate-600">{fmtPct(totalPct)}</td>
                <td className="px-5 py-3 text-right text-sm font-black text-slate-900">${fmt(monto || utilidadNeta)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="px-5 py-3 text-[10px] text-slate-400 italic border-t border-slate-100">
            * "Monto Invertido" = porción proporcional de la Utilidad Neta calculada del sistema.
          </p>
        </div>
      </div>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function FinanceCorte() {
  const [activeTab, setActiveTab] = useState('balance');
  const [sales, setSales] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0); // dispara recarga tras pagar nómina

  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [sRes, cRes] = await Promise.all([
          fetch('http://localhost:8000/sales/', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('http://localhost:8000/cash/', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [sData, cData] = await Promise.all([
          sRes.ok ? sRes.json() : [],
          cRes.ok ? cRes.json() : [],
        ]);
        setSales(Array.isArray(sData) ? sData : []);
        setCashFlow(Array.isArray(cData) ? cData : []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadData();
  }, [token, dataVersion]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Corte_Financiero_${startDate}_al_${endDate}`;
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 100);
  };

  const tabs = [
    { id: 'balance',    label: 'Balance General',         icon: BarChart3 },
    { id: 'nomina',     label: 'Nómina Horaria',          icon: Users },
    { id: 'distribucion', label: 'Distribución Socios',   icon: PieChart },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Activity size={32} className="mx-auto text-slate-300 mb-3 animate-pulse" />
        <p className="font-bold text-slate-400">Analizando datos financieros...</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-end mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Finanzas & Corte</h2>
          <p className="text-slate-400 text-sm mt-0.5">Centro de Gestión Financiera · Estilo Nórdico</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-black transition-all shadow-lg"
        >
          <Printer size={16} /> Cerrar Corte / Imprimir
        </button>
      </div>

      {/* Selector de Rango Global */}
      <DateRangeBar
        startDate={startDate} endDate={endDate}
        setStartDate={setStartDate} setEndDate={setEndDate}
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200 flex gap-8 print:hidden overflow-x-auto">
        {tabs.map(t => (
          <TabBtn key={t.id} label={t.label} active={activeTab === t.id}
            onClick={() => setActiveTab(t.id)} icon={t.icon} />
        ))}
      </div>

      {/* Contenido por tab */}
      <div className="print:hidden">
        {activeTab === 'balance' && (
          <TabBalance sales={sales} cashFlow={cashFlow} startDate={startDate} endDate={endDate} token={token} />
        )}
        {activeTab === 'nomina' && (
          <TabNomina startDate={startDate} endDate={endDate} token={token}
            onPaymentMade={() => setDataVersion(v => v + 1)} />
        )}
        {activeTab === 'distribucion' && (
          <TabDistribucion sales={sales} cashFlow={cashFlow}
            startDate={startDate} endDate={endDate} token={token} />
        )}
      </div>

      {/* Vista de Impresión — se muestra TODO el resumen al hacer Ctrl+P */}
      <div className="hidden print:block space-y-6">
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-black">ESTILO NÓRDICO — CORTE FINANCIERO</h1>
          <p className="text-sm font-bold text-slate-700">Período: {startDate} al {endDate}</p>
        </div>
        <TabBalance sales={sales} cashFlow={cashFlow} startDate={startDate} endDate={endDate} token={token} />
      </div>
    </div>
  );
}