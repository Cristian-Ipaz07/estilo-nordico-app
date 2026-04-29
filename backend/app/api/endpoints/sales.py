from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.schemas.sale import SaleCreate, SaleResponse
from typing import List, Optional

router = APIRouter()

@router.get("/cogs")
def get_cogs(start: Optional[str] = None, end: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Calcula el Costo de Mercancía Vendida (COGS) real:
    COGS = SUM(item.quantity × product.my_cost) para las ventas en el rango.
    """
    query = db.query(
        func.coalesce(func.sum(SaleItem.quantity * Product.my_cost), 0)
    ).join(
        Product, SaleItem.product_id == Product.id
    ).join(
        Sale, SaleItem.sale_id == Sale.id
    )
    if start:
        query = query.filter(func.date(Sale.created_at) >= start)
    if end:
        query = query.filter(func.date(Sale.created_at) <= end)

    cogs_total = query.scalar() or 0
    return {"cogs_total": round(cogs_total, 2)}

@router.get("/", response_model=List[SaleResponse])
def read_sales(status: Optional[str] = None, db: Session = Depends(get_db)):

    query = db.query(Sale)
    if status:
        query = query.filter(Sale.status == status)
    return query.all()

@router.post("/", response_model=SaleResponse)
def create_sale(sale_data: SaleCreate, db: Session = Depends(get_db)):
    # 1. Crear la cabecera de la venta
    new_sale = Sale(
        customer_name=sale_data.customer_name,
        total_sale=sale_data.total_price,  # frontend manda total_price, ORM lo guarda en total_sale
        amount_paid=sale_data.amount_paid,
        balance_due=max(0.0, sale_data.total_price - sale_data.amount_paid),
        status=sale_data.status,
        sale_channel="LOCAL"
    )
    
    db.add(new_sale)
    db.flush() 

    # 2. Procesar cada producto del carrito
    for item in sale_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        
        if not product or product.stock < item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para: {product.name if product else 'ID '+str(item.product_id)}")

        # Descontar Stock
        product.stock -= item.quantity
        
        # Crear detalle de venta
        sale_item = SaleItem(
            sale_id=new_sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price_at_sale=item.unit_price,
            total_item=item.quantity * item.unit_price,
            original_price=product.price_sale or 0.0 # Guardamos el precio original de lista
        )
        db.add(sale_item)

    db.commit()
    db.refresh(new_sale)
    return new_sale

@router.patch("/{sale_id}/payment")
def register_payment(sale_id: int, amount: float, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    db_sale.amount_paid += amount
    db_sale.balance_due = max(0, db_sale.total_sale - db_sale.amount_paid)
    
    if db_sale.balance_due <= 0:
        db_sale.status = "pagado"
        
    db.commit()
    return {"message": "Abono registrado", "nuevo_saldo": db_sale.balance_due}