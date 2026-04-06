import sys
import os

# Añadimos el directorio raíz del backend al path para poder importar la app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db.database import engine, Base
from app.models.sale import Sale, SaleItem
from app.models.product import Product # IMPORTANTE: Cargar el modelo para que la FK funcione
from app.models.user import User       # Cargar el modelo de usuario por si hay relaciones
from sqlalchemy import text

def reset_sales_tables():
    print("--- 🛠 REINICIO DE TABLAS DE VENTAS (Con soporte de FK) 🛠 ---")
    
    with engine.connect() as conn:
        print("Eliminando tablas dependientes por cascada...")
        # Desactivamos FK temporalmente o usamos CASCADE para evitar bloqueos
        conn.execute(text("DROP TABLE IF EXISTS sale_items CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS sales CASCADE;"))
        conn.commit()
    
    print("\nCreando las tablas de nuevo con la nueva estructura...")
    # create_all respetará las tablas ya existentes (products, users) 
    # y solo creará las que acabamos de borrar (sales, sale_items).
    Base.metadata.create_all(bind=engine)
    
    print("\n✅ ¡Tablas de ventas reiniciadas con éxito!")
    print("🚀 Ya puedes volver a encender el backend.")

if __name__ == "__main__":
    try:
        reset_sales_tables()
    except Exception as e:
        print(f"\n❌ Error durante el reinicio: {e}")
