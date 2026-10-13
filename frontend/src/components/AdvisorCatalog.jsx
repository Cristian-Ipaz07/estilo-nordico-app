import React, { useState, useMemo } from 'react';
import { Search, Filter, Package, Globe, Copy, Check, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fmt = (num) => Number(num || 0).toLocaleString('es-CO');

export default function AdvisorCatalog({ products, onEditProduct }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('TODOS');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedType !== 'TODOS') {
      list = list.filter(p => (p.product_type || 'ROPA').toUpperCase() === selectedType);
    }
    if (onlyInStock) {
      list = list.filter(p => (p.stock || 0) > 0);
    }
    if (search && search.trim()) {
      const kws = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(item => {
        const content = `${item.ref || ''} ${item.name || item.producto || ''} ${item.category || ''} ${item.subcategory || ''} ${item.color || ''} ${item.size || ''} ${item.product_type || ''}`.toLowerCase();
        return kws.every(k => content.includes(k));
      });
    }
    return list;
  }, [products, selectedType, onlyInStock, search]);

  const copyToWhatsApp = (p) => {
    const hasDiscount = p.compare_price && p.compare_price > p.price_sale;
    const firstImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;

    let text = `❄️ *ESTILO NÓRDICO* ❄️\n`;
    text += `🏷️ *${p.name}*\n`;
    text += `🔖 *Ref:* ${p.ref}\n`;
    text += `💰 *Precio:* $${fmt(p.price_sale)}`;
    if (hasDiscount) {
      text += ` ~(Antes: $${fmt(p.compare_price)})~`;
    }
    text += `\n`;
    if (p.color || p.size) {
      text += `🎨 *Color:* ${p.color || 'Único'} | 📏 *Talla:* ${p.size || 'Única'}\n`;
    }
    text += `⚡ *Disponibilidad:* ${p.stock > 0 ? `¡Solo ${p.stock} unidad(es) disponible(s)!` : 'Agotado'}\n`;
    if (p.description) {
      text += `\n?? _${p.description}_\n`;
    }
    if (firstImg) {
      text += `\n?? *Ver foto:* ${firstImg}\n`;
    }
    text += `\n?? *?Te gustar?a apartarla para entrega inmediata o env?o contraentrega?*`;

    navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar en catálogo: nombre, ref, color, talla..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['TODOS', 'CHAQUETA', 'ROPA', 'PERFUME', 'RELOJ', 'ACCESORIO'].map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${selectedType === t ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {t}
            </button>
          ))}

          <button
            onClick={() => setOnlyInStock(!onlyInStock)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${onlyInStock ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <Filter size={12} /> Solo en Stock
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Catálogo */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">No se encontraron productos en este filtro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
            {filtered.map(p => {
              const hasImages = Array.isArray(p.images) && p.images.length > 0;
              const isCopied = copiedId === p.id;
              const hasDiscount = p.compare_price && p.compare_price > p.price_sale;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group"
                >
                  <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {hasImages ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.target.src = ''; e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="text-center text-slate-300">
                        <Package size={40} className="mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin foto</span>
                      </div>
                    )}

                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                        {p.product_type || 'ROPA'}
                      </span>
                      {p.is_published && (
                        <span className="bg-emerald-600/90 backdrop-blur-sm text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Globe size={9} /> Web
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm ${
                        p.stock <= 0 ? 'bg-rose-500 text-white' : p.stock < 3 ? 'bg-amber-400 text-slate-900' : 'bg-emerald-500 text-white'
                      }`}>
                        {p.stock <= 0 ? 'Agotado' : `${p.stock} un.`}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p className="text-[10px] font-mono font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.ref}
                        </p>
                        {p.category && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {p.category}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                        {p.name}
                      </h4>

                      {(p.color || p.size) && (
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600 font-medium">
                          {p.color && <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-bold">{p.color}</span>}
                          {p.size && <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-black text-indigo-700">{p.size}</span>}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <p className="text-lg font-black text-slate-900">${fmt(p.price_sale)}</p>
                          {hasDiscount && (
                            <p className="text-[10px] font-bold text-slate-400 line-through">
                              Antes: ${fmt(p.compare_price)}
                            </p>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Costo Base</span>
                            <span className="text-xs font-black text-slate-600">${fmt(p.my_cost)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToWhatsApp(p)}
                          className={`flex-1 py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                            isCopied ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                          }`}
                        >
                          {isCopied ? <Check size={14} /> : <Copy size={14} />}
                          {isCopied ? '✅ ¡Copiado!' : '💬 Ficha WhatsApp'}
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => onEditProduct(p)}
                            className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                            title="Editar ficha"
                          >
                            <Edit3 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
