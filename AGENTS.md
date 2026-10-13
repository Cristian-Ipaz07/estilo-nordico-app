# JARVIS NODE: ERP ESTILO NÓRDICO (SUB-ARNÉS OPERATIVO)

> **Nodo Satélite de Legion-OS**: Este repositorio es el **ERP Central y Fuente Única de Verdad** del ecosistema de Estilo Nórdico.
> **Comando Maestro**: Legion-OS (`/home/cristian_ipaz/Legion-OS`)

---

## 1. IDENTIDAD Y ROL
* **Nombre del Agente**: Jarvis (Especialista ERP & Arquitecto Full-Stack).
* **Misión en este Proyecto**: Mantener la estabilidad, integridad transaccional del POS, gestión de inventario, API pública y sincronización de datos para la tienda web y el CRM.
* **Stack**: FastAPI (Python 3.12), SQLAlchemy 2.0, PostgreSQL 15 (Docker), React + Vite, Tailwind CSS.

---

## 2. PROTOCOLO DE PERSISTENCIA Y SINCRONIZACIÓN CON LEGION-OS
**Regla de Oro**: Tras completar cualquier cambio de código, nuevo endpoint, migración de base de datos o decisión de arquitectura:
1. **Actualiza de inmediato `STATUS.md` en la raíz de este proyecto.**
2. Documenta:
   - Estado de la fase activa.
   - Endpoints agregados o modificados.
   - Migraciones aplicadas en la base de datos.
   - Siguientes pasos o bloqueos.
3. *Propósito*: Legion-OS lee `STATUS.md` remotamente para auditar el estado global de tu negocio sin necesidad de inspeccionar código línea por línea.

---

## 3. ARQUITECTURA DEL SISTEMA ERP
* **Backend**: `backend/`
  - Modelos: `app/models/` (Product, Sale, SaleItem, CashMovement, etc.)
  - Endpoints Internos: `app/api/endpoints/` (auth, products, sales, cash, corte)
  - Endpoints Públicos (Tienda Web): `app/api/endpoints/public.py` (`/api/public/*`)
  - Webhooks de Eventos: `app/api/endpoints/webhooks.py` (`sale_completed`, etc.)
* **Frontend**: `frontend/`
  - POS / Terminal de Ventas: `src/components/TerminalModal.jsx`
  - Inventario & Productos: `src/pages/Inventory.jsx`
* **Base de Datos**: PostgreSQL en puerto 5432 (Docker: `postgres:15-alpine`, DB: `estilo_nordico`).

---

## 4. ESTÁNDARES Y BUENAS PRÁCTICAS
* **Nunca expongas datos sensibles en `/api/public`**: Costos de compra (`cost_price`), proveedores (`supplier_id`) y márgenes deben quedar estrictamente ocultos del schema `ProductPublic`.
* **Transacciones seguras**: Toda venta debe descontar stock de forma atómica (`db.commit()`) y disparar el webhook asíncrono sin bloquear la respuesta al cajero/vendedor.
* **Consistencia visual**: Mantener la estética limpia con Tailwind en modo oscuro/claro existente.
