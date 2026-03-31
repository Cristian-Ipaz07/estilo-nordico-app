import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Wallet, Plus, Trash2, X, User } from 'lucide-react';

export default function TerminalModal({ isOpen, onClose }) {
  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState('ventas'); // Controla el menú lateral
  const [search, setSearch] = useState('');
  const [inventory, setInventory] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('CLIENTE FINAL');
  const [amountPaid, setAmountPaid] = useState(0);

  // --- 1. CONEXIÓN BACKEND (PRODUCTOS) ---
  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:8000/products/')
        .then(res => res.json())
        .then(data => setInventory(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error cargando inventario:", err));
    }
  }, [isOpen]);

  // --- 2. LÓGICA DE BÚSQUEDA (ESTILO NÓRDICO) ---
  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (!term) { setFilteredResults([]); return; }

    const results = inventory.filter(item => 
      item.ref?.toString().toLowerCase().includes(term) ||
      item.producto?.toLowerCase().includes(term) ||
      item.categoria?.toLowerCase().includes(term)
    );
    setFilteredResults(results);
  }, [search, inventory]);

  // --- 3. ACCIONES DEL CARRITO ---
  const addToCart = (prod) => {
    const newItem = {
      id: prod.id,
      ref: prod.ref,
      producto: prod.producto,
      categoria: prod.categoria,
      subcategoria: prod.subcategoria,
      precio_venta: prod.p_venta || 0,
      precio_final: prod.p_venta || 0,
      stock: prod.stock
    };
    setCart([...cart, newItem]);
    setSearch('');
    setFilteredResults([]);
  };

  const total = cart.reduce((acc, item) => acc + item.precio_final, 0);
  useEffect(() => { setAmountPaid(total); }, [total]);

  // --- 4. REGISTRO DE VENTA / SEPARADO ---
  const handleFinalizar = async () => {
    if (cart.length === 0) return;
    try {
      const item = cart[0]; 
      const saleData = {
        product_id: item.id,
        customer_name: customer,
        total_price: total,
        amount_paid: amountPaid,
        status: amountPaid >= total ? "pagado" : "separado"
      };

      const response = await fetch('http://localhost:8000/sales/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });

      if (response.ok) {
        alert(amountPaid >= total ? "¡Venta Exitosa!" : "¡Separado Registrado!");
        setCart([]);
        onClose();
      }
    } catch (err) { alert("Error al conectar con el backend"); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[40px] shadow-2xl flex overflow-hidden border border-white/20">
        
        {/* PANEL PRINCIPAL (DINÁMICO) */}
        <div className="flex-[3] flex flex-col p-10 overflow-y-auto">
          
          {activeTab === 'ventas' && (
            <>
              <div className="relative mb-10">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input 
                  autoFocus
                  className="w-full pl-14 pr-6 py-5 bg-slate-100 rounded-3xl outline-none text-xl font-medium border-2 border-transparent focus:border-emerald-500 transition-all"
                  placeholder="Escribe REF o Nombre del producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {filteredResults.length > 0 && (
                  <div className="absolute z-50 w-full bg-white shadow-2xl rounded-3xl mt-3 border border-slate-100 max-h-80 overflow-auto">
                    {filteredResults.map(p => (
                      <div key={p.id} onClick={() => addToCart(p)} className="p-5 hover:bg-emerald-50 cursor-pointer flex justify-between items-center border-b border-slate-50 transition-colors">
                        <div>
                          <p className="font-black text-slate-900 text-lg uppercase">{p.producto}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{p.categoria} • {p.subcategoria} | REF: {p.ref}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-emerald-600 text-xl">${p.p_venta?.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-slate-400">STOCK DISPONIBLE: {p.stock}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-end mb-4 px-2">
                  <h2 className="text-2xl font-black text-slate-800 italic uppercase">Carrito de Venta</h2>
                  <div className="flex items-center gap-3 bg-slate-100 px-5 py-2 rounded-2xl border border-slate-200">
                    <User size={18} className="text-slate-500"/>
                    <input value={customer} onChange={e => setCustomer(e.target.value)} className="bg-transparent outline-none text-sm font-black w-40 text-slate-700" />
                  </div>
                </div>

                {cart.length === 0 ? (
                  <div className="h-60 border-4 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-slate-300">
                    <ShoppingCart size={48} className="mb-2 opacity-20"/>
                    <p className="font-bold uppercase tracking-widest text-sm">Escanea o busca un producto</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[32px] border-2 border-slate-100 shadow-sm flex items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black tracking-tighter">{item.ref}</span>
                          <h3 className="font-black text-slate-800 text-lg uppercase leading-none">{item.producto}</h3>
                        </div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">{item.categoria} / {item.subcategoria}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Precio Final</p>
                        <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-2 border border-slate-200">
                          <span className="font-black text-slate-400 mr-2">$</span>
                          <input 
                            type="number" 
                            className="w-24 bg-transparent font-black text-xl text-slate-900 outline-none" 
                            value={item.precio_final}
                            onChange={(e) => {
                              const newCart = [...cart];
                              newCart[idx].precio_final = Number(e.target.value);
                              setCart(newCart);
                            }}
                          />
                        </div>
                      </div>
                      <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600 p-2"><Trash2 size={24}/></button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-10 grid grid-cols-2 gap-8">
                <div className="p-8 bg-slate-900 text-white rounded-[35px] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><ShoppingCart size={80}/></div>
                  <p className="text-xs font-bold opacity-60 uppercase tracking-[0.2em] mb-2">Total a pagar</p>
                  <p className="text-5xl font-black italic">${total.toLocaleString()}</p>
                </div>
                <div className="p-8 bg-emerald-50 border-2 border-emerald-200 rounded-[35px] relative">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-[0.2em] mb-2">Abono Recibido</p>
                  <div className="flex items-center text-5xl font-black text-emerald-700">
                    <span className="mr-3 opacity-40">$</span>
                    <input type="number" value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} className="bg-transparent outline-none w-full" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleFinalizar}
                disabled={cart.length === 0}
                className="w-full mt-8 bg-slate-900 text-white py-7 rounded-[30px] text-2xl font-black shadow-xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-20"
              >
                {amountPaid < total ? 'REGISTRAR COMO SEPARADO' : 'FINALIZAR VENTA'}
              </button>
            </>
          )}

          {activeTab === 'stock' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-10 bg-blue-50 rounded-full mb-6"><Plus size={60} className="text-blue-500"/></div>
              <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase">Entrada de Mercancía</h2>
              <p className="text-slate-400 max-w-md font-medium">Módulo para sumar stock a tus REFs existentes. Estará disponible en la siguiente actualización.</p>
            </div>
          )}

          {activeTab === 'caja' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-10 bg-amber-50 rounded-full mb-6"><Wallet size={60} className="text-amber-500"/></div>
              <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase">Flujo de Caja</h2>
              <p className="text-slate-400 max-w-md font-medium">Aquí podrás registrar gastos diarios o retiros de dinero.</p>
            </div>
          )}

        </div>

        {/* MENÚ DE CONTROL LATERAL */}
        <div className="flex-1 bg-slate-50 border-l border-slate-100 p-10 flex flex-col shadow-[inset_10px_0_20px_rgba(0,0,0,0.02)]">
           <div className="flex justify-between items-center mb-16">
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Sistema POS</p>
               <h1 className="font-black text-slate-900 italic">ESTILO NÓRDICO</h1>
             </div>
             <button onClick={onClose} className="p-3 bg-white shadow-sm border border-slate-200 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20}/></button>
           </div>
           
           <nav className="space-y-4 flex-1">
              <button 
                onClick={() => setActiveTab('ventas')}
                className={`w-full text-left p-6 rounded-3xl font-black flex items-center gap-5 transition-all duration-300 ${activeTab === 'ventas' ? 'bg-white shadow-xl text-slate-900 border-2 border-emerald-500 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ShoppingCart size={28} className={activeTab === 'ventas' ? 'text-emerald-500' : 'text-slate-300'}/> 
                <span className="tracking-tighter">Ventas</span>
              </button>

              <button 
                onClick={() => setActiveTab('stock')}
                className={`w-full text-left p-6 rounded-3xl font-black flex items-center gap-5 transition-all duration-300 ${activeTab === 'stock' ? 'bg-white shadow-xl text-slate-900 border-2 border-blue-500 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Plus size={28} className={activeTab === 'stock' ? 'text-blue-500' : 'text-slate-300'}/> 
                <span className="tracking-tighter">Stock</span>
              </button>

              <button 
                onClick={() => setActiveTab('caja')}
                className={`w-full text-left p-6 rounded-3xl font-black flex items-center gap-5 transition-all duration-300 ${activeTab === 'caja' ? 'bg-white shadow-xl text-slate-900 border-2 border-amber-500 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Wallet size={28} className={activeTab === 'caja' ? 'text-amber-500' : 'text-slate-300'}/> 
                <span className="tracking-tighter">Caja</span>
              </button>
           </nav>

           <div className="mt-auto p-6 bg-slate-900 rounded-[30px] text-white">
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Sesión activa</p>
              <p className="font-black italic text-sm">Cristian Ipaz</p>
           </div>
        </div>
      </div>
    </div>
  );
}