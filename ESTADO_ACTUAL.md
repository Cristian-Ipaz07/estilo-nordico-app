# ESTADO DEL DESARROLLO - ESTILO NÓRDICO (Finales Abril 2026)

## ✅ Módulo de Contabilidad y Flujo de Caja (Actualizado)
- **Registro Histórico y Retroactivo:** Se implementó el uso de `payment_date` en todo el flujo de caja, reemplazando `created_at`. Esto permite registrar movimientos pasados (ej. cierres de marzo hechos en abril) para que impacten en el periodo correspondiente.
- **Integración Global del Terminal:** El `TerminalModal` se puede invocar desde cualquier página mediante un evento global (`open-terminal`). Se añadió un botón directo en Flujo de Caja para registrar movimientos macro sin cambiar de página.
- **Edición de Movimientos:** En *Caja -> Historial de Operaciones*, el Super Administrador ahora cuenta con botones para **Editar** y **Eliminar** movimientos contables individualmente (modificar descripción, monto, tipo, categoría o fecha retroactiva).
- **Control de Categorías:** 
  - Se añadieron `PRÉSTAMO` y `GANANCIA` en los tipos de Entrada y Salida.
  - Se añadió `SALARIO` en las salidas para unificar y conciliar automáticamente los pagos de "Nómina Horaria" con el Flujo de Caja.
- **Métricas Reales (Excel vs App):** 
  - *Liquidez Total* se recalcula sumando todo el "Efectivo Cobrado" + "Todos los Ingresos Externos (Entradas manuales)". 
  - La *Ganancia Bruta* refleja limpiamente la utilidad operacional (Ventas - Costos de Mercancía).
- **Impresión Profesional (PDF):** La pestaña de *Finanzas & Corte* cuenta con un sistema de impresión adaptado que oculta la barra lateral, botones y selectores, generando un PDF 100% limpio y profesional.
- **Sugerencia Automática de Nombre PDF:** Al generar el reporte, el navegador sugerirá un nombre dinámico para el PDF en el formato `Corte_Financiero_YYYY-MM-DD_al_YYYY-MM-DD`.

## ✅ Backend y Base de Datos (PostgreSQL)
- **Migración a PostgreSQL Completa:** Todos los modelos operan de forma relacional y estructurada (Sales, Products, CashMovements, Users).
- **Nuevos Endpoints:** Se añadió `PUT /cash/{id}` y `DELETE /cash/{id}` para permitir correcciones contables sin tener que operar la base de datos a mano.
- **Normalización de Datos:** El backend maneja scripts de unificación (por ej. transformar "otros" a "INGRESO_VENTA_EXTERNA").

## 🛠️ Pendientes Inmediatos / Recomendaciones Futuras
- **Persistencia en Terminal:** Implementar `localStorage` en el Terminal para no perder el estado del carrito si el administrador cierra el modal por error.
- **Ajustes Menores de UI:** Agregar scroll interno en el Tab de Separados si la lista crece mucho.
- **Sincronización de Costos:** Asegurarse de que todos los productos del inventario histórico tengan seteado un `my_cost` para que el COGS (Costo de Mercancía) sea 100% preciso.

## ⚠️ Notas Operativas
- **Flujo de Trabajo:** Si se registra una venta que fue cancelada parcialmente y se quiere anotar el abono exacto, usar la pasarela de pagos del Terminal. Si es dinero que entra ajeno a las ventas, registrarlo por la pestaña "DIARIO" del Terminal o en la página "Caja".
- **Backup:** Aunque estamos en PostgreSQL, se recomienda configurar volcados (dumps) periódicos en el entorno de producción.