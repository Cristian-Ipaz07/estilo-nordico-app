import sys
import os

# Asegurar que el backend está en el path para poder importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.models.product import Product
from app.models.payment_history import PaymentHistory
from app.models.stock_entry import StockEntry
from app.models.cash_movement import CashMovement
from app.models.corte_payroll import CortePayroll

def fix_historical_prices():
    db = SessionLocal()
    try:
        items = db.query(SaleItem).all()
        fixed_count = 0
        
        for item in items:
            if item.quantity > 0 and item.total_item is not None:
                correct_price = item.total_item / item.quantity
                # Usar abs() para evitar problemas de precisión flotante
                if abs((item.price_at_sale or 0) - correct_price) > 0.01:
                    print(f"Fixing item {item.id}: P.Venta {item.price_at_sale} -> {correct_price} (Lista: {item.original_price})")
                    item.price_at_sale = correct_price
                    fixed_count += 1
        
        if fixed_count > 0:
            db.commit()
            print(f"Success: {fixed_count} items updated.")
        else:
            print("No items needed fixing.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Iniciando corrección de price_at_sale histórico...")
    fix_historical_prices()
