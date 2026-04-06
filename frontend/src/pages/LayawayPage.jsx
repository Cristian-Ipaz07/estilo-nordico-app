
import React, { useState, useEffect } from 'react';
import {
  Users,
  Wallet,
  Calendar,
  Plus,
  ArrowRight,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { getSales } from '../services/api';

const getColDate = (d = new Date()) => new Date(new Date(d).toLocaleString("en-US", {timeZone: "America/Bogota"}));

const isOverdue = (dateString) => {
  const d = getColDate(dateString);
  const now = getColDate();
  const difTime = now - d;
  const difDays = Math.ceil(difTime / (1000 * 60 * 60 * 24)); 
  return difDays > 30; // Consideramos vencido si tiene más de 30 días
};

const LayawayCard = ({ item }) => {
  const percentage = (item.amount_paid / item.total_sale) * 100;
  const overdue = isOverdue(item.created_at);
  const formattedDate = getColDate(item.created_at).toLocaleDateString('es-CO');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">REF-{item.id}</p>
          <h4 className="text-lg font-bold text-slate-800 line-clamp-1">{item.customer_name}</h4>
        </div>
        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${overdue ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
          {overdue ? 'Vencido (+30d)' : 'Pendiente'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total</p>
          <p className="text-lg font-bold text-slate-800">${item.total_sale.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Saldo</p>
          <p className="text-lg font-bold text-amber-500">${item.balance_due.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-slate-500">Abonado: ${item.amount_paid.toLocaleString()}</span>
          <span className="text-emerald-500">{percentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500 bg-emerald-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100 mt-auto">
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          {formattedDate}
        </div>
        <button className="flex items-center gap-1 text-emerald-600 font-bold hover:text-emerald-500 transition-colors">
          Abonar / Detalles
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

const LayawayPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSales().then(res => {
      setSales(res.data);
      setLoading(false);
    }).catch(console.error);
  }, []);

  // Filter automatically by status === 'separado' and balance_due > 0
  const activeLayaways = sales.filter(s => s.status === 'separado' && s.balance_due > 0);

  // KPIs calculations
  const totalPorCobrar = activeLayaways.reduce((sum, s) => sum + s.balance_due, 0);
  const clientesActivos = new Set(activeLayaways.map(s => s.customer_name)).size;
  const vencidosCount = activeLayaways.filter(s => isOverdue(s.created_at)).length;

  if (loading) return <div className="p-8 text-slate-500">Cargando separados...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestión de Separados</h2>
          <p className="text-slate-500 text-sm">Seguimiento de saldos pendientes y abonos con mora.</p>
        </div>
        <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-all flex items-center gap-2">
          <Plus size={18} />
          Nuevo Separado POS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Users size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Clientes Activos</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{clientesActivos}</p>
        </div>
        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <Wallet size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Por Cobrar</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">${totalPorCobrar.toLocaleString()}</p>
        </div>
        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-rose-500 mb-2">
            <AlertCircle size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Vencidos (+30d)</span>
          </div>
          <p className="text-2xl font-bold text-rose-500">{vencidosCount}</p>
        </div>
        <div className="col-span-1 flex items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl hover:bg-slate-100 hover:border-slate-400 cursor-pointer transition-all">
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <UserPlus size={24} />
            <span className="text-xs font-bold text-slate-500 mt-1">Imprimir Cartera</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeLayaways.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            No hay separados pendientes de pago en este momento.
          </div>
        ) : (
          activeLayaways.map(item => (
            <LayawayCard key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
};

export default LayawayPage;
