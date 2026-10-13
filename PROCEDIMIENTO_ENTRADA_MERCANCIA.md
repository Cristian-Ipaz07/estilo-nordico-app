# MANUAL OPERATIVO: ENTRADA Y CATALOGACIÓN DE MERCANCÍA
## ESTILO NÓRDICO · PASTO & SAMANIEGO

> **Propósito**: Protocolo estándar para que cualquier encargado o asesor de tienda pueda recibir mercancía, fotografiarla, procesarla y cargarla al inventario y catálogo sin depender de Cristian Ipaz.

---

## 📋 RESUMEN DEL FLUJO (DE LA CAJA AL CLIENTE EN 6 PASOS)

```
[1. Recepción y Conteo] ➔ [2. Foto Rápida] ➔ [3. Fondo Canva + WebP] ➔ [4. Guardar en Disco D] ➔ [5. Cargar a Jarvis / ERP] ➔ [6. Perchero]
```

---

## PASO 1: RECEPCIÓN FÍSICA Y CONTEO
Al abrir las cajas o paquetes del proveedor:
1. **Revisión de Calidad:** Verificar que no haya manchas, descosidos o cremalleras dañadas.
2. **Separación por Modelos:** Agrupar prendas por la misma referencia.
3. **Llenado de la Ficha Rápida de Entrada (Cuaderno o Nota):**
   Anotar siempre con esta estructura exacta:
   * **Referencia:** Número del fabricante (ej. `30861`, `6041`, `5080`).
   * **Tipo de Prenda:** Buso, Chaqueta, Bermuda, Camiseta, etc.
   * **Colores y Estampados:** Especificar color base y estampado (ej. `Verde Petróleo - Redefine`, `Café / Marfil - Columbia`).
   * **Desglose de Tallas y Cantidades:**
     - Talla M: [X unidades]
     - Talla L: [X unidades]
     - Talla XL: [X unidades]
   * **Costo por unidad:** Lo que se le pagó al proveedor.
   * **Precio de Venta:** Precio oficial al público de Estilo Nórdico.

---

## PASO 2: SESIÓN DE FOTOS RÁPIDA (PARED NEUTRA)
* **Regla #1:** **Solo se toma 1 foto por color/diseño.** No necesitas tomar fotos para cada talla; la misma foto sirve para M, L, XL.
* **El Set:**
  - Pared limpia y despejada (blanca, gris o beige neutro).
  - Buena luz natural o aro de luz frontal. Sin sombras oscuras detrás.
  - Prenda en gancho de madera o percha presentable, bien estirada.
* **El Encuadre:**
  - Foto vertical (3:4 o 1:1).
  - Prenda completa centrada, dejando un pequeño margen arriba y abajo.

---

## PASO 3: EDICIÓN RÁPIDA Y COMPRESIÓN
1. **Quitar Fondo en Canva (en Bloque):**
   - Subir todas las fotos del lote a Canva.
   - Usar la herramienta *"Quitar fondo"* (en lote o individual con 1 clic).
   - Fondo resultante: **Transparente** o **Blanco puro**.
   - Descargar todas las imágenes procesadas.
2. **Compresión a WebP (Cero peso, máxima calidad):**
   - Pasar las imágenes por un convertidor/compresor (ej. Squoosh, TinyPNG o convertidor local a `.webp`).
   - **Peso objetivo:** Entre **200 KB y 600 KB** (nunca más de 1 MB).

---

## PASO 4: NOMENCLATURA EXACTA DE ARCHIVOS (DISCO D)
Para que el sistema ERP y la tienda web sincronicen la foto automáticamente, el nombre del archivo **DEBE seguir la regla de SKU**:

### Regla General:
`[REFERENCIA]-[COLOR]-[DISEÑO/MARCA].webp`
*(Todo en minúsculas, sin tildes, con guiones separando las palabras).*

### Ejemplos Reales:
* Buso Mónaco Capucha color Café Claro con estampado Paris Atelier:
  👉 `30861-cafe-claro-paris-atelier.webp`
* Chaqueta Polar Columbia color Marrón:
  👉 `6041-marron-columbia.webp`
* Chaqueta Polar Bicolor (Arriba Café, Abajo Marfil):
  👉 `6042-cafe-marfil-columbia.webp`

### Estructura de Carpetas en el Disco D:
```text
D:\FOTOS_CATALOGO\
  ├── 30861_BUSO_MONACO\
  │     ├── 30861-cafe-claro-paris-atelier.webp
  │     ├── 30861-verde-claro-nike.webp
  │     └── ...
  ├── 6041_POLAR_UNICOLOR\
  │     ├── 6041-marron-columbia.webp
  │     └── ...
  └── 6042_POLAR_BICOLOR\
        └── 6042-cafe-marfil-columbia.webp
```

---

## PASO 5: CARGA EN EL SISTEMA (2 ALTERNATIVAS)

### Opción A: Modo Jarvis (Recomendada — 1 Minuto)
El encargado abre Antigravity / Jarvis y escribe tal como lo anotó en el cuaderno:
> *"Llegó mercancía: Chaquetas Polar Columbia Ref 6041, costo 38mil, venta 65mil. M: 2 marron, L: 1 verde militar, XL: 1 azul petroleo."*

**Jarvis hace todo:**
1. Genera los SKUs estándar.
2. Asigna categorías, precios y fotos.
3. Inserta las variantes con su stock en la base de datos PostgreSQL.
4. Quedan disponibles de inmediato para facturar en el POS Terminal.

### Opción B: Carga Manual por la App
1. Abrir la app y entrar a la pestaña **Inventario**.
2. Clic en **`+ Nuevo Producto`**.
3. Ingresar:
   - Nombre: `POLAR UNICOLOR MARRON COLUMBIA`
   - REF / SKU: `6041-MARRON-COLUMBIA-M`
   - Categoría: `Hombre` | Subcategoría: `Chaqueta`
   - Talla: `M` | Color: `Marrón`
   - Costo: `$38.000` | Precio Venta: `$65.000`
   - Stock Inicial: `2`
4. Guardar.

---

## PASO 6: EXHIBICIÓN Y ETIQUETADO
1. Colocar el sticker o etiqueta de precio oficial en la prenda.
2. Colgar en el perchero correspondiente (zona Hombre / zona Mujer).
3. La prenda ya está lista para venta física en el mostrador o por WhatsApp.
