import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Wallet, 
  CircleDollarSign, BarChart3, Users, Settings,
  Bell, Search, ChevronDown, Store, Terminal,
  PanelLeftClose, PanelLeftOpen, LogOut
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
import { DateRangeProvider } from './context/DateRangeContext';
import Login from './pages/Login';

const SidebarItem = ({ to, icon: Icon, label, hidden = false, isCollapsed = false }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  if (hidden) return null;

  return (
    <Link 
      to={to} 
      title={isCollapsed ? label : undefined}
      className={`flex items-center rounded-xl transition-all duration-200 group relative ${
        isCollapsed 
          ? 'justify-center p-3' 
          : 'px-3.5 py-2.5 gap-3'
      } ${
        isActive 
          ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
      
      {!isCollapsed && (
        <span className="font-semibold text-sm truncate">{label}</span>
      )}

      {/* Tooltip flotante en modo colapsado */}
      {isCollapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
          {label}
        </div>
      )}
    </Link>
  );
};

// Rutas protegidas
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/layaway" />;
  return children;
};

// Layout con Sidebar Colapsable y Terminal Integrado
const Layout = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState("Sede Principal (Pasto)");
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'Admin';

  // Atajos: Ctrl + K (Terminal) y Ctrl + B (Colapsar Menú)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsTerminalOpen(prev => !prev);
      } else if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    const handleOpenTerminal = () => setIsTerminalOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-terminal', handleOpenTerminal);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-terminal', handleOpenTerminal);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      {/* Sidebar Navegación Lateral */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-slate-200 flex flex-col fixed h-full z-20 print:hidden transition-all duration-300 ease-in-out shadow-xs`}
      >
        {/* Cabecera del Sidebar */}
        <div className={`p-4 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="bg-slate-900 text-white p-2 rounded-xl shrink-0 shadow-sm" title="Estilo Nórdico">
              <Store size={20} />
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <h1 className="text-base font-black tracking-tight text-slate-900 truncate">Estilo Nórdico</h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sistema POS</span>
              </div>
            )}
          </div>

          <button 
            onClick={toggleSidebar}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isSidebarCollapsed ? "Expandir menú (Ctrl + B)" : "Contraer menú (Ctrl + B)"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Links de Navegación */}
        <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
          <nav className="space-y-1.5">
            <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} />
            <SidebarItem to="/inventory" icon={Package} label="Inventario" isCollapsed={isSidebarCollapsed} />
            <SidebarItem to="/sales" icon={ShoppingCart} label="Ventas" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} />
            <SidebarItem to="/layaway" icon={Wallet} label="Separados" isCollapsed={isSidebarCollapsed} />
            <SidebarItem to="/cash" icon={CircleDollarSign} label="Caja" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} />
            <SidebarItem to="/reports" icon={BarChart3} label="Finanzas & Corte" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} />
            <SidebarItem to="/users" icon={Users} label="Usuarios" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} />
          </nav>
        </div>

        {/* Footer: Cerrar Sesión */}
        <div className="mt-auto p-3 border-t border-slate-100 bg-white">
          <button 
            onClick={logout} 
            title={isSidebarCollapsed ? "Cerrar Sesión" : undefined}
            className={`w-full flex items-center rounded-xl transition-all duration-200 text-rose-500 hover:bg-rose-50 group relative cursor-pointer ${
              isSidebarCollapsed ? 'justify-center p-3' : 'px-3.5 py-2.5 gap-3'
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="font-bold text-sm">Cerrar Sesión</span>}
            {isSidebarCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Cerrar Sesión
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className={`flex-1 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300 ease-in-out min-w-0 overflow-x-hidden flex flex-col min-h-screen print:ml-0 print:w-full`}>
        {/* Barra Superior */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 sticky top-0 z-10 print:hidden shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer" onClick={() => setIsTerminalOpen(true)}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                readOnly
                placeholder="Buscador Rápido (Ctrl + K)..." 
                className="pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer border-none rounded-full text-xs font-bold text-slate-700 w-56 md:w-64 transition-all outline-none" 
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                Ctrl+K
              </span>
            </div>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 outline-none cursor-pointer hover:bg-slate-100 transition-colors hidden sm:block"
            >
              <option value="Sede Principal (Pasto)">🏢 Sede Principal (Pasto)</option>
              <option value="Sucursal Samaniego">🏬 Sucursal Samaniego</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón del Terminal */}
            <button 
              onClick={() => setIsTerminalOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
              title="Terminal POS (Ctrl+K)"
            >
              <Terminal size={20} />
            </button>
            
            <button className="text-slate-500 hover:text-slate-900 relative p-2">
              <Bell size={20} />
              <span className="absolute 1 top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-xs font-bold text-slate-400 uppercase">{user?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-sm">
                 {user?.full_name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Vista activa */}
        <div className="p-6 md:p-8 flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </main>

      {/* Modal del Terminal POS */}
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
        <DateRangeProvider>
          <AppContent />
        </DateRangeProvider>
      </AuthProvider>
    </HashRouter>
  );
}
