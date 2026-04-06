import sys
import os

# Ensure backend directory is in the python path
sys.path.append(os.path.dirname(__file__))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.payment_history import PaymentHistory
from app.models.cash_movement import CashMovement

def backfill():
    db = SessionLocal()
    
    print("Borrando registros antiguos de VENTA, ABONO y CIERRE CAJA para evitar duplicidad...")
    db.query(CashMovement).filter(CashMovement.category.in_(['VENTA', 'ABONO', 'CIERRE CAJA'])).delete()
    
    sales = db.query(Sale).all()
    print(f"Encontradas {len(sales)} ventas para sincronizar hacia cash_movements.")
    count = 0
    for s in sales:
        total_abonos = sum(p.amount for p in s.payment_history)
        initial_paid = s.amount_paid - total_abonos
        if initial_paid > 0:
            count += 1
            db.add(CashMovement(
                description=f"Venta #{s.id} - {s.customer_name}", 
                amount=initial_paid, 
                type="ENTRADA", 
                category="VENTA", 
                created_at=s.created_at, 
                payment_date=s.created_at
            ))
        for p in s.payment_history:
            count += 1
            db.add(CashMovement(
                description=f"Abono Venta #{s.id}", 
                amount=p.amount, 
                type="ENTRADA", 
                category="ABONO", 
                created_at=p.payment_date, 
                payment_date=p.payment_date
            ))
            
    db.commit()
    print(f"¡Éxito! Se insertaron {count} movimientos de caja basados en ventas pasadas.")

if __name__ == '__main__':
    backfill()
