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

---

## 📌 PRÓXIMOS PASOS
1. **Verificación Operativa en Tienda**: Pruebas continuas de venta en Terminal y recepción de variantes por parte del equipo.
2. **Liquidación Automática de Comisiones y Salarios**: Módulo de corte de comisiones por vendedor para Adriana, Andrés y Tereza.
3. **Cuentas por Pagar a Socios**: Control de deuda acumulada con Cristian y amortización automática desde Flujo de Caja.
4. **Conexión API Pública Web (Astro)**: Exposición de variantes y fotos optimizadas para el e-commerce público.
