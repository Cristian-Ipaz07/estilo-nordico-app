# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-17 | Ecosistema Cloud en Producción + Variantes Avanzadas + POS con Anticipos & Cruces

## 🎯 RESUMEN EJECUTIVO
* **Rol**: Fuente Única de Verdad en la Nube (Inventario Maestro, POS Terminal, Domicilios, Catálogo Asesores, Flujo de Caja & Arqueos, API Pública, Almacenamiento de Fotos).
* **Fase Actual**: Fase 2.0 — Estabilidad Transaccional, Variantes Dinámicas y Control de Caja Físico vs Mayor.
* **Infraestructura Cloud Activa**:
  - **Backend API**: [Render.com](https://estilo-nordico-app.onrender.com) (FastAPI + Python 3.11.9 + Uvicorn) | Status: 🟢 **Live**.
  - **Base de Datos**: [Supabase](https://supabase.com) (PostgreSQL 15 en AWS sa-east-1 vía Session Pooler IPv4:5432) | Status: 🟢 **Conectada**.
  - **Frontend PWA**: [Vercel](https://estilo-nordico-app.vercel.app) (React 18 + Vite 5 + Tailwind) | Status: 🟢 **Operativa e Instalable**.
  - **Almacenamiento de Medios**: Bucket público `products` en Supabase Storage con conversión client-side a WebP 1200px y borrado físico automático.
* **Documentación Maestra**: Ver [ARQUITECTURA_Y_MAPA_DEPENDENCIAS.md](file:///home/cristian_ipaz/proyectos/estilo-nordico-app/ARQUITECTURA_Y_MAPA_DEPENDENCIAS.md) para consultar el mapa de dependencias cruzadas entre el Terminal, Flujo de Caja, Inventario y Reportes.

---

## 🚀 HITOS IMPLEMENTADOS RECIENTEMENTE (SESIÓN 16-17 OCTUBRE)

### 1. Sistema Contable de Anticipos / Preventas y Cruce en POS
* **Categorías Creadas**: `ANTICIPO PREVENTA` (ingreso inicial de dinero sin salida de stock) y `CRUCE ANTICIPO` (entrega de prenda y cierre de venta).
* **Acceso Directo en Terminal**: Botón `+ Anticipo` integrado en el Terminal DIARIO para registrar preventas de prendas sobrepedido o apartados con cliente y celular.
* **Cruce Automático en Checkout**: Al llegar la mercancía y facturar la venta en el Terminal, el vendedor aplica el anticipo con la etiqueta `[ANTICIPO_CRUZADO:X]`.
* **Cálculo Exacto de Utilidad**: Se descuenta el stock real y se computa el costo de mercancía (`my_cost`) para registrar la ganancia exacta, evitando duplicar ingresos de dinero físico en el flujo de caja.

### 2. Blindaje de Caja del Terminal (Mostrador vs Caja Mayor / En Casa)
* **Resolución de Saldo Negativo (-$473.000)**: Se corrigió la mezcla de dineros entre la gaveta de la tienda física y los movimientos de caja mayor o efectivo guardado en casa.
* **Filtro Inteligente en Arqueo**: El Terminal ahora solo toma egresos físicos pagados desde la gaveta del local (incluyendo el adelanto de $85.000 a Andrés) y filtra fuera los movimientos marcados como `(EFECTIVO EN CASA)`, `(CAJA MAYOR)` o transferencias bancarias.
* **Badges Informativos**: Se incorporó indicador visual con la fecha de inicio del turno activo en el Terminal.

### 3. Pipeline WebP y Borrado Físico en Supabase Storage
* **Compresión Client-Side**: Todas las imágenes se redimensionan a máx 1200px y se convierten a WebP con calidad 0.85, manteniendo transparencia alfa (peso promedio 30-70 KB).
* **Limpieza Automatizada de Storage**: Al eliminar un producto o desvincular una foto, el backend ejecuta la eliminación física del archivo `.webp` en el bucket `products` de Supabase Storage para evitar fugas de almacenamiento.

### 4. Gestor Avanzado de Desglose de Variantes (`VariantBreakdownModal.jsx` & `EditVariantModal.jsx`)
* **Marca Dinámica con Búsqueda en Vivo**: Datalist interactivo que compila todas las marcas del catálogo general y de variantes, filtrando conforme el usuario escribe.
* **Campo Opcional de Estampado / Detalle / Letras**: Permite especificar variantes con diseños particulares (ej. `CASUAL`, `LETRAS`, `BORDADA`, `LOGO PEQUEÑO`), integrándolo en SKU (`7647-FRAMENS-CASUAL-AZUL-L`), nombre comercial y descripción.
* **Selector de Color Múltiple (Bicolor / Multicolor hacia la derecha)**: Menú desplegable con botón `+ Añadir` que va concatenando colores hacia la derecha como píldoras (`[ NEGRO ✕ ] [ ROJO ✕ ]`), creando combinaciones como `NEGRO / ROJO` (slug `NEGRO-ROJO`).
* **Asignación de Fotos de la Referencia en 1 Clic**: Galería visual horizontal en la cabecera del formulario que muestra todas las fotos ya subidas a la prenda base o variantes hermanas. Un clic selecciona la foto sin tener que volver a buscarla en el PC.

### 5. Flexibilización Total de Tallas para Accesorios y Correas
* **Talla 100% Opcional**: Eliminado el bloqueo de formulario (`required`) que impedía guardar correas o hebillas sin talla.
* **Detección Automática**: Para correas, hebillas, gorras, relojes, perfumes, billeteras y accesorios, la talla se inicializa vacía.
* **SKU y Nombres Limpios**: Se generan sin sufijos de talla si no aplica (ej. `15265-BOSS-NEGRO`).
* **Pestaña 'ÚNICA' en Entrada en Lote**: Integrada en `BatchStockEntryModal.jsx` para recepción masiva de accesorios.

### 6. UX de Venta Rápida, Depuración del Catálogo y Sincronización Automática en Vivo (`TerminalModal.jsx`)
* **Sincronización Automática Ultraligera en Tiempo Real (Multi-Asesor)**:
  - Nuevo endpoint backend `GET /products/sync-version` que entrega la versión compuesta (último `updated_at`, conteo y max `sale_id`) en ~20ms y solo 40 bytes.
  - El Terminal sondea automáticamente cada 3.5 segundos en segundo plano. Si otro asesor en cualquier celular o computador registra una venta o restock, el terminal se actualiza solo en vivo.
  - **Blindaje de Carrito**: Si otro asesor vende la última unidad de una prenda que tenías en tu carrito, el stock de esa fila en tu pantalla pasa inmediatamente a `0`, la fila se tiñe de rojo y el botón de 'Finalizar Venta' se bloquea para impedir sobreventas.
* **Exclusión de Prendas Base / Agrupadoras con Variantes (ej. `IMPORTADA 7647 con 11 un.`)**:
  - Se detectan los IDs de prendas base que ya fueron desglosadas en variantes hijas (`parentIds`).
  - La prenda matriz padre se descarta del buscador del Terminal para evitar confusiones y ventas sin talla o color. Solo se ofrecen las variantes reales vendibles.
* **Exclusión Total de Productos Agotados en Caja**:
  - Todos los productos con stock físico `0` (como `ESTAMPADO N.N 3706` o `HILO LANA 9004`) o cuyo stock disponible ya fue cargado por completo al carrito actual son omitidos del buscador de ventas para no saturar la pantalla.
* **Buscador Persistente Multi-Producto**: Al hacer clic en un producto para agregarlo al carrito, ya no se borra la búsqueda ni se cierra el menú desplegable. Permite agregar dos o más prendas de una misma búsqueda seguidas sin tener que volver a escribir el texto.
* **Cálculo de Stock Disponible en Tiempo Real**: El buscador descuenta en vivo las unidades que ya se encuentran en el carrito (stockDisponible = stockFisico - unidadesEnCarrito). Si un producto de 1 unidad ya pasó a la caja, se muestra como ✓ En caja · 0 disp. y se deshabilita para evitar sobreventas accidentales.
* **Priorización de Disponibles**: Los productos que todavía tienen stock disponible se ordenan automáticamente en las primeras posiciones del desplegable.
* **Sincronización Multi-Asesor y Multi-Dispositivo**: Polling automático cada 25s, recarga instantánea al regresar a la pestaña del navegador (window.onfocus), y botón visual de refresco rápido (RefreshCw) al lado del buscador para consultar el stock más reciente vendido por otros asesores.
* **Botón de Previsualización Visual Rápida (Hover en PC / Clic en Celular)**: Se integró un botón miniatura inteligente en cada fila del buscador y del carrito.
  - **En PC / Mouse (Hover)**: Al pasar el cursor por encima, despliega una tarjeta flotante ultra nítida al lado del cursor con la foto ampliada, nombre, SKU, color, talla y precio sin estorbar la pantalla.
  - **En Celular / Táctil (Clic)**: Al tocar el botón miniatura, abre un modal emergente interactivo con la foto en alta resolución y un botón para confirmar y 'Agregar a la Caja'.
  - **Aislamiento de Clic**: Usa e.stopPropagation() para que inspeccionar la foto no añada la prenda por error al carrito.
  - **Resolución Inteligente de Foto**: Si una talla específica aún no tiene foto asignada, busca automáticamente en el inventario la foto de su variante hermana con el mismo color o referencia base.
* **Ergonomía de Teclado y Lectores de Barras**: Tecla Enter añade el primer producto disponible con stock, tecla Escape cierra el desplegable, y botón X permite limpiar el buscador en 1 clic.

---

### 7. Sistema Integral de Tesorería Multi-Cuenta y Traslados Internos de Dinero
* **5 Cuentas / Bolsas Canónicas**:
  - `EFECTIVO_TIENDA`: Efectivo Mostrador (Gaveta Local / Tienda)
  - `NEQUI_CRISTIAN`: Nequi Cristian
  - `NEQUI_DAVID`: Nequi David (Hermano)
  - `EFECTIVO_CASA`: Efectivo en Casa (Caja Mayor)
  - `BANCOLOMBIA`: Bancolombia / Cuenta Bancaria
* **Arqueo y Reconciliación del Turno en Terminal POS (`TerminalModal.jsx`)**:
  - El cajón físico de la tienda (`EFECTIVO_TIENDA`) ahora calcula estrictamente billetes y monedas que entran y salen del mostrador, logrando que el dinero contado cuadre al 100%.
  - Se añade un panel dedicado de **Resumen de Cobros Digitales del Turno** (Nequi Cristian, Nequi David, Bancolombia) para que el cajero sepa exactamente cuánto entró en digital sin alterar el efectivo físico del cajón.
* **Cobro Multi-Cuenta y Pagos Divididos en Checkout**:
  - Selector rápido de píldoras para marcar la cuenta de cobro en 1 clic.
  - Soporte de **Pago Dividido / Mixto**: permite fraccionar una venta entre varias cuentas (ej. $50.000 Efectivo + $30.000 Nequi Cristian) con validación automática y desglose detallado en el historial de pagos.
* **Módulo y Endpoint Atómico de Traslados Internos (`POST /cash/transfer` & `TransferModal.jsx`)**:
  - Permite trasladar dinero entre cualquier cuenta (ej. Retiro de cajero Nequi -> Efectivo Tienda o Efectivo Tienda -> Casa).
  - Genera automáticamente un par sincronizado (Salida en origen y Entrada en destino) bajo la categoría `TRASLADO_INTERNO`.
  - Mantiene el patrimonio total del negocio intacto y no distorsiona las ganancias ni gastos operativos de la empresa.
* **Dashboard Global de Tesorería (`CashFlow.jsx`)**:
  - Tira interactiva superior con 6 tarjetas de saldo en tiempo real (las 5 cuentas + Patrimonio Total Disponible).
  - Filtro instantáneo por cuenta con un clic.
  - Columnas enriquecidas con insignias visuales por cuenta y modal de traslados integrado.

---

## 📌 PRÓXIMOS PASOS
1. **Verificación Operativa en Tienda**: Pruebas continuas de venta en Terminal y recepción de variantes por parte del equipo.
2. **Liquidación Automática de Comisiones y Salarios**: Módulo de corte de comisiones por vendedor para Adriana, Andrés y Tereza.
3. **Cuentas por Pagar a Socios**: Control de deuda acumulada con Cristian y amortización automática desde Flujo de Caja.
4. **Conexión API Pública Web (Astro)**: Exposición de variantes y fotos optimizadas para el e-commerce público.
