import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Users, Calendar, DollarSign, Wallet, 
  TrendingUp, Download, Printer, PieChart, Activity 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// Función local para timezone Colombia (UTC-5)
const getTodayCO = () => {
    const d = new Date();
    d.setHours(d.getHours() - 5);
    return d.toISOString().split('T')[0];
};

const getFirstDayCO = () => {
    const d = new Date();
    d.setHours(d.getHours() - 5);
    d.setDate(1);
    return d.toISOString().split('T')[0];
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('nomina');
  const [sales, setSales] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [startDate, setStartDate] = useState(getFirstDayCO());
  const [endDate, setEndDate] = useState(getTodayCO());
  const [selectedSeller, setSelectedSeller] = useState('ALL');

  const { user } = useAuth();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [salesRes, cashRes, usersRes] = await Promise.all([
          fetch('http://localhost:8000/sales/', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('http://localhost:8000/cash/', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('http://localhost:8000/users/', { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);
        
        const [sData, cData, uData] = await Promise.all([
          salesRes.ok ? salesRes.json() : [], 
          cashRes.ok ? cashRes.json() : [], 
          usersRes.ok ? usersRes.json() : []
        ]);
        
        setSales(sData);
        setCashFlow(cData);
        setUsers(uData);
      } catch (err) {
        console.error("Error loading report data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);


  // ── Filtrado General de Fechas ──────────────────────────────────────────────
  const validSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status !== 'pagado') return false; // Solo procesar ventas 100% pagadas
      const dateStr = s.created_at.split('T')[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [sales, startDate, endDate]);

  const validCash = useMemo(() => {
    return cashFlow.filter(c => {
      const dateStr = c.created_at.split('T')[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [cashFlow, startDate, endDate]);


  // ── LÓGICA DE NÓMINA (UTILIDAD * COMISIÓN) ───────────────────────────────────
  const { payrollData, totalPayable } = useMemo(() => {
    if (activeTab !== 'nomina') return { payrollData: [], totalPayable: 0 };
    
    // Agrupación por empleado
    const userMap = {};
    users.forEach(u => {
        userMap[u.id] = {
            id: u.id,
            name: u.full_name,
            role: u.role,
            type: u.vendedor_tipo,
            comision_pct: u.comision_pct || 0,
            total_sales_amount: 0,
            total_cost: 0,
            gross_profit: 0,
            commission_earned: 0,
            sales_count: 0
        };
    });

    validSales.forEach(sale => {
        // Asignar al vendedor de la comisión, si no tiene fall-back al creador
        const v_id = sale.user_id || sale.created_by; 
        if (!v_id || !userMap[v_id]) return;

        let saleCost = 0;
        let saleRevenue = sale.total_sale;

        sale.items.forEach(item => {
            // Asumimos que el producto fue enviado en SaleItemResponse (modificado en prev step)
            // item.product.my_cost es el costo base.
            const cost = item.product?.my_cost || 0;
            saleCost += cost * item.quantity;
        });

        const profit = saleRevenue - saleCost;
        
        userMap[v_id].sales_count += 1;
        userMap[v_id].total_sales_amount += saleRevenue;
        userMap[v_id].total_cost += saleCost;
        userMap[v_id].gross_profit += profit;
        userMap[v_id].commission_earned += (profit * userMap[v_id].comision_pct) / 100;
    });

    let arr = Object.values(userMap).filter(u => u.sales_count > 0 || u.role === 'Admin'); // Omitimos inactivos sin ventas
    if (selectedSeller !== 'ALL') {
        arr = arr.filter(u => u.id.toString() === selectedSeller);
    }

    const total = arr.reduce((acc, u) => acc + u.commission_earned, 0);

    return { payrollData: arr, totalPayable: total };
  }, [validSales, users, selectedSeller, activeTab]);


  // ── LÓGICA DE BALANCE GENERAL ───────────────────────────────────────────────
  const { balanceMetrics } = useMemo(() => {
    if (activeTab !== 'balance') return { balanceMetrics: {} };

    // 1. Ingresos Venta Pagada
    const ingresosVentas = validSales.reduce((a, s) => a + s.total_sale, 0);
    
    // 2. Costo Mercancía Vendida (COGS)
    let costoMercancia = 0;
    validSales.forEach(s => {
        s.items.forEach(i => { costoMercancia += (i.product?.my_cost || 0) * i.quantity; });
    });

    // 3. Egresos Operativos (Caja - Solo Salidas manuales)
    const gastosOperativos = validCash
        .filter(c => c.type?.toUpperCase() === 'SALIDA' && c.category !== 'RETIRO DUEÑO' && c.category !== 'REINVERSION')
        .reduce((a, c) => a + c.amount, 0);

    const reinversion = validCash
        .filter(c => c.type?.toUpperCase() === 'SALIDA' && c.category === 'REINVERSION')
        .reduce((a, c) => a + c.amount, 0);

    const retiros = validCash
        .filter(c => c.type?.toUpperCase() === 'SALIDA' && c.category === 'RETIRO DUEÑO')
        .reduce((a, c) => a + c.amount, 0);

    const extraIngresos = validCash
        .filter(c => c.type?.toUpperCase() === 'ENTRADA' && c.category !== 'CIERRE CAJA' && c.category !== 'VENTA' && c.category !== 'ABONO')
        .reduce((a, c) => a + c.amount, 0);

    // 4. Utilidad Bruta = Ingresos Ventas - Costo Mercancia
    const utilidadBruta = ingresosVentas - costoMercancia;

    // 5. Utilidad Neta (Aprox) = Utilidad Bruta + Extra - Gastos Op - Comisiones Totales
    // Calculamos todas las comisiones del periodo (sin filtro de seller)
    let totalComisionesPeriodo = 0;
    validSales.forEach(sale => {
        const v_id = sale.user_id || sale.created_by; 
        const u = users.find(u => u.id === v_id);
        if (u) {
            let sProf = 0;
            sale.items.forEach(i => sProf += ((i.price_at_sale || 0) * i.quantity) - ((i.product?.my_cost || 0) * i.quantity));
            totalComisionesPeriodo += (sProf * (u.comision_pct || 0)) / 100;
        }
    });

    const utilidadNeta = utilidadBruta + extraIngresos - gastosOperativos - reinversion - totalComisionesPeriodo;

    return { balanceMetrics: {
        ingresosVentas, costoMercancia, gastosOperativos, reinversion,
        extraIngresos, retiros, totalComisionesPeriodo, 
        utilidadBruta, utilidadNeta
    }};
  }, [validSales, validCash, users, activeTab]);



  // ── RENDER PESTAÑAS ─────────────────────────────────────────────────────────

  const renderFiltros = () => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end mb-6">
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Desde</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} 
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-slate-400" />
        </div>
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hasta</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} 
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-slate-400" />
        </div>
        
        {activeTab === 'nomina' && (
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vendedor</label>
                <select value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)} 
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-slate-400 min-w-[200px]">
                    <option value="ALL">TODOS LOS VENDEDORES</option>
                    {users.filter(u=> u.status === 'Activo').map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.vendedor_tipo})</option>
                    ))}
                </select>
            </div>
        )}
    </div>
  );


  const renderNomina = () => (
    <div className="animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto a Liquidar (Selección)</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">${fmt(totalPayable)}</p>
                <p className="text-xs text-slate-500 mt-2 font-medium">Suma de comisiones generadas en el periodo</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volumen Ventas</p>
                   <p className="text-2xl font-black text-slate-800">${fmt(payrollData.reduce((a,u)=>a+u.total_sales_amount, 0))}</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl"><TrendingUp size={24} /></div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Utilidad Generada</p>
                   <p className="text-2xl font-black text-slate-800">${fmt(payrollData.reduce((a,u)=>a+u.gross_profit, 0))}</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><DollarSign size={24} /></div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                 <h3 className="font-bold text-slate-800">Cálculo por Vendedor</h3>
                 <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Basado en Utilidad = (Venta - Costo Prod)</p>
               </div>
               <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors">
                  <Printer size={14} /> Imprimir Comprobantes
               </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-white">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Txs</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Venta Bruta</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Utilidad (Neto)</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tasa %</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Total Comisión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {payrollData.length === 0 && (
                            <tr><td colSpan="6" className="py-8 text-center text-sm font-bold text-slate-400">No hay ventas registradas en este periodo.</td></tr>
                        )}
                        {payrollData.map((u, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-900">{u.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{u.type} • {u.role}</p>
                                </td>
                                <td className="px-6 py-4 text-center text-sm font-bold text-slate-600">{u.sales_count}</td>
                                <td className="px-6 py-4 text-right text-sm font-medium text-slate-500">${fmt(u.total_sales_amount)}</td>
                                <td className="px-6 py-4 text-right text-sm font-black text-slate-700">${fmt(u.gross_profit)}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-md">{u.comision_pct}%</span>
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-black text-emerald-600 bg-emerald-50/30">
                                    ${fmt(u.commission_earned)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );


  const renderBalance = () => {
    const { 
        ingresosVentas, costoMercancia, gastosOperativos, reinversion,
        extraIngresos, totalComisionesPeriodo, utilidadBruta, utilidadNeta 
    } = balanceMetrics;

    return (
      <div className="animate-in fade-in duration-500 max-w-5xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bloque Ingresos */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Wallet size={20} /></div>
                      <h3 className="text-lg font-black text-slate-900">Ingresos Operativos</h3>
                  </div>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-sm font-bold text-slate-500">Ventas Pagadas</span>
                          <span className="text-sm font-black text-emerald-600">+ ${fmt(ingresosVentas)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-sm font-bold text-slate-500">Ingresos Extra (Caja)</span>
                          <span className="text-sm font-black text-emerald-600">+ ${fmt(extraIngresos)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Ingresos</span>
                          <span className="text-lg font-black text-slate-900">${fmt(ingresosVentas + extraIngresos)}</span>
                      </div>
                  </div>
              </div>

              {/* Bloque Egresos */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-rose-100 text-rose-500 rounded-xl flex items-center justify-center"><Activity size={20} /></div>
                      <h3 className="text-lg font-black text-slate-900">Costos y Gastos</h3>
                  </div>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-sm font-bold text-slate-500">Costo Mercancía Vendida</span>
                          <span className="text-sm font-black text-rose-500">- ${fmt(costoMercancia)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-sm font-bold text-slate-500">Reinversión (Stock)</span>
                          <span className="text-sm font-black text-rose-500">- ${fmt(reinversion)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-sm font-bold text-slate-500">Gastos Local (Caja)</span>
                          <span className="text-sm font-black text-rose-500">- ${fmt(gastosOperativos)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <span className="text-sm font-bold text-slate-500">Pago Comisiones (Est.)</span>
                          <span className="text-sm font-black text-rose-500">- ${fmt(totalComisionesPeriodo)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Egresos</span>
                          <span className="text-lg font-black text-slate-900">${fmt(costoMercancia + reinversion + gastosOperativos + totalComisionesPeriodo)}</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* Gran Resultado */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl mt-4 relative overflow-hidden">
              <PieChart size={200} className="absolute -right-10 -bottom-10 text-white opacity-5" strokeWidth={1} />
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Utilidad Bruta (antes de gastos)</p>
                      <h2 className="text-3xl font-black text-slate-200">${fmt(utilidadBruta)}</h2>
                      <p className="text-xs font-medium text-slate-500 mt-1">Ventas deduciendo únicamente el costo base de las prendas.</p>
                  </div>
                  <div className="md:border-l border-slate-700 md:pl-8">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Utilidad Neta Real
                      </p>
                      <h2 className="text-4xl font-black text-white">${fmt(utilidadNeta)}</h2>
                      <p className="text-xs font-medium text-slate-400 mt-2">Ingresos menos costo de ropa, gastos de local y comisiones.</p>
                  </div>
              </div>
          </div>
      </div>
    );
  };


  if (loading) return <div className="p-8 text-center font-bold text-slate-400">Analizando datos financieros...</div>;

  return (
    <div>
        <div className="mb-6 border-b border-slate-200 flex gap-6">
            <button 
                onClick={() => setActiveTab('nomina')}
                className={`pb-4 text-sm font-black uppercase tracking-wider transition-all relative ${
                    activeTab === 'nomina' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
                }`}
            >
                Liquidación de Nómina
                {activeTab === 'nomina' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" />}
            </button>
            <button 
                onClick={() => setActiveTab('balance')}
                className={`pb-4 text-sm font-black uppercase tracking-wider transition-all relative ${
                    activeTab === 'balance' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
                }`}
            >
                Balance General (Corte)
                {activeTab === 'balance' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" />}
            </button>
        </div>

        {renderFiltros()}
        {activeTab === 'nomina' ? renderNomina() : renderBalance()}
    </div>
  );
}