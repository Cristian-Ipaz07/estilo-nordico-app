from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.sale import Sale as SaleModel
from app.models.product import Product as ProductModel
from app.schemas.sale import Sale, SaleCreate

router = APIRouter()

@router.get("/", response_model=list[Sale])
def get_sales(db: Session = Depends(get_db)):
    return db.query(SaleModel).all()

@router.post("/", response_model=Sale)
def create_sale(sale: SaleCreate, db: Session = Depends(get_db)):
    # 1. Buscar el producto que se está vendiendo
    product = db.query(ProductModel).filter(ProductModel.id == sale.product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="El producto no existe")

    # 2. Verificar si hay stock (Solo si la venta es efectiva o separado)
    if product.stock < 1:
        raise HTTPException(status_code=400, detail=f"No hay stock suficiente de {product.name}")

    # 3. Restar 1 al stock del producto
    product.stock -= 1

    # 4. Calcular el saldo pendiente
    balance = sale.total_price - sale.amount_paid
    
    # 5. Crear la venta
    db_sale = SaleModel(
        product_id=sale.product_id,
        customer_name=sale.customer_name,
        total_price=sale.total_price,
        amount_paid=sale.amount_paid,
        balance_due=balance,
        status=sale.status
    )
    
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.patch("/{sale_id}/payment", response_model=Sale)
def register_payment(sale_id: int, amount: float, db: Session = Depends(get_db)):
    # 1. Buscar la venta
    db_sale = db.query(SaleModel).filter(SaleModel.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    # 2. Actualizar montos
    db_sale.amount_paid += amount
    db_sale.balance_due = db_sale.total_price - db_sale.amount_paid
    
    # 3. Cambiar estado si ya pagó todo
    if db_sale.balance_due <= 0:
        db_sale.status = "pagado"
        db_sale.balance_due = 0 # Evita números negativos
        
    db.commit()
    db.refresh(db_sale)
    return db_sale