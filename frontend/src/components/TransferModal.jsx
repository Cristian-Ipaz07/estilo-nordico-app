import React, { useState } from 'react';
import { ArrowRight, ArrowLeftRight, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { FINANCIAL_ACCOUNTS, getAccountInfo } from '../utils/accounts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function TransferModal({ isOpen, onClose, defaultSource = 'EFECTIVO_TIENDA', defaultDest = 'NEQUI_CRISTIAN', context = 'general', onTransferSuccess }) {
  const [sourceAccount, setSourceAccount] = useState(defaultSource);
  const [destAccount, setDestAccount] = useState(defaultDest);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSourceChange = (e) => {
    const src = e.target.value;
    setSourceAccount(src);
    if (src === destAccount) {
      const other = FINANCIAL_ACCOUNTS.find(a => a.id !== src);
      if (other) setDestAccount(other.id);
    }
  };

  const handleQuickAmount = (val) => {
    const current = Number(amount) || 0;
    setAmount(current + val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0');
      return;
    }
    if (sourceAccount === destAccount) {
      setErrorMsg('La cuenta de origen y destino deben ser diferentes');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/cash/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          source_account: sourceAccount,
          destination_account: destAccount,
          amount: amt,
          description: description.trim() || undefined,
          transfer_date: date ? `${date}T12:00:00` : undefined
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al procesar el traslado');
      }

      const data = await res.json().catch(() => ({}));
      window.dispatchEvent(new CustomEvent('refresh-cash'));
      if (onTransferSuccess) onTransferSuccess(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const srcInfo = getAccountInfo(sourceAccount);
  const dstInfo = getAccountInfo(destAccount);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header con Contexto de Caja Local */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              context === 'terminal' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
            }`}>
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                context === 'terminal' ? 'text-emerald-700' : 'text-indigo-600'
              }`}>
                {context === 'terminal' ? 'Caja del Local (Tienda Mostrador)' : 'Tesorería & Liquidez'}
              </span>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {context === 'terminal' ? 'Traslado / Retiro desde Tienda' : 'Traslado entre Cuentas'}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Badge Aclaratorio si estamos en el Terminal POS */}
        {context === 'terminal' && (
          <div className="px-3.5 py-2 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🏪</span>
              <span>Operando desde la Caja Física del Local (Mostrador)</span>
            </div>
            <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
              Tienda
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-bold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Cuentas Origen y Destino */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center relative">
              
              {/* Origen */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">
                  Sale de (Origen):
                </label>
                <select
                  value={sourceAccount}
                  onChange={handleSourceChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  {FINANCIAL_ACCOUNTS.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.icon} {acc.fullLabel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destino */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">
                  Entra a (Destino):
                </label>
                <select
                  value={destAccount}
                  onChange={e => setDestAccount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  {FINANCIAL_ACCOUNTS.filter(acc => acc.id !== sourceAccount).map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.icon} {acc.fullLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Badge visual de dirección */}
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] font-bold text-slate-600">
              <span className={`px-2 py-0.5 rounded-lg border font-mono ${srcInfo.badgeClass}`}>
                {srcInfo.icon} {srcInfo.label}
              </span>
              <ArrowRight size={14} className="text-slate-400" />
              <span className={`px-2 py-0.5 rounded-lg border font-mono ${dstInfo.badgeClass}`}>
                {dstInfo.icon} {dstInfo.label}
              </span>
            </div>
          </div>

          {/* Botones rápidos de preset para la caja del local */}
          {context === 'terminal' && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                Operaciones comunes desde Tienda:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSourceAccount('EFECTIVO_TIENDA');
                    setDestAccount('NEQUI_CRISTIAN');
                    setDescription('RETIRO CAJA TIENDA A NEQUI');
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                    sourceAccount === 'EFECTIVO_TIENDA' && destAccount === 'NEQUI_CRISTIAN'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🔒 Retirar a Nequi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceAccount('EFECTIVO_TIENDA');
                    setDestAccount('EFECTIVO_CASA');
                    setDescription('TRASLADO EFECTIVO TIENDA A CASA');
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                    sourceAccount === 'EFECTIVO_TIENDA' && destAccount === 'EFECTIVO_CASA'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🏠 Llevar a Casa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceAccount('NEQUI_CRISTIAN');
                    setDestAccount('EFECTIVO_TIENDA');
                    setDescription('BASE / CAMBIO TIENDA DESDE NEQUI');
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                    sourceAccount === 'NEQUI_CRISTIAN' && destAccount === 'EFECTIVO_TIENDA'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🪙 Inyectar Cambio a Tienda
                </button>
              </div>
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Monto a Trasladar ($)
            </label>
            <div className="flex items-center border-2 border-slate-200 rounded-2xl px-4 py-2.5 bg-slate-50 focus-within:border-indigo-500 focus-within:bg-white transition-colors">
              <span className="font-black text-slate-400 mr-2 text-lg">$</span>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-transparent outline-none font-black text-xl text-slate-900"
              />
            </div>
            {/* Botones rápidos */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[50000, 100000, 200000, 500000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                >
                  +${(val / 1000).toFixed(0)}k
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount('')}
                className="px-2 py-1 text-slate-400 hover:text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Motivo y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Motivo / Referencia
              </label>
              <input
                type="text"
                placeholder="Ej. Retiro cajero, Base tienda, etc."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Fecha del Traslado
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-slate-50"
              />
            </div>
          </div>

          {/* Nota informativa de balance */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-[10px] text-indigo-900 leading-relaxed">
            💡 <strong>Movimiento de liquidez interno:</strong> Se descontará de <em>{srcInfo.label}</em> y se sumará a <em>{dstInfo.label}</em>. No afecta las ganancias ni el balance total del negocio.
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || Number(amount) <= 0}
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase transition-all shadow-md disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Registrando...' : 'Confirmar Traslado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
