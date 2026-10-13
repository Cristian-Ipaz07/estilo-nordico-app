#!/usr/bin/env python3
"""
Migración de BD — Agrega las columnas nuevas de Fase 1.2 a la tabla products.
Ejecutar UNA SOLA VEZ: python3 migrate_web_fields.py
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:password123@localhost:5432/estilo_nordico")

# Parsear la URL de conexión
# postgresql://admin:password123@localhost:5432/estilo_nordico
parts = DATABASE_URL.replace("postgresql://", "").split("@")
user_pass = parts[0].split(":")
host_db = parts[1].split("/")
host_port = host_db[0].split(":")

conn = psycopg2.connect(
    host=host_port[0],
    port=int(host_port[1]) if len(host_port) > 1 else 5432,
    database=host_db[1],
    user=user_pass[0],
    password=user_pass[1],
)
conn.autocommit = True
cur = conn.cursor()

columns_to_add = [
    ("product_type", "VARCHAR DEFAULT 'ROPA'"),
    ("slug", "VARCHAR UNIQUE"),
    ("description", "TEXT"),
    ("images", "JSONB DEFAULT '[]'::jsonb"),
    ("is_published", "BOOLEAN DEFAULT FALSE"),
    ("notion_sync_id", "VARCHAR"),
    ("compare_price", "FLOAT"),
    ("updated_at", "TIMESTAMP DEFAULT NOW()"),
]

for col_name, col_def in columns_to_add:
    try:
        cur.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_def};")
        print(f"  ✅ Columna '{col_name}' agregada.")
    except psycopg2.errors.DuplicateColumn:
        conn.rollback()
        conn.autocommit = True
        print(f"  ⏭️  Columna '{col_name}' ya existe, saltando.")

# Crear índices
try:
    cur.execute("CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_products_is_published ON products(is_published);")
    print("  ✅ Índices creados.")
except Exception as e:
    print(f"  ⚠️  Error creando índices: {e}")

# Generar slugs automáticos para productos existentes sin slug
cur.execute("SELECT id, ref, name FROM products WHERE slug IS NULL;")
rows = cur.fetchall()
for row in rows:
    pid, ref, name = row
    # Generar slug a partir de ref y name
    import re
    base = f"{ref}-{name}" if name else ref
    slug = re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')
    # Asegurar unicidad
    cur.execute("SELECT COUNT(*) FROM products WHERE slug = %s;", (slug,))
    if cur.fetchone()[0] > 0:
        slug = f"{slug}-{pid}"
    cur.execute("UPDATE products SET slug = %s WHERE id = %s;", (slug, pid))

print(f"  ✅ Slugs generados para {len(rows)} productos existentes.")

cur.close()
conn.close()
print("\n🎉 Migración completada exitosamente.")
