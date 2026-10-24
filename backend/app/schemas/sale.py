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
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None

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
    account: Optional[str] = "EFECTIVO_TIENDA"
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryMarkRequest(BaseModel):
    amount_collected: float
    payment_method: Optional[str] = "EFECTIVO"
    notes: Optional[str] = None


class ItemExchangeRequest(BaseModel):
    item_id: int
    new_product_id: int
    new_price: Optional[float] = None
    difference_paid: Optional[float] = 0.0
    account: Optional[str] = "EFECTIVO_TIENDA"
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    account: Optional[str] = None
    payment_date: Optional[str] = None
    notes: Optional[str] = None


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
    sale_channel: Optional[str] = "LOCAL"
    payment_method: Optional[str] = "EFECTIVO_TIENDA"
    delivery_address: Optional[str] = None
    delivery_notes: Optional[str] = None


class SaleCreate(SaleBase):
    items: List[SaleItemCreate]
    # Fecha retroactiva opcional (YYYY-MM-DD). Si se omite, se usa la hora actual de Colombia.
    sale_date: Optional[str] = None
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    payments: Optional[List[dict]] = None


# ── Actualización parcial de venta (PUT) ──────────────────────────────────────
class SaleItemUpdate(BaseModel):
    id: Optional[int] = None
    product_id: Optional[int] = None
    quantity: Optional[int] = None
    price_at_sale: Optional[float] = None

class SaleUpdate(BaseModel):
    customer_name: Optional[str] = None
    seller: Optional[str] = None      # nombre de vendedor (se guarda en sale_channel)
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    amount_paid: Optional[float] = None
    payment_method: Optional[str] = None
    sale_date: Optional[str] = None   # YYYY-MM-DD para corregir la fecha
    status: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_notes: Optional[str] = None
    delivered_by: Optional[int] = None
    cash_settled: Optional[bool] = None
    items: Optional[List[SaleItemUpdate]] = None
    total_sale: Optional[float] = None


class SaleResponse(BaseModel):
    id: int
    customer_name: str
    # El modelo ORM lo guarda como total_sale; lo exponemos como total_price
    total_price: float = Field(alias="total_sale")
    amount_paid: float
    balance_due: float
    status: str
    sale_channel: Optional[str] = "LOCAL"
    delivery_address: Optional[str] = None
    delivery_notes: Optional[str] = None
    payment_method: Optional[str] = "EFECTIVO_TIENDA"
    created_at: datetime
    items: List[SaleItemResponse]
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    user: Optional[UserInSale] = None
    creator: Optional[UserInSale] = None
    delivered_by: Optional[int] = None
    cash_settled: Optional[bool] = False
    delivery_person: Optional[UserInSale] = None
    payment_history: Optional[List[PaymentHistoryInSale]] = None

    class Config:
        from_attributes = True
        populate_by_name = True