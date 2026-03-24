from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.product import Product as ProductModel
from app.schemas.product import Product, ProductCreate
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import pandas as pd
import io
from app.services.excel_service import sync_from_estilo_nordico_excel

router = APIRouter()

# 1. VER TODOS
@router.get("/", response_model=List[Product])
def read_products(db: Session = Depends(get_db)):
    return db.query(ProductModel).all()

# 2. CREAR
@router.post("/", response_model=Product)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    new_product = ProductModel(**product.model_dump()) # Forma elegante de pasar todos los datos
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

# 3. ACTUALIZAR (Para la edición rápida tipo Excel)
@router.put("/{product_id}", response_model=Product)
def update_product(product_id: int, product_data: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # exclude_unset=True evita errores si mandas un json parcial
    update_data = product_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product

# 4. ELIMINAR
@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    db.delete(db_product)
    db.commit()
    return {"message": "Producto eliminado correctamente"}

# 5. importar excel
@router.post("/upload-excel", tags=["Productos"])
async def upload_inventory(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xlsm', '.xls')):
        raise HTTPException(status_code=400, detail="Formato no válido. Sube el Excel de Estilo Nórdico.")
    
    try:
        contents = await file.read()
        # Leemos el Excel usando pandas
        df = pd.read_excel(io.BytesIO(contents), sheet_name='INVENTARIO', header=1)
        
        # Llamamos a tu servicio que ya mapea REF, MI COSTO, etc.
        result = sync_from_estilo_nordico_excel(db, df)
        return result
    except Exception as e:
        print(f"Error detallado: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar Excel: {str(e)}")