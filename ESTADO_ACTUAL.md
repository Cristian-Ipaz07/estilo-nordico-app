# ESTADO DEL DESARROLLO (Abril 2026)

## ✅ Implementado
- Terminal V2.0 con 3 Tabs funcionales.
- Tabla `payment_history` para rastrear abonos por fecha.
- Sincronización de inventario reactiva (no requiere cerrar modal).
- Edición rápida de precios desde el Tab de Stock.

## 🛠️ Pendientes Inmediatos
- **Persistencia:** Implementar `localStorage` en el Terminal para no perder datos al cerrar.
- **Ajuste UI:** Agregar scroll interno en el Tab de Separados para que el botón no se pierda.
- **Carga de Datos:** Comenzar la migración de las ventas reales de marzo.

## ⚠️ Notas de Seguridad
- El archivo `database.db` debe tener copia de seguridad diaria manual.