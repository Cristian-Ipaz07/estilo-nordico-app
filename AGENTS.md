# JARVIS NODE: ERP ESTILO NÓRDICO (SUB-ARNÉS OPERATIVO)

> **Nodo Satélite de Legion-OS**: Este repositorio es el **ERP Central y Fuente Única de Verdad** del ecosistema de Estilo Nórdico.
> **Comando Maestro**: Legion-OS (`/home/cristian_ipaz/Legion-OS`)
> **Frontend Producción**: https://estilo-nordico-app.vercel.app
> **Backend API Cloud**: https://estilo-nordico-app.onrender.com
> **Base de Datos Cloud**: Supabase PostgreSQL 15 (AWS sa-east-1)
> **Repositorio Cloud**: https://github.com/Cristian-Ipaz07/estilo-nordico-app (rama `dev`)

---

## 1. IDENTIDAD Y ROL
* **Nombre del Agente**: Jarvis (Especialista ERP & Arquitecto Full-Stack).
* **Misión en este Proyecto**: Mantener la estabilidad, integridad transaccional del POS, gestión de inventario, API pública y sincronización omnicanal en tiempo real para la tienda web y el CRM.
* **Stack**: FastAPI (Python 3.11.9), SQLAlchemy 2.0, PostgreSQL 15 (Supabase Session Pooler), React 18 + Vite 5, Tailwind CSS, Supabase Storage.

---

## 2. PROTOCOLO DE PERSISTENCIA Y SINCRONIZACIÓN CON LEGION-OS
**Regla de Oro**: Tras completar cualquier cambio de código, nuevo endpoint, migración de base de datos o decisión de arquitectura:
1. **Actualiza de inmediato `STATUS.md` y `ARQUITECTURA_Y_MAPA_DEPENDENCIAS.md` en la raíz de este proyecto.**
2. **Sincroniza con Legion-OS**: Actualiza `/home/cristian_ipaz/Legion-OS/.agents/projects/estilo_nordico/CONTEXT.md` y `memory.md`.
3. Documenta:
   - Estado de endpoints internos y públicos.
   - Migraciones aplicadas en la base de datos (con cláusula `IF NOT EXISTS` en `main.py`).
   - Cambios en el Catálogo de Asesores, Terminal POS o Desglose de Variantes.
   - Sincronización omnicanal con la Tienda Web (`Web-Estilo-Nordico`).

---

## 3. ARQUITECTURA DEL SISTEMA ERP
* **Backend**: `backend/`
  - Modelos: `app/models/` (Product, Sale, SaleItem, CashMovement, Cut, etc.)
  - Endpoints Internos: `app/api/endpoints/` (auth, products, sales, cash, corte)
  - Endpoints Públicos (Tienda Web): `app/api/endpoints/public.py` (`/api/public/*`)
  - Auto-Migraciones DDL: `backend/main.py` (`run_db_migrations()` con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
* **Frontend**: `frontend/`
  - POS / Terminal de Ventas: `src/components/TerminalModal.jsx` (persistencia en carrito, arqueo exacto por cuentas)
  - Inventario & Variantes: `src/pages/Inventory.jsx`, `src/components/VariantBreakdownModal.jsx` (herencia de `is_published: true`)
  - Catálogo de Asesores: `src/components/AdvisorCatalog.jsx` (cero exposición de costos, Web Share API, enlaces web con `webUrlHelper.js`)
  - Flujo de Caja & Tesorería: `src/pages/CashFlow.jsx` (5 cuentas canónicas, traslados internos sin distorsión P&L)
* **Base de Datos & Storage**:
  - Supabase PostgreSQL: `aws-1-sa-east-1.pooler.supabase.com:5432`
  - Supabase Storage: Bucket público `products` con WebP adaptativo 1200px máx y borrado físico automatizado.

---

## 4. ESTÁNDARES Y BUENAS PRÁCTICAS
* **Preservación Obligatoria de Domicilios en Edición de Ventas**: Si una venta posee `delivery_address` o `sale_channel == 'DOMICILIO'`, `PUT /sales/{id}` y `EditSaleModal` NUNCA deben cambiar su status a `'separado'` ni su canal a `'LOCAL'`. Todo pedido con dirección física debe permanecer en el ciclo de mensajería (`en_domicilio`, `alistado`, `en_camino`).
* **Navegación Interna en SPA con HashRouter**: NUNCA usar `window.location.href = '/ruta'`. Usar siempre `window.location.hash = '#/ruta'` o `navigate('/ruta')` de React Router para prevenir errores 404 en Vercel.
* **Herencia en Cambios de Prenda 1 a 1**: En cambios de variantes de la misma prenda o precio promocional, heredar obligatoriamente `currentItem.price_at_sale` para garantizar diferencia $0. Proveer siempre botón explícito `[Hacer $0]` y advertir en el botón de confirmación si hay excedente a cobrar.
* **Atomicidad en Pagos y Flujo de Caja**: El dinero de caja lee desde `payment_history`. Al eliminar un abono/pago, recalcular en backend `sale.amount_paid = sum(p.amount for p in remaining_payments)` y ajustar `balance_due`. Nunca editar solo la cabecera escalar de `sales`.
* **Filtro Estricto de Ventas Canceladas en Analítica**: Todo reporte, métrica, KPI o ranking en `Dashboard.jsx` y `Reports.jsx` DEBE filtrar `sale.status !== 'cancelado'`. Al cancelar una entrega/venta en backend, forzar `sale.balance_due = 0.0`.
* **Diseño Responsivo en Datos Críticos de Caja**: Identificadores operativos como `Venta #{id}` deben ubicarse siempre a la izquierda (inicio visual) con contenedores flexibles (`flex-wrap`) y nunca truncarse con `overflow-hidden`.
* **Nunca expongas datos sensibles en `/api/public`**: Costos de compra (`my_cost`), proveedores y márgenes deben quedar estrictamente ocultos del schema `ProductPublic`.
* **Herencia Obligatoria de `is_published`**: Toda variante creada en `VariantBreakdownModal.jsx` debe heredar `is_published: baseProduct.is_published !== false`.
* **Auto-Migraciones Idempotentes**: Nunca confiar en `Base.metadata.create_all()` para modificar tablas existentes; registrar siempre `ALTER TABLE ADD COLUMN IF NOT EXISTS` en `run_db_migrations()`.
* **Zero 404s hacia la Web**: Usar siempre `getProductWebUrl(product, selectedColor)` de `webUrlHelper.js` para generar enlaces a la tienda web.
