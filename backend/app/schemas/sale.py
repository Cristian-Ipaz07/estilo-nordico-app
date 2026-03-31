from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# Esquema para el detalle de cada producto en la venta
class SaleItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class SaleItemCreate(SaleItemBase):
    pass

class SaleItemResponse(SaleItemBase):
    id: int
    
    class Config:
        from_attributes = True

# Esquema principal de la Venta
class SaleBase(BaseModel):
    customer_name: str = "Cliente Final"
    total_price: float
    amount_paid: float = 0.0
    status: str = "pagado" # pagado, separado, cancelado

class SaleCreate(SaleBase):
    # Aquí es donde sucede la magia: una lista de items
    items: List[SaleItemCreate]

class SaleResponse(SaleBase):
    id: int
    balance_due: float
    created_at: datetime
    items: List[SaleItemResponse] # Para que el front reciba qué se vendió

    class Config:
        from_attributes = True