# Arquitectura de Despliegue Gratuito en la Nube: Vercel + Supabase + Render
**Proyecto:** Estilo Nórdico ERP (POS, Catálogo Web y Gestión)  
**Estado:** Puesto en espera temporal (A ejecutar una vez el sistema local quede al 100%)  
**Fecha de registro:** 13 de Octubre de 2026

---

## 1. Visión General de la Arquitectura (Cero Costo de Servidores)

```
┌─────────────────────────────────┐
│       CELULARES / LAPTOPS       │
│  (Doña Tereza, Asesores, Cris)  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     VERCEL (Frontend PWA)       │  ◄── 100% Gratis
│    estilonordico.vercel.app     │      - React + Vite + PWA
│    (o dominio propio HTTPS)     │      - Despliegue automático desde GitHub
└────────────────┬────────────────┘      - CDN global ultra rápida
                 │
                 ▼
┌─────────────────────────────────┐
│    BACKEND (FastAPI Python)     │  ◄── 100% Gratis
│    Render.com / Koyeb / Fly     │      - API REST Uvicorn
│   estilo-nordico-api.onrender   │      - Conexión vía DATABASE_URL a Supabase
└────────────────┬────────────────┘      - Ping keep-alive cada 10 min
                 │
                 ▼
┌─────────────────────────────────┐
│    SUPABASE (PostgreSQL 15)     │  ◄── 100% Gratis (500 MB)
│      Base de Datos Cloud        │      - Transacciones, Ventas, Usuarios
│                                 │      - Panel visual tipo Airtable/Excel
└─────────────────────────────────┘      - Backups automáticos
```

---

## 2. Componentes y Servicios

### A. Base de Datos: Supabase (PostgreSQL)
* **Tier:** Free Tier (500 MB de base de datos, 1 GB de almacenamiento).
* **Compatibilidad:** 100% idéntico a nuestro PostgreSQL local actual de Docker (`estilo_nordico_db`).
* **Conexión en Backend:**
  ```env
  DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  ```
* **Migración de Datos Locales a Supabase (Un solo paso):**
  1. Extraer respaldo de Docker:
     ```bash
     docker exec estilo_nordico_db pg_dump -U admin -d estilo_nordico > backup_local.sql
     ```
  2. Inyectar en Supabase:
     ```bash
     psql "postgresql://postgres.[ID]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" < backup_local.sql
     ```

### B. Frontend: Vercel (Web + PWA Móvil)
* **Tier:** Hobby (100% Gratis).
* **Configuración en Vercel:**
  * Root Directory: `frontend`
  * Framework Preset: `Vite`
  * Build Command: `npm run build`
  * Output Directory: `dist`
  * Variable de Entorno:
    `VITE_API_URL=https://estilo-nordico-api.onrender.com` (o la URL del backend)
* **PWA:** Funciona nativamente con el `manifest.json`, iconos y Service Worker ya configurados. Permite que usuarios en Android y iPhone instalen la aplicación en su pantalla principal.

### C. Backend: Render.com o Koyeb (FastAPI)
* **Tier:** Free Tier Web Service.
* **Configuración:**
  * Root Directory: `backend`
  * Runtime: `Python 3`
  * Build Command: `pip install -r requirements.txt`
  * Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  * Variables de Entorno:
    * `DATABASE_URL`: Cadena de conexión de Supabase.
    * `SECRET_KEY`: Llave para JWT tokens de autenticación.
* **Mantenimiento del servidor despierto (Evitar cold-starts):**
  * Configurar un monitor gratuito en [UptimeRobot.com](https://uptimerobot.com) o cron-job que haga ping a `GET /` cada 10 minutos.

---

## 3. Checklist de Ejecución (Para cuando se active esta fase)

- [ ] Crear cuenta en [Supabase](https://supabase.com) y crear proyecto "estilo-nordico".
- [ ] Exportar la base de datos local actual con `pg_dump` e importarla a Supabase.
- [ ] Subir el repositorio actualizado a GitHub (privado).
- [ ] Desplegar backend en Render.com conectado al repo y a la URL de Supabase.
- [ ] Desplegar frontend en Vercel conectado al repo y apuntando al API de Render.
- [ ] Enlazar dominio propio (si aplica, ej. `pos.estilonordico.com`).
- [ ] Validar inicio de sesión de Doña Tereza y asesores virtuales desde sus teléfonos.
