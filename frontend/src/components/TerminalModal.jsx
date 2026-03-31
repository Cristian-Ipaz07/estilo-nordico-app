import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Wallet, Plus, Trash2, X, User, Calendar, Tag, AlertCircle } from 'lucide-react';

export default function TerminalModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('ventas');
  const [search, setSearch] = useState('');
  const [inventory, setInventory] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [cart, setCart] = useState([]); // Este estado persiste mientras la app esté abierta
  const [customer, setCustomer] = useState('CLIENTE FINAL');
  const [vendedor, setVendedor] = useState('LOCAL');
  const [amountPaid, setAmountPaid] = useState(0);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  
  const searchRef = useRef(null);

  // --- 1. LÓGICA DE TECLA ESCAPE ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose(); // Se cierra pero NO limpia el estado (se guarda lo que ibas haciendo)
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // --- 2. CLIC FUERA DEL BUSCADOR ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setFilteredResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:8000/products/')
        .then(res => res.json())
        .then(data => setInventory(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (!term) { setFilteredResults([]); return; }
    const keywords = term.split(' ');
    const results = inventory.filter(item => {
      const content = `${item.ref} ${item.name} ${item.category} ${item.subcategory}`.toLowerCase();
      return keywords.every(key => content.includes(key));
    });
    setFilteredResults(results);
  }, [search, inventory]);

  const addToCart = (p) => {
    const existing = cart.find(item => item.id === p.id);
    if (existing) {
      updateCartItem(p.id, 'qty', existing.qty + 1);
    } else {
      setCart([...cart, { ...p, qty: 1, edit_price: p.price_sale }]);
    }
    setSearch('');
    setFilteredResults([]);
  };

  const updateCartItem = (id, field, value) => {
    setCart(cart.map(item => {
      if (item.id === id) return { ...item, [field]: Number(value) };
      return item;
    }));
  };

  const calculateRowTotal = (item) => item.edit_price * item.qty;
  const total = cart.reduce((acc, item) => acc + calculateRowTotal(item), 0);
  const hasStockError = cart.some(item => item.stock <= 0 || item.qty > item.stock);

  useEffect(() => { setAmountPaid(total); }, [total]);

  // --- 3. FINALIZAR Y LIMPIAR ---
  const handleFinalizar = async () => {
    if (cart.length === 0 || hasStockError) return;
    
    const saleData = {
      customer_name: customer,
      vendedor: vendedor,
      total_price: total,
      amount_paid: amountPaid,
      status: amountPaid >= total ? "pagado" : "separado",
      created_at: saleDate,
      items: cart.map(i => ({ product_id: i.id, quantity: i.qty, unit_price: i.edit_price }))
    };

    try {
      // await fetch... (lógica de guardado)
      alert("Venta registrada con éxito");
      
      // LIMPIEZA TOTAL PARA NUEVA VENTA
      setCart([]);
      setCustomer('CLIENTE FINAL');
      setAmountPaid(0);
      setSearch('');
      // onClose();
      
    } catch (e) {
      alert("Error al guardar venta");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-2">
      <div className="bg-white w-[98vw] max-w-7xl h-[95vh] rounded-[40px] shadow-2xl flex overflow-hidden">
        
        {/* PANEL IZQUIERDO */}
        <div className="flex-[4] flex flex-col bg-white">
          <div className="p-6 flex flex-col h-full">
            
            {/* BUSCADOR */}
            <div className="grid grid-cols-12 gap-3 mb-6">
              <div className="col-span-7 relative" ref={searchRef}>
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22}/>
                <input 
                  autoFocus
                  className="w-full pl-14 pr-6 py-4 bg-slate-100 rounded-[22px] outline-none font-bold text-slate-700 text-lg border-2 border-transparent focus:border-emerald-500 transition-all"
                  placeholder="Ej: 'Chaqueta hombre xl'..."
                  value={search} onChange={e => setSearch(e.target.value)}
                />
                {filteredResults.length > 0 && (
                  <div className="absolute z-[110] w-full bg-white shadow-2xl rounded-2xl mt-2 border border-slate-100 max-h-72 overflow-auto py-2">
                    {filteredResults.map(p => (
                      <div key={p.id} onClick={() => addToCart(p)} className="px-5 py-3 hover:bg-emerald-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0">
                        <div>
                          <p className="font-black text-xs uppercase text-slate-800">{p.name} <span className="text-emerald-500">[{p.ref}]</span></p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.category} • {p.subcategory} | Stock: {p.stock}</p>
                        </div>
                        <p className="font-black text-sm text-slate-900">$ {p.price_sale?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-5 flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-slate-50 border rounded-[20px] px-4">
                  <Calendar size={18} className="text-slate-400"/>
                  <input type="date" className="bg-transparent text-[11px] font-black outline-none w-full text-slate-600" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
                </div>
                <div className="flex-1 flex items-center gap-2 bg-slate-50 border rounded-[20px] px-4">
                  <Tag size={18} className="text-slate-400"/>
                  <select className="bg-transparent text-[10px] font-black outline-none w-full text-slate-600 uppercase" value={vendedor} onChange={e => setVendedor(e.target.value)}>
                    <option value="LOCAL">VENTA LOCAL</option>
                    <option value="WHATSAPP">WHATSAPP</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TABLA */}
            <div className="flex-1 overflow-y-auto custom-scroll">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                    <th className="pb-3 pl-6 text-left w-[40%]">Producto / Detalles</th>
                    <th className="pb-3 text-center">Stock</th>
                    <th className="pb-3 text-center">Cant.</th>
                    <th className="pb-3 text-right">Precio Unitario</th>
                    <th className="pb-3 text-right pr-6">Total Fila</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.id} className={`${item.stock <= 0 || item.qty > item.stock ? 'bg-rose-50 border-rose-200' : 'bg-white'} border rounded-2xl shadow-sm`}>
                      <td className="py-4 pl-6 rounded-l-2xl border-y border-l">
                        <div className="flex flex-col">
                          <span className="font-black text-[11px] uppercase text-slate-800">{item.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter italic">
                             {item.category} • {item.subcategory} <span className="text-slate-900 not-italic ml-1">({item.ref})</span>
                          </span>
                        </div>
                      </td>
                      <td className={`py-4 text-center border-y font-black text-xs ${item.stock <= 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {item.stock}
                      </td>
                      <td className="py-4 border-y text-center">
                        <input type="number" className="w-14 bg-slate-100 rounded-xl py-2 text-center font-black text-xs outline-none" 
                          value={item.qty} onChange={e => updateCartItem(item.id, 'qty', e.target.value)} />
                      </td>
                      <td className="py-4 border-y text-right">
                        <div className="inline-flex items-center bg-slate-50 border rounded-xl px-3 py-1">
                          <span className="text-[10px] font-black text-slate-400 mr-1">$</span>
                          <input type="number" className="w-24 bg-transparent text-right font-black text-xs outline-none text-emerald-600" 
                            value={item.edit_price} onChange={e => updateCartItem(item.id, 'edit_price', e.target.value)} />
                        </div>
                      </td>
                      <td className="py-4 pr-6 rounded-r-2xl border-y border-r text-right">
                        <div className="flex items-center justify-end gap-4">
                          <span className="font-black text-sm text-slate-900">${calculateRowTotal(item).toLocaleString()}</span>
                          <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RESUMEN FINAL AJUSTADO (ABONO CORREGIDO) */}
            <div className="pt-6 border-t mt-4">
              <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-3 bg-slate-900 p-6 rounded-[35px] text-white flex flex-col justify-center">
                  <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest mb-1 text-center">Total Venta</p>
                  <p className="text-3xl font-black italic text-center leading-none">${total.toLocaleString()}</p>
                </div>
                
                {/* Cuadro de Abono ensanchado (col-span-5) para evitar corte */}
                <div className="col-span-5 bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[35px] flex flex-col justify-center">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 text-center font-black">Abono Recibido</p>
                  <div className="flex items-center justify-center text-4xl font-black text-emerald-700">
                    <span className="mr-2 opacity-30 text-2xl">$</span>
                    <input 
                      type="number" 
                      className="bg-transparent outline-none w-full text-center" 
                      value={amountPaid} 
                      onChange={e => setAmountPaid(Number(e.target.value))} 
                    />
                  </div>
                </div>

                <div className="col-span-4 flex flex-col gap-2">
                   <div className="flex items-center gap-3 bg-slate-100 px-5 py-3 rounded-2xl border">
                      <User size={18} className="text-slate-400"/>
                      <input placeholder="Nombre Cliente" className="bg-transparent font-bold text-xs outline-none w-full uppercase" value={customer} onChange={e => setCustomer(e.target.value)} />
                   </div>
                   <button 
                    disabled={cart.length === 0 || hasStockError}
                    onClick={handleFinalizar}
                    className="flex-1 bg-slate-900 text-white rounded-[22px] font-black text-sm hover:bg-black transition-all disabled:opacity-20 flex items-center justify-center gap-3 uppercase tracking-tighter"
                  >
                    {amountPaid < total ? 'Registrar Separado' : 'Finalizar Venta'}
                  </button>
                </div>
              </div>
              {hasStockError && (
                <div className="flex items-center gap-2 text-rose-600 font-bold text-[10px] mb-2 bg-rose-50 p-2 rounded-xl justify-center uppercase italic">
                  <AlertCircle size={14}/> Error: Productos sin stock disponible
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="flex-1 bg-slate-50 border-l p-8 flex flex-col">
          <div className="flex justify-between items-center mb-16">
            <h1 className="font-black italic text-xl tracking-tighter text-slate-900">ESTILO NÓRDICO</h1>
            <button onClick={onClose} className="p-3 bg-white shadow-sm border rounded-2xl hover:text-rose-500 transition-all"><X size={20}/></button>
          </div>
          <nav className="space-y-4 flex-1">
             <button onClick={()=>setActiveTab('ventas')} className={`w-full flex items-center gap-4 p-6 rounded-[25px] font-black text-xs transition-all ${activeTab==='ventas'?'bg-white shadow-xl text-emerald-600 border border-emerald-50':'text-slate-400'}`}>
                <ShoppingCart size={22}/> VENTAS
             </button>
          </nav>
        </div>
      </div>
    </div>
  );
}