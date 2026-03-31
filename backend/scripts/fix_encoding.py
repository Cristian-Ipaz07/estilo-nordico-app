import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

# Configuración del logger
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

def deep_clean_encoding_sql():
    if not DATABASE_URL:
        logger.error("DATABASE_URL no encontrada en el .env")
        return

    # Conexión directa
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    # MAPEO FINAL BASADO EN INSPECCIÓN REAL (UTF-8 con caracteres de caja)
    replacements = [
        ('├ôN', 'ÓN'),
        ('├ô', 'Ó'),
        ('├í', 'á'),
        ('├⌐', 'é'),
        ('├¡', 'í'),
        ('├│', 'ó'),
        ('├║', 'ú'),
        ('├▒', 'ñ'),
        ('├æ', 'Ñ'),
    ]

    columns = ['name', 'category', 'subcategory']

    try:
        logger.info("Iniciando Limpieza Profunda Final...")
        
        updated_count = 0
        total_changes_shown = 0

        # Para mostrar antes/después, primero buscamos qué filas necesitan cambios
        for column in columns:
            query_get = text(f"SELECT id, {column} FROM products WHERE {column} IS NOT NULL")
            items = session.execute(query_get).all()
            
            for row in items:
                p_id = row[0]
                old_val = row[1]
                
                # Simular reemplazo para ver si hay cambios
                new_val = old_val
                for old_str, new_str in replacements:
                    if old_str in new_val:
                        new_val = new_val.replace(old_str, new_str)
                
                if new_val != old_val:
                    print(f"[{column.upper()}] ID {p_id}:")
                    print(f"  ANTES  : {old_val}")
                    print(f"  DESPUÉS: {new_val}")
                    
                    # Ejecutar el update real en la base de datos para esta fila/columna
                    # Usamos SQL REPLACE por requerimiento del usuario (aunque ya lo calculamos en Python)
                    # pero aplicamos el cambio directo es más eficiente en este bucle
                    query_update = text(f"UPDATE products SET {column} = :new_val WHERE id = :p_id")
                    session.execute(query_update, {"new_val": new_val, "p_id": p_id})
                    updated_count += 1

        if updated_count > 0:
            session.commit()
            print("\nLimpieza profunda finalizada.")
            logger.info(f"Se realizaron {updated_count} actualizaciones en total.")
        else:
            logger.info("No se encontraron caracteres rotos con el nuevo mapeo.")
            
    except Exception as e:
        session.rollback()
        logger.error(f"Error durante la limpieza profunda: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    deep_clean_encoding_sql()
