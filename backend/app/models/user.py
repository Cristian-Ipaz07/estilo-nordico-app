from sqlalchemy import Column, Integer, String, DateTime, Float
from app.db.database import Base # <--- Importamos el Base real desde donde está definido
from datetime import datetime, timezone, timedelta

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="Vendedor") # Admin, Vendedor
    status = Column(String, default="Activo") # Activo, Inactivo
    vendedor_tipo = Column(String, default="Físico") # Físico, Virtual
    comision_pct = Column(Float, default=0.0) 
    created_at = Column(DateTime, default=get_colombia_time)