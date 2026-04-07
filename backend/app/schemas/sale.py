from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ── Esquema mínimo del producto embebido en los items ─────────────────────────
class ProductInItem(BaseModel):
    id: int
    name: str
    ref: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None

    class Config:
        from_attributes = True


# ── Esquema mínimo del usuario ────────────────────────────────────────────────
class UserInSale(BaseModel):
    id: int
    full_name: Optional[str] = None
    username: Optional[str] = None

    class Config:
        from_attributes = True


# ── Esquema mínimo de PaymentHistory ─────────────────────────────────────────
class PaymentHistoryInSale(BaseModel):
    id: int
    amount: float
    payment_date: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ── Item de venta ─────────────────────────────────────────────────────────────
class SaleItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: float  # nombre que usa el frontend al CREAR


class SaleItemCreate(SaleItemBase):
    pass


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    # El modelo ORM lo guarda como price_at_sale; lo exponemos como unit_price
    unit_price: float = Field(alias="price_at_sale")
    total_item: Optional[float] = None
    original_price: Optional[float] = None
    product: Optional[ProductInItem] = None

    class Config:
        from_attributes = True
        populate_by_name = True  # permite usar tanto alias como nombre real


# ── Venta principal ───────────────────────────────────────────────────────────
class SaleBase(BaseModel):
    customer_name: str = "Cliente Final"
    total_price: float  # nombre que usa el frontend al CREAR
    amount_paid: float = 0.0
    status: str = "pagado"


class SaleCreate(SaleBase):
    items: List[SaleItemCreate]


class SaleResponse(BaseModel):
    id: int
    customer_name: str
    # El modelo ORM lo guarda como total_sale; lo exponemos como total_price
    total_price: float = Field(alias="total_sale")
    amount_paid: float
    balance_due: float
    status: str
    sale_channel: Optional[str] = "LOCAL"
    created_at: datetime
    items: List[SaleItemResponse]
    user: Optional[UserInSale] = None
    payment_history: Optional[List[PaymentHistoryInSale]] = None

    class Config:
        from_attributes = True
        populate_by_name = True