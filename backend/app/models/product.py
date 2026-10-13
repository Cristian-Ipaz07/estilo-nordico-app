from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone, timedelta

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    ref = Column(String, unique=True, index=True) # Tu columna 'REF'
    category = Column(String) # 'CATEGORIA' (Hombre)
    subcategory = Column(String) # 'SUBCATEGORIA' (Bermuda)
    brand = Column(String, nullable=True)
    color = Column(String, nullable=True)
    size = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey('products.id'), nullable=True) # Marca: Yanbal, Avon, etc.
    origin = Column(String, nullable=True) # Propio, Amiga, etc.
    name = Column(String, index=True) # 'PRODUCTO' (Algodón Importado)
    price_sale = Column(Float) # 'PRECIO VENTA'
    my_cost = Column(Float) # 'MI COSTO'
    cost_total = Column(Float) # 'COSTO TOTAL'
    initial_stock = Column(Integer) # 'CANT INICIAL'
    entry_count = Column('entries', Integer, default=0) # 'ENTRADA'
    exits = Column(Integer, default=0) # 'SALIDA'
    stock = Column(Integer) # 'STOCK' actual
    current_cost_total = Column(Float) # 'COSTO ACTUAL'
    is_active = Column(Boolean, default=True)

    # -- Campos Web & Catálogo (Fase 1.2 — Unificación) ----------------------
    product_type = Column(String, default="ROPA", index=True)  # CHAQUETA, PERFUME, RELOJ, ROPA, ACCESORIO
    slug = Column(String, unique=True, index=True, nullable=True)  # URL-friendly: "ohm-parfum-yanbal"
    description = Column(String, nullable=True)  # Descripción para la ficha de producto web
    images = Column(JSON, default=[])  # ["https://...img1.jpg", "https://...img2.jpg"]
    is_published = Column(Boolean, default=False)  # ¿Visible en la tienda web pública?
    notion_sync_id = Column(String, nullable=True)  # ID de Notion para migración gradual
    compare_price = Column(Float, nullable=True)  # Precio comercial tachado (anclaje: $150.000)
    updated_at = Column(DateTime, default=get_colombia_time, onupdate=get_colombia_time)

    sales_items = relationship("SaleItem", back_populates="product")
    entries = relationship("StockEntry", back_populates="product")
