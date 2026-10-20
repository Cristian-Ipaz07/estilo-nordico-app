# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-19 | Resiliencia Cold-Start (SWR Instantáneo) + Variantes Avanzadas + Multi-Fotos + Omnicanal Web

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

## 📌 PRÓXIMOS PASOS
1. **Verificación Operativa en Tienda**: Pruebas continuas de venta en Terminal y recepción de variantes por parte del equipo.
2. **Liquidación Automática de Comisiones y Salarios**: Módulo de corte de comisiones por vendedor para Adriana, Andrés y Tereza.
3. **Cuentas por Pagar a Socios**: Control de deuda acumulada con Cristian y amortización automática desde Flujo de Caja.
4. **Campaña de Tráfico Meta Ads**: Lanzamiento de pauta a WhatsApp con los nuevos conjuntos importados y busos únicos.
