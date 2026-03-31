import pandas as pd
from sqlalchemy.orm import Session
from app.models.product import Product

def sync_from_estilo_nordico_excel(db: Session, df: pd.DataFrame):
    # Limpiamos los símbolos de '$' y puntos de miles para que Python pueda operar
    def clean_currency(value):
        if isinstance(value, str):
            return float(value.replace('$', '').replace('.', '').strip())
        return value

    # 1. Normalizamos los nombres de las columnas del Excel
    df.columns = [str(c).strip().upper() for c in df.columns]

    for _, row in df.iterrows():
        # 2. Limpieza de REF (Básico para Estilo Nórdico)
        ref_val = str(row.get('REF', '')).split('.')[0]
        if not ref_val or ref_val == 'nan': continue

        try:
            # 3. Mapeo Seguro: Usamos .get() para evitar que el error detenga el código
            product_data = {
                "ref": ref_val,
                "category": str(row.get('CATEGORIA', row.get('CATEGORÍA', ''))),
                "subcategory": str(row.get('SUBCATEGORIA', row.get('SUBCATEGORÍA', ''))),
                "name": str(row.get('PRODUCTO', '')),
                "price_sale": clean_currency(row.get('PRECIO VENTA', 0)),
                "my_cost": clean_currency(row.get('MI COSTO', 0)),
                "stock": int(row.get('STOCK', 0)), # Aquí ya no fallará por el orden
                "is_active": True
            }

            # Lógica de guardado en DB...
            product = db.query(Product).filter(Product.ref == ref_val).first()
            if product:
                for key, value in product_data.items():
                    setattr(product, key, value)
            else:
                db.add(Product(**product_data))

        except Exception as e:
            print(f"Error en fila {ref_val}: {e}")
            continue # Si una fila falla, sigue con la siguiente (Bermudas, Billeteras, etc.)
            
    db.commit()
    return {"message": "Inventario actualizado desde Excel con éxito"}