# ESTADO EN VIVO: NODO ERP (ESTILO NÓRDICO)
> Última actualización: 2026-10-13 (Mediodía) | Recepción de Mercancía Facturas 8-Octubre + Cuadre Total Inventario

## 🎯 RESUMEN EJECUTIVO
* **Rol**: Fuente Única de Verdad (Inventario Maestro, POS Terminal, Domicilios, Catálogo Asesores, Flujo de Caja & Arqueos, API Pública).
* **Fase Actual**: Fase 1 — ERP como Núcleo Central (100% Completada, Probada y Blindada).
* **Inventario Total**: Todas las prendas de las facturas del 8 de octubre asentadas en PostgreSQL.
* **Turno Cerrado (6 al 8 de Octubre)**: Ventas: $850.000 | Gastos: $95.000 | Guardado/Retirado: $755.000 | Base fija: $150.000.
* **Turno Activo Actual (9 de Octubre en adelante)**:
  - Ventas: #286 ($160k), #287 ($160k), #288 ($60k), Abono Juan Ipaz ($30k). Total caja turno: **$410.000 COP**.
* **Crédito de Capital & Proveedores (8 de Octubre)**:
  - Factura 1 (Proveedor Local): $720.000 pagados 100% con crédito (Saldo: $0).
  - Factura 2 (Euforia Sport Fact 090): $1.003.000 total | Abono: $300.000 pagado con crédito | **Saldo por pagar a Euforia Sport: $703.000**.
  - Total desembolsado del Crédito para compras: **$1.020.000 COP**.

---

## 📦 DETALLE DE MERCANCÍA INGRESADA (FACTURAS 8 DE OCTUBRE)

### 1. Factura 1 — Proveedor Local ($720.000 COP)
* **Busos Mónaco Capucha (`REF 30861`)**:
  - 14 busos ingresados (12 normales @ $35.000 + 2 XXL Plus @ $36.000).
  - Sumados a los 4 existentes menos 1 vendido el 8-Oct = **17 unidades físicas** en stock.
  - 17 variantes activas con stock 1 c/u: M (5), L (7), XL (3) a costo $35k y XXL (2) a costo $36k. Precio venta unificado: **$60.000**.
* **Ovejeras Polar Columbia (`REF 6041` y `REF 6042`)**:
  - 6 unidades ingresadas @ costo $38.000 = $228.000.
  - `6041` Unicolor: 4 unidades (2 Marrón M, 1 Verde Militar L, 1 Azul Petróleo XL) | Precio venta: $65.000.
  - `6042` Bicolor: 2 unidades (1 Café/Marfil L, 1 Gris Jaspeado XL) | Precio venta: $65.000.

### 2. Factura 2 — Euforia Sport / Factura No. 090 ($1.003.000 COP)
* **Bermudas Algodón (`REF 770`)**:
  - 6 unidades nuevas ingresadas @ costo $36.000 = $216.000. Precio venta: **$55.000**.
  - 6 variantes creadas en base de datos:
    - `770-VERDE-BLANCO-REEBOK-XL` (1)
    - `770-VERDE-BLANCO-REEBOK-L` (1)
    - `770-VERDE-BLANCO-REEBOK-M` (1)
    - `770-GRIS-NEGRO-REEBOK-M` (1)
    - `770-NEGRO-BLANCO-VERDE-NIKE-XL` (1)
    - `770-NEGRO-BLANCO-VERDE-NIKE-L` (1)
  - Total stock `REF 770`: 7 unidades (1 existente + 6 nuevas).
* **Camisetas Importadas (`REF 7647`)**:
  - 5 unidades nuevas ingresadas (2 Kallejon + 2 Havens + 1 1.1) @ costo promedio $44.400 = $222.000.
  - Sumadas a las 6 previas = **11 unidades en stock**.
  - Costo ponderado: $51.000 | Precio de venta unificado: **$80.000**.
* **Polos Importadas**:
  - `REF 1535` (Polo Importada): +1 unidad @ $45.000 ingresada. Stock total: **3 unidades** | Precio venta: $65.000.
  - `REF 1536` (Polo Importada 1.1 - NUEVA REFERENCIA): 10 unidades @ costo $52.000 = $520.000 | Precio venta: **$80.000**.

---

## 📌 PRÓXIMOS PASOS
1. Iniciar registro de ventas de la jornada actual con el inventario 100% al día.
2. Módulo de Cuentas por Pagar a Proveedores para registrar los abonos a la deuda de $703.000 con Euforia Sport.
3. Conexión de la Tienda Web (`Web-Estilo-Nordico`) consumiendo `/api/public/products` para catálogo en línea.
