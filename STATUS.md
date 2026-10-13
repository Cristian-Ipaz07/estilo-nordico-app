# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-13 (5:15 PM) | Despiece Ref 5080, Media WebP, Pestañas Activas/Agotadas y Filtros Excel

## 🎯 RESUMEN EJECUTIVO
* **Rol**: Fuente Única de Verdad (Inventario Maestro, POS Terminal, Domicilios, Catálogo Asesores, Flujo de Caja & Arqueos, API Pública, Servidor de Medios).
* **Fase Actual**: Fase 1 — ERP como Núcleo Central (100% Blindada, Optimizada y Conectada a la Web).
* **Inventario Total**: 295 referencias/variantes activas en PostgreSQL (puerto 5432).
  - **131 Referencias Activas con Stock > 0** (visibles por defecto en tienda).
  - **104 Referencias en Archivo Histórico** (stock 0, consultables y reactivables con 1 clic con botón `+ Retomar`).
* **Turno Activo Actual (9 de Octubre en adelante)**:
  - Ventas: #286 ($160k), #287 ($160k), #288 ($60k), Abono Juan Ipaz ($30k). Total caja turno: **$410.000 COP**.
* **Crédito de Capital & Proveedores (8 de Octubre)**:
  - Factura 1 (Proveedor Local): $720.000 pagados 100% con crédito (Saldo: $0).
  - Factura 2 (Euforia Sport Fact 090): $1.003.000 total | Abono: $300.000 con crédito | **Saldo por pagar a Euforia Sport: $703.000**.
  - Total desembolsado del Crédito para compras: **$1.020.000 COP**.

---

## 🚀 HITOS IMPLEMENTADOS Y BLINDADOS (SESIÓN 13 OCTUBRE)

### 1. Gestión Inteligente de Stock (Activas vs Archivo Agotadas)
* **Separación Automática**: Vista filtrada por defecto a **🟢 En Tienda / Activas (131)**, reduciendo un 44% la carga visual de la tabla.
* **Archivo Histórico**: Pestaña **📁 Agotadas / Archivo (104)** para consultar prendas agotadas sin perder precios, costos ni códigos de barra.
* **Acción Rápida `+ Retomar`**: Si vuelve mercancía, 1 clic abre el despiece o edición rápida de stock y tras ingresar >= 1 unidad, la prenda regresa automáticamente a la vista activa.

### 2. Ordenamiento Multinivel Estilo Excel y Subcategorías
* **Orden por defecto**: Categoría (Hombre primero, Mujer segundo) → Subcategoría A-Z → Producto A-Z.
* **Filtros por Columna**: Clic 1 Ascendente, Clic 2 Descendente, Clic 3 Restablece a Orden Excel.
* **Selector Dinámico de Subcategorías**: Dropdown con conteo de prendas activas.

### 3. Despiece y Variantes de Chaqueta 5080 (Impermeable)
* **Total Ingresado**: 20 unidades físicas en físico.
* **16 Variantes Creadas**:
  - The North Face (Negro M/L/XL/XXL, Azul M/XL, Azul Cobalto XL, Beige XXL, Gris Claro XXL, Gris Ratón M/XXL, Rojo XXL, Rojo Franja Lateral M/XL).
  - Columbia (Rojo Franja Lateral L).
  - Gris Claro M.
* **Modal de Variantes Potenciado**: Selector rápido de Marca (`THE NORTH FACE`, `COLUMBIA`), tallas completas hasta `XXXL`, y generación automática de SKU estándar `[REF]-[MARCA]-[COLOR]-[TALLA]`.

### 4. Motor de Medios & Compresión WebP (Servidor Central)
* **Optimización Extrema**: De **52.22 MB** a **0.56 MB** (**98.9% de reducción de peso**).
* **Ruta Estática Activa**: Montada en FastAPI `/static/products/5080/*.webp`.
* **Asociación en Base de Datos**: Galería de 10 fotos asignada al producto base 5080 y cada variante vinculada a su foto exacta según color y diseño.
* **Copia Estática Web**: Sincronizada en `Web-Estilo-Nordico/public/assets/products/5080/`.

### 5. UI/UX, Responsive y Multi-Usuario
* **PWA Móvil**: Sidebar colapsable (solo iconos o expandida con texto), viewport táctil, drawer responsive para smartphones y tablets de vendedores.
* **Módulo de Usuarios**: Gestión de roles (Admin, Vendedor, Contador) y botón para invitar/compartir acceso directo por WhatsApp.
* **Plan Cloud (Vercel + Supabase)**: Arquitectura completa de migración documentada y respaldada en `.memory/DESPLIEGUE_VERCEL_SUPABASE.md` en espera para ejecución cuando el usuario lo determine.

---

## 📌 PRÓXIMOS PASOS
1. Ejecutar Fase 2 en `Web-Estilo-Nordico` (conectar `src/lib/erpApi.ts` al backend y activar carrito multi-prenda para WhatsApp).
2. Probar compras de prueba en la web y verificar micro-chequeo de stock en tiempo real.
3. Configurar seguimiento de abonos pendientes a Euforia Sport ($703.000).
