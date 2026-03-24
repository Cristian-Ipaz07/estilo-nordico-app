import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Package, UploadCloud, AlertCircle } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  // 3. Filtro de búsqueda
  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.ref?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventario Real</h2>
          <p className="text-slate-500 text-sm">Base de datos de Estilo Nórdico 2026</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Input de archivo oculto */}
          <input 
            type="file" 
            id="excel-upload" 
            className="hidden" 
            onChange={handleFileUpload} 
            accept=".xlsx, .xlsm" 
          />
          <label 
            htmlFor="excel-upload" 
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all active:scale-95"
          >
            <UploadCloud size={16} className="text-blue-600" />
            Importar Excel
          </label>

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

      {/* Barra de Búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por REF o Nombre..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">REF</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Producto</th>
                {/* Nueva Columna */}
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Subcategoría</th> 
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Categoría</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Costo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">P. Venta</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* REF: Limpia y con estilo mono */}
                    <td className="px-6 py-4 text-sm font-mono text-slate-600 font-medium">
                      {p.ref}
                    </td>

                    {/* PRODUCTO: Nombre principal resaltado */}
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {p.name}
                    </td>

                    {/* SUBCATEGORÍA: Ej. Bermuda, Billetera */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {p.subcategory || "-"}
                    </td>

                    {/* CATEGORÍA: Ej. Hombre */}
                    <td className="px-6 py-4 text-sm text-slate-400 italic">
                      {p.category}
                    </td>

                    {/* COSTO: Gris suave para no distraer del precio de venta */}
                    <td className="px-6 py-4 text-sm text-slate-400">
                      ${p.my_cost?.toLocaleString('es-CO')}
                    </td>

                    {/* P. VENTA: Resaltado en verde esmeralda */}
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                      ${p.price_sale?.toLocaleString('es-CO')}
                    </td>

                    {/* STOCK: Con badges de colores según disponibilidad */}
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
                    No se encontraron productos en el inventario.
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