from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SaleBase(BaseModel):
    product_id: int
    customer_name: str
    total_price: float
    amount_paid: float = 0.0
    status: str = "separado"

class SaleCreate(SaleBase):
    pass

class Sale(SaleBase):
    id: int
    balance_due: float
    created_at: datetime

    class Config:
        from_attributes = True