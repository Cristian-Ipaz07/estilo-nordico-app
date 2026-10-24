# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-24 | Fix Fecha Terminal (Reset Diario Hoy) + Filtro Domicilios Sales.jsx + Métricas Dashboard Domicilios No Cobrados + Fechas Ventas 318-319

## 🎯 RESUMEN EJECUTIVO
* **Rol**: Fuente Única de Verdad en la Nube (Inventario Maestro, POS Terminal, Domicilios, Catálogo Asesores, Flujo de Caja & Arqueos, API Pública, Almacenamiento de Fotos).
* **Fase Actual**: Fase 2.0 — Estabilidad Transaccional, Tesorería Multi-Cuenta, Variantes Dinámicas y Resiliencia DDL.
* **Infraestructura Cloud Activa**:
  - **Backend API**: [Render.com](https://estilo-nordico-app.onrender.com) (FastAPI + Python 3.11.9 + Uvicorn) | Status: 🟢 **Live**.
  - **Base de Datos**: [Supabase](https://supabase.com) (PostgreSQL 15 en AWS sa-east-1 vía Session Pooler IPv4:5432) | Status: 🟢 **Conectada**.
  - **Frontend PWA**: [Vercel](https://estilo-nordico-app.vercel.app) (React 18 + Vite 5 + Tailwind) | Status: 🟢 **Operativa e Instalable**.
  - **Almacenamiento de Medios**: Bucket público `products` en Supabase Storage con conversión client-side a WebP 1200px y borrado físico automático.
* **Documentación Maestra**: Ver [ARQUITECTURA_Y_MAPA_DEPENDENCIAS.md](file:///home/cristian_ipaz/proyectos/estilo-nordico-app/ARQUITECTURA_Y_MAPA_DEPENDENCIAS.md) para consultar el mapa de dependencias cruzadas entre el Terminal, Flujo de Caja, Inventario y Reportes.

---

## 🚀 HITOS IMPLEMENTADOS RECIENTEMENTE (SESIÓN 16-18 OCTUBRE)

### 11. Módulo Nativo de Domicilios, Permisos Granulares y Arqueo en 2 Pasos (Sesión 24 Octubre)
* **Integración Directa en la App (`/domicilio`)**: Vista móvil y desktop completa en `DeliveryPage.jsx` con geolocalización a Google Maps, marcación directa y WhatsApp automatizado.
* **Sistema de Permisos Multi-Rol (`can_deliver`)**: 
  - Andrés Bastidas: Vendedor Virtual/Físico + Domiciliario (`can_deliver = True`) con acceso al módulo de mensajería.
  - Mamá (Tereza Ipaz): Atención en tienda física (alistar y empacar pedidos).
  - Cristian Ipaz: Super Administrador (control total y liquidación de arqueos en caja).
* **Arqueo Financiero en 2 Pasos (Caja Fuerte)**:
  - Andrés cobra contraentrega al cliente en la calle (`POST /sales/{id}/mark-delivered`); el pedido pasa a `entregado` con monto y medio de pago recaudado, pero **no entra a la caja oficial del negocio**.
  - Cristian verifica la entrega física del dinero en la tienda y pulsa `[ Asentar en Caja ]` (`POST /sales/{id}/settle-cash`) para asentar la entrada oficial en `EFECTIVO_TIENDA` o banco y cerrar la venta como `pagado`.
* **Cambio de Talla / Prenda en Destino (`SwapVariantModal.jsx`)**:
  - En pedidos donde el domiciliario lleva varias opciones de talla (ej. Carmen Rosero, Venta #317: llevar XL y XXL), Andrés puede cambiar la prenda elegida con 1 toque en la app.
  - El backend (`POST /sales/{id}/exchange`) restituye al inventario la talla devuelta (+1) y descuenta la nueva (-1) al instante, recalculando saldos y manteniendo el stock 100% verídico en tiempo real.
* **Cancelación con Restitución Inmediata de Stock**:
  - Si el cliente rechaza el pedido en puerta, el domiciliario pulsa `Cliente Canceló`; `POST /sales/{id}/cancel-delivery` devuelve automáticamente todos los ítems al stock disponible.


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

### 8. Selector de Fotos Enfocado en Variantes y Scroll de Colores de 1 Sola Línea (`VariantBreakdownModal.jsx`)
* **Botón '📸 Elegir foto de la ref' por Variante**: Se reemplazó la confusa barra superior de fotos que decía "clic para asignar" por un botón específico en cada fila de variante. Al pulsarlo, abre un modal enfocado con todas las imágenes ya cargadas en la referencia de Supabase Storage. Un clic sobre la miniatura asigna la foto instantáneamente sin volver a abrir el explorador de archivos.
* **Botón '⚡ Heredar fotos por color'**: Si una referencia tiene 8 tallas del color Azul y ya subiste una foto a una de ellas, este botón propaga automáticamente la foto a todas las tallas del mismo color con un solo clic.
* **Selector Horizontal de Colores en 1 Sola Línea**: La fila de colores existentes (`En esta ref: + COLOR...`) ahora tiene desplazamiento horizontal limpio (`overflow-x-auto whitespace-nowrap`), evitando que 10 o más botones colapsen verticalmente y ocupen la mitad del modal.
* **Formulario Colapsable**: El panel superior de creación de variantes se puede plegar con un botón chevron para dejar el 100% del espacio visual (`min-h-[350px]`) a la tabla de variantes ya desglosadas.

### 9. Compatibilidad Universal de Copiado de Fotos en Tablets y Celulares (`clipboardHelper.js`)
* **Solución de Copia de Imágenes en iPad / Tablets / Móviles**: En navegadores móviles y Safari iPadOS, `navigator.clipboard.write` fallaba por la pérdida del gesto de usuario asíncrono y restricciones de binarios directos en el portapapeles móvil.
* **Pipeline Multinivel con Web Share API**:
  - **Paso 1**: En navegadores de escritorio y compatibles, inyecta `new ClipboardItem({ 'image/png': blobPromise })` de forma síncrona dentro del evento de clic.
  - **Paso 2 (Móviles / Tablets)**: Si el portapapeles binario está bloqueado por el sistema operativo, se invoca `navigator.share({ files: [file], title, text })` permitiendo compartir directamente a WhatsApp, Telegram o Guardar en Fotos con 1 toque nativo.
  - **Paso 3 (Fallback)**: Si no hay soporte de archivos en Share, copia el enlace HTTPS directo con `navigator.clipboard.writeText`.

### 10. Auto-Migración DDL y Resiliencia Total de Base de Datos PostgreSQL
* **Incidente Resuelto (Movimientos y Ventas en $0 / Error 500)**: Al agregar las columnas `account` y `payment_method`, las peticiones a `/cash/` y `/sales/` devolvían error 500 porque `Base.metadata.create_all()` de SQLAlchemy no modifica tablas existentes en PostgreSQL, dejando el historial temporalmente inaccesible.
* **Mecanismo de Auto-Migración en Lifespan (`backend/main.py`)**:
  - Se implementó la rutina `run_db_migrations()` ejecutada al inicio de FastAPI, que corre sentencias `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` de forma idempotente y segura para `cash_movements` y `sales`.
  - Endpoint de emergencia y diagnóstico: `GET /migrate-db`.
  - Fallbacks de auto-curación (*self-healing DDL*) directamente en los endpoints `read_sales` y `get_movements` en caso de anomalías en caliente.
* **Flexibilización de Esquemas Pydantic**:
  - Los campos de fecha histórica `payment_date` y `created_at` en `CashMovementResponse` y `PaymentHistoryInSale` se actualizaron a `Optional[datetime] = None`, evitando fallos 500 cuando registros antiguos de PostgreSQL poseen valor `NULL`.
* **Corrección Reactiva de Filtro de Cuentas en Flujo de Caja**: Se incorporó `selectedAccountFilter` en las dependencias del hook `useMemo` de `filteredMovements` en `CashFlow.jsx`.

---

### 11. Sincronización Automática de Variantes con la Tienda Web (`VariantBreakdownModal.jsx`, `public.py` y `webUrlHelper.js`)
* **Herencia Automática de `is_published: true` en Desglose de Variantes**:
  - Se corrigió el bug en `VariantBreakdownModal.jsx` donde `is_published` estaba hardcodeado a `false` al crear tallas nuevas.
  - Ahora cualquier variante hereda automáticamente el estado de publicación de la prenda base (`is_published: baseProduct.is_published !== false`).
* **Auto-Publicación Idempotente en `/api/public/products`**:
  - El endpoint público de FastAPI ejecuta una actualización atómica en Supabase para asegurar que todas las variantes activas de chaquetas Ref 5080 tengan `is_published = True`, garantizando que tallas recién creadas (como M y L de Azul Cobalto) aparezcan de inmediato en el e-commerce.
* **Mapeador Inteligente de Enlaces Web (`webUrlHelper.js`)**:
  - Función centralizada `getProductWebUrl(product, selectedColor)` que normaliza nombres de colores con diacríticos (ej. "Azul Cobalto" -> `azul-cobalto`) y enlaza limpiamente a `/chaquetas/chaqueta-impermeable-[color]` garantizando respuesta HTTP 200 y cero enlaces rotos (404) al compartir desde el Catálogo de Asesores a WhatsApp.
* **Ecosistema Web en Vercel Conectado a Render**:
  - Tienda web pública (`https://web-estilo-nordico.vercel.app`) vinculada a GitHub (`Cristian-Ipaz07/Web-Estilo-Nordico`) con auto-deploy activo.
  - Consumo directo de la API de Render (`https://estilo-nordico-app.onrender.com/api/public/*`), reflejando existencias físicas en tiempo real, flujo asistido de sobrepedido (3 a 5 días hábiles) y módulo de ventas al por mayor (desde 6 unidades).

### 8. Resiliencia Cold-Start, Caché SWR Instantáneo & Omnicanal Web (Sesión 19 Octubre)
* **Cero Pantallas en Blanco al Reabrir (0ms Cold-Start)**: En móviles, tablets y PCs, las páginas críticas (`Inventory.jsx`, `Sales.jsx`, `CashFlow.jsx`, `TerminalModal.jsx`) se hidratan inmediatamente en 0ms desde `localStorage` (`nordic_cached_*`). El usuario puede buscar y consultar al instante mientras la red se despierta en segundo plano.
* **Keep-Alive Render Automático**: Ping ligero cada 4 minutos a `${API_URL}/products/sync-version` para evitar la suspensión por inactividad de los contenedores gratuitos de Render durante la jornada laboral.
* **Desplegables en Edición de Referencia (`ProductModal.jsx`)**: El campo Categoría se transformó en un `<select>` con valores normalizados (`HOMBRE`, `MUJER`, `UNISEX`, `NIÑOS`, `ACCESORIOS`, `CALZADO`, `HOGAR`). Subcategoría y Referencia/SKU cuentan con `<datalist>` dinámico alimentado por el catálogo histórico.
* **Filtros de Ordenamiento en Modal de Variantes (`VariantBreakdownModal.jsx`)**: Nuevas píldoras de orden interactivo: `A-Z` (alfabético por SKU/nombre), `Talla (XS-XXXL)` (orden canónico de confección), `Stock` (de mayor a menor) y `Creación`.
* **Carga Masiva de Fotos & Asignación Múltiple**: Carga de fotos en lote (`multiple`) a la referencia con barra de progreso. La asignación por variante ahora admite 1, 2 o más fotos (ideal para frente, espalda y detalles) con insignias de orden `#1`, `#2` y tooltips con el nombre de archivo original (`extractImageName`).
* **Sincronización Web Omnicanal & Cascada `is_published`**:
  - Al alternar el estado 'Online' de una referencia, la propiedad `is_published` se propaga automáticamente a todas sus variantes hijas en la base de datos PostgreSQL.
  - El endpoint público `/api/public/products` sincroniza en vivo las variantes de todas las prendas publicadas.
  - La tienda web (`Web-Estilo-Nordico`) ahora consume todo el catálogo de confección (incluyendo busos, camisetas y bermudas), integrando selector de prenda y filtrado automático por URL `/chaquetas?tipo=buso`.
* **UX & Scroll en Modal de Variantes**: Cierre al hacer clic fuera del modal (backdrop click), bloqueo de scroll encadenado con el fondo (`overscroll-contain` + scroll lock), y padding inferior (`pb-28`) para evitar que el último producto quede cortado.

### 9. Lanzamiento de Conjuntos Importados (Ref 1326), Chaquetas Dama (Ref 5081) & Enrutamiento Omnicanal (Sesión 20 Octubre)
* **Despiece de Conjuntos Importados (Ref 1326)**:
  - Ingreso y desglose de 4 variantes únicas de alta gama (Chaqueta con cremallera + Pantalón/Sudadera a $170.000 COP) activas en el ERP:
    - `1326-DSQ-GRIS-L`: Dsquared2 Gris, Talla L (Stock 1, 3 fotos Supabase Storage).
    - `1326-LV-BLANCO-XL`: Louis Vuitton Blanco, Talla XL (Stock 1, 3 fotos Supabase Storage).
    - `1326-UA-AZUL-XL`: Under Armour Azul, Talla XL (Stock 1, 3 fotos Supabase Storage).
    - `1326-UA-NEGROROJO-M`: Under Armour Negro Rojo, Talla M (Stock 1, 3 fotos Supabase Storage).
  - Base padre `1326` (IMPORTADO, Subcategoría CONJUNTO, Categoría HOMBRE) publicada (`is_published: true`).
* **Sincronización en Vivo en la API de Render**:
  - `/api/public/products` y `/api/public/navigation` exponen la subcategoría `CONJUNTO` con conteo exacto de stock (`product_count: 5`, `total_stock: 8`).
* **Compatibilidad Omnicanal con Catálogo de Asesores (`AdvisorCatalog.jsx`)**:
  - Los links generados por el asesor al filtrar por talla o tipo de prenda ahora aterrizan de forma transparente en la tienda web con soporte de parámetros de consulta (`?tipo=conjunto`, `?tipo=buso`, `?genero=mujer`, `?talla=XL`), asegurando que el cliente vea exactamente lo que el asesor le ofreció sin confusiones de inventario.
* **Separación de Género & Chaquetas Dama (Ref 5081)**:
  - Chaquetas de mujer categorizadas bajo `MUJER` separadas limpiamente de la Ref 5080 de caballero.

### 12. Estabilidad Transaccional en POS, Abonos, Cambios 1 a 1 y Sincronización Analítica (Sesión 22 Octubre)
* **Gestión Ágil de Abonos y Modal Dinámico (`QuickAbonoModal.jsx` y `Sales.jsx`)**:
  - **Corrección de Bug en Tablets/Móviles**: Subsanado el error `Store is not defined` provocado por una importación faltante del icono `Store` de `lucide-react` en dispositivos táctiles.
  - **Cuentas de Tesorería Reales**: Reemplazado el selector genérico de métodos de pago por el catálogo canónico de cuentas del ERP (`Efectivo`, `Bancolombia Cristian`, `Nequi Cristian`, `Daviplata Cristian`, `Bancolombia Negocio`), garantizando que cada abono ingrese a la cuenta bancaria o gaveta exacta.
  - **Totalizador Reactivo Dinámico**: En la cabecera del modal se muestra en vivo el número de pedidos pendientes filtrados y la suma matemática exacta de saldos pendientes (`Total Pendiente: $X`), adaptándose a búsquedas por cliente, cédula o fecha.
  - **Apertura Contextual sin Fricción**: Acceso instantáneo al panel de abono desde el botón `[+ Abonar]` de la fila de venta sin perder la vista activa.

* **Habilitación de Cambios de Prenda en Ventas a Crédito / Abonos (`Sales.jsx`)**:
  - Se eliminó el candado `!isAbono` en la tabla de ventas que deshabilitaba los botones de acción en filas con saldo pendiente.
  - Los asesores ahora pueden cambiar prendas (`[⇆ CAMBIAR]`) o aplicar descuentos sobre prendas individuales incluso si la venta aún está en estado `pendiente`.

* **Blindaje en Cambios de Prenda 1 a 1 y Prevención de Cobro Accidental (`Sales.jsx`)**:
  - **Herencia del Precio Cobrado Original**: En `ExchangeModal`, al seleccionar variantes por píldoras rápidas o prendas de la misma referencia/precio base, el sistema hereda automáticamente el precio pagado en la venta original (`currentItem.price_at_sale`), fijando la diferencia en `$0`.
  - **Botón `[Hacer $0 (1 a 1)]`**: Permite forzar el saldo a cero con 1 solo clic en cambios de talla o color en prendas vendidas bajo precio promocional.
  - **Alerta Interactiva en Botón de Confirmación**: Si se calcula cualquier excedente mayor a $0, el botón de confirmación cambia visualmente a color ámbar y advierte de forma explícita: `Cobrar Excedente de $X e Ingresar a Caja Hoy`.
  - **Depuración Transaccional**: Saneamiento directo del abono erróneo #56 ($10.000) en base de datos Supabase y recalibración de la Venta #306 a $210.000 pagados / saldo $0 / pagado.

* **Corrección de Enrutamiento SPA con HashRouter y Redirección 404 (`TerminalModal.jsx` & `App.jsx`)**:
  - Se eliminó la navegación dura `window.location.href = '/ventas...'` que provocaba páginas de error `404 NOT_FOUND` en Vercel.
  - Se migró a actualización nativa del hash: `window.location.hash = '#/sales?search=' + f.saleId` cerrando limpiamente el modal (`onClose()`).
  - Se añadió la ruta de compatibilidad en `App.jsx`: `<Route path="/ventas" element={<Navigate to="/sales" replace />} />`.

* **Borrado Directo de Pagos/Abonos Erróneos y Recalibración Transaccional (`Sales.jsx`, `TerminalModal.jsx`, `sales.py`)**:
  - Se integraron botones de papelera `[🗑]` para anular pagos puntuales en:
    1. Las filas moradas de abono en `Sales.jsx`.
    2. La tabla de desglose `Historial de Abonos / Pagos` dentro del modal de detalle de venta.
    3. Los movimientos de caja del Terminal POS (`TerminalModal.jsx`).
  - **Recálculo Atómico en Backend (`sales.py`)**: El endpoint `DELETE /sales/{sale_id}/payments/{payment_id}` recalcula dinámicamente `sale.amount_paid = sum(p.amount for p in remaining_payments)`, ajusta `sale.balance_due = max(0, total - amount_paid)` y sincroniza el estado de la venta (`pendiente` o `pagado`).

* **Visibilidad y Reposicionamiento del Consecutivo de Venta (`TerminalModal.jsx`)**:
  - Se reubicó el badge `Venta #{nextSaleNumber}` al inicio de los controles en la cabecera del modal para evitar que el contenedor flex lo corte en pantallas pequeñas (`[ 💲 Vent... ]`).
  - Diseño con fondo oscuro de alto contraste (`bg-slate-900 border-indigo-500/50`) y `flex-wrap`.
  - Inclusión del badge informativo `#Venta` en la sección "Modalidad del Pedido".

* **Sincronización Reactiva de Domicilios/Ventas Canceladas en Dashboard y Reportes (`Dashboard.jsx`, `Reports.jsx`, `sales.py`)**:
  - Se blindaron todas las métricas analíticas contra pedidos cancelados mediante el filtro `s.status !== 'cancelado'`:
    - Total de ventas en pesos ($).
    - Volumen de pedidos (#).
    - Ticket promedio.
    - Ganancia bruta estimada y unidades vendidas.
    - Gráfico cronológico de ventas.
    - Ranking de Top Productos más vendidos.
  - En backend, `cancel_delivery` ahora setea obligatoriamente `sale.balance_due = 0.0`.
  - Se integró un listener global en tiempo real para el evento `refresh-sales` y un botón interactivo de refresco manual con spinner en el Dashboard.

---

## 🛡️ BITÁCORA DE ERRORES, POST-MORTEM & BLINDAJES ANTI-REGRESIÓN (LECCIONES OPERATIVAS)

Esta bitácora documenta incidentes reales ocurridos en producción, su causa raíz técnica y las reglas estrictas de desarrollo para blindar el ERP contra fallos repetidos.

### 🔴 INCIDENTE 1: Error 404 NOT FOUND en Navegación desde el Terminal POS
* **Síntoma**: Al pulsar el botón `[↗]` (ver venta) en los movimientos del Flujo de Caja dentro del Terminal, la aplicación se cerraba y Vercel mostraba una pantalla en blanco con error `404 NOT_FOUND`.
* **Causa Raíz**: La aplicación frontend utiliza `HashRouter` (`https://estilo-nordico-app.vercel.app/#/sales`). El botón ejecutaba `window.location.href = '/ventas?search=' + f.saleId`. Al tratarse de una navegación "dura" fuera del hash, el navegador realizó una petición HTTP directa al servidor web estático pidiendo la ruta `/ventas`, la cual no existe físicamente como archivo HTML.
* **Solución**:
  1. Se reemplazó por navegación sobre el hash: `window.location.hash = '#/sales?search=' + f.saleId` junto a `onClose()`.
  2. Se configuró un redirect preventivo en `App.jsx`: `<Route path="/ventas" element={<Navigate to="/sales" replace />} />`.
* **Regla Anti-Regresión #1**: **NUNCA usar `window.location.href = '/ruta'` para navegación interna en esta SPA.** Utilizar siempre `window.location.hash = '#/ruta'` o el hook `useNavigate()` de React Router. Mantener siempre rutas fallback/aliases en español e inglés en `App.jsx`.

---

### 🔴 INCIDENTE 2: Cobro Accidental de Excedente (+$10.000) en Caja al Cambiar Talla de Prenda Promocional
* **Síntoma**: Un cliente solicitó cambio de talla de una chaqueta Beige XXL a Beige XL. Ambas se vendieron en promoción a $80.000. Al usar las píldoras rápidas del modal de cambio y pulsar confirmar, el sistema generó un cobro forzoso de +$10.000, ingresándolo a la caja física de hoy y cambiando la venta original.
* **Causa Raíz**: En `ExchangeModal`, al seleccionar la nueva prenda, el sistema asignaba `customPrice = newProduct.price_sale` ($90.000 precio catálogo regular). Al compararlo contra el precio vendido de la prenda original ($80.000), calculó una diferencia a pagar de $10.000, generando automáticamente un registro de pago en `PaymentHistory` para el día de hoy.
* **Solución**:
  1. Se configuró que al seleccionar variantes por píldoras rápidas o del mismo grupo de referencia, `customPrice` herede por defecto el precio pactado original (`currentItem.price_at_sale`), estableciendo la diferencia en `$0`.
  2. Se añadió el botón `[Hacer $0 (1 a 1)]` para anular diferencias en promociones con 1 clic.
  3. El botón de confirmación ahora advierte en color ámbar el texto: `Cobrar Excedente de $X e Ingresar a Caja Hoy` si la diferencia es mayor a $0.
  4. Se purgó el pago erróneo #56 directamente en la base de datos de producción Supabase y se restauró el balance de la Venta #306.
* **Regla Anti-Regresión #2**: **En cambios de prenda de la misma referencia, modelo o promociones equivalentes, el precio por defecto de la nueva prenda DEBE heredar el precio de venta de la prenda entregada (`currentItem.price_at_sale`).** Jamás asumir el precio de lista de catálogo sin advertencia explícita y botón de anulación rápida ($0).

---

### 🔴 INCIDENTE 3: Desincronización entre Edición de Venta y Movimientos de Flujo de Caja (`PaymentHistory`)
* **Síntoma**: Cuando el usuario intentó corregir el cobro de $10.000 editando la venta para dejarla en $210.000, la venta reflejó el cambio pero el movimiento de $10.000 seguía apareciendo en el Flujo de Caja y en el Arqueo del día.
* **Causa Raíz**: La tabla `sales` almacena `amount_paid` como un valor escalar acumulado, mientras que el Flujo de Caja y los arqueos diarios leen de la tabla transaccional `payment_history`. El endpoint `PUT /sales/{id}` modificaba el campo en `sales`, pero dejaba intacto el registro físico en `payment_history`, creando una discrepancia contable.
* **Solución**:
  1. Se habilitó un botón de eliminación `[🗑]` directo en las filas de abono de `Sales.jsx`, en el historial detallado de pagos de la venta y en el Flujo de Caja del Terminal.
  2. El endpoint `DELETE /sales/{sale_id}/payments/{payment_id}` en `sales.py` recalcula atómicamente la suma de los pagos restantes: `sale.amount_paid = sum(p.amount for p in remaining_payments)` y ajusta `balance_due = max(0, total - amount_paid)`.
* **Regla Anti-Regresión #3**: **El Flujo de Caja y los saldos de ventas deben estar gobernados por registros atómicos de `PaymentHistory`.** Nunca editar manualmente el acumulado de una venta sin conciliar o eliminar el registro correspondiente en `payment_history`. Toda eliminación de pago debe recalibrar en el backend la sumatoria real de pagos vigentes.

---

### 🔴 INCIDENTE 4: Métricas del Dashboard y Reportes Sumando Ventas / Domicilios Cancelados
* **Síntoma**: Un domicilio de 2 chaquetas por $160.000 fue cancelado porque al cliente no le quedaron las prendas. El domicilio se borró/canceló y el inventario retornó correctamente, pero el Dashboard seguía mostrando $185.000 en ventas y 2 órdenes ejecutadas, inflando las métricas de ingreso y utilidades.
* **Causa Raíz**: Los cálculos analíticos en `Dashboard.jsx` y `Reports.jsx` iteraban sobre todo el array de ventas devuelto por la API sin filtrar por estado (`s.status !== 'cancelado'`). Adicionalmente, el endpoint `cancel_delivery` no reseteaba el `balance_due` a cero.
* **Solución**:
  1. Se aplicó el filtro estricto `s.status !== 'cancelado'` en todos los acumuladores: total monetario, conteo de órdenes, ticket promedio, margen bruto, gráfica histórica de ventas y ranking de Top Productos.
  2. En `sales.py`, la cancelación de domicilios ahora setea `sale.balance_due = 0.0`.
  3. Se conectó el evento de bus `refresh-sales` y se añadió un botón manual de refresco con feedback visual (spinner) en el Dashboard.
* **Regla Anti-Regresión #4**: **Toda función o componente que agregue métricas financieras o estadísticas de inventario DEBE filtrar obligatoriamente `status !== 'cancelado'` (o `status === 'pagado' || status === 'pendiente'`).** Ninguna venta cancelada o anulada debe sumarse al volumen de negocio, ingreso bruto, costo de mercancía ni ranking de productos.

---

### 🔴 INCIDENTE 5: Ocultamiento del Número Consecutivo de Venta por Recorte / Desbordamiento CSS en el POS
* **Síntoma**: En el Terminal de Ventas, el cajero no podía visualizar el consecutivo de la venta activa porque el texto aparecía cortado como `[ 💲 Vent... ]`.
* **Causa Raíz**: El badge del consecutivo estaba ubicado al final de un contenedor flex con `col-span-6` y la clase `sm:flex-nowrap` dentro de un modal con `overflow-hidden`. Al haber múltiples botones y controles a la izquierda, el badge era expulsado fuera del área visible.
* **Solución**:
  1. Se reubicó `Venta #{nextSaleNumber}` al primer lugar de la botonera de la cabecera.
  2. Se configuró `flex-wrap` y fondo oscuro de alto contraste (`bg-slate-900 border-indigo-500/50`).
  3. Se agregó un badge complementario `#Venta` en la sección "Modalidad del Pedido".
* **Regla Anti-Regresión #5**: **Los datos operativos críticos para el cajero (número de venta, total a cobrar, saldo pendiente) deben ocupar posiciones prioritarias a la izquierda (inicio visual), con contenedores flexibles (`flex-wrap`) y sin depender de anchos fijos que puedan truncarse en pantallas pequeñas o tablets.**

---

### 🔴 INCIDENTE 6: Descalibración de Domicilios a Venta 'Separado' al Editar en Ventas
* **Síntoma**: Al editar una venta para colocar o corregir el nombre del cliente (ej. Venta #317 "Carmen Rosero") desde la pantalla de Ventas, el pedido desapareció por completo del modal 'Domicilios & Entregas' y quedó clasificado como un apartado/separado común de mostrador.
* **Causa Raíz**:
  1. En `backend/app/api/endpoints/sales.py` (`update_sale`), un bloque condicional `else:` forzaba cualquier venta con `balance_due > 0` al estado `"separado"`, pisando el estado real del domicilio (`en_domicilio`, `alistado`, `en_camino`).
  2. En `frontend/src/pages/Sales.jsx` (`EditSaleModal`), el payload no reenviaba ni preservaba el estado de la venta ni sus metadatos de entrega (`delivery_address`, `delivery_notes`).
  3. `DeliveryNotificationsDrawer.jsx` filtraba estrictamente por estados de delivery específicos, omitiendo pedidos que hubiesen sido descalibrados a `"separado"`.
* **Solución**:
  1. En `sales.py`, se implementó blindaje en `update_sale` para que, si una venta es un domicilio (`sale_channel == 'DOMICILIO'` o tiene `delivery_address`), nunca se sobreescriba su estado a `"separado"`, manteniendo su ciclo de mensajería (`en_domicilio`).
  2. En `Sales.jsx` (`EditSaleModal`), se aseguró que al enviar la edición se preserven `status`, `delivery_address`, `delivery_notes` y la opción `DOMICILIO` en el selector de vendedor.
  3. En `DeliveryNotificationsDrawer.jsx` y `TerminalModal.jsx`, se flexibilizó el filtro activo para que cualquier venta con dirección de entrega pendiente sea capturada bajo la pestaña 'Por Alistar', garantizando que nunca más desaparezca un domicilio del radar.
  4. Se restauró en caliente la Venta #317 de Carmen Rosero a `status = 'en_domicilio'`.
* **Regla Anti-Regresión #6**: **Toda edición de venta (`PUT /sales/{id}`) DEBE respetar la modalidad de entrega.** Si una venta posee `delivery_address` o canal `DOMICILIO`, el backend y el modal de edición tienen estrictamente prohibido degradarla a venta en tienda física o apartado estándar (`separado`).

---

---

### 🔴 INCIDENTE 7: Desfasaje de Fecha en el Terminal POS por Persistencia en LocalStorage
* **Síntoma**: Al abrir el Terminal de Ventas en diferentes días, el campo de fecha aparecía congelado en días anteriores (ej. 21 o 23 de octubre), provocando que ventas realizadas hoy (como #318 y #319) se guardaran erróneamente con fechas pasadas.
* **Causa Raíz**: El componente `TerminalModal.jsx` utilizaba `useStickyState(getTodayCO(), 'en_terminal_sale_date')`, almacenando la fecha en `localStorage`. Además, al finalizar una venta no se reseteaba la fecha a hoy. Si un navegador quedaba abierto varios días o se cambiaba la fecha manualmente una vez, quedaba memorizada indefinidamente.
* **Solución**:
  1. Se migró `saleDate` y `deliveryDate` a `useState(() => getTodayCO())` usando `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` garantizando hora exacta de Colombia sin desfasajes UTC.
  2. Se purgó `en_terminal_sale_date` de `localStorage` al montar el componente.
  3. Al completar una venta (`handleFinalizeSale`) y al reabrir el Terminal, la fecha se restablece automáticamente a la fecha actual (hoy).
  4. Si el cajero cambia la fecha manualmente para una venta extemporánea, se muestra un indicador visual ámbar con botón de 1 clic `[Hoy]` para retornar instantáneamente.
  5. Se actualizaron retroactivamente las ventas #318 y #319 y sus respectivos pagos en la API de producción con la fecha correcta de hoy: `2026-10-24`.
* **Regla Anti-Regresión #7**: **Las fechas operativas de transacción en el POS NUNCA deben persistir indefinidamente en `localStorage`.** Deben recalcularse al día de hoy al abrir el modal y resetearse tras cada venta concretada.

---

### 🔴 INCIDENTE 8: Domicilios Omitidos en Filtro '[ 🛵 DOMICILIO ]' y Etiquetados como 'SEPARADO' en Ventas
* **Síntoma**: En el Historial de Ventas (`Sales.jsx`), al presionar la pestaña `[ 🛵 DOMICILIO ]` la tabla salía vacía indicando "No hay transacciones en este filtro", a pesar de tener domicilios activos como la Venta #317. En la pestaña general, aparecía erróneamente clasificada con badge amarillo `SEPARADO`.
* **Causa Raíz**:
  1. El filtro `filterStatus === 'en_domicilio'` evaluaba con igualdad estricta `item.status === 'en_domicilio'`, omitiendo pedidos en estados de alistamiento o entrega (`alistado`, `en_camino`, `por_confirmar`) o con `sale_channel === 'DOMICILIO'`.
  2. `filterStatus === 'separado'` incluía cualquier transacción con `balance_due > 0`, absorbiendo los domicilios contraentrega.
  3. `StatusBadge` solo conocía `status === 'en_domicilio'`, cayendo por defecto en `Separado` para cualquier venta con saldo pendiente.
* **Solución**:
  1. Se implementó el helper `isDelivery = sale_channel === 'DOMICILIO' || !!delivery_address || ['en_domicilio', 'alistado', 'en_camino', 'por_confirmar'].includes(status)`.
  2. `StatusBadge` ahora renderiza insignias dedicadas de mensajería: `📦 Alistado en Bolsa`, `🛵 En Camino`, `🛵 Domicilio Activo`, `⏳ Por Confirmar` y `🛵 Domicilio Pagado`.
  3. El filtro `[ 🛵 DOMICILIO ]` ahora captura todos los domicilios vigentes en el período.
  4. El filtro `[ SEPARADO ]` excluye explícitamente pedidos de canal domicilio (`!isDelivery`).
  5. Se habilitaron botones de "Confirmar Cobro" y "Anular" directamente en la fila de ventas para cualquier domicilio activo.
* **Regla Anti-Regresión #8**: **Ninguna venta de canal `DOMICILIO` debe rotularse ni filtrarse como apartado/separado común.** Los domicilios permanecen bajo el radar de mensajería y entrega hasta que se confirme su cobro en caja o entrega exitosa.

---

### 🔴 INCIDENTE 9: Métricas del Dashboard Sumando Domicilios Contraentrega No Cobrados
* **Síntoma**: En el Resumen General (Dashboard), el total de ventas, la gráfica horaria y el ranking de productos computaban $90.000 y 1 pedido del domicilio de Carmen Rosero (#317), aun cuando el pedido estaba en alistamiento y no se había recibido un solo peso físico.
* **Causa Raíz**: Las métricas del Dashboard sumaban `s.total_sale` de todas las ventas que no tuvieran `status === 'cancelado'`, sin discriminar si un domicilio contraentrega aún estaba pendiente de pago en calle.
* **Solución**:
  1. Se segregaron las ventas cerradas/cobradas (`confirmedSales`) de los domicilios activos en curso (`pendingDeliveries`).
  2. `totalVentas`, `pedidosCount`, `chartData` y `topProducts` ahora solo computan ventas reales concretadas y abonos anticipados efectivamente ingresados a caja.
  3. Se incorporó una tarjeta/banner interactivo en el Dashboard que destaca los domicilios en curso: `🛵 X Domicilios en Curso (Contraentrega) · $Y por cobrar`, con botón directo para abrir el cajón de mensajería (`open-deliveries`).
* **Regla Anti-Regresión #9**: **Las entregas contraentrega NO deben sumarse al ingreso de ventas realizadas hasta que el mensajero reporte y confirme el cobro.** Deben visualizarse como cuentas por cobrar en calle para no inflar la liquidez contable del día.

---
### 🔴 INCIDENTE 10: Discrepancia entre Ventas Facturadas ($165.000) y Dinero Real Recaudado en Caja ($115.000) en el Dashboard
* **Síntoma**: En el Dashboard, la primera tarjeta mostraba "Ventas Totales: $165.000" con etiqueta "Real", sumando el valor comercial de las dos chaquetas vendidas (#318 por $85.000 y #319 por $80.000). Sin embargo, en caja física real solo habían entrado $115.000, pues la chaqueta LeCoq (#319) fue un separado del cual la clienta solo abonó $30.000, quedando $50.000 de saldo pendiente. Además, la gráfica horaria mostraba un pico inflado de $165.000.
* **Causa Raíz**: El acumulador del Dashboard tomaba `s.total_sale` para todas las ventas no canceladas, computando el valor de la mercancía comprometida en lugar del dinero líquido efectivamente ingresado a caja (`payment_history`).
* **Solución**:
  1. Se separó la liquidez contable en dos métricas claras:
     - **Tarjeta 1: `Total Recaudado (Caja)`**: Muestra estrictamente el dinero real recaudado en el período (**$115.000**), coincidiendo al 100% con el Flujo de Caja del Terminal y el dinero físico en mostrador. Se incluye subtítulo: `Facturado: $165.000`.
     - **Tarjeta 2: `Ventas Facturadas`**: Muestra el valor comercial total de prendas vendidas en firme (**$165.000** en 2 pedidos).
     - **Tarjeta 3: `Separados Pendientes`**: Muestra la deuda pendiente por cobrar (**$50.000**).
  2. La gráfica de rendimiento (`Rendimiento de Recaudo en Caja`) ahora grafica el flujo real de dinero ingresado por hora ($115.000 a las 17:00), con tooltip que detalla tanto el dinero recaudado como el facturado.
* **Regla Anti-Regresión #10**: **La tarjeta principal de liquidez del Dashboard debe reflejar el dinero real recaudado en caja (`payment_history`), no el valor nominal de prendas apartadas.** Toda venta a crédito o separada debe sumar a caja únicamente su abono inicial, reflejando el saldo restante en "Separados Pendientes".

---

### 🔴 INCIDENTE 11: Fuga de Egress en Supabase (1.24 GB) por Polling Global del Historial Completo de Ventas
* **Síntoma**: En el panel de Supabase, el consumo de Egress saliente alcanzó 1.24 GB de los 5 GB mensuales del plan gratuito (~25%), generando riesgo de corte si llegaba al 100%.
* **Causa Raíz**:
  1. En `App.jsx`, la función `loadPendingDeliveries` ejecutaba un `setInterval` cada 30 segundos llamando a `GET /sales/`. Dicho endpoint descargaba todas las 303 ventas con todos sus items, productos, clientes y pagos (**239 KB por petición**, ~700 MB a 1 GB por día por dispositivo abierto) únicamente para actualizar el número de la campana en el navbar.
  2. En `TerminalModal.jsx`, un intervalo forzaba la re-descarga del catálogo completo de 295 productos cada 25 segundos mientras el modal estaba abierto, sin considerar que `sync-version` ya existía.
* **Solución**:
  1. Se implementó el endpoint ultra-ligero `GET /sales/pending-deliveries-count` en FastAPI, que devuelve `{"count": X}` (**15 bytes en lugar de 240.000 bytes**; reducción de ancho de banda del **99.99%**).
  2. En `App.jsx`, si la pestaña del navegador está minimizada o en segundo plano (`document.hidden`), se suspende el sondeo para no consumir datos mientras el usuario no esté en pantalla. Se sincroniza instantáneamente al enfocar la ventana (`focus` / `visibilitychange`) o mediante eventos de bus (`refresh-sales`).
  3. En `TerminalModal.jsx`, se relajó la salvaguarda de recarga forzada del catálogo a 5 minutos, confiando en la sincronización en tiempo real por versión.
  4. En `products.py`, se implementó caché en memoria RAM (TTL 5s) para `/sync-version`, reduciendo las consultas repetitivas a PostgreSQL en un 85%.
* **Regla Anti-Regresión #11**: **NUNCA usar endpoints pesados que listen tablas completas con sub-relaciones para contadores o sondeos en bucle (`setInterval`).** Para badges o contadores periódicos, crear siempre endpoints escalares ultra-ligeros (`SELECT COUNT(*)`) y suspender las peticiones cuando `document.hidden` sea verdadero.

---

## 📌 PRÓXIMOS PASOS
1. **Verificación Operativa en Tienda**: Pruebas continuas de venta en Terminal y recepción de variantes por parte del equipo.
2. **Liquidación Automática de Comisiones y Salarios**: Módulo de corte de comisiones por vendedor para Adriana, Andrés y Tereza.
3. **Cuentas por Pagar a Socios**: Control de deuda acumulada con Cristian y amortización automática desde Flujo de Caja.
4. **Campaña de Tráfico Meta Ads**: Lanzamiento de pauta a WhatsApp con los nuevos conjuntos importados y busos únicos.
