# MAPA MAESTRO DE ARQUITECTURA, DEPENDENCIAS E IMPACTO CRUZADO (ESTILO NÓRDICO ERP)
> **Documento de Referencia Obligatoria para Desarrolladores y Agentes de IA.**
> Última actualización: Octubre 2026 | Versión 2.0 (Ecosistema Cloud + POS Integral + Variantes Dinámicas)

---

## 🧭 1. FILOSOFÍA DEL SISTEMA Y FUENTE ÚNICA DE VERDAD
El ERP de Estilo Nórdico es un sistema transaccional de alta coherencia. Cada acción realizada en una pantalla (ej. vender una camiseta en el Terminal) produce **efectos en cascada atómicos** sobre múltiples módulos (Inventario, Finanzas, Arqueo de Caja, Reportes y Tienda Web).

### 🛠️ Stack Tecnológico
* **Frontend**: React 18 + Vite 5 + Tailwind CSS + Lucide Icons (PWA instalable alojada en Vercel).
* **Backend API**: FastAPI (Python 3.11.9) + SQLAlchemy 2.0 + Uvicorn (alojado en Render).
* **Base de Datos**: PostgreSQL 15 en Supabase (AWS sa-east-1 vía Session Pooler IPv4:5432).
* **Storage de Medios**: Bucket público `products` en Supabase Storage (conversión automática client-side a WebP 1200px máx con preservación de transparencia alfa).
* **Web Pública**: Astro SSR/SSG conectada a `/api/public/*`.

---

## 🗺️ 2. MAPA DE DEPENDENCIAS Y CONEXIONES (COMPONENTE POR COMPONENTE)

| Módulo / Archivo Frontend | Componentes / Páginas Conectadas | Endpoints Backend Involucrados | Tablas de BD Afectadas | Riesgo de Regresión |
| :--- | :--- | :--- | :--- | :--- |
| **Terminal / POS**<br>`TerminalModal.jsx` | `CashFlow.jsx`<br>`Sales.jsx`<br>`Inventory.jsx`<br>`Reports.jsx` | `POST /sales/`<br>`GET /cash/`<br>`POST /cash/`<br>`GET /corte/current`<br>`POST /corte/close` | `sales`<br>`sale_items`<br>`products`<br>`cash_movements`<br>`cuts` | 🔴 **CRÍTICO** |
| **Inventario & Productos**<br>`Inventory.jsx`<br>`ProductModal.jsx` | `VariantBreakdownModal`<br>`AdvisorCatalog.jsx`<br>`TerminalModal.jsx`<br>Tienda Web Pública | `GET /products/`<br>`POST /products/`<br>`PUT /products/{id}`<br>`DELETE /products/{id}`<br>`POST /products/{id}/upload-image` | `products`<br>Supabase Storage (`products` bucket) | 🔴 **CRÍTICO** |
| **Desglose de Variantes**<br>`VariantBreakdownModal.jsx`<br>`EditVariantModal.jsx` | `Inventory.jsx`<br>`AdvisorCatalog.jsx`<br>`TerminalModal.jsx` | `POST /products/`<br>`PUT /products/{id}`<br>`DELETE /products/{id}`<br>`POST /products/{id}/upload-image` | `products`<br>Supabase Storage | 🟡 **ALTO** |
| **Recepción en Bloque**<br>`BatchStockEntryModal.jsx` | `Inventory.jsx`<br>`CashFlow.jsx`<br>`Reports.jsx` | `POST /products/batch-stock-entry` | `products`<br>`stock_entries`<br>`cash_movements` | 🔴 **CRÍTICO** |
| **Flujo de Caja**<br>`CashFlow.jsx` | `TerminalModal.jsx`<br>`Reports.jsx` | `GET /cash/`<br>`POST /cash/`<br>`DELETE /cash/{id}` | `cash_movements` | 🟡 **ALTO** |
| **Ventas & Domicilios**<br>`Sales.jsx`<br>`LayawayPage.jsx` | `TerminalModal.jsx`<br>`Inventory.jsx`<br>`CashFlow.jsx` | `GET /sales/`<br>`PUT /sales/{id}`<br>`DELETE /sales/{id}` | `sales`<br>`sale_items`<br>`products`<br>`cash_movements` | 🔴 **CRÍTICO** |
| **Catálogo de Asesores**<br>`AdvisorCatalog.jsx` | `Inventory.jsx`<br>WhatsApp Asesores<br>Web Externa | `GET /products/` | `products` (solo lectura) | 🟢 **MEDIO** |
| **Reportes & Métricas**<br>`Reports.jsx`<br>`Dashboard.jsx` | Todos los módulos de venta y caja | `GET /sales/`<br>`GET /cash/`<br>`GET /products/` | Solo lectura y agregación analítica | 🟢 **MEDIO** |

