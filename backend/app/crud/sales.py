from sqlalchemy.orm import Session
from app.models.sale import Sale
from app.schemas.sale import SaleCreate

def create_sale(db: Session, sale: SaleCreate):
    # Calculamos automáticamente lo que falta por pagar
    balance_due = sale.total_price - sale.amount_paid
    
    db_sale = Sale(
        product_id=sale.product_id,
        customer_name=sale.customer_name,
        total_price=sale.total_price,
        amount_paid=sale.amount_paid,
        balance_due=balance_due, # Se guarda el cálculo
        status=sale.status
    )
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

def get_sales(db: Session):
    return db.query(Sale).all()