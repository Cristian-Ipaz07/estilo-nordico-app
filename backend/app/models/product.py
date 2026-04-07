from sqlalchemy import Column, Integer, String, Float, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    ref = Column(String, unique=True, index=True) # Tu columna 'REF'
    category = Column(String) # 'CATEGORIA' (Hombre)
    subcategory = Column(String) # 'SUBCATEGORIA' (Bermuda)
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

    sales_items = relationship("SaleItem", back_populates="product")
    entries = relationship("StockEntry", back_populates="product")