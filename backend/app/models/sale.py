from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone, timedelta

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5))).replace(tzinfo=None)

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, default="Cliente Final")
    total_sale = Column('total_sale', Float, default=0.0) # Mapped to total_sale for frontend
    amount_paid = Column(Float, default=0.0)
    balance_due = Column(Float, default=0.0)
    status = Column(String, default="pagado") # pagado, separado, cancelado
    sale_channel = Column(String, default="LOCAL") # para 'Vendedor' en el front
    delivery_address = Column(String, nullable=True)
    delivery_notes = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    payment_method = Column(String, default="EFECTIVO_TIENDA", nullable=True)
    delivered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cash_settled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_colombia_time)

    # Relaciones
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    delivery_person = relationship("User", foreign_keys=[delivered_by])
    # Relación con los productos de esta venta
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payment_history = relationship("PaymentHistory", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    price_at_sale = Column('price_at_sale', Float) # Mapped for frontend (unit_price)
    total_item = Column(Float) # total de la fila
    original_price = Column(Float) # precio de lista para ver el descuento

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")