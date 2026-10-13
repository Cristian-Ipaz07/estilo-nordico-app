import { API_URL } from '../config/api';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Edit2,
  Trash2,
  X,
  CalendarRange
} from 'lucide-react';
import { useDateRange, getTodayCO } from '../context/DateRangeContext';

const getColDate = (d = new Date()) => new Date(new Date(d).toLocaleString("en-US", {timeZone: "America/Bogota"}));

const CashFlow = () => {
  const [movements, setMovements] = useState([]);
  const [sales, setSales] = useState([]); // Nuevo estado para inyectar las ventas
  const [loading, setLoading] = useState(true);
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    Promise.all([
      fetch(`${API_URL}/cash/`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/sales/`, { headers }).then(r => r.json())
    ])
    .then(([cashData, salesData]) => {
      setMovements(Array.isArray(cashData) ? cashData : []);
      setSales(Array.isArray(salesData) ? salesData : []);
      setLoading(false);
    })
    .catch(console.error);
  }, []);

  const [editingMovement, setEditingMovement] = useState(null);
  
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/cash/${editingMovement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editingMovement)
      });
      if (res.ok) {
        const updated = await res.json();
        setMovements(prev => prev.map(m => m.id === updated.id ? updated : m));
        setEditingMovement(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    // Si es una venta virtual no se puede borrar desde aquí
    if (String(id).startsWith('sale-')) return;
    if (!window.confirm("¿Seguro que quieres eliminar este movimiento?")) return;
    try {
      const res = await fetch(`${API_URL}/cash/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setMovements(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) { console.error(err); }
  };

  // Unificar movimientos físicos + ventas virtuales
  const allMovements = useMemo(() => {
    const virtualSales = [];
    sales.forEach(s => {
      const history = s.payment_history || [];
      const historyTotal = history.reduce((sum, p) => sum + p.amount, 0);
      const initialPayment = s.amount_paid - historyTotal;

      if (initialPayment > 0) {
        virtualSales.push({
          id: `sale-${s.id}-init`,
          description: `VENTA #${s.id} - ${s.customer_name}`,
          amount: initialPayment,
          type: 'ENTRADA',
          category: 'VENTA',
          payment_date: s.created_at,
          created_at: s.created_at,
          isVirtual: true
        });
      }

      history.forEach(p => {
        virtualSales.push({
          id: `sale-${s.id}-pay-${p.id}`,
          description: `ABONO VENTA #${s.id} - ${s.customer_name}`,
          amount: p.amount,
          type: 'ENTRADA',
          category: 'VENTA',
          payment_date: p.payment_date,
          created_at: p.payment_date,
          isVirtual: true
        });
      });
    });
    
    // Como ahora inyectamos las ventas automáticamente, filtramos cualquier registro MANUAL
    // que el usuario haya hecho en el pasado usando la categoría "VENTA" para evitar duplicar el dinero.
    const realMovements = movements.filter(m => m.category !== 'VENTA');
    
    return [...realMovements, ...virtualSales].sort((a,b) => new Date(a.payment_date || a.created_at) - new Date(b.payment_date || b.created_at));
  }, [movements, sales]);

  // Filtrar y calcular arrastre
  const processedData = useMemo(() => {
    const effectiveEnd = endDate || getTodayCO();
    
    let initialBalance = 0;
    const filtered = [];
    
    allMovements.forEach(m => {
      const d = (m.payment_date || m.created_at || '').split('T')[0];
      const isEntrada = m.type === 'ENTRADA';
      
      if (d < startDate) {
        // Movimientos antes del corte suman al saldo arrastrado
        if (isEntrada) initialBalance += m.amount;
        else initialBalance -= m.amount;
      } else if (d <= effectiveEnd) {
        // Movimientos dentro del corte
        filtered.push(m);
      }
    });

    return { initialBalance, filtered };
  }, [allMovements, startDate, endDate]);

  // Calculate Running Balance & Process Rows
  const tableRows = [];
  let currentBalance = processedData.initialBalance;
  
  // Agregar fila virtual de saldo inicial arrastrado
  tableRows.push({
    id: 'saldo-inicial',
    fechaStr: startDate.split('-').reverse().join('/'),
    description: 'SALDO ANTERIOR (ARRASTRE)',
    entrada: null,
    salida: null,
    saldo: currentBalance,
    category: 'INICIO',
    isVirtual: true,
    isInitial: true
  });

  processedData.filtered.forEach(m => {
    const isEntrada = m.type === 'ENTRADA';
    if (isEntrada) currentBalance += m.amount;
    else currentBalance -= m.amount;
    
    tableRows.push({
      ...m,
      entrada: isEntrada ? m.amount : null,
      salida: !isEntrada ? m.amount : null,
      saldo: currentBalance,
      fechaStr: getColDate(m.payment_date || m.created_at).toLocaleDateString('es-CO')
    });
  });

  // Pivot Table Calculation
  const pivotData = useMemo(() => {
    const sums = {};
    processedData.filtered.forEach(m => {
      if (!sums[m.category]) sums[m.category] = { ENTRADAS: 0, SALIDAS: 0 };
      if (m.type === 'ENTRADA') sums[m.category].ENTRADAS += m.amount;
      else sums[m.category].SALIDAS += m.amount;
    });
    
    const summary = Object.keys(sums).sort().map(cat => ({
      category: cat,
      entradas: sums[cat].ENTRADAS,
      salidas: sums[cat].SALIDAS
    }));
    
    const totalEntradas = summary.reduce((a, b) => a + b.entradas, 0);
    const totalSalidas = summary.reduce((a, b) => a + b.salidas, 0);
    
    return { summary, totalEntradas, totalSalidas };
  }, [processedData.filtered]);

  if (loading) return <div className="p-8 text-slate-500 font-bold">Cargando contabilidad global...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Header & Filtro de Rango Global */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Flujo de Caja Global (Contabilidad)</h2>
          <p className="text-slate-500 text-sm">Consolidado de cierres de caja, arriendos, salarios y gastos macro.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-terminal'))}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-indigo-500/30"
          >
            + Registrar Movimiento
          </button>
        </div>
      </div>

      {/* Selector de rango global (sincronizado con Ventas y Finanzas) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex items-center gap-2 mr-2">
          <CalendarRange size={14} className="text-indigo-500" />
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Período del Corte</span>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Desde</label>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-indigo-400" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hasta (Automático = Hoy)</label>
          <div className="flex items-center gap-2">
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-indigo-400" />
            <button 
              onClick={() => setEndDate(getTodayCO())}
              className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors"
            >
              AL DÍA
            </button>
            <button 
              onClick={() => setEndDate('')}
              className="px-3 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
              title="Dejar abierto para que avance con el día de hoy automáticamente"
            >
              LIMPIAR
            </button>
          </div>
        </div>
        <div className="ml-auto text-[10px] font-bold text-slate-400 italic">
          Sincronizado con Ventas &amp; Finanzas
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Entradas</p>
              <h3 className="text-2xl font-black text-emerald-600">${pivotData.totalEntradas.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><TrendingUp size={20} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Salidas</p>
              <h3 className="text-2xl font-black text-rose-600">${pivotData.totalSalidas.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl"><TrendingDown size={20} /></div>
          </div>
        </div>
        <div className={`p-6 rounded-2xl border shadow-sm ${currentBalance >= 0 ? 'bg-slate-900 border-black' : 'bg-rose-900 border-rose-950'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Real (Neto)</p>
              <h3 className="text-3xl font-black text-white">${currentBalance.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-white/10 text-white rounded-xl"><DollarSign size={20} /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tabla Excel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50 flex justify-between items-center">
             <h3 className="font-black text-slate-800 uppercase text-sm flex items-center gap-2"><FileText size={16}/> Historial de Operaciones</h3>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-[#1e7e9e] text-white">
                  <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase tracking-wider text-center">Fecha</th>
                  <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase tracking-wider w-[40%] text-center">Descripción</th>
                  <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase tracking-wider text-center">Entradas</th>
                  <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase tracking-wider text-center">Salidas</th>
                  <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase tracking-wider text-center">Saldo</th>
                  <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase tracking-wider text-center">Cat</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-center"></th>
                </tr>
              </thead>
              <tbody>
                {/* Lo invertimos para visualizar del más reciente al más antiguo, manteniendo el saldo ya calculado */}
                {tableRows.slice().reverse().map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 text-center">{row.fechaStr}</td>
                    <td className="px-4 py-1.5 border border-slate-200 text-xs font-bold text-slate-800 uppercase bg-[#d9f1fa]">{row.description}</td>
                    <td className="px-4 py-1.5 border border-slate-200 text-xs font-black text-emerald-600 text-right">
                      {row.entrada ? row.entrada.toLocaleString() : ''}
                    </td>
                    <td className="px-4 py-1.5 border border-slate-200 text-xs font-black text-rose-600 text-right">
                       {row.salida ? row.salida.toLocaleString() : ''}
                    </td>
                    <td className="px-4 py-1.5 border border-slate-200 text-xs font-black text-slate-800 text-right bg-[#d9f1fa]">
                      {row.saldo.toLocaleString()}
                    </td>
                    <td className="px-4 py-1.5 border border-slate-200 text-[10px] font-black text-slate-500 text-center uppercase">
                      {row.category}
                    </td>
                    <td className="px-4 py-1.5 border border-slate-200 text-center">
                      {!row.isVirtual && (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setEditingMovement({
                            id: row.id, description: row.description, amount: row.amount, 
                            type: row.type, category: row.category, 
                            payment_date: row.payment_date ? row.payment_date.split('T')[0] : row.created_at.split('T')[0]
                          })} className="text-slate-400 hover:text-indigo-600 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      {row.isInitial && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Base</span>}
                      {row.isVirtual && !row.isInitial && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Venta Auto</span>}
                    </td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center border text-slate-400 font-bold italic text-sm">Vacíe, no hay asientos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla Pivote (Resumen) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50">
               <h3 className="font-black text-slate-800 uppercase text-sm mb-1">Resumen por Categoría</h3>
               <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Suma de Entradas vs Salidas</p>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                   <tr className="bg-[#1e7e9e] text-white">
                      <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase">Etiquetas de fila</th>
                      <th className="px-4 py-2 border-r border-[#15607a] text-[10px] font-black uppercase text-center">Suma Entradas</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-center">Suma Salidas</th>
                   </tr>
                </thead>
                <tbody>
                  {pivotData.summary.map((row, i) => (
                    <tr key={i}>
                       <td className="px-4 py-1.5 border-b border-r text-xs font-bold text-slate-800 uppercase">{row.category}</td>
                       <td className="px-4 py-1.5 border-b border-r text-xs font-bold text-slate-600 text-right">
                          {row.entradas > 0 ? row.entradas.toLocaleString() : ''}
                       </td>
                       <td className="px-4 py-1.5 border-b text-xs font-bold text-slate-600 text-right">
                          {row.salidas > 0 ? row.salidas.toLocaleString() : ''}
                       </td>
                    </tr>
                  ))}
                  <tr className="bg-[#d9f1fa]">
                     <td className="px-4 py-2 border-t-2 border-slate-300 text-xs font-black text-slate-900 uppercase">Total general</td>
                     <td className="px-4 py-2 border-t-2 border-r border-slate-300 text-xs font-black text-emerald-700 text-right">{pivotData.totalEntradas.toLocaleString()}</td>
                     <td className="px-4 py-2 border-t-2 border-slate-300 text-xs font-black text-rose-700 text-right">{pivotData.totalSalidas.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
             <CalendarIcon size={32} strokeWidth={1.5} className="mx-auto text-slate-300 mb-2"/>
             <p className="text-xs font-bold text-slate-500">¿Deseas agregar un movimiento macro?</p>
             <p className="text-[10px] text-slate-400 mt-1">Usa la pestaña CAJA del Terminal para registrar cobros como Rentas o Salarios antes de cerrar.</p>
          </div>
        </div>

      </div>

      {/* Edit Modal */}
      {editingMovement && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEditSubmit} className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 text-lg uppercase">Editar Movimiento</h3>
              <button type="button" onClick={() => setEditingMovement(null)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Descripción</label>
                <input value={editingMovement.description} onChange={e => setEditingMovement({...editingMovement, description: e.target.value})} 
                  className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-400 uppercase" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Monto</label>
                <div className="flex items-center border-2 border-slate-100 rounded-2xl px-4 py-3">
                  <span className="font-black text-slate-400 mr-2">$</span>
                  <input type="number" value={editingMovement.amount} onChange={e => setEditingMovement({...editingMovement, amount: parseFloat(e.target.value)})} 
                    className="w-full outline-none font-black text-lg text-slate-800" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                  <select value={editingMovement.type} onChange={e => setEditingMovement({...editingMovement, type: e.target.value})} 
                    className="w-full border-2 border-slate-100 rounded-2xl px-3 py-3 font-bold text-xs outline-none">
                    <option value="SALIDA">SALIDA</option>
                    <option value="ENTRADA">ENTRADA</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Categoría</label>
                  <select value={editingMovement.category} onChange={e => setEditingMovement({...editingMovement, category: e.target.value})} 
                    className="w-full border-2 border-slate-100 rounded-2xl px-3 py-3 font-bold text-xs outline-none uppercase">
                    <option value="GASTO">GASTO</option>
                    <option value="SALARIO">SALARIO</option>
                    <option value="ADELANTO">ADELANTO</option>
                    <option value="DEVOLUCION">DEVOLUCION</option>
                    <option value="REINVERSION">REINVERSIÓN</option>
                    <option value="PRESTAMO">PRÉSTAMO</option>
                    <option value="GANANCIA">GANANCIA</option>
                    <option value="OTRA ENTRADA">OTRA ENTRADA</option>
                    <option value="INGRESO_VENTA_EXTERNA">INGRESO_VENTA_EXTERNA</option>
                    <option value="OTROS">OTROS</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha</label>
                <input type="date" value={editingMovement.payment_date} onChange={e => setEditingMovement({...editingMovement, payment_date: e.target.value})} 
                  className="w-full border-2 border-slate-100 rounded-2xl px-3 py-3 font-bold text-xs outline-none" required />
              </div>
            </div>
            
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black uppercase text-xs hover:bg-indigo-700 shadow-lg mt-6">
              Guardar Cambios
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CashFlow;
