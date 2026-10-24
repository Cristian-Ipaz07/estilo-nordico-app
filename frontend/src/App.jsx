import { forceUnlockBodyScroll } from './hooks/useBodyScrollLock';
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, Shirt, ShoppingCart, Wallet, 
  CircleDollarSign, BarChart3, Users, Settings,
  Bell, Search, ChevronDown, Store, Terminal,
  PanelLeftClose, PanelLeftOpen, LogOut, Menu, X
} from 'lucide-react';

// Importación de componentes y páginas
import TerminalModal from './components/TerminalModal';
import DeliveryNotificationsDrawer from './components/DeliveryNotificationsDrawer';
import ScrollToTopButton from './components/ScrollToTopButton'; 
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
import { API_URL } from './config/api';

const SidebarItem = ({ to, icon: Icon, label, hidden = false, isCollapsed = false, onNavigate }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  if (hidden) return null;

  return (
    <Link 
      to={to} 
      onClick={onNavigate}
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

      {/* Tooltip flotante en modo colapsado para Desktop */}
      {isCollapsed && (
        <div className="hidden lg:group-hover:block absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl pointer-events-none z-50 whitespace-nowrap">
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
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/inventory" />;
  return children;
};

// Layout con Sidebar Colapsable, Drawer Móvil y Terminal Integrado
const Layout = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState("Sede Principal (Pasto)");
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTerminalDeliveryMode, setIsTerminalDeliveryMode] = useState(false);
  const [terminalInitialTab, setTerminalInitialTab] = useState(null);
  const [terminalInitialLayawayId, setTerminalInitialLayawayId] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);

  const loadPendingDeliveries = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_URL}/sales/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const pending = data.filter(s => {
            const isDomi = s.sale_channel === 'DOMICILIO' || s.delivery_address || s.status === 'en_domicilio';
            const isActiveStatus = s.status === 'en_domicilio' || s.status === 'por_confirmar' || s.status === 'alistado' || s.status === 'en_camino';
            return isDomi && isActiveStatus;
          });
          setPendingDeliveriesCount(pending.length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPendingDeliveries();
    window.addEventListener('refresh-sales', loadPendingDeliveries);
    const handleOpenDeliveries = () => setIsNotificationsOpen(true);
    window.addEventListener('open-deliveries', handleOpenDeliveries);
    const interval = setInterval(loadPendingDeliveries, 30000);
    return () => {
      window.removeEventListener('refresh-sales', loadPendingDeliveries);
      window.removeEventListener('open-deliveries', handleOpenDeliveries);
      clearInterval(interval);
    };
  }, [loadPendingDeliveries]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Pre-warmer & Keep-Alive para Render Cloud:
  // Despierta el backend al instante y realiza un ping liviano cada 4 minutos
  useEffect(() => {
    const pingCloud = () => {
      fetch(`${API_URL}/products/sync-version`).catch(() => {});
    };
    pingCloud();
    const timer = setInterval(pingCloud, 4 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

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
    const handleOpenTerminal = (e) => {
      if (e?.detail?.tab) setTerminalInitialTab(e.detail.tab);
      else setTerminalInitialTab('ventas');
      if (e?.detail?.layawayId) setTerminalInitialLayawayId(e.detail.layawayId);
      else setTerminalInitialLayawayId(null);
      setIsTerminalDeliveryMode(Boolean(e?.detail?.isDelivery));
      setIsTerminalOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-terminal', handleOpenTerminal);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-terminal', handleOpenTerminal);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden relative">
      {/* Overlay Backdrop para móviles */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Navegación Lateral (Drawer en móviles, Colapsable en Desktop) */}
      <aside 
        className={`
          fixed h-full z-40 bg-white border-r border-slate-200 flex flex-col print:hidden transition-all duration-300 ease-in-out shadow-xl md:shadow-xs overflow-x-hidden
          ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Cabecera del Sidebar */}
        <div className={`p-4 border-b border-slate-100 flex items-center justify-between ${isSidebarCollapsed ? 'md:flex-col md:gap-3 md:justify-center' : ''}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="bg-slate-900 text-white p-2 rounded-xl shrink-0 shadow-sm" title="Estilo Nórdico">
              <Store size={20} />
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <div className="truncate">
                <h1 className="text-base font-black tracking-tight text-slate-900 truncate">Estilo Nórdico</h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sistema POS & Web</span>
              </div>
            )}
          </div>

          {/* Botón cerrar drawer en móviles */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg md:hidden cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Botón colapsar en Desktop */}
          <button 
            onClick={toggleSidebar}
            className="hidden md:block p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isSidebarCollapsed ? "Expandir menú (Ctrl + B)" : "Contraer menú (Ctrl + B)"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Links de Navegación */}
        <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ touchAction: 'pan-y' }}>
          <nav className="space-y-1.5">
            <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
            <SidebarItem to="/inventory" icon={isAdmin ? Package : Shirt} label={isAdmin ? "Inventario" : "Catálogo Asesor"} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
            <SidebarItem to="/sales" icon={ShoppingCart} label="Ventas" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
            <SidebarItem to="/layaway" icon={Wallet} label="Separados" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
            <SidebarItem to="/cash" icon={CircleDollarSign} label="Caja" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
            <SidebarItem to="/reports" icon={BarChart3} label="Finanzas & Corte" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
            <SidebarItem to="/users" icon={Users} label="Usuarios" hidden={!isAdmin} isCollapsed={isSidebarCollapsed} onNavigate={() => setIsMobileMenuOpen(false)} />
          </nav>
        </div>

        {/* Footer: Cerrar Sesión */}
        <div className="mt-auto p-3 border-t border-slate-100 bg-white">
          <button 
            onClick={logout} 
            title={isSidebarCollapsed ? "Cerrar Sesión" : undefined}
            className={`w-full flex items-center rounded-xl transition-all duration-200 text-rose-500 hover:bg-rose-50 group relative cursor-pointer ${
              isSidebarCollapsed ? 'md:justify-center p-3' : 'px-3.5 py-2.5 gap-3'
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="font-bold text-sm">Cerrar Sesión</span>}
            {isSidebarCollapsed && (
              <div className="hidden lg:group-hover:block absolute left-full ml-3 px-2.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-xl pointer-events-none z-50 whitespace-nowrap">
                Cerrar Sesión
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido Principal Adaptable */}
      <main className={`
        flex-1 transition-all duration-300 ease-in-out min-w-0 overflow-x-hidden flex flex-col min-h-screen print:ml-0 print:w-full
        ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} ml-0
      `}>
        {/* Barra Superior Responsive */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            {/* Botón Hamburger en móviles */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-xl md:hidden cursor-pointer"
              title="Abrir menú"
            >
              <Menu size={22} />
            </button>

            {/* Buscador Rápido Ctrl + K */}
            <div className="relative cursor-pointer hidden sm:block" onClick={() => { setIsTerminalDeliveryMode(false); setIsTerminalOpen(true); }}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                readOnly
                placeholder="Buscador Rápido (Ctrl + K)..." 
                className="pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer border-none rounded-full text-xs font-bold text-slate-700 w-48 md:w-64 transition-all outline-none" 
              />
              <span className="hidden md:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                Ctrl+K
              </span>
            </div>

            {/* Selector de Sucursal */}
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="hidden lg:block text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <option value="Sede Principal (Pasto)">🏢 Sede Principal (Pasto)</option>
              <option value="Sucursal Samaniego">🏬 Sucursal Samaniego</option>
            </select>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Botón del Terminal POS (Ctrl+K) */}
            <button 
              onClick={() => setIsTerminalOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Terminal POS (Ctrl+K)"
            >
              <Terminal size={19} />
              <span className="text-xs font-black hidden sm:inline text-indigo-600">POS</span>
            </button>
            
            <button 
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="text-slate-600 hover:text-slate-900 relative p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Domicilios y Pedidos Pendientes"
            >
              <Bell size={19} />
              {pendingDeliveriesCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 bg-rose-600 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
                  {pendingDeliveriesCount}
                </span>
              ) : (
                <span className="absolute top-2 right-2 w-2 h-2 bg-slate-300 rounded-full border border-white"></span>
              )}
            </button>

            {/* Perfil del Usuario */}
            <div className="flex items-center gap-2.5 pl-2 md:pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs md:text-sm font-bold text-slate-900 truncate max-w-[130px]">{user?.full_name}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase">{user?.role} {user?.vendedor_tipo ? `(${user.vendedor_tipo})` : ''}</p>
              </div>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-xs md:text-sm shadow-2xs">
                 {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Vista activa */}
        <div className="p-4 md:p-8 flex-1 flex flex-col min-w-0">
          {children}
        </div>

        {/* Botón flotante para subir rápido */}
        <ScrollToTopButton />
      </main>

      {/* Modal del Terminal POS */}
      {isTerminalOpen && (
        <TerminalModal 
          isOpen={isTerminalOpen} 
          onClose={() => { 
            setIsTerminalOpen(false); 
            setIsTerminalDeliveryMode(false); 
            setTerminalInitialTab(null);
            setTerminalInitialLayawayId(null);
          }} 
          initialDeliveryMode={isTerminalDeliveryMode} 
          initialTab={terminalInitialTab}
          initialLayawayId={terminalInitialLayawayId}
        />
      )}

      {/* Drawer de Notificaciones de Domicilios y Pedidos */}
      <DeliveryNotificationsDrawer 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)}
        onOpenTerminal={() => {
          setIsNotificationsOpen(false);
          setIsTerminalDeliveryMode(true);
          setIsTerminalOpen(true);
        }}
      />
    </div>
  );
};

const AppContent = () => {
    const { user } = useAuth();
    const location = useLocation();

    // Salvaguarda: si cambia de ruta, asegurar que no queden bloqueos de scroll residuales
    useEffect(() => {
      const timer = setTimeout(() => {
        const hasOpenModal = document.querySelector('.fixed.inset-0.z-50, .fixed.inset-0.z-\\[100\\], .fixed.inset-0.z-\\[200\\], .fixed.inset-0.z-60');
        if (!hasOpenModal) {
          forceUnlockBodyScroll();
        }
      }, 50);
      return () => clearTimeout(timer);
    }, [location.pathname]);

    if (!user) return <Login />;
    const isAdmin = user?.role === 'Admin';

    return (
        <Layout>
            <Routes>
              <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to="/inventory" />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<ProtectedRoute allowedRoles={['Admin']}><Sales /></ProtectedRoute>} />
              <Route path="/ventas" element={<Navigate to="/sales" replace />} />
              <Route path="/layaway" element={<ProtectedRoute allowedRoles={['Admin']}><LayawayPage /></ProtectedRoute>} />
              <Route path="/cash" element={<ProtectedRoute allowedRoles={['Admin']}><CashFlow /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['Admin']}><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagement /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to={isAdmin ? "/" : "/inventory"} />} />
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
