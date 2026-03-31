import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Package, UploadCloud, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // 1. Función para cargar inventario desde el backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/products/');
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error("Error cargando inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // 2. Función para manejar la subida del Excel
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/products/upload-excel', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("¡Inventario actualizado con éxito desde el Excel!");
        fetchInventory(); // Recargar la tabla
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || "No se pudo procesar el archivo"}`);
      }
    } catch (error) {
      console.error("Error en la subida:", error);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
      event.target.value = null; // Limpiar el input
    }
  };

  // 3. Manejo de Ordenamiento
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 4. Lógica de Filtrado Global y Ordenamiento Optimizado con useMemo
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filtro Global Multicolumna
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(lowerSearch) || 
        p.ref?.toLowerCase().includes(lowerSearch) ||
        p.category?.toLowerCase().includes(lowerSearch) ||
        p.subcategory?.toLowerCase().includes(lowerSearch)
      );
    }

    // Ordenamiento
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        
        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [products, searchTerm, sortConfig]);

  // Icono de flecha según el estado del ordenamiento
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={14} className="opacity-30 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-slate-900" /> 
      : <ChevronDown size={14} className="text-slate-900" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventario Real</h2>
          <p className="text-slate-500 text-sm">Altas capacidades de ordenamiento y filtrado 2026</p>
        </div>
        
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            id="excel-upload" 
            className="hidden" 
            onChange={handleFileUpload} 
            accept=".xlsx, .xlsm" 
          />
          <button 
            onClick={() => document.getElementById('excel-upload').click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all active:scale-95"
          >
            <UploadCloud size={16} className="text-blue-600" />
            Importar Excel
          </button>

          <button 
            onClick={fetchInventory}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda Global */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por REF, Producto, Categoría..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Productos con Sorting */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { label: 'REF', key: 'ref' },
                  { label: 'Producto', key: 'name' },
                  { label: 'Subcategoría', key: 'subcategory' },
                  { label: 'Categoría', key: 'category' },
                  { label: 'Costo', key: 'my_cost' },
                  { label: 'P. Venta', key: 'price_sale' },
                  { label: 'Stock', key: 'stock' }
                ].map((col) => (
                  <th 
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-6 py-4 text-xs font-bold text-slate-400 uppercase cursor-pointer hover:bg-slate-100 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      <SortIcon columnKey={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedProducts.length > 0 ? (
                filteredAndSortedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-mono text-slate-600 font-medium whitespace-nowrap">
                      {p.ref}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {p.subcategory || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 italic">
                      {p.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      ${p.my_cost?.toLocaleString('es-CO')}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                      ${p.price_sale?.toLocaleString('es-CO')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.stock <= 0 ? 'bg-rose-100 text-rose-600' : 
                          p.stock < 5 ? 'bg-amber-100 text-amber-600' : 
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                          {p.stock} un.
                        </span>
                        {p.stock < 3 && <AlertCircle size={14} className="text-rose-500" />}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-400">
                    <Package className="mx-auto mb-2 opacity-20" size={40} />
                    No se encontraron productos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}