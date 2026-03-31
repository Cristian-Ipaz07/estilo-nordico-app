from pydantic import BaseModel
from typing import Optional

class ProductBase(BaseModel):
    ref: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    name: str
    price_sale: Optional[float] = 0.0      # Si está vacío en Excel, pone 0.0
    my_cost: Optional[float] = 0.0         # Si está vacío en Excel, pone 0.0
    cost_total: Optional[float] = 0.0      # Evita error 'float_type'
    initial_stock: Optional[int] = 0       # Evita el error 'int_type' que te salió
    entries: Optional[int] = 0
    exits: Optional[int] = 0
    stock: Optional[int] = 0               # Evita el error de validación
    current_cost_total: Optional[float] = 0.0 # Evita error 'float_type'
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    price_sale: Optional[float] = None
    stock: Optional[int] = None
    is_active: Optional[bool] = None

class Product(ProductBase):
    id: int

    class Config:
        from_attributes = True