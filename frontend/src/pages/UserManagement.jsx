import React, { useState, useEffect } from 'react';
import {
  Shield, User as UserIcon, Settings, Plus, X, Lock, Percent, Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
      const res = await fetch('http://localhost:8000/users/', {
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
        password: '', // Password oculto por seguridad
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
      ? `http://localhost:8000/users/${editingUser}` 
      : 'http://localhost:8000/users/';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      // Si estamos editando y el pass está vacío, lo quitamos del envío
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

  const activeCount = users.filter(u => u.status === 'Activo').length;
  const adminCount = users.filter(u => u.role === 'Admin').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Usuarios y Roles</h2>
          <p className="text-slate-500 text-sm">Gestiona quién tiene acceso a la plataforma y sus permisos.</p>
        </div>
        <button onClick={() => openModal()} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 flex items-center gap-2">
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Staff</p>
            <p className="text-2xl font-black text-slate-900">{users.length}</p>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cuentas Activas</p>
            <p className="text-2xl font-black text-emerald-600">{activeCount}</p>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Virtuales / Físicos</p>
            <p className="text-2xl font-black text-slate-700">
               {users.filter(u=>u.vendedor_tipo==='Virtual').length} / {users.filter(u=>u.vendedor_tipo==='Físico').length}
            </p>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Administradores</p>
            <p className="text-2xl font-black text-indigo-600">{adminCount}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-slate-100 bg-white">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Rol / Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Comisión</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-bold">Cargando usuarios...</td></tr>}
              {!loading && users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-sm ${u.role === 'Admin' ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                        {u.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{u.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} className={u.role === 'Admin' ? 'text-indigo-500' : 'text-slate-400'} />
                        <span className="text-xs font-bold text-slate-700">{u.role}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">{u.vendedor_tipo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-md">
                      {u.comision_pct}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.status === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openModal(u)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-900 transition-colors">
                      <Settings size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Reusable (Crear/Editar) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-lg">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Perfil de Acceso y Comisiones</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-white p-2 rounded-xl shadow-sm border border-slate-100 transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre Completo</label>
                  <div className="relative">
                     <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                     <input required autoFocus value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} 
                       className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-[18px] text-sm font-bold text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Username / Login</label>
                  <input required value={formData.username} disabled={!!editingUser} onChange={e => setFormData({...formData, username: e.target.value})} 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-[18px] text-sm font-bold text-slate-800 outline-none focus:border-slate-900 disabled:opacity-50" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="password" placeholder={editingUser ? "Dejar vacío para no cambiar" : "••••••••"} required={!editingUser}
                      value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-[18px] text-sm font-bold text-slate-800 outline-none focus:border-slate-900" />
                  </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">% de Comisión</label>
                   <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input type="number" step="0.1" value={formData.comision_pct} onChange={e => setFormData({...formData, comision_pct: e.target.value})} 
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-[18px] text-sm font-bold text-slate-800 outline-none focus:border-slate-900" />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Rol</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[16px] text-xs font-black text-slate-700 outline-none">
                    <option value="Vendedor">VENDEDOR</option>
                    <option value="Admin">ADMIN</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo</label>
                  <select value={formData.vendedor_tipo} onChange={e => setFormData({...formData, vendedor_tipo: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[16px] text-xs font-black text-slate-700 outline-none">
                    <option value="Físico">FÍSICO</option>
                    <option value="Virtual">VIRTUAL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} 
                    className={`w-full px-4 py-3 border border-slate-200 rounded-[16px] text-xs font-black outline-none ${formData.status === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    <option value="Activo">ACTIVO</option>
                    <option value="Inactivo">INACTIVO</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-3 text-slate-400 font-bold text-sm hover:bg-slate-50 rounded-[18px] transition-all">Cancelar</button>
                <button type="submit" 
                  className="px-8 py-3 bg-slate-900 text-white font-black text-sm rounded-[18px] hover:bg-black shadow-lg shadow-slate-200 transition-all flex items-center gap-2">
                  <Briefcase size={16} />
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
