# ESTRUCTURA TÉCNICA - ESTILO NÓRDICO

## Stack Tecnológico
- **Backend:** FastAPI (Python 3.12) + SQLAlchemy + SQLite.
- **Frontend:** React + Vite + Tailwind CSS.
- **Base de Datos:** `backend/database.db` (Contiene productos, ventas y payment_history).

## Módulos del Terminal (TerminalModal.jsx)
1. **VENTAS:** Carrito con descuentos, buscador por referencia y selección de cliente.
2. **SEPARADOS:** Gestión de deudas, historial de abonos por fecha y botón de liquidación.
3. **STOCK:** Buscador avanzado, edición rápida de precios y restock con costo ponderado.

## Lógica de Negocio Clave
- **Costo Ponderado:** `(Stock anterior * Costo anterior + Stock nuevo * Costo nuevo) / Stock total`.
- **Flujo de Caja:** Cada abono se registra en la tabla `payment_history` para auditoría diaria.