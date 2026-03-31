from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.product import Product
# Asegúrate de actualizar tus schemas (Pydantic) para soportar la lista de items
from app.schemas.sale import SaleCreate, SaleResponse 

router = APIRouter()

@router.post("/", response_model=SaleResponse)
def create_sale(sale_data: SaleCreate, db: Session = Depends(get_db)):
    # 1. Crear la cabecera de la venta
    new_sale = Sale(
        customer_name=sale_data.customer_name,
        total_price=sale_data.total_price,
        amount_paid=sale_data.amount_paid,
        balance_due=sale_data.total_price - sale_data.amount_paid,
        status="separado" if (sale_data.total_price > sale_data.amount_paid) else "pagado"
    )
    
    db.add(new_sale)
    db.flush() # Para obtener el ID de la venta antes del commit

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
            unit_price=item.unit_price
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
    db_sale.balance_due = max(0, db_sale.total_price - db_sale.amount_paid)
    
    if db_sale.balance_due <= 0:
        db_sale.status = "pagado"
        
    db.commit()
    return {"message": "Abono registrado", "nuevo_saldo": db_sale.balance_due}