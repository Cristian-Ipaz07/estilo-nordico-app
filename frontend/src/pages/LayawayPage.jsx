import { API_URL } from '../config/api';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Wallet, Calendar, Plus, ArrowRight, UserPlus, AlertCircle,
  Search, Truck, Printer, Clock, Edit3, Trash2, X, Check, DollarSign,
  ArrowRightLeft, Save, AlertTriangle, History, ArrowUpRight, RotateCcw,
  CheckCircle2, RefreshCw
} from 'lucide-react';
import { getSales } from '../services/api';
import { FINANCIAL_ACCOUNTS, getAccountInfo } from '../utils/accounts';

const getColDate = (d = new Date()) => new Date(new Date(d).toLocaleString("en-US", { timeZone: "America/Bogota" }));

const getTodayCO = () => {
  const d = getColDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


const isOverdue = (dateString) => {
  if (!dateString) return false;
  const d = getColDate(dateString);
  const now = getColDate();
  const difTime = now - d;
  const difDays = Math.ceil(difTime / (1000 * 60 * 60 * 24));
  return difDays > 30;
};

const fmt = (n) => (Number(n) || 0).toLocaleString('es-CO');

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return iso.split('T')[0] || iso;
  }
};

export function EditLayawayModal({ item, isOpen, onClose, onSaved }) {
  if (!isOpen || !item) return null;

  const [customerName, setCustomerName] = useState(item.customer_name || '');
  const [deliveryAddress, setDeliveryAddress] = useState(item.delivery_address || '');
  const [deliveryNotes, setDeliveryNotes] = useState(item.delivery_notes || '');
  const [status, setStatus] = useState(item.status || 'separado');
  const [seller, setSeller] = useState(item.sale_channel || 'LOCAL');
  const [amountPaid, setAmountPaid] = useState(item.amount_paid || 0);
  const [saleDate, setSaleDate] = useState(() => {
    if (!item.created_at) return '';
    try {
      return item.created_at.split('T')[0];
    } catch {
      return '';
    }
  });

  const [activeUsers, setActiveUsers] = useState([]);
  const [payments, setPayments] = useState(item.payment_history || []);
  const [saving, setSaving] = useState(false);

  // Estados para edición inline de un abono individual
  const [editingPayId, setEditingPayId] = useState(null);
  const [payEditAmount, setPayEditAmount] = useState('');
  const [payEditDate, setPayEditDate] = useState('');
  const [payEditAccount, setPayEditAccount] = useState('EFECTIVO_TIENDA');

  // Cargar usuarios activos del sistema para el selector de vendedor
  useEffect(() => {
    fetch(`${API_URL}/users/`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setActiveUsers(data.filter(u => u.status === 'Activo'));
      })
      .catch(console.error);
  }, []);

  // Actualizar lista si cambia item
  useEffect(() => {
    setCustomerName(item.customer_name || '');
    setDeliveryAddress(item.delivery_address || '');
    setDeliveryNotes(item.delivery_notes || '');
    setStatus(item.status || 'separado');
    setSeller(item.sale_channel || 'LOCAL');
    setAmountPaid(item.amount_paid || 0);
    setPayments(item.payment_history || []);
    if (item.created_at) {
      setSaleDate(item.created_at.split('T')[0]);
    }
    setEditingPayId(null);
  }, [item]);

  const notifyAll = () => {
    window.dispatchEvent(new CustomEvent('refresh-sales'));
    window.dispatchEvent(new CustomEvent('refresh-cash'));
    window.dispatchEvent(new CustomEvent('refresh-inventory'));
    if (onSaved) onSaved();
  };

  const handleSaveMain = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      // Si el usuario tenía un abono en edición, guardarlo primero
      if (editingPayId) {
        await fetch(`${API_URL}/sales/${item.id}/payments/${editingPayId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            amount: Number(payEditAmount),
            payment_date: payEditDate,
            account: payEditAccount,
            notes: `Abono registrado (${payEditAccount})`
          })
        });
      }

      const res = await fetch(`${API_URL}/sales/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customer_name: customerName,
          seller: seller,
          amount_paid: Number(amountPaid),
          sale_date: saleDate,
          status: status,
          delivery_address: deliveryAddress,
          delivery_notes: deliveryNotes
        })
      });

      if (res.ok) {
        notifyAll();
        onClose();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al actualizar el separado');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (payId, payAmount) => {
    if (!window.confirm(`¿Eliminar este abono de $${fmt(payAmount)}? Se descontará del abono acumulado y se recalculará el saldo de este separado.`)) return;
    try {
      const res = await fetch(`${API_URL}/sales/${item.id}/payments/${payId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(prev => prev.filter(p => p.id !== payId));
        setAmountPaid(data.amount_paid);
        notifyAll();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al eliminar el abono');
      }
    } catch (e) { console.error(e); }
  };

  const handleStartEditPay = (pay) => {
    setEditingPayId(pay.id);
    setPayEditAmount(pay.amount);
    setPayEditDate((pay.payment_date || '').split('T')[0] || '');
    setPayEditAccount(pay.account || 'EFECTIVO_TIENDA');
  };

  const handleSaveEditPay = async (payId) => {
    try {
      const res = await fetch(`${API_URL}/sales/${item.id}/payments/${payId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: Number(payEditAmount),
          payment_date: payEditDate
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(prev => prev.map(p => p.id === payId ? { ...p, amount: Number(payEditAmount), payment_date: payEditDate } : p));
        setAmountPaid(data.amount_paid);
        setEditingPayId(null);
        notifyAll();
        alert('¡Fecha y monto del abono actualizados correctamente!');
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al editar abono');
      }
    } catch (e) { console.error(e); }
  };

  const handleTransferPayment = async (payId, payAmount) => {
    const targetIdStr = window.prompt(`¿A qué ID de venta o separado deseas transferir este abono de $${fmt(payAmount)}? (Ej: 235)`);
    if (!targetIdStr) return;
    const targetId = parseInt(targetIdStr.trim().replace('#', ''));
    if (!targetId || targetId === item.id) {
      alert('Ingresa un número de venta válido y diferente a la actual.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/sales/${item.id}/payments/${payId}/transfer?target_sale_id=${targetId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setPayments(prev => prev.filter(p => p.id !== payId));
        setAmountPaid(prev => Math.max(0, prev - payAmount));
        notifyAll();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al transferir abono');
      }
    } catch (e) { console.error(e); }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm(`¿Seguro que deseas cancelar el separado #${item.id}? Las prendas se devolverán automáticamente al inventario.`)) return;
    try {
      const endpoint = item.status === 'en_domicilio' 
        ? `${API_URL}/sales/${item.id}/cancel-delivery`
        : `${API_URL}/sales/${item.id}`;
      const method = item.status === 'en_domicilio' ? 'POST' : 'DELETE';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        notifyAll();
        onClose();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70 rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                Separado #{item.id}
              </span>
              <span className="text-[10px] font-black uppercase text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                Total: ${fmt(item.total_sale)}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-1">Edición Total del Separado</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveMain} className="p-6 space-y-5">
          {/* Nombre Cliente */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Nombre del Cliente
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800 focus:bg-white uppercase"
              required
            />
          </div>

          {/* Fecha del separado y Vendedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Calendar size={12} /> Fecha Creación Separado
              </label>
              <input
                type="date"
                value={saleDate}
                onChange={e => setSaleDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Vendedor / Canal
              </label>
              <select
                value={seller}
                onChange={e => setSeller(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800 focus:bg-white"
              >
                <option value="LOCAL">LOCAL</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.full_name}>{u.full_name}</option>
                ))}
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="SAMANIEGO">SAMANIEGO</option>
              </select>
            </div>
          </div>

          {/* Monto Total Abonado y Tipo / Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1">
                <DollarSign size={12} /> Abono Acumulado Recibido
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-sm font-black text-emerald-800 outline-none focus:border-emerald-600 focus:bg-white"
                required
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Saldo resultante: ${fmt(Math.max(0, (item.total_sale || 0) - Number(amountPaid)))}</p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Estado / Tipo
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800 focus:bg-white"
              >
                <option value="separado">Separado en Tienda</option>
                <option value="en_domicilio">🛵 En Domicilio (Contraentrega)</option>
                <option value="pagado">Pagado Total</option>
              </select>
            </div>
          </div>

          {/* Dirección y notas */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Dirección y Teléfono de Entrega
              </label>
              <input
                type="text"
                placeholder="Ej: Cra 24 # 15-30, Tel: 312..."
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Notas / Instrucciones
              </label>
              <textarea
                rows={2}
                placeholder="Detalles del cliente, prendas especiales..."
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Historial de Abonos Individuales */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-600" /> Historial de Abonos de este Cliente ({payments.length})
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                Edita fecha, elimina errores o transfiere
              </span>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No hay abonos adicionales registrados en el historial de esta venta.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {payments.map(p => {
                  const isEditingThis = editingPayId === p.id;
                  const formattedDate = (p.payment_date || '').split('T')[0];

                  return (
                    <div key={p.id} className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col gap-2 shadow-2xs">
                      {isEditingThis ? (
                        <div className="flex flex-col gap-2 p-1 bg-amber-50/60 rounded-lg border border-amber-200">
                          <p className="text-[10px] font-black text-amber-700 uppercase">Modificando Abono #{p.id}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500">Fecha del Abono</label>
                              <input
                                type="date"
                                value={payEditDate}
                                onChange={e => setPayEditDate(e.target.value)}
                                className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-bold text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500">Monto</label>
                              <input
                                type="number"
                                value={payEditAmount}
                                onChange={e => setPayEditAmount(e.target.value)}
                                className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-black text-emerald-700"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500">Cuenta de Cobro</label>
                              <select
                                value={payEditAccount}
                                onChange={e => setPayEditAccount(e.target.value)}
                                className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-black text-slate-800 outline-none focus:border-amber-400 cursor-pointer"
                              >
                                {FINANCIAL_ACCOUNTS.map(a => (
                                  <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingPayId(null)}
                              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditPay(p.id)}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <Check size={12} /> Guardar Fecha/Monto
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-emerald-700 mr-2">
                              ${fmt(p.amount)}
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              📅 {formattedDate}
                            </span>
                            {p.notes && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5">{p.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditPay(p)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar fecha o monto de este abono"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTransferPayment(p.id, p.amount)}
                              className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Transferir este abono a otra venta"
                            >
                              <ArrowRightLeft size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id, p.amount)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Eliminar este abono si fue un error"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botones de acción inferior */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancelOrder}
              className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Cancelar y Restituir Stock
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── MODAL RÁPIDO PARA ABONAR Y GESTIONAR PAGOS/CUENTAS ────────────────────────
export function QuickAbonoModal({ item, isOpen, onClose, onAbonoSuccess }) {
  if (!isOpen || !item) return null;

  const [sale, setSale] = useState(item);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('EFECTIVO_TIENDA');
  const [paymentDate, setPaymentDate] = useState(getTodayCO());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Edición inline de cuenta para un abono previo
  const [editingPayId, setEditingPayId] = useState(null);
  const [editingPayAccount, setEditingPayAccount] = useState('EFECTIVO_TIENDA');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Cargar datos frescos de la venta
  const reloadSale = () => {
    fetch(`${API_URL}/sales/${item.id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.id) setSale(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    setSale(item);
    setAmount('');
    setNotes('');
    setPaymentDate(getTodayCO());
    setMsg('');
    setError('');
    setEditingPayId(null);
    reloadSale();
  }, [item]);

  const currentBalance = Math.max(0, (sale.balance_due !== undefined ? sale.balance_due : (sale.total_sale - sale.amount_paid)) || 0);
  const parsedAmount = Number(amount) || 0;
  const isFullyPaid = parsedAmount >= currentBalance && parsedAmount > 0;
  const isDelivery = sale.status === 'en_domicilio';
  const overdue = isOverdue(sale.created_at);

  const handleRegisterAbono = async (e) => {
    if (e) e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) return;
    setIsSubmitting(true);
    setError('');
    try {
      const isToday = paymentDate === getTodayCO();
      const dateParam = isToday ? '' : `&payment_date=${paymentDate}`;
      const noteParam = notes.trim() ? `&notes=${encodeURIComponent(notes.trim())}` : '';
      
      const res = await fetch(`${API_URL}/sales/${sale.id}/payment?amount=${parsedAmount}&account=${account}${dateParam}${noteParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al registrar abono');
      }

      setMsg('¡Abono registrado con éxito!');
      setAmount('');
      setNotes('');
      reloadSale();
      if (onAbonoSuccess) onAbonoSuccess();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      setTimeout(() => setMsg(''), 3500);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePaymentAccount = async (paymentId, newAccount) => {
    setIsSavingAccount(true);
    try {
      const res = await fetch(`${API_URL}/sales/${sale.id}/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          account: newAccount
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al actualizar cuenta');
      }

      setEditingPayId(null);
      reloadSale();
      if (onAbonoSuccess) onAbonoSuccess();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeletePayment = async (payId, payAmount) => {
    if (!window.confirm(`¿Eliminar este abono de $${fmt(payAmount)}? Se recalculará el saldo de este separado.`)) return;
    try {
      const res = await fetch(`${API_URL}/sales/${sale.id}/payments/${payId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al eliminar');
      }
      reloadSale();
      if (onAbonoSuccess) onAbonoSuccess();
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 flex flex-col my-auto max-h-[94vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                REF-#{sale.id}
              </span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                isDelivery ? 'bg-purple-100 text-purple-700' :
                overdue ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
              }`}>
                {isDelivery ? '🛵 En Domicilio' : overdue ? 'Vencido (+30d)' : 'Separado Activo'}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-0.5 truncate">{sale.customer_name || 'Sin nombre'}</h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-terminal', { detail: { tab: 'separados', layawayId: sale.id } }));
                onClose();
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-xl border border-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="Abrir en Terminal POS completo"
            >
              <span>Terminal POS</span>
              <ArrowUpRight size={13} className="text-indigo-600" />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal con Scroll Interno */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          
          {/* Métricas Financieras */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Total Venta</p>
              <p className="text-sm font-black text-slate-800 font-mono">${fmt(sale.total_sale)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Abonado</p>
              <p className="text-sm font-black text-emerald-600 font-mono">${fmt(sale.amount_paid)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-amber-600 uppercase">Saldo Pendiente</p>
              <p className="text-base font-black text-amber-600 font-mono">${fmt(currentBalance)}</p>
            </div>
          </div>

          {/* Prendas apartadas */}
          {sale.items && sale.items.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Prendas Apartadas ({sale.items.length})</p>
              <div className="divide-y divide-slate-100 max-h-28 overflow-y-auto pr-1">
                {sale.items.map(it => (
                  <div key={it.id} className="py-1 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 truncate pr-2">
                      {it.product?.name || `ID ${it.product_id}`} <span className="text-[10px] text-slate-400 font-normal">x{it.quantity}</span>
                    </span>
                    <span className="font-mono font-black text-slate-900 shrink-0">${fmt(it.total_item || it.price_at_sale)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensajes de Éxito / Error */}
          {msg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{msg}</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* FORMULARIO DE NUEVO ABONO */}
          {currentBalance > 0 ? (
            <form onSubmit={handleRegisterAbono} className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/90">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Registrar Nuevo Abono
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(String(currentBalance))}
                  className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                >
                  Saldar Todo (${fmt(currentBalance)})
                </button>
              </div>

              {/* Botones de montos sugeridos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[20000, 50000, 100000].filter(m => m <= currentBalance && m !== currentBalance).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAmount(String(m))}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-700 transition-colors cursor-pointer shadow-2xs font-mono"
                  >
                    +${fmt(m)}
                  </button>
                ))}
              </div>

              {/* Input grande del valor */}
              <div className="flex items-center bg-white border-2 border-emerald-400 rounded-2xl px-4 py-2.5 shadow-2xs">
                <span className="text-emerald-600 font-black text-xl mr-2">$</span>
                <input
                  type="number"
                  min="1"
                  max={currentBalance * 2}
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="bg-transparent outline-none w-full font-black text-2xl text-emerald-700 font-mono"
                  autoFocus
                />
              </div>

              {/* Selector de Cuenta / Método de Pago */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Método de Pago / Destino del Dinero:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'EFECTIVO_TIENDA', label: 'Efectivo', icon: '💵' },
                    { id: 'NEQUI_CRISTIAN', label: 'Nequi Cristian', icon: '📱' },
                    { id: 'NEQUI_DAVID', label: 'Nequi David', icon: '📱' },
                    { id: 'BANCOLOMBIA', label: 'Bancolombia', icon: '🏦' },
                    { id: 'EFECTIVO_CASA', label: 'Efectivo Casa', icon: '🏠' }
                  ].map(acc => {
                    const isSelected = account === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAccount(acc.id)}
                        className={`p-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span>{acc.icon}</span>
                        <span className="truncate">{acc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fecha y notas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Fecha del Abono</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Notas (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: abono presencial..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Botón de Confirmación de Abono */}
              <button
                type="submit"
                disabled={!parsedAmount || parsedAmount <= 0 || isSubmitting}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 disabled:opacity-30 ${
                  isFullyPaid
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    : 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={15} className="animate-spin" /> Registrando Abono...
                  </span>
                ) : isFullyPaid ? (
                  `🎉 Liquidar y Entregar Separado ($${fmt(parsedAmount)})`
                ) : (
                  `💵 Registrar Abono de $${fmt(parsedAmount)}`
                )}
              </button>
            </form>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-center font-bold text-xs">
              ✅ Este separado ya está 100% pagado y liquidado.
            </div>
          )}

          {/* HISTORIAL DE ABONOS PREVIOS Y CAMBIO DE CUENTAS */}
          {sale.payment_history && sale.payment_history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                Historial de Abonos Recibidos ({sale.payment_history.length})
              </p>
              <div className="space-y-2">
                {sale.payment_history.map(p => {
                  const accInfo = getAccountInfo(p.account);
                  const isEditingThis = editingPayId === p.id;

                  return (
                    <div key={p.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                            ${fmt(p.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {fmtDateTime(p.payment_date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingThis) setEditingPayId(null);
                              else {
                                setEditingPayId(p.id);
                                setEditingPayAccount(p.account || 'EFECTIVO_TIENDA');
                              }
                            }}
                            className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="Cambiar cuenta de este abono"
                          >
                            {isEditingThis ? 'Cancelar' : 'Cambiar Cuenta'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id, p.amount)}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Eliminar este abono"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Insignia de cuenta actual */}
                      {!isEditingThis ? (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-medium truncate">{p.notes || 'Abono registrado'}</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold shrink-0 ${accInfo.badgeClass}`}>
                            {accInfo.icon} {accInfo.label}
                          </span>
                        </div>
                      ) : (
                        /* Selector inline para cambiar cuenta */
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <select
                            value={editingPayAccount}
                            onChange={e => setEditingPayAccount(e.target.value)}
                            className="flex-1 bg-slate-50 border border-indigo-300 rounded-xl px-2.5 py-1 text-xs font-black text-slate-800 outline-none"
                          >
                            {FINANCIAL_ACCOUNTS.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.icon} {a.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isSavingAccount}
                            onClick={() => handleUpdatePaymentAccount(p.id, editingPayAccount)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase cursor-pointer disabled:opacity-50"
                          >
                            {isSavingAccount ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}

const LayawayCard = ({ item, onEdit, onAbonar }) => {
  const isDelivery = item.status === 'en_domicilio';
  const percentage = item.total_sale > 0 ? (item.amount_paid / item.total_sale) * 100 : 0;
  const overdue = isOverdue(item.created_at);
  const formattedDate = getColDate(item.created_at).toLocaleDateString('es-CO');

  const openTerminal = () => {
    window.dispatchEvent(new CustomEvent('open-terminal'));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">REF-#{item.id}</p>
          <h4 className="text-lg font-bold text-slate-800 line-clamp-1">{item.customer_name}</h4>
          {item.delivery_address && (
            <p className="text-[10px] text-purple-700 font-medium line-clamp-1">🛵 {item.delivery_address}</p>
          )}
        </div>
        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
          isDelivery ? 'bg-purple-100 text-purple-700' :
          overdue ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
        }`}>
          {isDelivery ? '🛵 En Domicilio' : overdue ? 'Vencido (+30d)' : 'Pendiente'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total</p>
          <p className="text-lg font-bold text-slate-800">${fmt(item.total_sale)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Saldo Pendiente</p>
          <p className="text-lg font-bold text-amber-500">${fmt(item.balance_due)}</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-slate-500">Abonado: ${fmt(item.amount_paid)}</span>
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
        <div className="flex items-center gap-1 text-[11px]">
          <Calendar size={13} />
          {formattedDate}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Editar datos del separado"
          >
            <Edit3 size={15} />
          </button>
          <button
            onClick={() => onAbonar(item)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl font-black text-xs transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Registrar nuevo abono para este cliente"
          >
            <span>Abonar</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function LayawayPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('tarjetas'); // 'tarjetas' | 'historial_abonos'
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('todos'); // 'todos', 'separado', 'en_domicilio', 'vencido'
  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [abonoTargetItem, setAbonoTargetItem] = useState(null);
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);

  const fetchSales = () => {
    getSales().then(res => {
      setSales(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchSales();
    const handleRefresh = () => fetchSales();
    window.addEventListener('refresh-sales', handleRefresh);
    return () => window.removeEventListener('refresh-sales', handleRefresh);
  }, []);

  // Separados y domicilios pendientes
  const pendingOrders = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'cancelado') return false;
      const isPending = s.balance_due > 0 || s.status === 'en_domicilio' || s.status === 'separado';
      if (!isPending) return false;

      if (filterType === 'separado') return s.status === 'separado';
      if (filterType === 'en_domicilio') return s.status === 'en_domicilio';
      if (filterType === 'vencido') return isOverdue(s.created_at);
      return true;
    });
  }, [sales, filterType]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return pendingOrders;
    const q = search.toLowerCase();
    return pendingOrders.filter(s =>
      s.customer_name?.toLowerCase().includes(q) ||
      String(s.id).includes(q) ||
      s.delivery_address?.toLowerCase().includes(q) ||
      s.delivery_notes?.toLowerCase().includes(q)
    );
  }, [pendingOrders, search]);

  // Historial global de todos los abonos ordenados cronológicamente (más nuevo primero)
  const allAbonosList = useMemo(() => {
    const list = [];
    sales.forEach(s => {
      (s.payment_history || []).forEach(p => {
        list.push({
          payment_id: p.id,
          sale_id: s.id,
          customer_name: s.customer_name,
          amount: p.amount,
          payment_date: p.payment_date,
          notes: p.notes,
          total_sale: s.total_sale,
          balance_due: s.balance_due,
          sale_status: s.status,
          seller: s.sale_channel,
          rawSale: s
        });
      });
    });
    return list.sort((a, b) => new Date(b.payment_date || 0) - new Date(a.payment_date || 0));
  }, [sales]);

  const filteredAbonos = useMemo(() => {
    if (!search.trim()) return allAbonosList;
    const q = search.toLowerCase();
    return allAbonosList.filter(a =>
      a.customer_name?.toLowerCase().includes(q) ||
      String(a.sale_id).includes(q) ||
      String(a.payment_id).includes(q) ||
      a.notes?.toLowerCase().includes(q) ||
      a.seller?.toLowerCase().includes(q)
    );
  }, [allAbonosList, search]);

  const totalPorCobrar = pendingOrders.reduce((sum, s) => sum + (s.balance_due || 0), 0);
  const filteredPendingTotal = useMemo(() => {
    return filteredOrders.reduce((sum, s) => sum + (Number(s.balance_due) || 0), 0);
  }, [filteredOrders]);
  const isFiltered = Boolean(search.trim() || filterType !== 'todos');
  const clientesActivos = new Set(pendingOrders.map(s => s.customer_name)).size;
  const vencidosCount = sales.filter(s => (s.balance_due > 0 || s.status === 'separado') && s.status !== 'cancelado' && isOverdue(s.created_at)).length;
  const domiciliosCount = sales.filter(s => s.status === 'en_domicilio').length;
  const separadosCount = sales.filter(s => s.status === 'separado' && s.balance_due > 0).length;

  const handleOpenTerminal = () => {
    window.dispatchEvent(new CustomEvent('open-terminal'));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleOpenAbono = (item) => {
    setAbonoTargetItem(item);
    setIsAbonoModalOpen(true);
  };

  const handleQuickDeletePay = async (abono) => {
    if (!window.confirm(`¿Eliminar este abono de $${fmt(abono.amount)} de ${abono.customer_name} (Venta #${abono.sale_id})? Su saldo volverá a subir automáticamente.`)) return;
    try {
      const res = await fetch(`${API_URL}/sales/${abono.sale_id}/payments/${abono.payment_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchSales();
        window.dispatchEvent(new CustomEvent('refresh-sales'));
        window.dispatchEvent(new CustomEvent('refresh-cash'));
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al eliminar');
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-8 text-slate-500 font-bold">Cargando cuentas por cobrar...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cuentas por Cobrar & Domicilios</h2>
          <p className="text-slate-500 text-sm">Separados en tienda, historial de abonos y pedidos contraentrega en reparto.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Printer size={16} /> Imprimir Cartera
          </button>
          <button
            onClick={handleOpenTerminal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Nuevo Separado POS
          </button>
        </div>
      </div>

      {/* Selector Principal de Vista: Tarjetas vs Historial de Abonos */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveMainTab('tarjetas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
            activeMainTab === 'tarjetas'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Wallet size={15} />
          Separados Activos ({pendingOrders.length})
        </button>

        <button
          onClick={() => setActiveMainTab('historial_abonos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
            activeMainTab === 'historial_abonos'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History size={15} />
          Historial de Abonos Recientes ({allAbonosList.length})
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Users size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Clientes con Saldo</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{clientesActivos}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <div className="flex items-center gap-2">
              <Wallet size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isFiltered ? 'Saldo Filtrado' : 'Total por Cobrar'}
              </span>
            </div>
            {isFiltered && (
              <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </div>
          <p className="text-2xl font-black text-amber-500 font-mono">
            ${fmt(isFiltered ? filteredPendingTotal : totalPorCobrar)}
          </p>
          {isFiltered && (
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              Cartera global: ${fmt(totalPorCobrar)}
            </p>
          )}
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-purple-600 mb-2">
            <Truck size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">En Domicilio</span>
          </div>
          <p className="text-2xl font-black text-purple-700">{domiciliosCount}</p>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm">
          <div className="flex items-center gap-3 text-rose-500 mb-2">
            <AlertCircle size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Vencidos (+30d)</span>
          </div>
          <p className="text-2xl font-black text-rose-600">{vencidosCount}</p>
        </div>
      </div>

      {/* CONTENIDO SEGÚN PESTAÑA PRINCIPAL */}
      {activeMainTab === 'tarjetas' ? (
        <>
          {/* Filtros y Buscador de Tarjetas */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setFilterType('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${filterType === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos ({pendingOrders.length})
              </button>
              <button
                onClick={() => setFilterType('separado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${filterType === 'separado' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Separados ({separadosCount})
              </button>
              <button
                onClick={() => setFilterType('en_domicilio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${filterType === 'en_domicilio' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🛵 Domicilios ({domiciliosCount})
              </button>
              <button
                onClick={() => setFilterType('vencido')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${filterType === 'vencido' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                ⚠️ Vencidos ({vencidosCount})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar cliente, dirección o ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-800"
              />
            </div>
          </div>

          {/* Barra de Resumen Dinámico al filtrar por búsqueda */}
          {search.trim() && (
            <div className="bg-amber-50/90 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-base">🔍</span>
                <span>Búsqueda: "<strong>{search}</strong>"</span>
                <span className="bg-white px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-bold text-amber-800 font-mono">
                  {filteredOrders.length} {filteredOrders.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">Total Pendiente Filtrado:</span>
                <span className="text-base font-black text-amber-900 bg-white px-3 py-1 rounded-xl border border-amber-300 font-mono shadow-2xs">
                  ${fmt(filteredPendingTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Grid de Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                <Clock size={40} className="mx-auto mb-2 opacity-30" />
                <p className="font-bold text-sm">No hay registros pendientes que coincidan con la búsqueda.</p>
              </div>
            ) : (
              filteredOrders.map(item => (
                <LayawayCard key={item.id} item={item} onEdit={handleOpenEdit} onAbonar={handleOpenAbono} />
              ))
            )}
          </div>
        </>
      ) : (
        /* VISTA: HISTORIAL DE ABONOS RECIENTES */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <History className="text-emerald-600" size={16} />
                Historial Cronológico de Abonos
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Los abonos más recientes aparecen de primero. Puedes editar fechas, transferirlos o eliminarlos directamente.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar en abonos por cliente, ID o notas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-800 shadow-2xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Fecha Abono</th>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Separado #ID</th>
                  <th className="px-5 py-3.5">Monto Abonado</th>
                  <th className="px-5 py-3.5">Saldo Restante</th>
                  <th className="px-5 py-3.5">Vendedor</th>
                  <th className="px-5 py-3.5">Notas</th>
                  <th className="px-5 py-3.5 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAbonos.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 italic">
                      No se encontraron abonos registrados.
                    </td>
                  </tr>
                ) : (
                  filteredAbonos.map((abono) => (
                    <tr key={`${abono.sale_id}-${abono.payment_id}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-700 whitespace-nowrap">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[11px] font-mono">
                          📅 {fmtDateTime(abono.payment_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-black text-slate-900 uppercase">
                        {abono.customer_name}
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-indigo-600">
                        <button
                          onClick={() => handleOpenEdit(abono.rawSale)}
                          className="hover:underline flex items-center gap-1"
                          title="Abrir edición de este separado"
                        >
                          #{abono.sale_id} <ArrowUpRight size={12} />
                        </button>
                      </td>
                      <td className="px-5 py-3 font-black text-emerald-600 text-sm font-mono whitespace-nowrap">
                        ${fmt(abono.amount)}
                      </td>
                      <td className="px-5 py-3 font-bold text-amber-600 whitespace-nowrap">
                        ${fmt(abono.balance_due)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 font-semibold text-[11px]">
                        {abono.seller || 'LOCAL'}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-[11px] italic max-w-xs truncate">
                        {abono.notes || 'Abono en POS'}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(abono.rawSale)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar fecha, monto o cliente"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleQuickDeletePay(abono)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar este abono erróneo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Edición de Separado */}
      <EditLayawayModal
        item={editingItem}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={fetchSales}
      />

      {/* Modal Rápido de Abono con selección de Cuenta y Edición de Pagos */}
      <QuickAbonoModal
        item={abonoTargetItem}
        isOpen={isAbonoModalOpen}
        onClose={() => {
          setIsAbonoModalOpen(false);
          setAbonoTargetItem(null);
        }}
        onAbonoSuccess={() => {
          fetchSales();
        }}
      />
    </div>
  );
}
