from app.db.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.stock_entry import StockEntry
from datetime import datetime
from app.models.payment_history import PaymentHistory

def run_backfill():
    db = SessionLocal()
    try:
        # Al importar todos los modelos arriba, SQLAlchemy registra las relaciones (como SaleItem) 
        # y evita el error "failed to locate a name"
        products = db.query(Product).all()
        created_count = 0
        now = datetime.now()
        
        for p in products:
            # Calculamos cuántas unidades YA tienen un registro en el historial
            logged_qty = sum(e.quantity for e in p.entries_history if not e.is_cancelled)
            
            # 'entries' es el acumulado total histórico en la tabla de productos
            total_entries = p.entries or 0
            
            # La diferencia son las entradas que se hicieron manualmente 
            # antes de que implementáramos el sistema de historial (StockEntry)
            missing_qty = total_entries - logged_qty
            
            if missing_qty > 0:
                print(f"📦 Producto ID {p.id} ({p.name}) tiene {missing_qty} unidades sin registro en historial.")
                
                # Usamos el costo actual para este registro genérico de nivelación
                unit_cost = p.my_cost or 0.0
                total_cost = unit_cost * missing_qty
                
                new_entry = StockEntry(
                    product_id=p.id,
                    quantity=missing_qty,
                    unit_cost=unit_cost,
                    total_cost=total_cost,
                    provider="AJUSTE SISTEMA (REGULARIZACIÓN)",
                    paid_from_cash=False, 
                    is_cancelled=False,
                    created_at=now
                )
                db.add(new_entry)
                created_count += 1
                
        if created_count > 0:
            db.commit()
            print(f"✅ Éxito: Se crearon {created_count} registros de StockEntry para nivelar el historial.")
        else:
            print("✨ El historial ya está al día. No se detectaron discrepancias.")
            
    except Exception as e:
        print(f"❌ Error durante el backfill: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Iniciando sincronización de historial de entradas (nivelación)...")
    run_backfill()
