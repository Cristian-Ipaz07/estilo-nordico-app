
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  ArrowUpRight,
  ChevronRight
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

const StatCard = ({ title, value, change, trend, icon: Icon, color }) => (
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
  </div>
);

const Dashboard = () => {
  const [sales, setSales] = useState([]);
  const [timeFilter, setTimeFilter] = useState('Hoy');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSales().then(res => {
      setSales(res.data);
      setLoading(false);
    }).catch(console.error);
  }, []);

  // Filter sales based on selected time using created_at
  const filteredSales = sales.filter(s => {
    if (timeFilter === 'Hoy') return isToday(s.created_at);
    if (timeFilter === 'Esta Semana') return isThisWeek(s.created_at);
    if (timeFilter === 'Este Mes') return isThisMonth(s.created_at);
    return true; // Todos
  });

  // Calculate generic stats
  const totalVentas = filteredSales.reduce((sum, s) => sum + s.total_sale, 0);
  const totalSeparados = filteredSales.filter(s => s.status === 'separado').reduce((sum, s) => sum + s.balance_due, 0);
  const pedidosCount = filteredSales.length;

  // Since we only track sales and not "users/clients" specifically in an active table, we will use unique names as "Clientes"
  const clientesCount = new Set(filteredSales.map(s => s.customer_name)).size;

  // Chart Logic (Aggregate by interval based on filter)
  const chartData = [];
  if (timeFilter === 'Hoy') {
    // Generate hours 8 AM to 8 PM
    const hours = Array.from({length: 13}, (_, i) => i + 8);
    hours.forEach(hour => {
      const saleSum = filteredSales.filter(s => getColDate(s.created_at).getHours() === hour)
                                   .reduce((sum, s) => sum + s.total_sale, 0);
      chartData.push({ name: `${hour}:00`, sales: saleSum });
    });
  } else if (timeFilter === 'Esta Semana') {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    days.forEach((dayName, idx) => {
      const saleSum = filteredSales.filter(s => getColDate(s.created_at).getDay() === idx)
                                   .reduce((sum, s) => sum + s.total_sale, 0);
      chartData.push({ name: dayName, sales: saleSum });
    });
    // Reorder from Monday -> Sunday conceptually if needed, but this is simple.
  } else if (timeFilter === 'Este Mes') {
    // Generate chunks of 5 days or simply every day
    const now = getColDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for(let i=1; i<=daysInMonth; i++) {
      const saleSum = filteredSales.filter(s => getColDate(s.created_at).getDate() === i)
                                   .reduce((sum, s) => sum + s.total_sale, 0);
      chartData.push({ name: `${i}`, sales: saleSum });
    }
  } else {
    // Todos (fallback)
    chartData.push({ name: 'Total', sales: totalVentas});
  }

  // Top Products Logic
  const productCount = {};
  filteredSales.forEach(sale => {
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
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Descargar Reporte
          </button>
          <button className="px-4 py-2 bg-emerald-500 text-slate-900 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors flex items-center gap-2">
            <ArrowUpRight size={16} />
            Nueva Venta POS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas Totales"
          value={`$${totalVentas.toLocaleString()}`}
          change="Real"
          trend="up"
          icon={ShoppingCart}
          color="bg-emerald-500 text-emerald-600"
        />
        <StatCard
          title="Nuevos Pedidos"
          value={pedidosCount}
          change="Facturas"
          trend="up"
          icon={Package}
          color="bg-blue-500 text-blue-600"
        />
        <StatCard
          title="Separados Pendientes"
          value={`$${totalSeparados.toLocaleString()}`}
          change="Deuda"
          trend="down"
          icon={Wallet}
          color="bg-amber-500 text-amber-600"
        />
        <StatCard
          title="Nuevos Clientes"
          value={clientesCount}
          change="Únicos"
          trend="up"
          icon={Users}
          color="bg-indigo-500 text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">Rendimiento de Ventas ({timeFilter})</h3>
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
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Ventas']}
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
