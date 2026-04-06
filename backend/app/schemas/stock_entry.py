from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class StockEntryBase(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float
    provider: Optional[str] = "PROVEEDOR GENÉRICO"
    paid_from_cash: bool = False
    new_price_sale: Optional[float] = None # Para actualizar el PVP si se desea

class StockEntryCreate(StockEntryBase):
    pass

class StockEntryResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_cost: float
    total_cost: float
    provider: Optional[str]
    paid_from_cash: bool
    is_cancelled: bool
    created_at: datetime
    product_name: Optional[str] = None # Para facilitar el listado
    stock: Optional[int] = None
    my_cost: Optional[float] = None
    price_sale: Optional[float] = None
    weighted_cost: Optional[float] = None
    class Config:
        from_attributes = True

class CancelEntryRequest(BaseModel):
    entry_id: int
