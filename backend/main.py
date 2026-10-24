import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from app.db.database import engine, Base, SessionLocal
from sqlalchemy import text
from app.api.endpoints import users, products, sales, cash, auth, corte, public, webhooks
from app.models.user import User
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.payment_history import PaymentHistory
from app.models.cash_movement import CashMovement
from app.models.corte_payroll import CortePayroll, CorteConfig
from app.core import security

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    
    # ── Migración automática de columnas en tablas existentes (PostgreSQL Supabase) ──
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS account VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            conn.execute(text("ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS account VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_deliver BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivered_by INTEGER REFERENCES users(id);"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_settled BOOLEAN DEFAULT FALSE;"))
            
            # Blindaje de Seguridad Supabase: Activar Row Level Security (RLS) en tablas publicas
            rls_tables = [
                "users", "products", "sales", "sale_items", "payment_history",
                "cash_movements", "corte_payroll", "corte_config", "stock_entries"
            ]
            for tbl in rls_tables:
                conn.execute(text(f"ALTER TABLE IF EXISTS {tbl} ENABLE ROW LEVEL SECURITY;"))
            
            conn.commit()
            print("✅ Migración automática de columnas ejecutada exitosamente.")
    except Exception as mig_err:
        print("⚠️ Advertencia en migración automática de columnas:", mig_err)

    # Crear usuario administrador semilla si no hay ningún usuario
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            default_pwd = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123")
            db_user = User(
                username="admin", 
                full_name="Super Administrador", 
                role="Admin", 
                hashed_password=security.get_password_hash(default_pwd)
            )
            db.add(db_user)
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(title="Estilo Nórdico API", lifespan=lifespan)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── Routers internos ────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/users", tags=["Usuarios"])
app.include_router(products.router, prefix="/products", tags=["Productos"])
app.include_router(sales.router, prefix="/sales", tags=["Ventas"])
app.include_router(cash.router, prefix="/cash", tags=["Caja"])
app.include_router(corte.router, prefix="/corte", tags=["Finanzas & Corte"])

# ── Routers públicos (Tienda Web) ───────────────────────────────────────────
app.include_router(public.router, prefix="/api/public", tags=["API Pública (Web)"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])

# ── Configuración Dinámica de CORS ──────────────────────────────────────────
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend conectado — Estilo Nórdico ERP v2.0"}

@app.get("/migrate-db")
def run_migrations():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS account VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            conn.execute(text("ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS account VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_deliver BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivered_by INTEGER REFERENCES users(id);"))
            conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_settled BOOLEAN DEFAULT FALSE;"))
            
            rls_tables = [
                "users", "products", "sales", "sale_items", "payment_history",
                "cash_movements", "corte_payroll", "corte_config", "stock_entries"
            ]
            for tbl in rls_tables:
                conn.execute(text(f"ALTER TABLE IF EXISTS {tbl} ENABLE ROW LEVEL SECURITY;"))
            
            conn.commit()
        return {"status": "ok", "message": "Columnas y blindaje RLS aplicados exitosamente en la base de datos"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
