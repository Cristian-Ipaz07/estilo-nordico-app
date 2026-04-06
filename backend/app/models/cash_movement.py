from sqlalchemy import Column, Integer, Float, String, DateTime
from app.db.database import Base
from datetime import datetime, timezone, timedelta

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

class CashMovement(Base):
    __tablename__ = "cash_movements"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False) # 'ENTRADA' or 'SALIDA'
    category = Column(String, nullable=False) # e.g. 'CIERRE CAJA', 'GASTO', 'ADELANTO', 'REINVERSION'
    payment_date = Column(DateTime, default=get_colombia_time)
    created_at = Column(DateTime, default=get_colombia_time)
