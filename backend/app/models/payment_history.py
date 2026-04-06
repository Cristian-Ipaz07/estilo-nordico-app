from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone, timedelta

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=get_colombia_time)

    notes = Column(String, nullable=True)

    sale = relationship("Sale", back_populates="payment_history")
