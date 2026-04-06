
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';

const getColDate = (d = new Date()) => new Date(new Date(d).toLocaleString("en-US", {timeZone: "America/Bogota"}));

const CashFlow = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('mes'); // 'hoy', 'semana', 'mes', 'todo'

  useEffect(() => {
    fetch('http://localhost:8000/cash/')
      .then(res => res.json())
      .then(data => {
        setMovements(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  // Filter and sort Data
  const filteredData = useMemo(() => {
    let filtered = [...movements];
    const now = getColDate();
    
    if (dateFilter === 'hoy') {
      filtered = filtered.filter(m => {
        const d = getColDate(m.created_at);
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (dateFilter === 'semana') {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
      firstDay.setHours(0,0,0,0);
      filtered = filtered.filter(m => getColDate(m.created_at) >= firstDay);
    } else if (dateFilter === 'mes') {
      filtered = filtered.filter(m => {
        const d = getColDate(m.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    
    // Sort oldest to newest to calculate running balance correctly
    return filtered.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  }, [movements, dateFilter]);

  // Calculate Running Balance & Process Rows
  const tableRows = [];
  let currentBalance = 0;
  
  filteredData.forEach(m => {
    const isEntrada = m.type === 'ENTRADA';
    if (isEntrada) currentBalance += m.amount;
    else currentBalance -= m.amount;
    
    tableRows.push({
      ...m,
      entrada: isEntrada ? m.amount : null,
      salida: !isEntrada ? m.amount : null,
      saldo: currentBalance,
      fechaStr: getColDate(m.created_at).toLocaleDateString('es-CO')
    });
  });

  // Pivot Table Calculation
  const pivotData = useMemo(() => {
    const sums = {};
    filteredData.forEach(m => {
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
  }, [filteredData]);

  if (loading) return <div className="p-8 text-slate-500 font-bold">Cargando contabilidad global...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Header & Filters */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Flujo de Caja Global (Contabilidad)</h2>
          <p className="text-slate-500 text-sm">Consolidado de cierres de caja, arriendos, salarios y gastos macro.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['hoy', 'semana', 'mes', 'todo'].map(f => (
            <button key={f} onClick={() => setDateFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${dateFilter === f ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {f}
            </button>
          ))}
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
                  <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-center">Cat</th>
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
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center border text-slate-400 font-bold italic text-sm">Vacíe, no hay asientos registrados.</td>
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
    </div>
  );
};

export default CashFlow;
