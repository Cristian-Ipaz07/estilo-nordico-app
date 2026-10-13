# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-13 (Jornada Mañana) | Cuadre 100% Corte 6-8 Octubre + Integración de Abonos a Separados en Ventas

## 🎯 RESUMEN EJECUTIVO
* **Rol**: Fuente Única de Verdad (Inventario Maestro, POS Terminal, Domicilios, Catálogo Asesores, Flujo de Caja & Arqueos, API Pública).
* **Fase Actual**: Fase 1 — ERP como Núcleo Central (100% Completada, Probada y Blindada).
* **Estado Base de Datos**: 254 productos/variantes en PostgreSQL (puerto 5432) con slugs únicos.
* **Saldo Inicial de Corte (Excel)**: Calibrado exactamente en **$215.900 COP** al 5 de Octubre 23:59:59.
* **Turno Cerrado (6 al 8 de Octubre)**: Ventas: $850.000 | Gastos: $95.000 | Guardado/Retirado: $755.000 | Base fija: $150.000 (100% auditado y cuadrado con cuaderno físico).
* **Turno Activo Actual (9 de Octubre en adelante)**:
  - Venta #286 (09/10): $160.000
  - Venta #287 (10/10): $160.000
  - Venta #288 (10/10): $60.000
  - Abono #44 (10/10 - Juan Ipaz a Separado #270): $30.000
  - **Total acumulado en caja turno activo**: **$410.000 COP**.
* **Regla de Operación**: Cero regresiones lograda y validada al 100%.

---

## 🛠️ HITOS RECIENTES COMPLETADOS & VERIFICADOS (13 OCTUBRE 2026)

### 1. Integración de Abonos a Separados en el Módulo de Ventas (`Sales.jsx`)
- [x] **Cuadre 1 a 1 de Dinero en Caja vs. Pantalla de Ventas**:
  - `Total Recaudado (Caja)` ahora consolida tanto las ventas de contado como los abonos recibidos en el período seleccionado.
  - Se añade indicador visual en tarjeta: *"Incluye $X en abonos a separados"*.
- [x] **Aislamiento Contable de Mercancía (`Ventas Totales`)**:
  - `Ventas Totales` suma únicamente las prendas nuevas facturadas en el período, evitando duplicar ventas cuando un cliente paga cuotas de un separado creado en fechas previas.
- [x] **Filas Distintivas de Abono**:
  - Los abonos aparecen en el orden cronológico exacto en que se pagaron con distintivo morado `ABONO`, borde lateral destacado y etiqueta `Abono Separado`.
  - Muestra monto recaudado en verde (`+$30.000`), total del separado y saldo restante del cliente.
  - Al expandir la fila, se despliega el resumen del recaudo y la lista de prendas que el cliente tiene reservadas.
- [x] **Pestaña de Filtro Dedicada**:
  - Añadido selector `[💜 Abonos]` junto a `[Todos]`, `[Pagado]`, `[Separado]` y `[Domicilio]`.
- [x] **Exportación a Excel**: Soporta transacciones mixtas exportando tanto ventas como cuotas de separados con su respectivo identificador.

### 2. Cuadre Histórico y Recuperación de Ventas del 8 de Octubre
- [x] **Restauración de 3 Ventas**: Reconstruidas las ventas #289 (Medias $20k), #290 (Buso Mónaco $55k) y #291 (Impermeable $80k) con fecha 08/10/2026.
- [x] **Cuadre Perfecto**: Las ventas del 6 al 8 de octubre totalizan exactamente **$850.000**, coincidiendo al peso con el cuaderno físico y el Cierre ID #119.

---

## 📌 PRÓXIMOS PASOS
1. Conteo físico de los 17 Busos Mónaco (`REF 30861`) para asentar stock inicial.
2. Registro de ventas y movimientos de los días 11 y 12 de octubre (si aplican).
3. Conexión de la Tienda Web (`Web-Estilo-Nordico`) consumiendo `/api/public/products` para catálogo en línea.
4. Sincronización de imágenes de variantes (`images` JSON) entre disco local D y la tienda web.
