# 🧥 Estilo Nórdico - Gestión Integral de Retail

<p align="center">
  <img src="https://img.shields.io/badge/Status-En%20Desarrollo-orange?style=for-the-badge&logo=git" alt="Status">
  <img src="https://img.shields.io/badge/Fase-0%20(Infraestructura)-blue?style=for-the-badge" alt="Fase">
  <img src="https://img.shields.io/badge/Versión-0.5.0--beta-lightgrey?style=for-the-badge" alt="Version">
</p>

---

### 📝 Resumen del Proyecto
Este sistema es una solución **Full-Stack** real diseñada para transformar la operación manual de **Estilo Nórdico** (retail de moda) en un ecosistema digital automatizado. Resuelve la complejidad del inventario por variantes (REF) y el seguimiento crítico de pagos parciales ("Separados").

## 🎯 El Problema (Pain Points)
La gestión basada en procesos manuales y hojas de cálculo generaba:
- ❌ **90% de riesgo de error** en sincronización de stock real vs. contable.
- ❌ **Lentitud operativa** en el punto de venta (POS) durante horas pico.
- ❌ **Fuga de información** y falta de trazabilidad en abonos de clientes.

## ✨ La Solución (Core Features)
Desarrollé un **POS & ERP** a medida que incluye:
- 🚀 **Control de Inventario Pro:** Gestión técnica por **REF**, categorías y subcategorías.
- 💰 **Módulo de Separados:** Sistema inteligente de abonos y cálculo de saldos pendientes.
- 📊 **Dashboard Real-time:** Visualización de ingresos, gastos y flujos de caja operativos.

## 🛠️ Stack Tecnológico
| Capa | Tecnología |
| :--- | :--- |
| **Backend** | ![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi) **Python (Asíncrono)** |
| **Frontend** | ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react) **Tailwind CSS** |
| **Contenerización** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white) **Docker & Docker Compose** |
| **Base de Datos** | ![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite) **SQLAlchemy ORM** |
| **DevOps** | ![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white) **Gitflow (Main/Dev)** |

---

## 🗺️ Hoja de Ruta (Roadmap)

### 🟢 Fase 0: Infraestructura & Estándares (Completado)
- [x] Configuración de entorno de desarrollo y flujo de ramas (**Gitflow**).
- [x] Diseño de arquitectura de base de datos relacional.
- [x] Documentación técnica y estándares de seguridad.
- [x] **Dockerización inicial** de los servicios de Backend y Frontend.

### 🟡 Fase 1: MVP Funcional (En Proceso)
- [x] Terminal de Ventas con buscador multi-parámetro (REF, Producto).
- [x] Lógica de negocio para registro de "Separados" y pagos parciales.
- [ ] Módulo de importación masiva de inventario desde archivos **CSV/Excel**.

### 🔵 Fase 2: Operación Nivel Empresa (Próximamente)
- [ ] Autenticación de usuarios mediante **JWT** y control de roles.
- [ ] Reportes de cierres de caja por turno y auditoría de movimientos.
- [ ] Sistema avanzado de egresos y gestión de gastos administrativos.

### 🚀 Fase 3: Ecosistema Digital & SaaS
- [ ] Sincronización mediante Webhooks con el inventario de **Shopify**.
- [ ] Dashboard de analítica avanzada con **Chart.js**.

---

## 👨‍💻 Sobre el Desarrollador
**Cristian Ipaz** *Estudiante de Ingeniería de Sistemas - UNAD* *CEO & Lead Developer en Estilo Nórdico*

---

### ⚙️ Instalación (Próximamente)
```bash
# Clonar el proyecto
git clone [https://github.com/Cristian-Ipaz07/estilo-nordico-app.git](https://github.com/Cristian-Ipaz07/estilo-nordico-app.git)

# Levantar con Docker
docker-compose up --build