---

## ⚡ 3. MATRIZ DE IMPACTO CRUZADO: "SI MODIFICO X, ¿DÓNDE MÁS DEBO REVISAR?"

### 1. SI EDITAS EL TERMINAL / POS (`TerminalModal.jsx`)
Cualquier cambio en el terminal impacta **4 áreas vitales** del negocio:
* ⚠️ **Impacto en Inventario (`products`)**: 
  - Toda venta debe descontar las unidades de cada variante de forma atómica (`stock = stock - qty`).
  - Si una venta se cancela o edita, las unidades deben reponerse exactamente al producto correspondiente.
* ⚠️ **Impacto en Arqueo de Caja y Flujo (`CashFlow.jsx`, `cuts`)**:
  - El dinero cobrado en Efectivo entra a la caja del turno activo.
  - **REGLA DE CAJA MOSTRADOR**: Solo los egresos físicos pagados desde la gaveta del local (ej. adelanto de viáticos, tintos, compras menores de tienda) deben descontar del Arqueo Diario del Terminal.
  - **Filtro de exclusión obligatorio**: Movimientos de `(EFECTIVO EN CASA)`, `(CAJA MAYOR)` o transferencias bancarias directas **NO** deben restar de la gaveta física del mostrador (de lo contrario la caja física da valores negativos absurdos como -$473.000).
* ⚠️ **Impacto en Buscador y Carrito del Terminal (Stock en Vivo)**:
  - **Buscador Persistente**: Al agregar un ítem al carrito (ddToCart), jamás se debe limpiar search ni cerrar el dropdown automáticamente. Esto permite agregar 2 o más prendas de una misma búsqueda sin interrupción.
  - **Descuento de Stock en Carrito**: El buscador calcula stockDisponible = stockFisico - unidadesEnCarrito. Si una prenda tiene 1 unidad y ya pasó al carrito, se muestra ✓ En caja · 0 disp. y se deshabilita para evitar sobreventas accidentales.
  - **Botón de Previsualización de Imagen**: Miniatura en buscador y carrito con hover en PC (tarjeta flotante sin clics) y clic/tap en móvil (modal interactivo con confirmación de compra y e.stopPropagation()).
  - **Sincronización Multi-Asesor**: Polling periódico cada 25s, actualización automática al retomar el foco del navegador (window.onfocus) y botón manual de sincronización para refrescar el stock vendido por otros asesores.
* ⚠️ **Impacto en Anticipos / Preventas (`ANTICIPO PREVENTA` vs `CRUCE ANTICIPO`)**:
  - Al recibir un anticipo: Se registra el ingreso de dinero en `cash_movements` (Categoría `ANTICIPO PREVENTA`).
  - Al entregar la prenda y cruzar el anticipo en el checkout: Se utiliza la categoría `CRUCE ANTICIPO` con tag `[ANTICIPO_CRUZADO:X]`. 
  - **Regla contable**: `CRUCE ANTICIPO` nunca suma dinero físico nuevo en efectivo, pero sí registra el costo de la mercancía (`my_cost`) para que la utilidad neta sea matemáticamente exacta.
* ⚠️ **Impacto en Reportes (`Reports.jsx`)**:
  - Las ventas cruzadas con anticipos no deben duplicar los ingresos brutos en los gráficos de ventas diarias.

---

