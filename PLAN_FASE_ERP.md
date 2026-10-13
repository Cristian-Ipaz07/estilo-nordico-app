# PLAN DE ACCI?N FASE 1: ERP ESTILO N?RDICO (FUENTE ?NICA DE VERDAD)

> **Rol del Agente en esta ventana**: Arquitecto & Desarrollador Full-Stack.
> **Regla de Oro**: CERO REGRESIONES. Los 246 productos existentes, historial de ventas y usuarios en PostgreSQL est?n preservados intactos.
> **Misi?n**: Convertir el ERP en la fuente maestra de cat?logo, POS, control de apartados/domicilios y API p?blica para la web.

---

## 1. CHECKLIST DE EJECUCI?N (ESTADO: 100% COMPLETADO)

### [x] PASO 1: Validar Base de Datos PostgreSQL
- Contenedor activo: `estilo_nordico_db` en puerto 5432 (PostgreSQL 15).
- Respaldo de seguridad creado: `backend/backups/backup_pre_fase1_20261011.sql`.
- 246 productos verificados intactos.

### [x] PASO 2: Ejecutar Migraci?n de Campos Web
- En `backend/`: `python3 migrate_web_fields.py` ejecutado con ?xito.
- Columnas a?adidas: `product_type`, `slug`, `description`, `images`, `is_published`, `notion_sync_id`, `compare_price`, `updated_at`.
- 246 slugs ?nicos autogenerados para productos existentes.

### [x] PASO 3: Levantar y Testear Backend FastAPI
- Servidor FastAPI en ejecuci?n en puerto 8000.
- Endpoints `/api/public/products`, `/categories` y `/stock-check/{id}` operativos.

### [x] PASO 4: Frontend ERP ? Formulario de Productos y Galer?a Web
- Componente `ProductModal.jsx` implementado:
  - Selector de `product_type` (`CHAQUETA`, `PERFUME`, `RELOJ`, `ROPA`, `ACCESORIO`, `OTRO`).
  - Toggle `is_published` ("Mostrar en Tienda Web").
  - Campo `compare_price` (precio antes del descuento para tachar en web).
  - Campo de descripci?n comercial web.
  - Gesti?n visual de galer?a de fotos (URLs).

### [x] PASO 5: M?dulo de Cat?logo para Vendedores (Remplazo de Notion + WhatsApp)
- Pesta?a `Cat?logo Asesores ??` en `Inventory.jsx` v?a `AdvisorCatalog.jsx`:
  - **Filtro por Rol**: Si el usuario es `Vendedor`, costos y m?rgenes se ocultan autom?ticamente.
  - **Tarjetas de Producto**: Foto, tallas/colores disponibles, precio y stock.
  - **Bot?n "?? Copiar Ficha a WhatsApp"**: Genera y copia al portapapeles el texto listo con formato para el cliente.

### [x] PASO 6: Flujo de "Apartado / En Domicilio" (Protecci?n contra doble venta)
- En el POS (`TerminalModal.jsx`): Opci?n "?? Apartar para Domicilio / Contraentrega" con direcci?n y notas.
- Descuenta stock de inmediato para proteger de doble venta en tienda y web.
- Estado `status = 'en_domicilio'`.
- Endpoints:
  - `POST /sales/{id}/confirm-delivery`: Asienta cobro en caja y liquida saldo.
  - `POST /sales/{id}/cancel-delivery`: Si cliente rechaza, devuelve prendas a stock autom?ticamente.

### [x] PASO 7: Prueba End-to-End
- Flujo completo verificado: Venta en domicilio descuenta stock en `/api/public/stock-check/{id}`, y al cancelar se devuelve autom?ticamente al stock sin duplicar saldo.
