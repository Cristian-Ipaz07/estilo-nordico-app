import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, RefreshCw, Package, UploadCloud, AlertCircle, ChevronUp, ChevronDown, 
  ChevronsUpDown, History, ArrowRight, Truck, CheckCircle2, RotateCcw, TrendingUp, 
  Edit3, Plus, Globe, Sparkles, Layers, Trash2, Check, Filter, BarChart3, X, SlidersHorizontal, ExternalLink,
  ArrowDownAZ, ArrowUpAZ, ArrowDown10, ArrowUp01, FileSpreadsheet, Archive, PackageCheck, PackageX
} from 'lucide-react';
import ProductModal from '../components/ProductModal';
import AdvisorCatalog from '../components/AdvisorCatalog';
import VariantBreakdownModal from '../components/VariantBreakdownModal';
import BatchStockEntryModal from '../components/BatchStockEntryModal';
import { useAuth } from '../context/AuthContext';
import { API_URL, WEB_STORE_URL } from '../config/api';

function AssetValuationCard({ products, variantStats }) {
  const STORAGE_KEY = 'inv_ajuste_creditos_externos';
  const [expanded, setExpanded] = useState(false);
  const [creditosExternos, setCreditosExternos] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE_KEY) || 0); } catch { return 0; }
  });
  const [inputVal, setInputVal] = useState(creditosExternos || '');
  const [saved, setSaved] = useState(false);

  // Valoración real sin duplicar stock de prendas con variantes
  const valorSistema = useMemo(() => {
    const base = products.filter(p => !p.parent_id);
    return base.reduce((acc, b) => {
      const v = variantStats ? variantStats[b.id] : null;
      if (v && v.hasVariants) {
        return acc + v.totalCostVal;
      }
      return acc + ((b.my_cost || 0) * (b.stock || 0));
    }, 0);
  }, [products, variantStats]);

  const valorTotal = valorSistema + creditosExternos;

  const handleSave = () => {
    const val = Number(inputVal) || 0;
    setCreditosExternos(val);
    localStorage.setItem(STORAGE_KEY, val.toString());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fmt = (n) => Number(n).toLocaleString('es-CO');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mt-4 shrink-0 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><TrendingUp size={18} /></div>
          <div className="text-left">
            <p className="text-sm font-black text-slate-900">Valoración Real del Inventario</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Sistema: ${fmt(valorSistema)} · Total estimado: ${fmt(valorTotal)}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor en Sistema</p>
              <p className="text-xl font-black text-slate-900">${fmt(valorSistema)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Costo real de prendas físicas activas</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Créditos / Mercancía Extra</p>
              <p className="text-xl font-black text-amber-700">${fmt(creditosExternos)}</p>
              <p className="text-[10px] text-amber-400 mt-1">Ingresado manualmente</p>
            </div>
            <div className="bg-indigo-600 rounded-xl p-4">
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Valor Total Estimado</p>
              <p className="text-xl font-black text-white">${fmt(valorTotal)}</p>
              <p className="text-[10px] text-indigo-200 mt-1">Sistema + Externos</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Créditos Externos / Mercancía fuera del sistema
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Usa este campo para ajustar el valor total real del inventario (Ej: mercancía a consignación, en tránsito o registrada solo en Excel). Se guarda localmente.
            </p>
            <div className="flex gap-2">
              <div className="flex items-center border-2 border-amber-200 rounded-xl px-4 py-3 bg-amber-50 focus-within:border-amber-400 transition-all flex-1">
                <span className="text-amber-400 font-black mr-2">$</span>
                <input
                  type="number" min="0"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="Ej. 2000000"
                  className="bg-transparent outline-none w-full font-bold text-amber-700"
                />
              </div>
              <button onClick={handleSave}
                className={`px-5 rounded-xl font-black text-sm transition-all flex items-center gap-2 cursor-pointer
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                {saved ? <><CheckCircle2 size={16} /> Guardado</> : <><Edit3 size={16} /> Aplicar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fmt = (num) => Number(num || 0).toLocaleString('es-CO');
const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit', hour12: true });
};

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Disponibilidad: 'IN_STOCK' (Por defecto: solo con stock > 0), 'OUT_OF_STOCK' (Agotadas / Archivo), 'ALL' (Todas)
  const [availabilityFilter, setAvailabilityFilter] = useState('IN_STOCK');

  // Ordenamiento por defecto: Orden Excel (Hombre primero, luego Mujer, subcategorías A-Z, productos A-Z)
  const [sortConfig, setSortConfig] = useState({ key: 'excel', direction: 'asc' });
  const [genderFilter, setGenderFilter] = useState('TODOS');
  const [subcategoryFilter, setSubcategoryFilter] = useState('TODAS');
  
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'catalog', 'history'

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStockId, setEditingStockId] = useState(null);
  const [inlineStockVal, setInlineStockVal] = useState('');
  const [savingStockId, setSavingStockId] = useState(null);
  const [variantModalProduct, setVariantModalProduct] = useState(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isBatchEntryOpen, setIsBatchEntryOpen] = useState(false);
  const [batchPreselectedRef, setBatchPreselectedRef] = useState('');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products/`);
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Separación limpia: Referencias Base vs. Variantes Anidadas
  const { baseProducts, variantsByParent, variantStats } = useMemo(() => {
    const base = [];
    const varMap = {};

    products.forEach(p => {
      if (p.parent_id) {
        if (!varMap[p.parent_id]) varMap[p.parent_id] = [];
        varMap[p.parent_id].push(p);
      } else {
        base.push(p);
      }
    });

    const vStats = {};
    base.forEach(b => {
      const children = varMap[b.id] || [];
      const count = children.length;
      const totalStock = count > 0 
        ? children.reduce((sum, v) => sum + (v.stock || 0), 0)
        : (b.stock || 0);
      const totalCostVal = count > 0
        ? children.reduce((sum, v) => sum + (v.stock || 0) * (v.my_cost || b.my_cost || 0), 0)
        : (b.stock || 0) * (b.my_cost || 0);
      const totalSaleVal = count > 0
        ? children.reduce((sum, v) => sum + (v.stock || 0) * (v.price_sale || b.price_sale || 0), 0)
        : (b.stock || 0) * (b.price_sale || 0);

      vStats[b.id] = {
        count,
        children,
        totalStock,
        totalCostVal,
        totalSaleVal,
        hasVariants: count > 0
      };
    });

    return { baseProducts: base, variantsByParent: varMap, variantStats: vStats };
  }, [products]);

  // Conteo de Referencias Activas con Stock vs Agotadas
  const { activeInStockCount, outOfStockCount } = useMemo(() => {
    let inStock = 0;
    let outStock = 0;
    baseProducts.forEach(b => {
      const v = variantStats[b.id];
      const stock = v && v.hasVariants ? v.totalStock : (b.stock || 0);
      if (stock > 0) inStock++;
      else outStock++;
    });
    return { activeInStockCount: inStock, outOfStockCount: outStock };
  }, [baseProducts, variantStats]);

  // Lista de subcategorías disponibles para el selector estilo Excel
  const availableSubcategories = useMemo(() => {
    const map = {};
    baseProducts.forEach(p => {
      // Si está en filtro IN_STOCK, contar solo las que tienen stock
      const v = variantStats[p.id];
      const stock = v && v.hasVariants ? v.totalStock : (p.stock || 0);
      if (availabilityFilter === 'IN_STOCK' && stock <= 0) return;
      if (availabilityFilter === 'OUT_OF_STOCK' && stock > 0) return;

      const sub = (p.subcategory || '').trim().toUpperCase();
      if (sub) {
        map[sub] = (map[sub] || 0) + 1;
      }
    });
    return Object.keys(map).sort().map(name => ({ name, count: map[name] }));
  }, [baseProducts, variantStats, availabilityFilter]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products/upload-excel`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("¡Inventario actualizado con éxito desde el Excel!");
        fetchInventory();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || "No se pudo procesar el archivo"}`);
      }
    } catch (error) {
      console.error("Error en la subida:", error);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
      event.target.value = null;
    }
  };

  // Manejo de ordenamiento estilo Excel:
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else {
          return { key: 'excel', direction: 'asc' };
        }
      }
      const defaultDir = ['stock', 'price_sale', 'my_cost'].includes(key) ? 'desc' : 'asc';
      return { key, direction: defaultDir };
    });
  };

  // Filtrado y Ordenamiento sobre las REFERENCIAS BASE
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...baseProducts];

    // 1. Filtro de Disponibilidad / Stock (Activas vs Agotadas / Histórico)
    if (availabilityFilter === 'IN_STOCK') {
      result = result.filter(p => {
        const v = variantStats[p.id];
        const stock = v && v.hasVariants ? v.totalStock : (p.stock || 0);
        return stock > 0;
      });
    } else if (availabilityFilter === 'OUT_OF_STOCK') {
      result = result.filter(p => {
        const v = variantStats[p.id];
        const stock = v && v.hasVariants ? v.totalStock : (p.stock || 0);
        return stock <= 0;
      });
    }

    // 2. Filtro por Género
    if (genderFilter !== 'TODOS') {
      if (genderFilter === 'OTROS') {
        result = result.filter(p => !['HOMBRE', 'MUJER'].includes((p.category || '').toUpperCase()));
      } else {
        result = result.filter(p => (p.category || '').toUpperCase() === genderFilter);
      }
    }

    // 3. Filtro por Subcategoría (Estilo Excel)
    if (subcategoryFilter !== 'TODAS') {
      result = result.filter(p => (p.subcategory || '').trim().toUpperCase() === subcategoryFilter);
    }

    // 4. Buscador inteligente global
    if (searchTerm && searchTerm.trim()) {
      const kws = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(item => {
        const vInfo = variantStats[item.id];
        const variantText = (vInfo?.children || []).map(v => 
          `${v.ref || ''} ${v.name || ''} ${v.color || ''} ${v.size || ''} ${v.brand || ''}`
        ).join(' ');

        const content = `${item.ref || ''} ${item.name || item.producto || ''} ${item.category || ''} ${item.subcategory || ''} ${item.color || ''} ${item.size || ''} ${item.product_type || ''} ${item.brand || ''} ${variantText}`.toLowerCase();
        return kws.every(k => content.includes(k));
      });
    }

    // 5. Ordenamiento
    if (sortConfig.key === 'excel') {
      const catPriority = (cat) => {
        const c = (cat || '').toUpperCase().trim();
        if (c === 'HOMBRE') return 1;
        if (c === 'MUJER') return 2;
        return 3;
      };

      result.sort((a, b) => {
        const prioA = catPriority(a.category);
        const prioB = catPriority(b.category);
        if (prioA !== prioB) {
          return sortConfig.direction === 'asc' ? prioA - prioB : prioB - prioA;
        }

        const subA = (a.subcategory || '').trim().toUpperCase();
        const subB = (b.subcategory || '').trim().toUpperCase();
        const subCmp = subA.localeCompare(subB, 'es', { sensitivity: 'base' });
        if (subCmp !== 0) {
          return sortConfig.direction === 'asc' ? subCmp : -subCmp;
        }

        const nameA = (a.name || '').trim().toUpperCase();
        const nameB = (b.name || '').trim().toUpperCase();
        const nameCmp = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
        if (nameCmp !== 0) {
          return sortConfig.direction === 'asc' ? nameCmp : -nameCmp;
        }

        return String(a.ref || '').localeCompare(String(b.ref || ''), 'es', { numeric: true });
      });
    } else if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? "";
        let bVal = b[sortConfig.key] ?? "";

        if (sortConfig.key === 'stock') {
          aVal = variantStats[a.id]?.totalStock ?? (a.stock || 0);
          bVal = variantStats[b.id]?.totalStock ?? (b.stock || 0);
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        if (sortConfig.key === 'my_cost' || sortConfig.key === 'price_sale') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        if (sortConfig.key === 'category') {
          const catPriority = (cat) => {
            const c = (cat || '').toUpperCase().trim();
            if (c === 'HOMBRE') return 1;
            if (c === 'MUJER') return 2;
            return 3;
          };
          const prioA = catPriority(aVal);
          const prioB = catPriority(bVal);
          if (prioA !== prioB) {
            return sortConfig.direction === 'asc' ? prioA - prioB : prioB - prioA;
          }
          return (a.name || '').localeCompare(b.name || '', 'es');
        }

        if (sortConfig.key === 'ref') {
          return sortConfig.direction === 'asc'
            ? String(aVal).localeCompare(String(bVal), 'es', { numeric: true })
            : String(bVal).localeCompare(String(aVal), 'es', { numeric: true });
        }

        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal, 'es', { sensitivity: 'base' })
            : bVal.localeCompare(aVal, 'es', { sensitivity: 'base' });
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [baseProducts, searchTerm, sortConfig, genderFilter, subcategoryFilter, availabilityFilter, variantStats]);

  // Estadísticas exactas para la vista activa
  const stats = useMemo(() => {
    // Tomar el universo base según disponibilidad (in stock o all)
    let scope = baseProducts;
    if (availabilityFilter === 'IN_STOCK') {
      scope = baseProducts.filter(p => (variantStats[p.id]?.totalStock ?? (p.stock || 0)) > 0);
    } else if (availabilityFilter === 'OUT_OF_STOCK') {
      scope = baseProducts.filter(p => (variantStats[p.id]?.totalStock ?? (p.stock || 0)) <= 0);
    }

    const calcGroup = (arr) => {
      const count = arr.length;
      let units = 0;
      let saleVal = 0;
      let costVal = 0;

      arr.forEach(p => {
        const v = variantStats[p.id];
        if (v) {
          units += v.totalStock;
          saleVal += v.totalSaleVal;
          costVal += v.totalCostVal;
        } else {
          units += (p.stock || 0);
          saleVal += (p.stock || 0) * (p.price_sale || 0);
          costVal += (p.stock || 0) * (p.my_cost || 0);
        }
      });

      return { count, units, saleVal, costVal, margin: saleVal - costVal };
    };

    const hombreProducts = scope.filter(p => (p.category || '').toUpperCase() === 'HOMBRE');
    const mujerProducts = scope.filter(p => (p.category || '').toUpperCase() === 'MUJER');

    return {
      total: calcGroup(scope),
      hombre: calcGroup(hombreProducts),
      mujer: calcGroup(mujerProducts),
      filtered: calcGroup(filteredAndSortedProducts)
    };
  }, [baseProducts, filteredAndSortedProducts, variantStats, availabilityFilter]);

  const handleInlineStockSave = async (p, newStock) => {
    const val = Number(newStock);
    if (isNaN(val) || val < 0) return;
    setSavingStockId(p.id);
    try {
      const res = await fetch(`${API_URL}/products/${p.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ stock: val })
      });
      if (res.ok) {
        setProducts(prev => prev.map(item => item.id === p.id ? { ...item, stock: val } : item));
        setEditingStockId(null);
      } else {
        alert("Error al actualizar el stock");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingStockId(null);
    }
  };

  const handleDeleteProduct = async (p, e) => {
    e.stopPropagation();
    const vCount = variantStats[p.id]?.count || 0;
    const msg = vCount > 0 
      ? `¿Seguro que deseas eliminar la referencia [${p.ref}] ${p.name}? Tiene ${vCount} variantes asociadas.`
      : `¿Seguro que deseas eliminar el producto [${p.ref}] ${p.name}?`;
    
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${API_URL}/products/${p.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setProducts(prev => prev.filter(item => item.id !== p.id && item.parent_id !== p.id));
      } else {
        alert("No se pudo eliminar el producto");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openVariantModal = (p, e) => {
    if (e) e.stopPropagation();
    setVariantModalProduct(p);
    setIsVariantModalOpen(true);
  };

  // Icono dinámico según el tipo de columna y dirección de orden
  const SortIcon = ({ columnKey, isNumeric = false }) => {
    const isActive = sortConfig.key === columnKey;
    if (!isActive) {
      return <ChevronsUpDown size={13} className="opacity-30 group-hover:opacity-100 transition-opacity" />;
    }

    if (isNumeric) {
      return sortConfig.direction === 'asc' 
        ? <ArrowUp01 size={13} className="text-indigo-600 font-black" />
        : <ArrowDown10 size={13} className="text-indigo-600 font-black" />;
    }

    return sortConfig.direction === 'asc'
      ? <ArrowDownAZ size={13} className="text-indigo-600 font-black" />
      : <ArrowUpAZ size={13} className="text-indigo-600 font-black" />;
  };

  const openCreateModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setSelectedProduct(p);
    setIsModalOpen(true);
  };

  const handleTogglePublish = async (p, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/products/${p.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ is_published: !p.is_published })
      });
      if (res.ok) {
        setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_published: !p.is_published } : item));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sortLabel = useMemo(() => {
    if (sortConfig.key === 'excel') return 'Orden Excel (Hombre → Subcat A-Z → Producto A-Z)';
    const names = {
      name: 'Producto (A-Z)',
      subcategory: 'Subcategoría (A-Z)',
      category: 'Categoría',
      ref: 'Referencia',
      stock: 'Stock',
      price_sale: 'Precio Venta',
      my_cost: 'Costo Unitario',
    };
    const col = names[sortConfig.key] || sortConfig.key;
    const dir = sortConfig.direction === 'asc' ? 'Menor a Mayor / A→Z' : 'Mayor a Menor / Z→A';
    return `${col} (${dir})`;
  }, [sortConfig]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 flex-1 flex flex-col min-w-0">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Inventario & Catálogo</h2>
          <p className="text-slate-500 text-xs font-semibold">Gestión de referencias base, desglose de variantes y catálogo web</p>
        </div>
        
        {/* Pestañas Principales */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Inventario ({activeInStockCount} activas)
          </button>
          <button 
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'catalog' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Sparkles size={14} className="text-indigo-600" /> Catálogo Asesores
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Historial Entradas
          </button>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBatchPreselectedRef(''); setIsBatchEntryOpen(true); }}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
            title="Ingreso rápido de múltiples prendas y tallas por lote con cálculo automático de costo puesto en tienda"
          >
            <Layers size={15} /> + Entrada en Bloque
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={15} /> Nueva Prenda
          </button>

          {activeTab === 'stock' && (
            <>
              <input type="file" id="excel-upload" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xlsm" />
              <button 
                onClick={() => document.getElementById('excel-upload').click()}
                className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all active:scale-95 bg-white"
              >
                <UploadCloud size={15} className="text-blue-600" /> Importar Excel
              </button>
            </>
          )}

          <button 
            onClick={fetchInventory} 
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Contenido según Pestaña */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {activeTab === 'stock' && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* 1. Tarjetas de Métricas de Inventario */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0 mb-4">
              {/* Tarjeta Hombre */}
              <div
                onClick={() => setGenderFilter(genderFilter === 'HOMBRE' ? 'TODOS' : 'HOMBRE')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  genderFilter === 'HOMBRE'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                    : 'bg-white hover:bg-blue-50/50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${genderFilter === 'HOMBRE' ? 'text-blue-100' : 'text-blue-600'}`}>
                    👔 Hombre ({stats.hombre.count} refs)
                  </span>
                  <span className={`text-xs font-mono font-black ${genderFilter === 'HOMBRE' ? 'text-white' : 'text-slate-700'}`}>
                    {stats.hombre.units} un.
                  </span>
                </div>
                <p className="text-sm font-black font-mono leading-tight">${fmt(stats.hombre.saleVal)}</p>
                <p className={`text-[9px] font-medium mt-0.5 ${genderFilter === 'HOMBRE' ? 'text-blue-200' : 'text-slate-400'}`}>
                  Costo: ${fmt(stats.hombre.costVal)}
                </p>
              </div>

              {/* Tarjeta Mujer */}
              <div
                onClick={() => setGenderFilter(genderFilter === 'MUJER' ? 'TODOS' : 'MUJER')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  genderFilter === 'MUJER'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100'
                    : 'bg-white hover:bg-rose-50/50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${genderFilter === 'MUJER' ? 'text-rose-100' : 'text-rose-600'}`}>
                    👗 Mujer ({stats.mujer.count} refs)
                  </span>
                  <span className={`text-xs font-mono font-black ${genderFilter === 'MUJER' ? 'text-white' : 'text-slate-700'}`}>
                    {stats.mujer.units} un.
                  </span>
                </div>
                <p className="text-sm font-black font-mono leading-tight">${fmt(stats.mujer.saleVal)}</p>
                <p className={`text-[9px] font-medium mt-0.5 ${genderFilter === 'MUJER' ? 'text-rose-200' : 'text-slate-400'}`}>
                  Costo: ${fmt(stats.mujer.costVal)}
                </p>
              </div>

              {/* Tarjeta Total */}
              <div
                onClick={() => { setGenderFilter('TODOS'); setSubcategoryFilter('TODAS'); }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  genderFilter === 'TODOS' && subcategoryFilter === 'TODAS' && !searchTerm
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${genderFilter === 'TODOS' && subcategoryFilter === 'TODAS' && !searchTerm ? 'text-slate-300' : 'text-slate-500'}`}>
                    📦 Total ({stats.total.count} refs)
                  </span>
                  <span className={`text-xs font-mono font-black ${genderFilter === 'TODOS' && subcategoryFilter === 'TODAS' && !searchTerm ? 'text-emerald-400' : 'text-slate-900'}`}>
                    {stats.total.units} un.
                  </span>
                </div>
                <p className="text-sm font-black font-mono leading-tight">${fmt(stats.total.saleVal)}</p>
                <p className={`text-[9px] font-medium mt-0.5 ${genderFilter === 'TODOS' && !searchTerm ? 'text-slate-300' : 'text-slate-400'}`}>
                  Costo: ${fmt(stats.total.costVal)}
                </p>
              </div>

              {/* Tarjeta En Pantalla */}
              <div className="p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/50 text-indigo-950">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                    👁️ En Pantalla ({stats.filtered.count} refs)
                  </span>
                  <span className="text-xs font-mono font-black text-indigo-700">
                    {stats.filtered.units} un.
                  </span>
                </div>
                <p className="text-sm font-black font-mono leading-tight">${fmt(stats.filtered.saleVal)}</p>
                <p className="text-[9px] font-medium text-indigo-500 mt-0.5">
                  Margen: ${fmt(stats.filtered.margin)}
                </p>
              </div>
            </div>

            {/* 2. Barra de Búsqueda y Filtros Estilo Excel con Selector de Disponibilidad */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 mb-4 flex flex-col gap-3">
              {/* Fila Superior: Disponibilidad de Stock + Buscador */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Selector de Disponibilidad: Activas en Tienda vs Archivo Agotadas */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
                  <button
                    onClick={() => setAvailabilityFilter('IN_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      availabilityFilter === 'IN_STOCK'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PackageCheck size={14} />
                    <span>En Tienda / Activas ({activeInStockCount})</span>
                  </button>

                  <button
                    onClick={() => setAvailabilityFilter('OUT_OF_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      availabilityFilter === 'OUT_OF_STOCK'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Archive size={14} />
                    <span>Agotadas / Archivo ({outOfStockCount})</span>
                  </button>

                  <button
                    onClick={() => setAvailabilityFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      availabilityFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-sm font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Todas ({baseProducts.length})</span>
                  </button>
                </div>

                {/* Buscador de Texto */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar REF (ej. 1536), Modelo, Color, Marca..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold text-slate-800"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filtro Dropdown de Subcategoría y Botón Orden Excel */}
                <div className="flex items-center gap-2">
                  <select
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <option value="TODAS">📂 Subcategoría: Todas ({availableSubcategories.length})</option>
                    {availableSubcategories.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.count} refs)
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setSortConfig({ key: 'excel', direction: 'asc' })}
                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      sortConfig.key === 'excel'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                    title="Restablecer el orden exacto de Excel: Hombre primero, luego Mujer, Subcategoría A-Z y Producto A-Z"
                  >
                    <FileSpreadsheet size={14} className={sortConfig.key === 'excel' ? 'text-emerald-700' : 'text-slate-400'} />
                    <span>Orden Excel</span>
                    {sortConfig.key === 'excel' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse ml-0.5"></span>
                    )}
                  </button>
                </div>
              </div>

              {/* Fila Inferior: Píldoras de Género y Estado del Orden */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                {/* Píldoras de Género */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                  {[
                    { id: 'TODOS', label: `Todos (${stats.total.count})` },
                    { id: 'HOMBRE', label: `Hombre (${stats.hombre.count})` },
                    { id: 'MUJER', label: `Mujer (${stats.mujer.count})` },
                    { id: 'OTROS', label: 'Otros / Unisex' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setGenderFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                        genderFilter === f.id
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  
                  {subcategoryFilter !== 'TODAS' && (
                    <button
                      onClick={() => setSubcategoryFilter('TODAS')}
                      className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-100 cursor-pointer"
                    >
                      <span>Subcat: {subcategoryFilter}</span>
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Indicador de Criterio de Orden Activo */}
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Orden:</span>
                  <span className="text-indigo-600 font-black">{sortLabel}</span>
                </div>
              </div>
            </div>

            {/* Banner Explicativo si está en Archivo de Agotadas */}
            {availabilityFilter === 'OUT_OF_STOCK' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                    <Archive size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-950 uppercase tracking-tight">
                      Archivo de Referencias Agotadas ({outOfStockCount} prendas históricas)
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Estas referencias tienen 0 unidades. Si alguna vuelve a llegar a tienda, haz clic en <strong className="text-indigo-700">"+ Retomar"</strong> en la fila para ingresar su nuevo stock y activarla de nuevo.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAvailabilityFilter('IN_STOCK')}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shadow-sm"
                >
                  Ver Prendas Activas
                </button>
              </div>
            )}

            {/* 3. Tabla de Referencias Estilo Excel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-left relative min-w-[950px]">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-xs">
                    <tr>
                      {[
                        { label: 'REF', key: 'ref', isNumeric: false }, 
                        { label: 'Categoría', key: 'category', isNumeric: false },
                        { label: 'Subcategoría', key: 'subcategory', isNumeric: false },
                        { label: 'Producto', key: 'name', isNumeric: false }, 
                        { label: 'Variantes / Tallas', key: 'color', isNumeric: false }, 
                        { label: 'Costo Unit.', key: 'my_cost', isNumeric: true }, 
                        { label: 'P. Venta', key: 'price_sale', isNumeric: true }, 
                        { label: 'Stock Total', key: 'stock', isNumeric: true },
                        { label: 'Web', key: 'is_published', isNumeric: false },
                        { label: 'Acciones', key: 'actions', isNumeric: false }
                      ].map((col) => {
                        const isCurrent = sortConfig.key === col.key;
                        const isAction = col.key === 'actions';

                        return (
                          <th 
                            key={col.key} 
                            onClick={() => !isAction && handleSort(col.key)}
                            className={`px-4 py-3.5 text-xs font-black uppercase transition-colors group select-none ${
                              isAction 
                                ? 'text-slate-400' 
                                : `cursor-pointer hover:bg-slate-100 ${isCurrent ? 'bg-indigo-50/70 text-indigo-900 font-black' : 'text-slate-400'}`
                            }`}
                            title={!isAction ? "Clic: Ordenar A-Z / Z-A (o mayor/menor)" : undefined}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{col.label}</span>
                              {!isAction && <SortIcon columnKey={col.key} isNumeric={col.isNumeric} />}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedProducts.length > 0 ? (
                      filteredAndSortedProducts.map((p) => {
                        const vInfo = variantStats[p.id];
                        const hasVars = vInfo?.hasVariants;
                        const displayStock = hasVars ? vInfo.totalStock : (p.stock || 0);
                        const isZeroStock = displayStock <= 0;

                        return (
                          <tr 
                            key={p.id} 
                            onClick={() => openEditModal(p)}
                            className={`hover:bg-indigo-50/40 transition-colors group cursor-pointer ${isZeroStock && availabilityFilter !== 'OUT_OF_STOCK' ? 'opacity-60 bg-slate-50/30' : ''}`}
                          >
                            {/* REF */}
                            <td className="px-4 py-3.5 text-xs font-mono font-black text-slate-800 whitespace-nowrap">
                              {p.ref}
                            </td>

                            {/* Categoría (Hombre / Mujer) */}
                            <td className="px-4 py-3.5 text-xs">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                (p.category || '').toUpperCase() === 'HOMBRE' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : (p.category || '').toUpperCase() === 'MUJER'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-600'
                              }`}>
                                {p.category || 'UNISEX'}
                              </span>
                            </td>

                            {/* Subcategoría (Bermuda, Buso, Camiseta...) */}
                            <td className="px-4 py-3.5 text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
                              {p.subcategory || '-'}
                            </td>

                            {/* Nombre del Producto Base */}
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors block">
                                {p.name}
                              </span>
                            </td>

                            {/* Columna de Variantes / Tallas */}
                            <td className="px-4 py-3.5 text-xs" onClick={e => e.stopPropagation()}>
                              {hasVars ? (
                                <button
                                  type="button"
                                  onClick={(e) => openVariantModal(p, e)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 border border-indigo-200 transition-all shadow-2xs group/var cursor-pointer"
                                  title="Clic para ver y editar las variantes de esta prenda"
                                >
                                  <Layers size={13} className="text-indigo-600 group-hover/var:scale-110 transition-transform" />
                                  <span>{vInfo.count} {vInfo.count === 1 ? 'Variante' : 'Variantes'}</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {p.color ? (
                                    <span className="font-bold text-slate-700">
                                      {p.color}
                                      {p.size && <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded ml-1">{p.size}</span>}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => openVariantModal(p, e)}
                                      className="text-slate-400 hover:text-indigo-600 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Desglosar colores y tallas"
                                    >
                                      <Plus size={13} /> Desglosar
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Costo Unitario */}
                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-400 whitespace-nowrap">
                              ${fmt(p.my_cost)}
                            </td>

                            {/* Precio de Venta */}
                            <td className="px-4 py-3.5 text-sm font-black text-emerald-600 whitespace-nowrap">
                              ${fmt(p.price_sale)}
                              {p.compare_price && p.compare_price > p.price_sale && (
                                <span className="block text-[10px] text-slate-400 line-through font-normal">${fmt(p.compare_price)}</span>
                              )}
                            </td>

                            {/* Stock Total con Opción de Retomar si está en 0 */}
                            <td className="px-4 py-3.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              {isZeroStock ? (
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                    0 un.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (hasVars) {
                                        openVariantModal(p, e);
                                      } else {
                                        setEditingStockId(p.id);
                                        setInlineStockVal('1');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-[10px] font-black border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs group/ret"
                                    title="Ingresar stock y reactivar esta prenda en tienda"
                                  >
                                    <Plus size={11} className="group-hover/ret:rotate-90 transition-transform" />
                                    <span>Retomar</span>
                                  </button>
                                </div>
                              ) : hasVars ? (
                                <div
                                  onClick={(e) => openVariantModal(p, e)}
                                  className="flex items-center gap-1.5 cursor-pointer group/stock"
                                  title="Stock total de variantes. Clic para ver desglose."
                                >
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black transition-all ${
                                    displayStock < 5 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                  } group-hover/stock:ring-2 group-hover/stock:ring-indigo-400`}>
                                    {displayStock} un.
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">({vInfo.count} SKUs)</span>
                                </div>
                              ) : (
                                isAdmin && editingStockId === p.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={inlineStockVal}
                                      onChange={e => setInlineStockVal(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleInlineStockSave(p, inlineStockVal);
                                        if (e.key === 'Escape') setEditingStockId(null);
                                      }}
                                      className="w-16 px-2 py-1 bg-white border-2 border-indigo-600 rounded-lg text-xs font-black text-slate-800 outline-none"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleInlineStockSave(p, inlineStockVal)}
                                      disabled={savingStockId === p.id}
                                      className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                                      title="Guardar"
                                    >
                                      <Check size={13} />
                                    </button>
                                    <button
                                      onClick={() => setEditingStockId(null)}
                                      className="p-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 cursor-pointer"
                                      title="Cancelar"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => {
                                      if (isAdmin) {
                                        setEditingStockId(p.id);
                                        setInlineStockVal(p.stock);
                                      }
                                    }}
                                    className={`flex items-center gap-1.5 ${isAdmin ? 'cursor-pointer group/stock' : ''}`}
                                    title={isAdmin ? "Clic para editar stock en línea" : ""}
                                  >
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black transition-all ${
                                      displayStock < 5 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                    } ${isAdmin ? 'group-hover/stock:ring-2 group-hover/stock:ring-indigo-400' : ''}`}>
                                      {p.stock} un.
                                    </span>
                                    {isAdmin && (
                                      <Edit3 size={11} className="opacity-0 group-hover/stock:opacity-60 text-slate-400" />
                                    )}
                                    {p.stock < 3 && <AlertCircle size={14} className="text-rose-500" />}
                                  </div>
                                )
                              )}
                            </td>

                            {/* Estado Web */}
                            <td className="px-4 py-3.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={(e) => handleTogglePublish(p, e)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                    p.is_published ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                  }`}
                                  title={p.is_published ? 'Publicado en tienda web. Clic para ocultar.' : 'Oculto de tienda web. Clic para publicar.'}
                                >
                                  <Globe size={11} /> {p.is_published ? 'Online' : 'Oculto'}
                                </button>
                                {p.is_published && (
                                  <a
                                    href={p.slug ? `${WEB_STORE_URL}/chaquetas/${p.slug}` : (p.ref ? `${WEB_STORE_URL}/chaquetas/${p.ref.toLowerCase()}` : WEB_STORE_URL)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                                    title="Mirar esta prenda en la tienda web (abre en nueva pestaña)"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Acciones */}
                            <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                {/* Botón Variantes */}
                                <button
                                  onClick={(e) => openVariantModal(p, e)}
                                  className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                  title="Desglosar tallas y colores de esta referencia"
                                >
                                  <Layers size={14} />
                                  <span className="hidden xl:inline">Variantes</span>
                                </button>

                                {/* Botón Editar */}
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                  title="Editar producto base"
                                >
                                  <Edit3 size={14} />
                                </button>

                                {/* Botón Eliminar */}
                                {isAdmin && (
                                  <button
                                    onClick={(e) => handleDeleteProduct(p, e)}
                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Eliminar producto"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="10" className="px-6 py-10 text-center text-slate-400">
                          <Package className="mx-auto mb-2 opacity-20" size={40} />
                          {availabilityFilter === 'OUT_OF_STOCK' 
                            ? 'No hay referencias agotadas que coincidan con la búsqueda.'
                            : 'No se encontraron referencias activas en tienda que coincidan con la búsqueda.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tarjeta de Valoración */}
            <AssetValuationCard products={products} variantStats={variantStats} />
          </div>
        )}

        {activeTab === 'catalog' && (
          <AdvisorCatalog 
            products={baseProducts} 
            allProducts={products}
            onEditProduct={openEditModal} 
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab 
            inventory={products} 
            reloadInventory={fetchInventory} 
            onOpenBatchEntry={(r) => { setBatchPreselectedRef(r || ''); setIsBatchEntryOpen(true); }}
          />
        )}
      </div>

      {/* Modal de Crear / Editar Prenda Base */}
      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchInventory}
      />

      {/* Modal de Variantes por Referencia */}
      <VariantBreakdownModal
        baseProduct={variantModalProduct}
        allProducts={products}
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        onRefresh={fetchInventory}
      />

      {/* Modal de Entrada de Mercancía en Bloque / Recepción de Pedidos */}
      <BatchStockEntryModal
        isOpen={isBatchEntryOpen}
        onClose={() => setIsBatchEntryOpen(false)}
        products={products}
        initialRef={batchPreselectedRef}
        onSuccess={(data) => {
          fetchInventory();
        }}
      />
    </div>
  );
}

function HistoryTab({ inventory, reloadInventory, onOpenBatchEntry }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  
  // Filtros de Historial
  const [filterType, setFilterType] = useState('dia');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Restock Form
  const [qtyIn, setQtyIn] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newPriceSale, setNewPriceSale] = useState('');
  const [provider, setProvider] = useState('');
  const [paidFromCash, setPaidFromCash] = useState(false);
  const [isStocking, setIsStocking] = useState(false);
  const [stockMsg, setStockMsg] = useState('');

  // History
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const kws = term.split(' ');
    return inventory.filter(p => {
       const c = `${p.ref} ${p.name || ''} ${p.color || ''} ${p.size || ''}`.toLowerCase();
       return kws.every(k => c.includes(k));
    }).slice(0, 50);
  }, [search, inventory]);

  const loadHistory = useCallback(async (productId = null) => {
    setIsLoadingHistory(true);
    try {
      let url = `${API_URL}/products/entries?filter_type=${filterType}`;
      if (productId) url += `&product_id=${productId}`;
      if (filterType === 'range' && dateRange.start && dateRange.end) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }

      const res = await fetch(url, {
         headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Error al cargar historial');
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
    finally { setIsLoadingHistory(false); }
  }, [filterType, dateRange]);

  useEffect(() => {
    loadHistory(selected?.id);
  }, [selected, loadHistory]);

  const selectProduct = (p) => {
    setSelected(p);
    setQtyIn(''); setNewCost(''); setNewPriceSale('');
    setProvider(''); setPaidFromCash(false);
    setStockMsg('');
  };

  const handleRestock = async () => {
    if (!selected || !qtyIn || !newCost) return;
    setIsStocking(true);
    try {
      const res = await fetch(`${API_URL}/products/entries`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: selected.id, 
          quantity: Number(qtyIn),
          unit_cost: Number(newCost),
          provider: provider || 'S/P',
          paid_from_cash: paidFromCash,
          new_price_sale: newPriceSale ? Number(newPriceSale) : null,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      
      reloadInventory();
      loadHistory(selected.id);
      
      setStockMsg(`✓ Ingreso Exitoso Registrado`);
      setQtyIn(''); setNewCost(''); setNewPriceSale(''); setProvider(''); setPaidFromCash(false);
      
      const data = await res.json();
      if (data && data.stock) {
          setSelected(prev => ({...prev, stock: data.stock, my_cost: data.my_cost, price_sale: data.price_sale || prev.price_sale }));
      }
      setTimeout(() => setStockMsg(''), 4000);
    } catch (e) { alert(e.message); }
    finally { setIsStocking(false); }
  };

  const handleCancelEntry = async (entryId) => {
    if (!window.confirm('¿Seguro que deseas anular esta entrada? Se restará el stock y se revertirá el pago en caja si aplica.')) return;
    try {
      const res = await fetch(`${API_URL}/products/entries/${entryId}/cancel`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      setStockMsg('✓ Entrada Anulada Correctamente');
      reloadInventory();
      loadHistory(selected?.id);
      
      const cancelled = history.find(h => h.id === entryId);
      if (cancelled && selected && selected.id === cancelled.product_id) {
          setSelected(prev => ({...prev, stock: prev.stock - cancelled.quantity}));
      }
      setTimeout(() => setStockMsg(''), 4000);
    } catch(e) { alert(e.message); }
  };

  const goToProduct = (pName) => {
    let searchPart = pName;
    if (pName.includes(' - ')) searchPart = pName.split(' - ')[0];
    
    const found = inventory.find(p => p.ref === searchPart || p.name === pName);
    if (found) {
        selectProduct(found);
        setSearch('');
    } else {
        setSearch(searchPart);
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
        {/* Lado izquierdo: Búsqueda y Selección */}
        <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-sm">Buscar Producto</h3>
                {selected && (
                    <button onClick={() => setSelected(null)} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
                        Ver Todo el Historial
                    </button>
                )}
            </div>
            <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl outline-none text-sm font-semibold text-slate-700 border focus:border-indigo-400 focus:bg-white transition-all"
                    placeholder="Referencia o Nombre..."
                    value={search} onChange={e => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filtered.length === 0 && search.length > 0 && <p className="text-center text-xs text-slate-400 py-4">No hay resultados</p>}
                {filtered.length === 0 && search.length === 0 && (
                    <div className="text-center py-8 opacity-50">
                        <Package size={32} className="mx-auto text-slate-300 mb-2"/>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mostrando vista global</p>
                        <p className="text-[9px] text-slate-400 mt-1">Selecciona un producto a la izquierda <br/> para registrar una nueva entrada.</p>
                    </div>
                )}
                
                {filtered.map(p => (
                    <div key={p.id} onClick={() => selectProduct(p)}
                        className={`p-3 rounded-xl border border-slate-100 cursor-pointer transition-all ${selected?.id === p.id ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'bg-slate-50 hover:bg-white hover:border-slate-200'}`}>
                        <p className="font-bold text-xs text-slate-800 truncate">{p.name}</p>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{p.ref}</p>
                            <p className="text-[10px] font-black text-slate-700">{p.stock} uds | ${fmt(p.my_cost)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Lado derecho: Formulario e Historial */}
        <div className="w-2/3 flex flex-col bg-slate-50 border border-slate-200 rounded-2xl shadow-sm p-6 overflow-y-auto custom-scrollbar">
            
            <div className="max-w-4xl mx-auto w-full space-y-6">
                
                {selected ? (
                    <>
                        {/* Cabecera del Producto */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors cursor-pointer">
                                            <RotateCcw size={16} />
                                        </button>
                                        <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 mt-1 ml-9">
                                        <span className="bg-slate-100 px-2 rounded font-mono">{selected.ref}</span>
                                        <span>{selected.category}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Stock Actual</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none">{selected.stock}</p>
                                </div>
                            </div>
                        </div>

                        {stockMsg && (
                            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-3 rounded-xl font-bold text-sm uppercase flex items-center gap-2">
                                <CheckCircle2 size={16} /> {stockMsg}
                            </div>
                        )}

                        {/* Formulario de Entrada */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2">
                                    <Plus size={16} className="text-indigo-600" /> Registrar Nueva Entrada
                                </h3>
                                {onOpenBatchEntry && (
                                    <button 
                                        type="button" 
                                        onClick={() => onOpenBatchEntry(selected.ref.split('-')[0])}
                                        className="text-[11px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                                    >
                                        <Layers size={13} /> Ingreso en Lote de esta Ref
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Cantidad *</label>
                                    <input type="number" min="1" value={qtyIn} onChange={e => setQtyIn(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:border-indigo-500" placeholder="Ej. 10" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Costo Unitario *</label>
                                    <input type="number" min="0" value={newCost} onChange={e => setNewCost(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:border-indigo-500" placeholder="Ej. 25000" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nuevo P. Venta</label>
                                    <input type="number" min="0" value={newPriceSale} onChange={e => setNewPriceSale(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:border-indigo-500" placeholder="Opcional" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Proveedor</label>
                                    <input type="text" value={provider} onChange={e => setProvider(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:border-indigo-500" placeholder="Ej. Medellín" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={paidFromCash} onChange={e => setPaidFromCash(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded" />
                                    <span className="text-xs font-bold text-slate-600">Pagar desde Caja Chica (Egreso automático)</span>
                                </label>

                                <button onClick={handleRestock} disabled={isStocking || !qtyIn || !newCost}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 cursor-pointer">
                                    {isStocking ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                    Registrar Entrada
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white p-6 rounded-[30px] shadow-lg relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
                         <div className="relative z-10">
                           <h2 className="text-2xl font-black uppercase tracking-tight">Historial de Mercancía</h2>
                           <p className="text-indigo-100 text-sm font-medium">Control global de ingresos, costos y proveedores.</p>
                         </div>
                         {onOpenBatchEntry && (
                           <button 
                             onClick={() => onOpenBatchEntry('')}
                             className="relative z-10 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
                           >
                             <Layers size={16} /> + Entrada en Bloque (Lote)
                           </button>
                         )}
                    </div>
                )}

                {/* Listado de Entradas */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-1">
                        <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2">
                            <History size={16} className="text-slate-500" /> {selected ? 'Entradas de este Producto' : 'Últimas Entradas Globales'}
                        </h3>
                        
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} 
                                className="bg-transparent text-[10px] font-black uppercase text-slate-600 outline-none px-2 py-1 cursor-pointer">
                                <option value="dia">Hoy</option>
                                <option value="semana">Semana</option>
                                <option value="mes">Mes</option>
                                <option value="todo">Todo</option>
                                <option value="range">Rango...</option>
                            </select>
                            {filterType === 'range' && (
                                <div className="flex items-center gap-1 border-l pl-2 border-slate-100">
                                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="text-[9px] font-bold outline-none bg-slate-50 rounded p-1" />
                                    <span className="text-slate-300">-</span>
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="text-[9px] font-bold outline-none bg-slate-50 rounded p-1" />
                                </div>
                            )}
                            <button onClick={() => loadHistory(selected?.id)} className="p-1.5 hover:bg-slate-50 rounded-lg text-indigo-500 transition-colors cursor-pointer">
                                <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                        {isLoadingHistory ? (
                             <div className="p-20 text-center"><RefreshCw size={40} className="animate-spin mx-auto text-slate-200 mb-4"/><p className="text-slate-400 font-bold uppercase text-xs">Cargando Historial...</p></div>
                        ) : history.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase">Detalle y Producto</th>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Cant.</th>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">Costo Unit.</th>
                                        <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map(h => (
                                        <tr key={h.id} className={`hover:bg-slate-50 transition-colors group ${h.is_cancelled ? 'opacity-40 grayscale italic' : ''}`}>
                                            <td className="px-5 py-4">
                                                <p className="font-bold text-slate-800 text-sm">{fmtDateTime(h.created_at)}</p>
                                                {!selected ? (
                                                    <button onClick={() => goToProduct(h.product_name)} 
                                                        className="text-[10px] text-indigo-600 font-bold uppercase mt-1 hover:underline flex items-center gap-1 cursor-pointer">
                                                        <Package size={10} /> {h.product_name}
                                                    </button>
                                                ) : (
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
                                                        <Truck size={10} /> {h.provider || 'Sin Proveedor'}
                                                    </p>
                                                )}
                                                {!selected && h.provider && h.provider !== 'S/P' && (
                                                     <p className="text-[9px] text-slate-400 font-medium mt-0.5 italic">Prov: {h.provider}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black ${h.is_cancelled ? 'bg-slate-100 text-slate-400 line-through' : 'bg-indigo-50 text-indigo-700'}`}>
                                                    +{h.quantity}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <p className="font-bold text-slate-800">${fmt(h.unit_cost)}</p>
                                                {h.paid_from_cash && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-black uppercase ml-1">Caja</span>}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {!h.is_cancelled ? (
                                                    <button onClick={() => handleCancelEntry(h.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Anulado</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-16 text-center">
                                <History size={48} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-400 font-bold text-xs uppercase">No hay entradas registradas</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
}
