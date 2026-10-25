import { useNavigate } from 'react-router-dom';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { getSales } from '../services/api';

const getColDate = (d = new Date()) => {
  return new Date(new Date(d).toLocaleString("en-US", {timeZone: "America/Bogota"}));
};

const isToday = (dateField) => {
  const d = getColDate(dateField);
  const now = getColDate();
  return d.getDate() === now.getDate() && 
         d.getMonth() === now.getMonth() && 
         d.getFullYear() === now.getFullYear();
};

const isThisWeek = (dateField) => {
  const d = getColDate(dateField);
  const now = getColDate();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0,0,0,0);
  return d >= startOfWeek;
};

const isThisMonth = (dateField) => {
  const d = getColDate(dateField);
  const now = getColDate();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const matchesTimeFilter = (dateField, filter) => {
  if (!dateField) return false;
  if (filter === 'Hoy') return isToday(dateField);
  if (filter === 'Esta Semana') return isThisWeek(dateField);
  if (filter === 'Este Mes') return isThisMonth(dateField);
  return true; // Todos
};

const StatCard = ({ title, value, change, trend, icon: Icon, color, subtitle }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-opacity-10 ${color} ${color.replace('bg-', 'text-')}`}>
        <Icon size={24} />
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
        <TrendingUp size={14} className={trend === 'down' ? 'rotate-180' : ''} />
        {change}
      </div>
    </div>
    <p className="text-slate-500 text-sm font-medium">{title}</p>
    <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
    {subtitle && <p className="text-xs text-slate-400 mt-1 font-semibold">{subtitle}</p>}
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [timeFilter, setTimeFilter] = useState('Hoy');
  const [loading, setLoading] = useState(true);

  const fetchDashboardSales = useCallback(() => {
    getSales().then(res => {
      setSales(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchDashboardSales();
    window.addEventListener('refresh-sales', fetchDashboardSales);
    return () => window.removeEventListener('refresh-sales', fetchDashboardSales);
  }, [fetchDashboardSales]);

  // Domicilio helper: identifica ventas a domicilio
  const isDelivery = (s) => s.sale_channel === 'DOMICILIO' || !!s.delivery_address || ['en_domicilio', 'alistado', 'en_camino', 'por_confirmar', 'entregado'].includes(s.status);
  // Domicilio activo / por cobrar contraentrega (no computar como venta consumada hasta confirmar cobro)
  const isPendingDelivery = (s) => isDelivery(s) && (s.status !== 'pagado' || !s.cash_settled) && s.status !== 'cancelado';

  // Excluir ventas canceladas o domicilios rechazados de métricas reales
  const activeSales = sales.filter(s => s.status !== 'cancelado');

  // Filter sales based on selected time using created_at
  const filteredSales = activeSales.filter(s => {
    if (timeFilter === 'Hoy') return isToday(s.created_at);
    if (timeFilter === 'Esta Semana') return isThisWeek(s.created_at);
    if (timeFilter === 'Este Mes') return isThisMonth(s.created_at);
    return true; // Todos
  });

  // Ventas del período (según fecha de creación)
  const salesInPeriod = activeSales.filter(s => matchesTimeFilter(s.created_at, timeFilter));
  const confirmedSales = salesInPeriod.filter(s => !isPendingDelivery(s));
  const pendingDeliveries = salesInPeriod.filter(s => isPendingDelivery(s));

  // 1. Total Recaudado (Caja): Dinero real cobrado durante el período filtrado
  // Se acumulan todos los pagos (payment_history) cuya fecha cae en el período filtrado
  let totalRecaudado = 0;
  activeSales.forEach(s => {
    const pendingDomi = isPendingDelivery(s);
    (s.payment_history || []).forEach(p => {
      const pDate = p.payment_date || s.created_at;
      if (matchesTimeFilter(pDate, timeFilter)) {
        if (!pendingDomi || (pendingDomi && p.amount > 0)) {
          totalRecaudado += (p.amount || 0);
        }
      }
    });
  });

  // Fallback si no hay payment_history en ventas antiguas
  if (totalRecaudado === 0 && confirmedSales.length > 0) {
    totalRecaudado = confirmedSales.reduce((sum, s) => sum + (s.amount_paid || 0), 0) +
                     pendingDeliveries.reduce((sum, s) => sum + (s.amount_paid || 0), 0);
  }

  // 2. Ventas Facturadas ($): Valor total de prendas vendidas en firme en el período
  const totalFacturado = confirmedSales.reduce((sum, s) => sum + (s.total_sale || 0), 0);

  // 3. Separados Pendientes ($): Saldo adeudado por clientes en separados del período
  const totalSeparados = confirmedSales.filter(s => s.status === 'separado').reduce((sum, s) => sum + (s.balance_due || 0), 0);

  // 4. Pedidos concretados en el período
  const pedidosCount = confirmedSales.length;

  // 5. Clientes únicos
  const clientesCount = new Set(confirmedSales.map(s => s.customer_name)).size;

  // 6. Domicilios activos en calle (por cobrar contraentrega)
  const totalCobroContraentrega = pendingDeliveries.reduce((sum, s) => sum + (s.balance_due || s.total_sale || 0), 0);

  // Chart Logic: Grafica el Dinero Real Recaudado en Caja por intervalo
  const chartData = [];
  if (timeFilter === 'Hoy') {
    const hours = Array.from({length: 13}, (_, i) => i + 8);
    hours.forEach(hour => {
      let hourRecaudo = 0;
      let hourFacturado = 0;

      activeSales.forEach(s => {
        const pendingDomi = isPendingDelivery(s);
        (s.payment_history || []).forEach(p => {
          const pDate = p.payment_date || s.created_at;
          if (isToday(pDate) && getColDate(pDate).getHours() === hour) {
            if (!pendingDomi || (pendingDomi && p.amount > 0)) {
              hourRecaudo += (p.amount || 0);
            }
          }
        });
      });

      confirmedSales.filter(s => getColDate(s.created_at).getHours() === hour).forEach(s => {
        hourFacturado += (s.total_sale || 0);
      });

      chartData.push({ name: `${hour}:00`, sales: hourRecaudo, facturado: hourFacturado });
    });
  } else if (timeFilter === 'Esta Semana') {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    days.forEach((dayName, idx) => {
      let dayRecaudo = 0;
      let dayFacturado = 0;

      activeSales.forEach(s => {
        const pendingDomi = isPendingDelivery(s);
        (s.payment_history || []).forEach(p => {
          const pDate = p.payment_date || s.created_at;
          if (isThisWeek(pDate) && getColDate(pDate).getDay() === idx) {
            if (!pendingDomi || (pendingDomi && p.amount > 0)) {
              dayRecaudo += (p.amount || 0);
            }
          }
        });
      });

      confirmedSales.filter(s => getColDate(s.created_at).getDay() === idx).forEach(s => {
        dayFacturado += (s.total_sale || 0);
      });

      chartData.push({ name: dayName, sales: dayRecaudo, facturado: dayFacturado });
    });
  } else if (timeFilter === 'Este Mes') {
    const now = getColDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for(let i=1; i<=daysInMonth; i++) {
      let dayRecaudo = 0;
      let dayFacturado = 0;

      activeSales.forEach(s => {
        const pendingDomi = isPendingDelivery(s);
        (s.payment_history || []).forEach(p => {
          const pDate = p.payment_date || s.created_at;
          if (isThisMonth(pDate) && getColDate(pDate).getDate() === i) {
            if (!pendingDomi || (pendingDomi && p.amount > 0)) {
              dayRecaudo += (p.amount || 0);
            }
          }
        });
      });

      confirmedSales.filter(s => getColDate(s.created_at).getDate() === i).forEach(s => {
        dayFacturado += (s.total_sale || 0);
      });

      chartData.push({ name: `${i}`, sales: dayRecaudo, facturado: dayFacturado });
    }
  } else {
    chartData.push({ name: 'Total', sales: totalRecaudado, facturado: totalFacturado });
  }

  // Top Products Logic (Solo productos de ventas cerradas / confirmadas)
  const productCount = {};
  confirmedSales.forEach(sale => {
    sale.items?.forEach(item => {
      const pName = item.product?.name || item.product?.ref || 'Producto Borrado';
      if(!productCount[pName]) productCount[pName] = { units: 0, revenue: 0 };
      productCount[pName].units += item.quantity;
      productCount[pName].revenue += item.total_item;
    });
  });
  const topProducts = Object.entries(productCount)
    .sort((a, b) => b[1].units - a[1].units).slice(0, 5)
    .map(([name, data]) => ({ name, sales: data.units }));

  if (loading) return <div className="p-8 text-slate-500">Cargando métricas...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Resumen General</h2>
          <p className="text-slate-500">Bienvenido de nuevo, así van las ventas en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={fetchDashboardSales}
            title="Sincronizar métricas en tiempo real"
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer flex items-center justify-center"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>
          <button 
            onClick={() => navigate('/reports')}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Ver Reportes & Corte
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-terminal'))}
            className="px-4 py-2 bg-emerald-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-colors flex items-center gap-2 shadow-sm"
          >
            <ArrowUpRight size={16} />
            Nueva Venta POS
          </button>
        </div>
      </div>

      {/* Banner de Domicilios en Curso / Contraentrega (por cobrar) */}
      {pendingDeliveries.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-purple-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
              <span className="text-2xl">🛵</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-slate-900 text-sm sm:text-base">
                  {pendingDeliveries.length} {pendingDeliveries.length === 1 ? 'Domicilio Activo en Curso' : 'Domicilios Activos en Curso'} (Contraentrega)
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-200 text-purple-900">
                  Por Cobrar
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Total por recaudar en calle: <strong className="text-purple-700 font-black">${totalCobroContraentrega.toLocaleString()}</strong>. No se computa en ventas realizadas hasta confirmar cobro.
              </p>
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-deliveries'))}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <span>Ver Domicilios ({pendingDeliveries.length})</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Recaudado (Caja)"
          value={`$${totalRecaudado.toLocaleString()}`}
          change="Dinero Real"
          trend="up"
          subtitle={`Facturado: $${totalFacturado.toLocaleString()}`}
          icon={DollarSign}
          color="bg-emerald-500 text-emerald-600"
        />
        <StatCard
          title="Ventas Facturadas"
          value={`$${totalFacturado.toLocaleString()}`}
          change={`${pedidosCount} Pedidos`}
          trend="up"
          subtitle={`${pedidosCount} facturas en período`}
          icon={Package}
          color="bg-blue-500 text-blue-600"
        />
        <StatCard
          title="Separados Pendientes"
          value={`$${totalSeparados.toLocaleString()}`}
          change="Deuda"
          trend="down"
          subtitle="Saldo por cobrar clientes"
          icon={Wallet}
          color="bg-amber-500 text-amber-600"
        />
        <StatCard
          title="Nuevos Clientes"
          value={clientesCount}
          change="Únicos"
          trend="up"
          subtitle="Registrados en período"
          icon={Users}
          color="bg-indigo-500 text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-800">Rendimiento de Recaudo en Caja ({timeFilter})</h3>
              <p className="text-[11px] text-slate-400 font-medium">Ingreso de dinero real recaudado por intervalo</p>
            </div>
            <select 
              className="bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="Hoy">Hoy</option>
              <option value="Esta Semana">Esta semana</option>
              <option value="Este Mes">Este mes</option>
              <option value="Todos">Histórico</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#0f172a' }}
                  itemStyle={{ color: '#10b981' }}
                  formatter={(value, name, item) => [
                    `$${Number(value).toLocaleString()} (Facturado: $${(item?.payload?.facturado || value).toLocaleString()})`,
                    'Recaudado en Caja'
                  ]}
                />
                <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">Top Productos</h3>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {topProducts.length === 0 ? (
               <p className="text-slate-500 text-sm">No hay ventas registradas.</p>
            ) : topProducts.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center font-bold text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{product.name}</p>
                    <p className="text-xs text-slate-500">Unidades sumadas</p>
                  </div>
                </div>
                <div className="text-right pl-2">
                  <p className="text-sm font-bold text-slate-800">{product.sales}</p>
                  <p className="text-[10px] text-emerald-500 font-bold">VENTAS</p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-6 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors md:mt-auto">
            Ver Inventario Completo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
