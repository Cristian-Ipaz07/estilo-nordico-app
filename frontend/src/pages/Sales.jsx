import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Search, CheckCircle2, Clock, ShoppingCart,
  Edit2, Eye, Trash2, X, ChevronDown, ChevronRight,
  AlertTriangle, DollarSign, TrendingUp, Package, User, RefreshCw
} from 'lucide-react';


// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const StatusBadge = ({ status, balance }) => {
  const paid = status === 'pagado' || balance <= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      paid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
    }`}>
      {paid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {paid ? 'Pagado' : 'Separado'}
    </span>
  );
};

// ── Modal de Confirmación de Eliminación ─────────────────────────────────────
const DeleteConfirmModal = ({ sale, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
    <div className="bg-white rounded-3xl shadow-2xl p-8 w-[400px] text-center">
      <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="text-rose-500" size={32} />
      </div>
      <h3 className="text-lg font-black text-slate-900 mb-2">¿Eliminar venta #{sale.id}?</h3>
      <p className="text-slate-500 text-sm mb-1">El stock de los productos será restituido automáticamente.</p>
      <p className="text-xs text-slate-400 italic mb-6">Esta acción no se puede deshacer.</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-2xl py-3 font-bold text-sm hover:bg-slate-50 transition-all">
          Cancelar
        </button>
        <button onClick={onConfirm} className="flex-1 bg-rose-500 text-white rounded-2xl py-3 font-bold text-sm hover:bg-rose-600 transition-all">
          Sí, eliminar
        </button>
      </div>
    </div>
  </div>
);

// ── Modal de Abono ────────────────────────────────────────────────────────────
const PaymentModal = ({ sale, onPay, onClose }) => {
  const [amount, setAmount] = useState('');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-[380px]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900">Registrar Abono</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-800" /></button>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-1">
          <div className="flex justify-between text-xs font-bold text-slate-500">
            <span>Total venta</span><span>${fmt(sale.total_sale)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-emerald-600">
            <span>Abonado</span><span>${fmt(sale.amount_paid)}</span>
          </div>
          <div className="flex justify-between text-sm font-black text-rose-600 pt-1 border-t border-slate-200">
            <span>Saldo pendiente</span><span>${fmt(sale.balance_due)}</span>
          </div>
        </div>
        <label className="text-[10px] font-black text-slate-400 uppercase">Valor del abono</label>
        <div className="flex items-center border-2 border-emerald-400 rounded-2xl px-4 py-3 mt-1 mb-6 bg-emerald-50">
          <span className="text-emerald-400 font-black mr-2">$</span>
          <input
            type="number" autoFocus
            className="bg-transparent outline-none w-full font-black text-xl text-emerald-700"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
        <button
          disabled={!amount || Number(amount) <= 0}
          onClick={() => onPay(Number(amount))}
          className="w-full bg-slate-900 text-white rounded-2xl py-3 font-black text-sm hover:bg-black transition-all disabled:opacity-20"
        >
          Registrar ${amount ? Number(amount).toLocaleString() : '0'}
        </button>
      </div>
    </div>
  );
};

// ── Modal de Edición de Venta (Administrador) ─────────────────────────────────
const EditSaleModal = ({ sale, onUpdate, onClose }) => {
  const [formData, setFormData] = useState({
    customer_name: sale.customer_name || '',
    seller: sale.seller || 'LOCAL',
    amount_paid: sale.amount_paid || 0,
    sale_date: sale.sale_date || (sale.created_at ? sale.created_at.split('T')[0] : '')
  });

  // Cargar usuarios activos para el selector de vendedor
  const [activeUsers, setActiveUsers] = useState([]);
  useEffect(() => {
    fetch('http://localhost:8000/users/', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setActiveUsers(data.filter(u => u.status === 'Activo'));
      })
      .catch(console.error);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-md">
      <div className="bg-white rounded-[35px] shadow-2xl p-8 w-[450px]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900">Corregir Venta #{sale.id}</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Modo Administrador</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Comprador</label>
            <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
              <User className="text-slate-400 mr-3" size={18} />
              <input 
                className="bg-transparent outline-none w-full font-bold text-sm text-slate-700 uppercase"
                value={formData.customer_name}
                onChange={e => setFormData({...formData, customer_name: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Vendedor / Canal</label>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <select 
                  className="bg-transparent outline-none w-full font-bold text-xs text-slate-700"
                  value={formData.seller}
                  onChange={e => setFormData({...formData, seller: e.target.value})}
                >
                  <option value="LOCAL">LOCAL</option>
                  {/* Usuarios activos del sistema */}
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.full_name}>{u.full_name}</option>
                  ))}
                  {/* Canales legacy — se conservan para compatibilidad */}
                  <option value="WHATSAPP">WHATSAPP</option>
                  <option value="SAMANIEGO">SAMANIEGO</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Fecha Venta</label>
              <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <input 
                  type="date"
                  className="bg-transparent outline-none w-full font-bold text-xs text-slate-700"
                  value={formData.sale_date}
                  onChange={e => setFormData({...formData, sale_date: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Abono Total recibido</label>
            <div className="flex items-center bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-4 py-4">
              <span className="text-emerald-500 font-black mr-3">$</span>
              <input 
                type="number"
                className="bg-transparent outline-none w-full font-black text-xl text-emerald-700"
                value={formData.amount_paid}
                onChange={e => setFormData({...formData, amount_paid: Number(e.target.value)})}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter text-center mt-2 italic px-4">
              Nota: El total de la venta (${fmt(sale.total_sale)}) no se puede editar aquí. Si necesitas cambiar productos, elimina la venta y créala de nuevo en el terminal.
            </p>
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 text-white rounded-[25px] py-4 font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200 mt-4 uppercase"
          >
            Guardar Cambios
          </button>
        </form>
      </div>
    </div>
  );
};


// ── Fila expandible con items ─────────────────────────────────────────────────
const SaleRow = ({ sale, onDelete, onPay, onEdit }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-300" />}
            <div>
              <p className="text-sm font-bold text-slate-900">#{sale.id}</p>
              <p className="text-[10px] text-slate-400">{new Date(sale.created_at).toLocaleString('es-CO')}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase italic">
          {sale.user ? sale.user.full_name : (sale.sale_channel || 'LOCAL')}
          {sale.sale_channel !== 'LOCAL' && sale.user && <span className="block text-[9px] text-slate-400 mt-0.5">{sale.sale_channel}</span>}
        </td>
        <td className="px-6 py-4 text-sm text-slate-700 font-medium">
          {sale.customer_name || 'Cliente Final'}
        </td>
        <td className="px-6 py-4 text-sm font-black text-slate-900">
          ${fmt(sale.total_sale)}
        </td>
        <td className="px-6 py-4 text-sm font-bold text-emerald-600">
          ${fmt(sale.amount_paid)}
        </td>
        <td className="px-6 py-4 text-sm font-bold text-rose-500">
          {sale.balance_due > 0 ? `$${fmt(sale.balance_due)}` : '—'}
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={sale.status} balance={sale.balance_due} />
        </td>
        <td className="px-6 py-4 text-right space-x-1" onClick={e => e.stopPropagation()}>
          <button
              title="Corregir venta"
              onClick={() => onEdit(sale)}
              className="p-2 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
            >
              <Edit2 size={15} />
            </button>
          {sale.balance_due > 0 && (
            <button
              title="Registrar abono"
              onClick={() => onPay(sale)}
              className="p-2 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-lg text-slate-400 hover:text-emerald-600 transition-all"
            >
              <DollarSign size={15} />
            </button>
          )}
          <button
            title="Eliminar venta"
            onClick={() => onDelete(sale)}
            className="p-2 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
          >
            <Trash2 size={15} />
          </button>
        </td>
      </tr>


      {/* Fila expandida con detalle de items */}
      {expanded && (
        <tr className="bg-slate-50/60">
          <td colSpan={8} className="px-10 py-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Detalle de productos
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-slate-400 font-bold uppercase">
                  <th className="text-left pb-1">Producto</th>
                  <th className="text-center pb-1">Cant.</th>
                  <th className="text-right pb-1">P. Lista</th>
                  <th className="text-right pb-1">P. Venta</th>
                  <th className="text-right pb-1">Total Fila</th>
                  <th className="text-right pb-1">Dcto.</th>
                </tr>
              </thead>
              <tbody>
                {(sale.items || []).map(item => {
                  const originalTotal = item.original_price * item.quantity;
                  const disc = originalTotal - item.total_item;
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 text-xs font-bold text-slate-700">
                        {item.product?.name || `ID ${item.product_id}`}
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic">
                          {item.product?.category} • {item.product?.subcategory} ({item.product?.ref || 'Sin Ref'})
                        </p>
                      </td>

                      <td className="py-2 text-center text-xs font-bold text-slate-600">{item.quantity}</td>
                      <td className="py-2 text-right text-xs text-slate-400">${fmt(item.original_price)}</td>
                      <td className="py-2 text-right text-xs font-bold text-slate-700">${fmt(item.price_at_sale)}</td>
                      <td className="py-2 text-right text-sm font-black text-slate-900">${fmt(item.total_item)}</td>
                      <td className={`py-2 text-right text-xs font-bold ${disc > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                        {disc > 0 ? `-$${fmt(disc)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Historial de Abonos — visible solo si hay registro y el saldo es relevante */}
            {sale.payment_history && sale.payment_history.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <DollarSign size={11} /> Flujo de Caja — Abonos Recibidos
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-slate-400 font-bold uppercase">
                      <th className="text-left pb-1">Fecha</th>
                      <th className="text-left pb-1">Nota</th>
                      <th className="text-right pb-1">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.payment_history.map(p => (
                      <tr key={p.id} className="border-t border-slate-50">
                        <td className="py-1.5 text-xs text-slate-500">
                          {new Date(p.payment_date).toLocaleString('es-CO', { 
                            day:'2-digit', month:'2-digit', 
                            hour:'numeric', minute:'2-digit', hour12: true 
                          })}
                        </td>
                        <td className="py-1.5 text-xs text-slate-400 italic">{p.notes || '—'}</td>
                        <td className="py-1.5 text-right text-sm font-black text-emerald-600">${fmt(p.amount)}</td>
                      </tr>

                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}

    </>
  );
};


// ── Componente principal ──────────────────────────────────────────────────────
const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchSales = useCallback(() => {
    setLoading(true);
    fetch('http://localhost:8000/sales/')
      .then(res => res.json())
      .then(data => { setSales(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { 
    fetchSales(); 

    // Escuchar evento global de venta completada para recargar la lista sin F5
    const handleRefresh = () => fetchSales();
    window.addEventListener('refresh-sales', handleRefresh);
    return () => window.removeEventListener('refresh-sales', handleRefresh);
  }, [fetchSales]);


  // ── Eliminar ──────────────────────────────────────────────────────────────
  const handleDelete = async (sale) => {
    await fetch(`http://localhost:8000/sales/${sale.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    fetchSales();
    showToast(`Venta #${sale.id} eliminada y stock restituido`);
  };

  // ── Abonar ────────────────────────────────────────────────────────────────
  const handlePayment = async (sale, amount) => {
    const res = await fetch(
      `http://localhost:8000/sales/${sale.id}/payment?amount=${amount}`,
      { method: 'PATCH' }
    );
    if (res.ok) {
      setPayTarget(null);
      fetchSales();
      showToast(`Abono de $${amount.toLocaleString()} registrado en venta #${sale.id}`);
    }
  };

  // ── Editar (Actualización parcial) ─────────────────────────────────────────
  const handleUpdate = async (sale, updatedData) => {
    const res = await fetch(`http://localhost:8000/sales/${sale.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (res.ok) {
      setEditTarget(null);
      fetchSales();
      showToast(`Venta #${sale.id} actualizada correctamente`);
    } else {
      alert("Error al actualizar la venta");
    }
  };


  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = sales.filter(s => {
    const matchStatus =
      filterStatus === 'todos' ? true :
      filterStatus === 'pagado' ? s.balance_due <= 0 :
      s.balance_due > 0;

    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.customer_name?.toLowerCase().includes(q) ||
      String(s.id).includes(q) ||
      s.user?.full_name?.toLowerCase().includes(q) ||
      s.sale_channel?.toLowerCase().includes(q);

    return matchStatus && matchSearch;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalRecaudado = sales.reduce((a, s) => a + (s.amount_paid || 0), 0);
  const totalPendiente = sales.reduce((a, s) => a + (s.balance_due || 0), 0);
  const totalVentas = sales.reduce((a, s) => a + (s.total_sale || 0), 0);

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const headers = [
      "FECHA", "COMPRADOR", "REF", "CATEGORIA", "SUBCATEGORIA", "PRODUCTO", 
      "PRECIO VEN", "MI COSTO", "CANTIDAD", "SE VENDE", "VALOR MERCA", 
      "VENTA", "SALDO", "OBSERVACION", "GANANCIA", "COSTO DE VENT", "VENDEDOR"
    ];

    let rows = [];

    // Exportar las ventas que actualmente estén filtradas en la tabla
    filtered.forEach(sale => {
      const d = new Date(sale.created_at);
      const fecha = isNaN(d) ? '' : d.toLocaleDateString('es-CO'); // e.g., 28-feb
      const comprador = sale.customer_name || 'CLIENTE FINAL';
      const vendedor = sale.user ? sale.user.full_name : (sale.sale_channel || 'LOCAL');
      const saldo = sale.balance_due > 0 ? sale.balance_due : 0;
      const obs = sale.status === 'separado' ? 'SEPARADO' : 'PAGADO';

      if (!sale.items || sale.items.length === 0) {
        rows.push([
          fecha, comprador, "", "", "", "SIN PRODUCTOS",
          0, 0, 0, 0, 0, sale.amount_paid, saldo, obs, 0, 0, vendedor
        ]);
        return;
      }

      sale.items.forEach((item, idx) => {
        const ref = item.product?.ref || '';
        const cat = item.product?.category || '';
        const subcat = item.product?.subcategory || '';
        const prod = item.product?.name || '';
        
        const precioVen = item.original_price || 0;
        const miCosto = item.product?.my_cost || 0;
        const cantidad = item.quantity || 0;
        const seVende = item.price_at_sale || 0;
        
        const valorMerca = seVende * cantidad; // El total que vale la mercancia
        const costoVent = miCosto * cantidad;
        const ganancia = valorMerca - costoVent;

        // Para evitar duplicar sumas de 'Venta Total' o 'Saldo' en Excel, 
        // lo colocamos en la primera fila de la venta
        const ventaVal = idx === 0 ? sale.amount_paid : '';
        const saldoVal = idx === 0 && saldo > 0 ? saldo : '';

        rows.push([
          fecha, comprador, ref, cat, subcat, prod,
          precioVen, miCosto, cantidad, seVende, valorMerca,
          ventaVal, saldoVal, obs, ganancia, costoVent, vendedor
        ]);
      });
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => {
        if (typeof cell === 'string') return `"${cell.replace(/"/g, '""')}"`;
        return cell;
      }).join(';')) // Separador punto y coma para Excel en español
    ].join('\n');

    // Añadir BOM (\uFEFF) para que Excel detecte UTF-8 correctamente (tildes, etc)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Ventas_EstiloNordico_${new Date().toLocaleDateString('es-CO').replace(/\//g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-4 min-h-full">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[300] bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-pulse">
          <CheckCircle2 size={16} className="text-emerald-400" /> {toast}
        </div>
      )}

      {/* Modales */}
      {deleteTarget && (
        <DeleteConfirmModal
          sale={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {payTarget && (
        <PaymentModal
          sale={payTarget}
          onPay={(amount) => handlePayment(payTarget, amount)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {editTarget && (
        <EditSaleModal
          sale={editTarget}
          onUpdate={(data) => handleUpdate(editTarget, data)}
          onClose={() => setEditTarget(null)}
        />
      )}


      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Historial de Ventas</h2>
          <p className="text-slate-400 text-sm mt-0.5">Estilo Nórdico · Pasto / Samaniego</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <Download size={16} /> Exportar a Excel
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl col-span-1">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Recaudado</p>
          <h3 className="text-3xl font-black mt-1">${fmt(totalRecaudado)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ventas Totales</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">${fmt(totalVentas)}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl"><TrendingUp size={22} /></div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">N.° Transacciones</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{sales.length}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><ShoppingCart size={22} /></div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-rose-400 text-xs font-bold uppercase tracking-wider">Saldos Pendientes</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">${fmt(totalPendiente)}</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-500 rounded-xl"><Clock size={22} /></div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra de filtros */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
          <div className="flex gap-2">
            {['todos','pagado','separado'].map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  filterStatus === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente, ID..."
              className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 w-60"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabla de ventas */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                {['ID / Fecha','Vendedor','Cliente','Total Venta','Abono','Saldo','Estado',''].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr><td colSpan={8} className="py-20 text-center text-slate-300 text-sm italic">Cargando ventas...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="py-20 text-center text-slate-300 italic text-sm">No hay ventas en este filtro.</td></tr>
              )}
              {filtered.map(sale => (
                <SaleRow
                  key={sale.id}
                  sale={sale}
                  onDelete={setDeleteTarget}
                  onPay={setPayTarget}
                  onEdit={setEditTarget}
                />
              ))}

            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 font-bold flex justify-between items-center bg-slate-50/30">
          <span>{filtered.length} de {sales.length} ventas</span>
          <span>Haz clic en una fila para ver el detalle de productos</span>
        </div>
      </div>
    </div>
  );
};

export default Sales;