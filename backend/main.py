from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.database import engine, Base, SessionLocal
from app.api.endpoints import users, products, sales, cash, auth, corte
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
    
    # Crear usuario administrador semilla si no hay ningún usuario
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            db_user = User(
                username="admin", 
                full_name="Super Administrador", 
                role="Admin", 
                hashed_password=security.get_password_hash("admin123")
            )
            db.add(db_user)
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(title="Estilo Nórdico API", lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/users", tags=["Usuarios"])
app.include_router(products.router, prefix="/products", tags=["Productos"])
app.include_router(sales.router, prefix="/sales", tags=["Ventas"])
app.include_router(cash.router, prefix="/cash", tags=["Caja"])
app.include_router(corte.router, prefix="/corte", tags=["Finanzas & Corte"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend conectado"}