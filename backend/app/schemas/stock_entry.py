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
    entry_date: Optional[str] = None

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


class BatchEntryItem(BaseModel):
    color: str
    size: Optional[str] = 'ÚNICA'
    quantity: int
    brand: Optional[str] = None
    new_price_sale: Optional[float] = None

class BatchStockEntryRequest(BaseModel):
    product_id: Optional[int] = None
    base_ref: str
    is_new_base: bool = False
    base_name: Optional[str] = None
    category: Optional[str] = "Hombre"
    subcategory: Optional[str] = None
    brand: Optional[str] = "Estilo Nórdico"
    base_price_sale: Optional[float] = None
    total_invoice: Optional[float] = 0.0
    freight_cost: Optional[float] = 0.0
    unit_cost: float
    provider: Optional[str] = "PROVEEDOR GENÉRICO"
    paid_from_cash: bool = False
    entry_date: Optional[str] = None
    items: List[BatchEntryItem]

class BatchStockEntryResponse(BaseModel):
    message: str
    base_product_id: int
    base_ref: str
    total_units: int
    unit_cost: float
    total_cost: float
    entries_created: int
    variants_created: int
