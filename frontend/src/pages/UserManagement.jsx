import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, User as UserIcon, Settings, Plus, X, Lock, Percent, Briefcase,
  Share2, Check, Copy, Search, Globe, Store, MessageCircle, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('TODOS'); // TODOS, VIRTUAL, FISICO, ADMIN, INACTIVO
  const [copiedId, setCopiedId] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = Crear, ID = Editar
  
  const initialForm = { 
    username: '', 
    full_name: '', 
    password: '', 
    role: 'Vendedor', 
    status: 'Activo',
    vendedor_tipo: 'Físico',
    comision_pct: 0
  };
  const [formData, setFormData] = useState(initialForm);

  const { user: currentUser } = useAuth();
  const token = localStorage.getItem('token');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user.id);
      setFormData({
        username: user.username,
        full_name: user.full_name,
        password: '',
        role: user.role,
        status: user.status,
        vendedor_tipo: user.vendedor_tipo || 'Físico',
        comision_pct: user.comision_pct || 0
      });
    } else {
      setEditingUser(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingUser 
      ? `${API_URL}/users/${editingUser}` 
      : `${API_URL}/users/`;
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const payload = { ...formData };
      if (editingUser && !payload.password) delete payload.password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail);
      }
      
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Copiar ficha de acceso lista para enviar por WhatsApp
  const handleCopyWhatsAppInvite = (u) => {
    const appUrl = window.location.origin;
    const tipoLabel = u.vendedor_tipo === 'Virtual' ? 'Asesor(a) Virtual' : 'Atención Tienda Física';
    
    const text = `❄️ *ACCESO AL SISTEMA - ESTILO NÓRDICO* ❄️\n\n` +
      `Hola *${u.full_name}*, aquí tienes tus datos de acceso a la plataforma POS y Catálogo:\n\n` +
      `🔗 *Enlace de Acceso:* ${appUrl}\n` +
      `👤 *Usuario:* \`${u.username}\`\n` +
      `🔑 *Contraseña:* _(la contraseña que te compartió Cristian)_\n` +
      `💼 *Rol:* ${u.role} (${tipoLabel})\n` +
      (u.comision_pct > 0 ? `💰 *Comisión:* ${u.comision_pct}%\n\n` : `\n`) +
      `📲 *¿Cómo instalar la app en tu celular?*\n` +
      `1. Abre el enlace arriba en Google Chrome (Android) o Safari (iPhone).\n` +
      `2. Toca el menú de opciones (los 3 puntos en Android o el botón Compartir en iPhone).\n` +
      `3. Selecciona *"Instalar aplicación"* o *"Agregar a pantalla de inicio"*.\n` +
      `¡Listo! La tendrás como una aplicación en tu celular para consultar inventario y hacer ventas. ✨`;

    navigator.clipboard.writeText(text);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Métricas
  const totalUsers = users.length;
  const activeCount = users.filter(u => u.status === 'Activo').length;
  const virtualCount = users.filter(u => u.vendedor_tipo === 'Virtual').length;
  const fisicoCount = users.filter(u => u.vendedor_tipo === 'Físico').length;
  const adminCount = users.filter(u => u.role === 'Admin').length;

  // Filtrado
  const filteredUsers = useMemo(() => {
    let list = [...users];

    if (filterType === 'VIRTUAL') {
      list = list.filter(u => u.vendedor_tipo === 'Virtual');
    } else if (filterType === 'FISICO') {
      list = list.filter(u => u.vendedor_tipo === 'Físico' && u.role !== 'Admin');
    } else if (filterType === 'ADMIN') {
      list = list.filter(u => u.role === 'Admin');
    } else if (filterType === 'INACTIVO') {
      list = list.filter(u => u.status === 'Inactivo');
    }

    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(u => 
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, filterType, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 flex-1 flex flex-col min-w-0">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestión de Usuarios & Equipo</h2>
          <p className="text-slate-500 text-xs font-semibold">Administra accesos para asesores virtuales, personal de tienda física y comisiones</p>
        </div>
        <button 
          onClick={() => openModal()} 
          className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* Tarjetas de Métricas del Equipo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div 
          onClick={() => setFilterType('TODOS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'TODOS' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${filterType === 'TODOS' ? 'text-slate-400' : 'text-slate-400'}`}>
            Total Equipo
          </p>
          <p className="text-2xl font-black">{totalUsers}</p>
          <p className={`text-[10px] font-bold mt-1 ${filterType === 'TODOS' ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {activeCount} cuentas activas
          </p>
        </div>

        <div 
          onClick={() => setFilterType('VIRTUAL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'VIRTUAL' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white hover:bg-indigo-50/50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black uppercase tracking-wider ${filterType === 'VIRTUAL' ? 'text-indigo-200' : 'text-indigo-600'}`}>
              🌐 Asesores Virtuales
            </span>
          </div>
          <p className="text-2xl font-black">{virtualCount}</p>
          <p className={`text-[10px] font-bold mt-1 ${filterType === 'VIRTUAL' ? 'text-indigo-200' : 'text-slate-400'}`}>
            Ventas remotas & WhatsApp
          </p>
        </div>

        <div 
          onClick={() => setFilterType('FISICO')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'FISICO' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-white hover:bg-blue-50/50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black uppercase tracking-wider ${filterType === 'FISICO' ? 'text-blue-200' : 'text-blue-600'}`}>
              🏬 Tienda Física
            </span>
          </div>
          <p className="text-2xl font-black">{fisicoCount}</p>
          <p className={`text-[10px] font-bold mt-1 ${filterType === 'FISICO' ? 'text-blue-200' : 'text-slate-400'}`}>
            Atención presencial Pasto
          </p>
        </div>

        <div 
          onClick={() => setFilterType('ADMIN')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'ADMIN' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black uppercase tracking-wider ${filterType === 'ADMIN' ? 'text-slate-300' : 'text-slate-500'}`}>
              🛡️ Administradores
            </span>
          </div>
          <p className="text-2xl font-black">{adminCount}</p>
          <p className={`text-[10px] font-bold mt-1 ${filterType === 'ADMIN' ? 'text-slate-300' : 'text-slate-400'}`}>
            Acceso total del sistema
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Píldoras */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o @usuario..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'VIRTUAL', label: 'Virtuales' },
            { id: 'FISICO', label: 'Físicos' },
            { id: 'ADMIN', label: 'Admins' },
            { id: 'INACTIVO', label: 'Inactivos' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                filterType === f.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 text-xs font-black uppercase tracking-wider">
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol & Tipo</th>
                <th className="px-6 py-4 text-center">Comisión</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Compartir / Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-slate-400 text-xs font-bold">
                    Cargando equipo...
                  </td>
                </tr>
              )}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-slate-400 text-xs font-bold">
                    No se encontraron usuarios con los filtros aplicados.
                  </td>
                </tr>
              )}
              {!loading && filteredUsers.map((u) => {
                const isVirtual = u.vendedor_tipo === 'Virtual';
                const isCopied = copiedId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Nombre y Username */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0 ${
                          u.role === 'Admin' ? 'bg-indigo-600 shadow-indigo-100' : isVirtual ? 'bg-sky-600 shadow-sky-100' : 'bg-slate-800'
                        }`}>
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {u.full_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono font-bold uppercase">
                            @{u.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Rol & Tipo */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Shield size={12} className={u.role === 'Admin' ? 'text-indigo-600' : 'text-slate-400'} />
                          <span className="text-xs font-bold text-slate-800">{u.role}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider w-fit px-2 py-0.5 rounded-md ${
                          isVirtual ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isVirtual ? <Globe size={10} /> : <Store size={10} />}
                          {u.vendedor_tipo || 'Físico'}
                        </span>
                      </div>
                    </td>

                    {/* Comisión */}
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg ${
                        u.comision_pct > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {u.comision_pct}%
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        u.status === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {u.status}
                      </span>
                    </td>

                    {/* Acciones & Compartir WhatsApp */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botón WhatsApp */}
                        <button
                          onClick={() => handleCopyWhatsAppInvite(u)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isCopied 
                              ? 'bg-emerald-600 text-white shadow-sm' 
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                          title="Copiar datos de acceso y guía de instalación para enviar por WhatsApp"
                        >
                          {isCopied ? <Check size={14} /> : <MessageCircle size={14} />}
                          <span>{isCopied ? '¡Copiado!' : 'Compartir'}</span>
                        </button>

                        {/* Botón Editar */}
                        <button 
                          onClick={() => openModal(u)} 
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Editar usuario"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Reusable (Crear / Editar) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-base">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Perfil de Acceso y Comisiones</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre Completo *</label>
                  <div className="relative">
                     <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                     <input 
                       required 
                       autoFocus 
                       value={formData.full_name} 
                       onChange={e => setFormData({...formData, full_name: e.target.value})} 
                       placeholder="Ej. Tereza Ipaz"
                       className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all" 
                     />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Username / Login *</label>
                  <input 
                    required 
                    value={formData.username} 
                    disabled={!!editingUser} 
                    onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '')})} 
                    placeholder="Ej. tereza"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-900 disabled:opacity-50" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    {editingUser ? 'Nueva Contraseña' : 'Contraseña *'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input 
                      type="password" 
                      placeholder={editingUser ? "En blanco para mantener" : "••••••••"} 
                      required={!editingUser}
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all" 
                    />
                  </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">% de Comisión</label>
                   <div className="relative">
                      <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        max="100"
                        value={formData.comision_pct} 
                        onChange={e => setFormData({...formData, comision_pct: e.target.value})} 
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all" 
                      />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Rol</label>
                  <select 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="Vendedor">VENDEDOR</option>
                    <option value="Admin">ADMIN</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo</label>
                  <select 
                    value={formData.vendedor_tipo} 
                    onChange={e => setFormData({...formData, vendedor_tipo: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="Físico">FÍSICO</option>
                    <option value="Virtual">VIRTUAL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estado</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})} 
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer ${formData.status === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                  >
                    <option value="Activo">ACTIVO</option>
                    <option value="Inactivo">INACTIVO</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Briefcase size={14} />
                  {editingUser ? 'Guardar Cambios' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
