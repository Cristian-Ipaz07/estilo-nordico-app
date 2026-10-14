import os
import sys
from sqlalchemy import text
from dotenv import load_dotenv

# Configurar path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import engine, Base
from app.models.user import User
from app.core import security

load_dotenv()

def reset_users_table():
    print("Iniciando RESET de tabla 'users' en PostgreSQL...")
    
    with engine.connect() as conn:
        print("Eliminando tabla antigua (DROP CASCADE)...")
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.commit()
        print("DROP ejecutado con éxito.")

    # Volver a crear todas las tablas segun modelos SQLAlchemy
    print("Creando tabla con nuevo esquema desde Base.metadata...")
    Base.metadata.create_all(bind=engine)
    print("Sincronización de Base.metadata completa.")

    # Insertar el usuario admin semilla
    print("Insertando semilla admin/admin123...")
    from sqlalchemy.orm import Session
    from app.db.database import SessionLocal
    
    db = SessionLocal()
    try:
        hashed_pw = security.get_password_hash("admin123")
        admin = User(
            username="admin",
            full_name="Super Administrador",
            hashed_password=hashed_pw,
            role="Admin",
            status="Activo",
            vendedor_tipo="Admin",
            comision_pct=0.0
        )
        db.add(admin)
        db.commit()
        print("¡Usuario ADMIN creado correctamente!")
    except Exception as e:
        print(f"Error al insertar admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_users_table()
    print("--- Proceso Finalizado ---")
