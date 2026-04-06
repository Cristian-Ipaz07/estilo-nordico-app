from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone, timedelta

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

class StockEntry(Base):
    __tablename__ = "stock_entries"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    provider = Column(String, nullable=True) # "Ej. Maicao, Bodega Principal, etc."
    paid_from_cash = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_colombia_time)

    product = relationship("Product", back_populates="entries_history")
