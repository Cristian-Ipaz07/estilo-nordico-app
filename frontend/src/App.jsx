import React, { useState, useEffect } from 'react'; // Añadido useEffect
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Wallet, 
  CircleDollarSign, BarChart3, Users, Settings,
  Bell, Search, ChevronDown, Store, Terminal // Añadido Terminal icon
} from 'lucide-react';

// Importación de componentes y páginas
import TerminalModal from './components/TerminalModal'; 
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import LayawayPage from './pages/LayawayPage';
import CashFlow from './pages/CashFlow';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';

import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

const SidebarItem = ({ to, icon: Icon, label, hidden = false }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  if (hidden) return null;
  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

// Rutas protegidas geniales
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/layaway" />;
  return children;
};

// Layout con Terminal Integrado
const Layout = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState("Sucursal Norte");
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const { user, logout } = useAuth();
  
  const isAdmin = user?.role === 'Admin';

  // Lógica de Atajo Ctrl + K para Estilo Nórdico
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsTerminalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-slate-900 text-white p-2 rounded-lg"><Store size={20} /></div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Estilo Nórdico</h1>
          </div>
          <nav className="space-y-1">
            <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" hidden={!isAdmin} />
            <SidebarItem to="/inventory" icon={Package} label="Inventario" />
            <SidebarItem to="/sales" icon={ShoppingCart} label="Ventas" hidden={!isAdmin}/>
            <SidebarItem to="/layaway" icon={Wallet} label="Separados" />
            <SidebarItem to="/cash" icon={CircleDollarSign} label="Caja" hidden={!isAdmin}/>
            <SidebarItem to="/reports" icon={BarChart3} label="Reportes" hidden={!isAdmin}/>
            <SidebarItem to="/users" icon={Users} label="Usuarios" hidden={!isAdmin}/>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-100">
             <button onClick={logout} className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-rose-500 hover:bg-rose-50">
               <span className="font-bold">Cerrar Sesión</span>
             </button>
        </div>
      </aside>

      <main className="flex-1 ml-64">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Buscar SKU, cliente..." className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-slate-900 w-64 transition-all" />
            </div>
            <button className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Store size={16} /> {selectedBranch} <ChevronDown size={14} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* BOTÓN DEL TERMINAL (Nuevo) */}
            <button 
              onClick={() => setIsTerminalOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
              title="Terminal (Ctrl+K)"
            >
              <Terminal size={20} />
            </button>
            
            <button className="text-slate-500 hover:text-slate-900 relative">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-xs font-bold text-slate-400 uppercase">{user?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black">
                 {user?.full_name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>

      {/* RENDER DEL MODAL */}
      <TerminalModal isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
    </div>
  );
};

const AppContent = () => {
    const { user } = useAuth();
    if (!user) return <Login />;

    return (
        <Layout>
            <Routes>
              <Route path="/" element={<ProtectedRoute allowedRoles={['Admin']}><Dashboard /></ProtectedRoute>} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<ProtectedRoute allowedRoles={['Admin']}><Sales /></ProtectedRoute>} />
              <Route path="/layaway" element={<LayawayPage />} />
              <Route path="/cash" element={<ProtectedRoute allowedRoles={['Admin']}><CashFlow /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['Admin']}><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagement /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Layout>
    );
};

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}