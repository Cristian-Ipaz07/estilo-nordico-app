import os
import sys
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Asegurar que la carpeta 'backend' esté en el path de Python
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# IMPORTANTE: Importar todos los modelos relacionados para evitar KeyErrors en las relaciones de SQLAlchemy
from app.models.user import User
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.payment_history import PaymentHistory
from app.models.stock_entry import StockEntry
from app.models.cash_movement import CashMovement
from app.db.database import get_db

# Conexión a Postgres
engine = create_engine("postgresql://admin:password123@localhost:5432/estilo_nordico")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

def fix_payments():
    print("🚀 Iniciando corrección manual de abonos retrospectivos...")

    # 1. LILIANA ROSERO (65k - 17 de Abril)
    liliana = db.query(Sale).filter(Sale.customer_name.ilike('%liliana rosero%')).order_by(Sale.created_at.desc()).first()
    if liliana and not db.query(PaymentHistory).filter(PaymentHistory.sale_id == liliana.id, PaymentHistory.amount == 65000).first():
        p = PaymentHistory(
            sale_id=liliana.id, 
            amount=65000, 
            payment_date=datetime(2026, 4, 17, 12, 0), 
            notes="Abono final de 65000 (17-Abr)"
        )
        db.add(p)
        print(f"✅ Liliana Rosero: Abono de 65k registrado para el 17 de Abril.")

    # 2. DAVID IPAZ (50k - 17 de Abril)
    david = db.query(Sale).filter(Sale.customer_name.ilike('%david ipaz%')).order_by(Sale.created_at.desc()).first()
    if david and not db.query(PaymentHistory).filter(PaymentHistory.sale_id == david.id, PaymentHistory.amount == 50000).first():
        p = PaymentHistory(
            sale_id=david.id, 
            amount=50000, 
            payment_date=datetime(2026, 4, 17, 12, 0),
            notes="Abono de 50000 (17-Abr)"
        )
        db.add(p)
        print(f"✅ David Ipaz: Abono de 50k registrado para el 17 de Abril.")

    # 3. MARISOL (25k - 18 de Abril)
    marisol = db.query(Sale).filter(Sale.customer_name.ilike('%marisol%')).order_by(Sale.created_at.desc()).first()
    if marisol and not db.query(PaymentHistory).filter(PaymentHistory.sale_id == marisol.id, PaymentHistory.amount == 25000).first():
        p = PaymentHistory(
            sale_id=marisol.id, 
            amount=25000, 
            payment_date=datetime(2026, 4, 18, 12, 0),
            notes="Abono de 25000 (18-Abr)"
        )
        db.add(p)
        print(f"✅ Marisol: Abono de 25k registrado para el 18 de Abril.")

    try:
        db.commit()
        print("\n🎉 ¡Sincronización completada!")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_payments()