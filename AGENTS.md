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
* **Nunca expongas datos sensibles en `/api/public`**: Costos de compra (`my_cost`), proveedores y márgenes deben quedar estrictamente ocultos del schema `ProductPublic`.
* **Herencia Obligatoria de `is_published`**: Toda variante creada en `VariantBreakdownModal.jsx` debe heredar `is_published: baseProduct.is_published !== false`.
* **Auto-Migraciones Idempotentes**: Nunca confiar en `Base.metadata.create_all()` para modificar tablas existentes; registrar siempre `ALTER TABLE ADD COLUMN IF NOT EXISTS` en `run_db_migrations()`.
* **Zero 404s hacia la Web**: Usar siempre `getProductWebUrl(product, selectedColor)` de `webUrlHelper.js` para generar enlaces a la tienda web.