### 2. SI EDITAS PRODUCTOS, VARIANTES O SKUs (`Inventory.jsx`, `VariantBreakdownModal.jsx`, `EditVariantModal.jsx`)
* ⚠️ **Estructura Estándar del SKU**:
  - Formato Maestro: `[REF_BASE]-[MARCA?]-[DETALLE?]-[COLOR]-[TALLA?]`
  - Ejemplos:
    - Prenda con marca y detalle: `7647-FRAMENS-CASUAL-AZUL-L`
    - Prenda bicolor: `5080-THE-NORTH-FACE-NEGRO-ROJO-XL`
    - Accesorio o correa sin talla: `15265-BOSS-NEGRO` (¡Nunca forzar sufijos ficticios de talla si no aplica!)
    - Prenda estándar propia: `5080-AZUL-M`
* ⚠️ **Regla de Marcas 'ESTILO NÓRDICO'**:
  - Si la marca es la propia de la tienda (`Estilo Nórdico`), no se inserta slug redundante en el SKU para mantener los códigos de barras cortos y legibles.
* ⚠️ **Fotos de Variantes & Supabase Storage**:
  - Toda imagen subida se procesa primero en el cliente mediante `optimizeImageToWebP` (máx 1200px, WebP ~40KB, fondo transparente preservado).
  - Al borrar un producto (`DELETE /products/{id}`) o una imagen (`DELETE /products/{id}/images`), el backend ejecuta el **borrado físico automático** en el bucket de Supabase Storage para no acumular basura ni costos de almacenamiento.
* ⚠️ **Productos sin Talla**:
  - Accesorios, correas, hebillas, gorras, relojes, perfumes, billeteras, lociones y gafas **no deben tener el atributo `required` en talla**.
  - Al crear o editar, el SKU y el nombre deben omitir la talla limpiamente si el usuario la deja vacía.

---

### 3. SI EDITAS RECEPCIÓN DE PEDIDOS Y ENTRADA EN BLOQUE (`BatchStockEntryModal.jsx`)
* ⚠️ **Cálculo de Costo Unitario Promedio Ponderado (Landed Cost)**:
  - `Costo Unitario Real = (Factura Total + Flete) / Cantidad Total de Unidades Recibidas`.
  - Este costo actualiza `my_cost` y `cost_total` en `products` y genera una fila de auditoría en `stock_entries`.
* ⚠️ **Pago desde Caja Chica**:
  - Si el checkbox `paid_from_cash` está desactivado, el costo del pedido **NO** se descuenta de la caja menor del mostrador (se asume pagado por transferencia o caja mayor de socios).
* ⚠️ **Compatibilidad de Tallas**:
  - Soporta letras (`S - XXXL`), números (`28 - 38`) y **`ÚNICA`** para accesorios.

---

### 4. SI EDITAS EL CATÁLOGO DE ASESORES (`AdvisorCatalog.jsx`)
* ⚠️ **Seguridad Comercial (Zero Cost Exposure)**:
  - Ningún asesor o usuario con rol `Vendedor` debe ver `my_cost` ni márgenes brutos.
  - El catálogo de asesores solo muestra: Precio de Venta, Fotos dinámicas por color, Tallas disponibles con stock real, y enlaces de venta.
* ⚠️ **Interacción Foto - Color**:
  - Al hacer clic en un color de la tarjeta, la foto principal debe cambiar de inmediato a la foto asociada a esa variante específica.
* ⚠️ **Generador de Mensajes WhatsApp**:
  - El texto generado debe ser persuasivo, listar las tallas reales en stock y contener el enlace a la foto o tienda web.

---

### 5. SI EDITAS REPORTES O MÉTRICAS FINANCIERAS (`Reports.jsx`, `Dashboard.jsx`)
* ⚠️ **Fórmula de Ganancia Neta Real**:
  - `Ganancia Bruta = Suma(Precio Venta - Mi Costo Unitario)` de los ítems vendidos.
  - `Utilidad Neta = Ganancia Bruta - Gastos Operativos de Tienda (Flujo de Caja)`.
* ⚠️ **Separación por Métodos de Pago**:
  - Distinguir siempre: **Efectivo Físico**, **Transferencias (Bancolombia, Nequi, Daviplata)** y **Domicilios Pendientes de Cobro**.

