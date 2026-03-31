import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Plus, Store, User, Hash, DollarSign } from 'lucide-react';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para el formulario de nueva venta (Basado en tu Hoja de Salidas)
  const [newSale, setNewSale] = useState({
    customer: 'CLIENTE FINAL',
    ref: '',
    quantity: 1,
    sale_price: 0,
    observation: ''
  });

  // 1. Cargar historial de ventas
  const fetchSales = async () => {
    try {
      const response = await fetch('http://localhost:8000/sales/');
      const data = await response.json();
      setSales(data);
    } catch (err) { console.error("Error cargando ventas:", err); }
  };

  useEffect(() => { fetchSales(); }, []);

  // 2. Registrar Venta (Afecta Stock y Ganancia)
  const handleRegisterSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/sales/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSale),
      });
      if (response.ok) {
        alert("¡Venta registrada!");
        fetchSales(); // Recarga la lista
        setNewSale({ ...newSale, ref: '', quantity: 1, sale_price: 0 }); // Limpia
      }
    } catch (err) { alert("Error al conectar con el servidor"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Resumen Rápido */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Registro de Salidas</h2>
        <span className="text-sm font-medium px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
          Hoy: {new Date().toLocaleDateString()}
        </span>
      </div>

      {/* FORMULARIO DE REGISTRO (Tu flujo de trabajo) */}
      <form onSubmit={handleRegisterSale} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Comprador</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input type="text" className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm" 
              value={newSale.customer} onChange={e => setNewSale({...newSale, customer: e.target.value})} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">REF (Producto)</label>
          <div className="relative">
            <Hash className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input type="text" placeholder="Ej: 770" className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm"
              value={newSale.ref} onChange={e => setNewSale({...newSale, ref: e.target.value})} required />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad</label>
          <input type="number" className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
            value={newSale.quantity} onChange={e => setNewSale({...newSale, quantity: parseInt(e.target.value)})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Precio Venta</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input type="number" className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-emerald-600"
              value={newSale.sale_price} onChange={e => setNewSale({...newSale, sale_price: parseFloat(e.target.value)})} />
          </div>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            <Plus size={18} /> {loading ? 'Procesando...' : 'Registrar'}
          </button>
        </div>
      </form>

      {/* TABLA DE SALIDAS RECIENTES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Fecha</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Comprador</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">REF</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Cant</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Venta</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Ganancia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 text-xs text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-900">{sale.customer}</td>
                <td className="px-6 py-4 text-sm font-mono text-slate-600">{sale.ref}</td>
                <td className="px-6 py-4 text-sm font-bold">{sale.quantity}</td>
                <td className="px-6 py-4 text-sm font-bold text-emerald-600">${sale.total?.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-bold text-blue-600">${sale.profit?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}