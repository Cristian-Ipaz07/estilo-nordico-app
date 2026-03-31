from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.api.endpoints import users  # <--- IMPORTANTE
from app.models.user import User    # <--- IMPORTANTE para que cree la tabla
from app.models.product import Product # Para que cree la tabla
# Luego crearemos el router de productos, por ahora solo el modelo.
from app.api.endpoints import products # Importar el nuevo router
from app.models.sale import Sale
from app.api.endpoints import sales # Import

# Crea las tablas en la DB al iniciar
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Estilo Nórdico API")

# Aquí conectamos las rutas de usuarios
app.include_router(users.router, prefix="/users", tags=["Usuarios"])
app.include_router(products.router, prefix="/products", tags=["Productos"])
app.include_router(sales.router, prefix="/sales", tags=["Ventas"])

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