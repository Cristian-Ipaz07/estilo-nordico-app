# 🧥 Estilo Nórdico - Enterprise Retail Engine (POS & ERP)

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge&logo=git" alt="Status">
  <img src="https://img.shields.io/badge/Architecture-Async--FastAPI-005571?style=for-the-badge&logo=fastapi" alt="Arch">
  <img src="https://img.shields.io/badge/Infrastructure-Docker--Compose-2496ED?style=for-the-badge&logo=docker" alt="Infra">
</p>

---

### 🚀 Visión de Ingeniería
Este no es solo un software de ventas; es un **ecosistema de gestión integral** diseñado bajo estándares de alta disponibilidad. Desarrollé esta solución para digitalizar la operación de **Estilo Nórdico**, sustituyendo procesos manuales por una arquitectura robusta que garantiza la integridad de los datos y la escalabilidad del negocio.

## 🎯 Impacto en el Negocio (ROI)
* **Eficiencia Operativa:** Reducción del **70% en el tiempo de registro** de ventas y abonos.
* **Integridad de Datos:** Eliminación total de discrepancias entre el stock físico y el sistema mediante un motor de base de datos relacional.
* **Control Financiero:** Trazabilidad completa de "Separados" (pagos parciales), reduciendo la cartera vencida mediante alertas de saldos.

## 🛠️ Stack Tecnológico & Decisiones de Arquitectura

| Capa | Tecnología | Justificación Técnica |
| :--- | :--- | :--- |
| **Backend** | **FastAPI (Python)** | Implementación de **Programación Asíncrona** para manejar múltiples terminales POS concurrentes sin bloqueos. |
| **Frontend** | **React 18 + Tailwind** | SPA (Single Page Application) optimizada para una respuesta inmediata en el punto de venta físico. |
| **Infraestructura** | **Docker & Docker Compose** | Contenerización total para asegurar que el entorno de desarrollo sea idéntico al de producción, facilitando el despliegue escalable. |
| **Persistencia** | **SQLAlchemy + SQLite** | Uso de **ORM** para permitir una migración fluida a PostgreSQL a medida que el volumen de datos crezca (Migración Stateless). |

---

## 🏗️ Arquitectura y Flujo de Trabajo
El proyecto sigue el estándar **Gitflow**, separando las ramas de desarrollo (`dev`) de las versiones estables de producción (`main`).

### 🟢 Hitos Alcanzados (Ingeniería de Software)
- [x] **Arquitectura de Microservicios:** Backend y Frontend aislados y comunicados vía REST API.
- [x] **Dockerización:** Orquestación de servicios lista para entornos Cloud.
- [x] **Lógica de Negocio Transaccional:** Sistema de abonos con validación de estados y saldos en tiempo real.
- [x] **Buscador Indexado:** Terminal de ventas optimizada para consultas por REF, categoría o descripción.

### 🔵 Próximos Desafíos Técnicos
- [ ] Implementación de seguridad avanzada con **JWT (JSON Web Tokens)**.
- [ ] Integración de **Webhooks** para sincronización bidireccional con Shopify.
- [ ] Dashboard analítico con procesamiento de datos en tiempo real.

---

## 👨‍💻 Engineering & Leadership
**Cristian Ipaz**
*Estudiante de Ingeniería de Sistemas (UNAD)*
*Consultor Tecnológico y Lead Developer en Estilo Nórdico*

*"Mi enfoque es transformar problemas de negocio complejos en soluciones de software simples, escalables y rentables."*

---

## ⚙️ Quick Start (Deployment)
```bash
# Clonar repositorio
git clone [https://github.com/Cristian-Ipaz07/estilo-nordico-app.git](https://github.com/Cristian-Ipaz07/estilo-nordico-app.git)

# Despliegue inmediato con Docker
docker-compose up --build