---

## 🛡️ 4. CHECKLIST OBLIGATORIO ANTES DE CONFIRMAR CUALQUIER CAMBIO

Antes de confirmar cualquier commit o dar por terminada una tarea en el ERP:
1. [ ] **¿Rompí algún SKU o cálculo de stock?** Verificar que las variantes creadas generen SKUs válidos y que las ventas descuenten stock.
2. [ ] **¿Afecté la caja física del Terminal?** Asegurarse de que los egresos de caja mayor o transferencias sigan filtrados fuera del arqueo diario del mostrador.
3. [ ] **¿Validé productos con y sin talla?** Comprobar que tanto ropa (S-XXXL) como correas/accesorios puedan crearse y editarse sin errores.
4. [ ] **¿Preservé la calidad WebP y limpieza de fotos?** Asegurarse de que no se suban archivos pesados sin compresión y que las imágenes se puedan asociar en 1 clic.
5. [ ] **¿Se mantuvo la seguridad de costos en el Catálogo de Asesores?** Verificar que ningún asesor tenga visibilidad de costos de compra.
6. [ ] **¿Ejecuté `npm run build` en frontend?** Confirmar que no hay errores de sintaxis JSX, imports rotos ni warnings de empaquetado.
7. [ ] **¿El backend responde en FastAPI sin errores 422/500?** Confirmar schemas Pydantic y migraciones de modelos.
8. [ ] **¿Actualicé `STATUS.md`?** Registrar los cambios realizados para que todo el equipo y agentes tengan trazabilidad inmediata.

---
*Este documento es el estándar maestro de ingeniería de Estilo Nórdico. Consúltalo siempre antes de tocar cualquier lógica central.*

---

## 8. CONTROL DE TESORERÍA, MULTI-CUENTAS Y TRASLADOS DE DINERO (BOLSA POR CUENTA)

### 8.1 Las 5 Bolsas Canónicas de Dinero
Toda entrada, salida, venta, abono o transferencia en Estilo Nórdico queda asignada a una cuenta contable canónica:
1. `EFECTIVO_TIENDA`: Billetes y monedas físicas dentro de la gaveta / cajón del local comercial.
2. `NEQUI_CRISTIAN`: Dinero digital recaudado en la cuenta de Nequi de Cristian.
3. `NEQUI_DAVID`: Dinero digital recaudado en la cuenta de Nequi de David (hermano).
4. `EFECTIVO_CASA`: Efectivo guardado en casa (Caja Mayor para pagos grandes o reinversión).
5. `BANCOLOMBIA`: Cuentas corrientes/ahorros o transferencias bancarias de Bancolombia.

### 8.2 Principio de No-Distorsión en Traslados Internos (`POST /cash/transfer`)
* Cuando se hace un retiro de Nequi para meter dinero físico a la gaveta (`NEQUI_CRISTIAN -> EFECTIVO_TIENDA`), o cuando se lleva dinero de la tienda a la casa (`EFECTIVO_TIENDA -> EFECTIVO_CASA`):
  - Se genera un registro de `SALIDA` en la cuenta origen.
  - Se genera un registro de `ENTRADA` en la cuenta destino.
  - Ambas transacciones llevan la categoría `TRASLADO_INTERNO`.
  - El patrimonio neto del negocio tiene una variación neta de `$0`.
  - En los informes de pérdidas y ganancias (P&L), los traslados están excluidos de las ventas operativas y de los gastos operativos.

### 8.3 Aislamiento del Turno del Terminal (`ModuloCaja`):
* El cálculo de `totalEnCajon` del turno físico:
  $$	ext{Total en Cajón} = 	ext{Base Fija} + (	ext{Entradas EFECTIVO\_TIENDA} - 	ext{Salidas EFECTIVO\_TIENDA})$$
* Los cobros recibidos por Nequi Cristian, Nequi David o Bancolombia se listan en el bloque "Cobros Digitales del Turno" y **NO** se suman a los billetes físicos del mostrador, garantizando un arqueo físico 100% exacto al contar la gaveta al final del día.
