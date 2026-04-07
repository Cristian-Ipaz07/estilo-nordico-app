from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.product import Product as ProductModel
from app.models.stock_entry import StockEntry as StockEntryModel
from app.models.cash_movement import CashMovement as CashMovementModel
from app.schemas.product import Product, ProductCreate, RestockRequest, RestockResponse
from app.schemas.stock_entry import StockEntryCreate, StockEntryResponse, CancelEntryRequest
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


# 6. RESTOCK con cálculo de costo ponderado
@router.post("/restock", response_model=RestockResponse)
def restock_product(data: RestockRequest, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if data.qty_in <= 0:
        raise HTTPException(status_code=400, detail="La cantidad entrante debe ser mayor a 0")

    stock_actual = product.stock or 0
    costo_actual = product.my_cost or 0.0

    # Fórmula del Costo Promedio Ponderado
    stock_total = stock_actual + data.qty_in
    if stock_total > 0:
        weighted_cost = (stock_actual * costo_actual + data.qty_in * data.new_cost) / stock_total
    else:
        weighted_cost = data.new_cost

    product.stock = stock_total
    product.entry_count = (product.entry_count or 0) + data.qty_in
    product.my_cost = round(weighted_cost, 2)
    product.current_cost_total = round(weighted_cost * stock_total, 2)

    if data.new_price_sale is not None:
        product.price_sale = data.new_price_sale

    db.commit()
    db.refresh(product)

    # Retornar respuesta enriquecida con el costo ponderado calculado
    result = RestockResponse(
        id=product.id,
        name=product.name,
        ref=product.ref,
        stock=product.stock,
        my_cost=product.my_cost,
        price_sale=product.price_sale or 0.0,
        weighted_cost=weighted_cost,
    )
    return result


# 7. EDICIÓN RÁPIDA de precio/costo (para el panel Stock del Terminal)
@router.patch("/{product_id}/price")
def update_product_price(product_id: int, price_sale: float = None, my_cost: float = None, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if price_sale is not None:
        product.price_sale = price_sale
    if my_cost is not None:
        product.my_cost = my_cost
    db.commit()
    db.refresh(product)
    return {"id": product.id, "price_sale": product.price_sale, "my_cost": product.my_cost}


# 8. HISTORIAL DE ENTRADAS - LISTAR
@router.get("/entries", response_model=List[StockEntryResponse])
def read_stock_entries(
    product_id: Optional[int] = None, 
    filter_type: Optional[str] = "todo", # dia, semana, mes, todo, range
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(StockEntryModel)
    
    if product_id:
        query = query.filter(StockEntryModel.product_id == product_id)

    # Filtros de Fecha
    now = datetime.now()
    if filter_type == "dia":
        # Hoy (24h)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(StockEntryModel.created_at >= today_start)
    elif filter_type == "semana":
        last_week = now - timedelta(days=7)
        query = query.filter(StockEntryModel.created_at >= last_week)
    elif filter_type == "mes":
        last_month = now - timedelta(days=30)
        query = query.filter(StockEntryModel.created_at >= last_month)
    elif filter_type == "range" and start_date and end_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            ed = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(StockEntryModel.created_at >= sd, StockEntryModel.created_at <= ed)
        except ValueError:
            pass # Ignorar si el formato es inválido

    entries = query.order_by(StockEntryModel.created_at.desc()).all()
    
    # Enriquecimiento para el cliente (Nombre y REF del producto)
    for e in entries:
        if e.product:
            e.product_name = e.product.name
            # Aprovechamos el campo para meter info de la REF si es listado global
            if not product_id:
                e.product_name = f"{e.product.ref} - {e.product.name}"
        else:
            e.product_name = "Producto Desconocido"
            
    return entries

# 9. HISTORIAL DE ENTRADAS - REGISTRAR NUEVA
@router.post("/entries", response_model=StockEntryResponse)
def create_stock_entry(data: StockEntryCreate, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # 1. Cálculos de Costo Ponderado
    qty_in = data.quantity
    unit_cost = data.unit_cost
    total_cost = round(qty_in * unit_cost, 2)
    
    stock_actual = product.stock or 0
    costo_actual = product.my_cost or 0.0
    
    stock_total = stock_actual + qty_in
    if stock_total > 0:
        weighted_cost = (stock_actual * costo_actual + qty_in * unit_cost) / stock_total
    else:
        weighted_cost = unit_cost

    # 2. Actualizar Producto
    product.stock = stock_total
    product.entry_count = (product.entry_count or 0) + qty_in
    product.my_cost = round(weighted_cost, 2)
    product.current_cost_total = round(weighted_cost * stock_total, 2)
    if data.new_price_sale:
        product.price_sale = data.new_price_sale

    # 3. Crear Registro de Entrada
    new_entry = StockEntryModel(
        product_id=data.product_id,
        quantity=qty_in,
        unit_cost=unit_cost,
        total_cost=total_cost,
        provider=data.provider,
        paid_from_cash=data.paid_from_cash
    )
    db.add(new_entry)
    db.flush()

    # 4. Sincronizar con Caja si aplica
    if data.paid_from_cash:
        db.add(CashMovementModel(
            description=f"Pago Mercancía {product.ref} - {product.name}",
            amount=total_cost,
            type="SALIDA",
            category="REINVERSION"
        ))

    db.commit()
    db.refresh(new_entry)
    new_entry.product_name = product.name
    new_entry.stock = product.stock
    new_entry.my_cost = product.my_cost
    new_entry.price_sale = product.price_sale
    new_entry.weighted_cost = weighted_cost
    return new_entry

# 10. HISTORIAL DE ENTRADAS - ANULAR
@router.patch("/entries/{entry_id}/cancel")
def cancel_stock_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(StockEntryModel).filter(StockEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    if entry.is_cancelled:
        raise HTTPException(status_code=400, detail="Esta entrada ya fue anulada anteriormente")
    
    product = entry.product
    if not product:
        raise HTTPException(status_code=404, detail="Producto inexistente para anular stock")
    
    # Seguridad: Bloquear si no hay stock suficiente para cubrir la resta
    if product.stock < entry.quantity:
        raise HTTPException(status_code=400, detail=f"No hay stock suficiente ({product.stock}) para restar las {entry.quantity} unidades de esta entrada")
    
    # 1. Revertir Stock
    product.stock -= entry.quantity
    product.entry_count -= entry.quantity
    # Nota: No recalculamos costo ponderado histórico por seguridad (regla de oro del cliente)

    # 2. Revertir Caja si aplica
    if entry.paid_from_cash:
        db.add(CashMovementModel(
            description=f"REVERSIÓN POR ANULACIÓN DE ENTRADA #{entry.id}",
            amount=entry.total_cost,
            type="ENTRADA",
            category="OTROS"
        ))

    # 3. Marcar como anulada
    entry.is_cancelled = True
    
    db.commit()
    return {"message": "Entrada anulada exitosamente", "id": entry.id}