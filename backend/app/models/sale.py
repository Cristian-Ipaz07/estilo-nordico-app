from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id")) # Conecta con el ID del producto
    customer_name = Column(String)
    total_price = Column(Float)
    amount_paid = Column(Float, default=0.0)  
    balance_due = Column(Float)               
    status = Column(String, default="separado") 
    created_at = Column(DateTime, default=datetime.utcnow)

    # Esto conecta la venta con el modelo de Producto anterior
    product = relationship("Product", back_populates="sales")