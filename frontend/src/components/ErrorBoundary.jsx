import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-black">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-slate-900">Algo no cargó correctamente</h2>
            <p className="text-xs text-slate-500 font-medium">
              Ocurrió un detalle al renderizar la vista. Pulsa el botón para recargar o cerrar sesión.
            </p>
            {this.state.error?.message && (
              <p className="text-[10px] font-mono bg-slate-100 p-2.5 rounded-xl text-slate-700 text-left overflow-x-auto">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 cursor-pointer shadow-sm"
              >
                🔄 Recargar App
              </button>
              <button
                onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
