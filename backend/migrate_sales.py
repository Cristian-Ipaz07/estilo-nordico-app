import os
import sys
from dotenv import load_dotenv
from sqlalchemy import text

# Agregamos la ruta base para que pueda importar 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import engine, Base
from app.models.user import User

print("Iniciando migración manual...")

# Crear tabla de usuarios (y cualquier otra que falte)
Base.metadata.create_all(bind=engine)
print("Tablas creadas/sincronizadas por SQLAlchemy.")

with engine.connect() as conn:
    print("Conexión activa. Ejecutando ALTER TABLE en sales...")
    try:
        # Renombrar columna
        conn.execute(text("ALTER TABLE sales RENAME COLUMN seller TO sale_channel;"))
        print("-> DONE: RENAME seller TO sale_channel")
    except Exception as e:
        print(f"-> RENAME no fue necesario o falló: {e}")
        
    try:
        # Agregar user_id
        conn.execute(text("ALTER TABLE sales ADD COLUMN user_id INTEGER REFERENCES users(id);"))
        print("-> DONE: ADD COLUMN user_id")
    except Exception as e:
        print(f"-> ADD COLUMN user_id no fue necesario o falló: {e}")

    try:
        # Agregar created_by
        conn.execute(text("ALTER TABLE sales ADD COLUMN created_by INTEGER REFERENCES users(id);"))
        print("-> DONE: ADD COLUMN created_by")
    except Exception as e:
        print(f"-> ADD COLUMN created_by no fue necesario o falló: {e}")

    conn.commit()

print("¡Migración finalizada con éxito!")
