from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ProductBase(BaseModel):
    ref: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    origin: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    parent_id: Optional[int] = None
    name: str
    price_sale: Optional[float] = 0.0      # Si está vacío en Excel, pone 0.0
    my_cost: Optional[float] = 0.0         # Si está vacío en Excel, pone 0.0
    cost_total: Optional[float] = 0.0      # Evita error 'float_type'
    initial_stock: Optional[int] = 0       # Evita el error 'int_type' que te salió
    entry_count: Optional[int] = 0
    exits: Optional[int] = 0
    stock: Optional[int] = 0               # Evita el error de validación
    current_cost_total: Optional[float] = 0.0 # Evita error 'float_type'
    is_active: bool = True
    # -- Campos Web & Catálogo (Fase 1.2) --
    product_type: Optional[str] = "ROPA"
    slug: Optional[str] = None
    description: Optional[str] = None
    images: Optional[list] = []
    is_published: bool = False
    notion_sync_id: Optional[str] = None
    compare_price: Optional[float] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    ref: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    origin: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    parent_id: Optional[int] = None
    price_sale: Optional[float] = None
    my_cost: Optional[float] = None
    stock: Optional[int] = None
    is_active: Optional[bool] = None
    # -- Campos Web editables --
    product_type: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    images: Optional[list] = None
    is_published: Optional[bool] = None
    compare_price: Optional[float] = None

class Product(ProductBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Restock con costo ponderado ──────────────────────────────────────────────
class RestockRequest(BaseModel):
    product_id: int
    qty_in: int                              # Cantidad entrante
    new_cost: float                          # Precio de compra nuevo
    new_price_sale: Optional[float] = None  # Ajuste opcional del PVP


class RestockResponse(BaseModel):
    id: int
    name: str
    ref: str
    stock: int
    my_cost: float
    price_sale: float
    weighted_cost: float                     # Costo ponderado calculado

    class Config:
        from_attributes = True


# ── Schema público (sin datos internos de costo) ────────────────────────────
class ProductPublic(BaseModel):
    """Schema para la API pública — NO expone costos ni datos financieros."""
    id: int
    ref: str
    name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    product_type: str
    slug: Optional[str] = None
    description: Optional[str] = None
    images: Optional[list] = []
    price_sale: Optional[float] = 0.0
    compare_price: Optional[float] = None
    stock: Optional[int] = 0
    is_active: bool = True
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
