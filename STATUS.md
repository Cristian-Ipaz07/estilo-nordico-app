# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-15 | Despliegue Cloud Completado al 100% (Supabase + Render + Vercel PWA) y Storage Activo

## 🎯 RESUMEN EJECUTIVO
* **Rol**: Fuente Única de Verdad en la Nube (Inventario Maestro, POS Terminal, Domicilios, Catálogo Asesores, Flujo de Caja & Arqueos, API Pública, Almacenamiento de Fotos).
* **Fase Actual**: Fase 1.5 — Ecosistema Cloud en Producción (100% Operativo, Seguro y de Alta Disponibilidad).
* **Infraestructura Cloud Activa**:
  - **Backend API**: [Render.com](https://estilo-nordico-app.onrender.com) (FastAPI + Python 3.11.9 + Uvicorn) | Status: 🟢 **Live**.
  - **Base de Datos**: [Supabase](https://supabase.com) (PostgreSQL 15 en AWS sa-east-1 vía Session Pooler IPv4:5432) | Status: 🟢 **Conectada**.
  - **Frontend PWA**: [Vercel](https://estilo-nordico-app.vercel.app) (React 18 + Vite 5 + Tailwind) | Status: 🟢 **Operativa e Instalable**.
  - **Almacenamiento de Medios**: Bucket público `products` en Supabase Storage con soporte para fotos transparentes WebP.
* **Inventario Total**: 295 referencias/variantes en Supabase.
  - **131 Referencias Activas con Stock > 0** (visibles en tienda física y virtual).
  - **104 Referencias en Archivo Histórico** (stock 0, reactivables con 1 clic con `+ Retomar`).
* **Turno y Ventas Sincronizadas**:
  - Todas las ventas asentadas hasta el **10 de Octubre** (Ventas #287, #288, #289, #290, #291).
  - Total caja turno acumulada: **$410.000 COP**.
* **Usuarios y Roles Configurados**:
  - `admin`, `cristian`, `david`, `estefania`, `adriana`, `tereza`, `andres` (Roles: Admin, Vendedor, Contador).

---

## 🚀 HITOS IMPLEMENTADOS (SESIÓN 14-15 OCTUBRE)

### 1. Despliegue Completo en la Nube (Cero Costo Fijo)
* **Migración a Supabase**: Volcado y restauración integral de 295 productos, historial de pagos, movimientos de caja y usuarios.
* **Fijación de Python 3.11.9**: Archivos `.python-version` creados para blindar la compatibilidad de SQLAlchemy 2.0 y eliminar conflictos con Python 3.14.
* **Resolución de Red IPv4**: Configuración de `Session pooler` (`aws-1-sa-east-1.pooler.supabase.com:5432`) eliminando el bloqueo de IPv6 (`Network is unreachable`).
* **Frontend en Vercel**: Variable `VITE_API_URL` configurada en modo `Config` (público para el navegador) con auto-deploy conectado a GitHub (`dev`).

### 2. Optimización Extrema de Rendimiento (N+1 Query Elimination)
* **Reducción de Latencia**: La consulta de ventas (`/sales/`) se redujo de **>30 segundos (timeout)** a **1.89 segundos** mediante `selectinload` en `Sale.items`, `SaleItem.product`, `Sale.payment_history` y `Sale.user`.
* **Resiliencia de Conexión**: Configuración de `pool_pre_ping=True` y `pool_recycle=300` en SQLAlchemy para reconexión instantánea sin caídas en conexiones frías.
* **Blindaje de UI**: Manejo de errores en `Dashboard.jsx`, `Sales.jsx` y `LayawayPage.jsx` para evitar pantallas congeladas en "Cargando...".

### 3. Pipeline de Fotos & Supabase Storage
* **Bucket `products`**: Creado y configurado como público en Supabase Storage.
* **Endpoint de Subida**: `POST /products/{product_id}/upload-image` listo para recibir imágenes WebP y asociarlas atómicamente a la prenda en la base de datos.
* **Protocolo de Medios desde `D:`**: Fotos sin fondo procesadas a WebP a 1200px con compresión adaptativa (reducción del 98.9% de peso).

### 4. Protocolo de Depuración y Variantes
* **Plantilla Estandarizada para Gemini**:
  `[Título de la prenda] | [SKU] | [Cantidad física]`
* **Objetivo**: Cruzar existencias físicas reales de la tienda contra el catálogo para eliminar stock fantasma e inyectar las variantes depuradas masivamente.

---

## 📌 PRÓXIMOS PASOS
1. **Recepción de Lotes de Variantes**: Cristian dicta o pega lotes generados por Gemini para inyección directa en Supabase.
2. **Carga de Imágenes**: Subida de fotos limpias sin fondo desde disco `D:` asociadas a cada referencia/variante.
3. **Onboarding de Asesores**: Instalación de la PWA en móviles de vendedores con rol `Vendedor` (costos ocultos automáticamente).
4. **Fase Web (Astro)**: Conectar `src/lib/erpApi.ts` en `Web-Estilo-Nordico` apuntando a `https://estilo-nordico-app.onrender.com/api/public/*`.
5. ⏳ **Automatización de Finanzas & Nómina (Pendiente Prioritario para Fase Siguiente)**:
   - Liquidación automática de comisiones y salarios por corte de ventas.
   - Control y libro de cuentas por pagar a socios (saldo pendiente de Cristian) y empleados (Adriana, Andrés, Tereza).
   - Cruce automático de abonos: cada salida registrada en Flujo de Caja con categoría `SALARIO` o `RETIRO UTILIDADES` descuenta automáticamente de la deuda/saldo pendiente.


### 🚀 Actualización (2026-10-15 16:18): Asignación de Fotos a Variantes y Catálogo de Asesores
- **Asignación de fotos por variante en `VariantBreakdownModal.jsx`**:
  - Cada fila de variante ahora tiene su miniatura de foto.
  - Botón '+ Foto' para subir directo desde el disco (D:) con optimización client-side a WebP (1200px máx, calidad 0.85, transparencia preservada).
  - Selector para vincular con 1 clic fotos ya existentes en la prenda base a cualquier variante.
- **Catálogo de Asesores (`AdvisorCatalog.jsx`) potenciado**:
  - Desglose inteligente de todas las variantes por referencia base.
  - Píldoras de colores interactivas (ej: NEGRO, AZUL, ROJO): al hacer clic en un color, la foto de la tarjeta cambia dinámicamente a la foto exacta de ese color.
  - Visualización de tallas y stock en tiempo real.
  - Botón '🌐 Mirar en Web' y mundito interactivo que redirige directamente a la página del producto publicado en la tienda web (`https://web-estilo-nordico.vercel.app/chaquetas/[slug]`), o a la tienda principal si está en borrador.
  - Generador de Ficha WhatsApp hiper-persuasiva con desglose de tallas disponibles, enlace a la foto y enlace web directo.
- **URLs de imágenes corregidas en Supabase**: Todas las referencias (incluyendo 5080) migradas de `http://localhost:8000` a HTTPS en Render y Supabase Storage.


### 🎯 Actualización (2026-10-15 16:30): Catálogo de Asesores Optimizado & Seguro
- **Eliminación Total de Costo Base**: Protegida la confidencialidad comercial; ningún asesor ni pantalla del catálogo muestra costos internos.
- **Tarjetas Compactas y Estéticas**: Tamaño estándar optimizado (h-48 de foto), sin alargar la pantalla, con badges limpios de stock, talla y tienda web.
- **Ventana Emergente de Ventas (1 Clic en la Tarjeta)**:
  - Al hacer clic en cualquier prenda (ej: 5080), se abre el nuevo **Modal de Asesor**.
  - **Filtro Instantáneo por Talla (S, M, L, XL, XXL, XXXL)**: Si un cliente pregunta *"¿Qué colores hay en talla M?"*, el asesor presiona `M` y el modal muestra al instante solo los colores disponibles en M con su foto y stock.
  - **Filtro por Color**: Permite ver qué tallas quedan de cualquier color.
  - **Ficha WhatsApp Contextual**: Si está filtrado por talla M, genera el mensaje de WhatsApp especificando los colores disponibles en M, enlaces a las fotos y tienda web.
- **Filtro Global por Talla**: En la barra superior del catálogo, el asesor puede filtrar todo el inventario por una talla específica con un solo toque.
