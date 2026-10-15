import uuid
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.product import Product as ProductModel
from app.models.stock_entry import StockEntry as StockEntryModel
from app.models.cash_movement import CashMovement as CashMovementModel
from app.schemas.product import Product, ProductCreate, ProductUpdate, RestockRequest, RestockResponse
import re
from app.schemas.stock_entry import StockEntryCreate, StockEntryResponse, CancelEntryRequest, BatchStockEntryRequest, BatchStockEntryResponse
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
import pandas as pd
import io
from app.services.excel_service import sync_from_estilo_nordico_excel

router = APIRouter()

# 1. VER TODOS
@router.get("/", response_model=List[Product])
def read_products(db: Session = Depends(get_db)):
    return db.query(ProductModel).all()

# Helper slug
def generate_product_slug(ref: str, name: str, db: Session, current_id: int = None) -> str:
    base = f"{ref}-{name}" if name else ref
    slug = re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')
    query = db.query(ProductModel).filter(ProductModel.slug == slug)
    if current_id:
        query = query.filter(ProductModel.id != current_id)
    if query.first():
        slug = f"{slug}-{int(datetime.now().timestamp())}"
    return slug

# 2. CREAR
@router.post("/", response_model=Product)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(ProductModel).filter(ProductModel.ref == product.ref).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"La referencia '{product.ref}' ya existe en el inventario")

    data = product.model_dump()
    if not data.get("slug"):
        data["slug"] = generate_product_slug(data["ref"], data.get("name", ""), db)

    new_product = ProductModel(**data)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

# 3. ACTUALIZAR (Edici?n completa o parcial)
@router.put("/{product_id}", response_model=Product)
def update_product(product_id: int, product_data: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    update_data = product_data.model_dump(exclude_unset=True)
    
    if "ref" in update_data and update_data["ref"] != db_product.ref:
        existing = db.query(ProductModel).filter(ProductModel.ref == update_data["ref"]).first()
        if existing and existing.id != product_id:
            raise HTTPException(status_code=400, detail=f"La referencia '{update_data['ref']}' ya est? en uso por otro producto")

    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    # Si se actualizó price_sale y es un producto padre, propagar a sus variantes
    if "price_sale" in update_data and update_data["price_sale"] is not None:
        db.query(ProductModel).filter(ProductModel.parent_id == product_id).update(
            {"price_sale": update_data["price_sale"]}
        )
    
    if not db_product.slug:
        db_product.slug = generate_product_slug(db_product.ref, db_product.name or "", db, current_id=product_id)

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

# 5b. SUBIR IMAGEN A SUPABASE STORAGE Y VINCULAR AL PRODUCTO O VARIANTE
SUPABASE_URL = "https://rnlvzrelpvqjamcfvoga.supabase.co"

@router.post("/{product_id}/upload-image", tags=["Productos"])
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    replace: bool = Query(False),
    db: Session = Depends(get_db)
):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not supabase_key:
        raise HTTPException(status_code=500, detail="Falta configurar SUPABASE_SERVICE_KEY en Render")

    # Nombre limpio para la foto
    clean_ref = re.sub(r'[^a-zA-Z0-9_-]', '_', product.ref or f"prod_{product.id}").lower()
    unique_suffix = uuid.uuid4().hex[:8]
    filename = f"{clean_ref}_{unique_suffix}.webp"

    # Subir directo al bucket público 'products' de Supabase Storage
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "image/webp",
        "x-upsert": "true"
    }
    storage_url = f"{SUPABASE_URL}/storage/v1/object/products/{filename}"

    async with httpx.AsyncClient(timeout=25.0) as client:
        r = await client.post(storage_url, content=contents, headers=headers)
        if r.status_code not in (200, 201):
            r = await client.put(storage_url, content=contents, headers=headers)
            if r.status_code not in (200, 201):
                raise HTTPException(status_code=500, detail=f"Error al subir a Supabase Storage: {r.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/products/{filename}"

    # Si se pide reemplazar o es una variante individual (con parent_id), fijar como foto principal única
    if replace or product.parent_id is not None:
        product.images = [public_url]
    else:
        current_imgs = list(product.images) if isinstance(product.images, list) else []
        if public_url not in current_imgs:
            current_imgs.append(public_url)
        product.images = current_imgs
    db.commit()
    db.refresh(product)

    return {
        "message": "Imagen subida exitosamente",
        "image_url": public_url,
        "images": product.images
    }


@router.delete("/{product_id}/images", tags=["Productos"])
def remove_product_image(
    product_id: int,
    image_url: str = Query(...),
    db: Session = Depends(get_db)
):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    current_imgs = list(product.images) if isinstance(product.images, list) else []
    new_imgs = [img for img in current_imgs if img != image_url]
    product.images = new_imgs
    db.commit()
    db.refresh(product)
    return {"message": "Imagen eliminada", "images": product.images}



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
        db.query(ProductModel).filter(ProductModel.parent_id == product.id).update(
            {"price_sale": data.new_price_sale}
        )

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
        # Propagar a variantes si es padre
        db.query(ProductModel).filter(ProductModel.parent_id == product_id).update(
            {"price_sale": price_sale}
        )
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
        db.query(ProductModel).filter(ProductModel.parent_id == product.id).update(
            {"price_sale": data.new_price_sale}
        )

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

# 11. HISTORIAL DE ENTRADAS - RECEPCIÓN DE PEDIDO EN BLOQUE (LOTE COMPLETO)
@router.post("/batch-entries", response_model=BatchStockEntryResponse)
def create_batch_stock_entries(data: BatchStockEntryRequest, db: Session = Depends(get_db)):
    # 1. Buscar o Crear Prenda Base
    base_product = None
    if data.product_id:
        base_product = db.query(ProductModel).filter(ProductModel.id == data.product_id).first()
    if not base_product and data.base_ref:
        base_product = db.query(ProductModel).filter(ProductModel.ref == data.base_ref.strip().upper(), ProductModel.parent_id == None).first()
        if not base_product:
            # Buscar cualquier prenda que coincida con la ref base
            base_product = db.query(ProductModel).filter(ProductModel.ref == data.base_ref.strip().upper()).first()

    if not base_product:
        if not data.is_new_base and not data.base_ref:
            raise HTTPException(status_code=404, detail="Referencia base no encontrada y no se especificó creación de prenda nueva")
        
        # Crear Prenda Base
        clean_ref = data.base_ref.strip().upper()
        base_name = data.base_name.strip() if data.base_name else f"PRENDA {clean_ref}"
        base_product = ProductModel(
            ref=clean_ref,
            name=base_name,
            category=data.category or "Hombre",
            subcategory=data.subcategory or "General",
            brand=data.brand or "Estilo Nórdico",
            origin="Propio",
            price_sale=data.base_price_sale or 0.0,
            my_cost=round(data.unit_cost, 2),
            stock=0,
            initial_stock=0,
            entry_count=0,
            current_cost_total=0.0,
            product_type="ROPA",
            is_published=False,
            slug=generate_product_slug(clean_ref, base_name, db)
        )
        db.add(base_product)
        db.flush()

    # Si se pasó un nuevo precio de venta base, actualizarlo
    if data.base_price_sale is not None and data.base_price_sale > 0:
        base_product.price_sale = data.base_price_sale

    entries_created = 0
    variants_created = 0
    total_units = 0
    unit_cost = data.unit_cost

    # 2. Procesar cada ítem del lote
    for item in data.items:
        qty = item.quantity
        if qty <= 0:
            continue

        clean_color = item.color.strip().upper()
        clean_size = item.size.strip().upper()
        item_brand = item.brand.strip().upper() if item.brand else (base_product.brand or "Estilo Nórdico")
        
        # Generar SKU estándar: [REF]-[COLOR]-[TALLA] o [REF]-[MARCA]-[COLOR]-[TALLA]
        color_slug = clean_color.replace(" ", "-")
        brand_slug = item_brand.replace(" ", "-") if item_brand and item_brand not in ["ESTILO NÓRDICO", "ESTILO NORDICO"] else ""
        
        if brand_slug:
            sku = f"{base_product.ref}-{brand_slug}-{color_slug}-{clean_size}"
            variant_name = f"{base_product.name.strip()} {item_brand} {clean_color} {clean_size}"
        else:
            sku = f"{base_product.ref}-{color_slug}-{clean_size}"
            variant_name = f"{base_product.name.strip()} {clean_color} {clean_size}"

        # Buscar si ya existe la variante
        variant = db.query(ProductModel).filter(
            ProductModel.parent_id == base_product.id,
            ProductModel.color == clean_color,
            ProductModel.size == clean_size
        ).first()

        if not variant:
            # Buscar por ref exacta
            variant = db.query(ProductModel).filter(ProductModel.ref == sku).first()

        if not variant:
            # Crear la variante hija
            variant = ProductModel(
                ref=sku,
                name=variant_name,
                category=base_product.category or "Hombre",
                subcategory=base_product.subcategory or "",
                brand=item_brand,
                origin=base_product.origin or "Propio",
                color=clean_color,
                size=clean_size,
                parent_id=base_product.id,
                price_sale=item.new_price_sale or base_product.price_sale or 0.0,
                my_cost=round(unit_cost, 2),
                stock=qty,
                entry_count=qty,
                current_cost_total=round(unit_cost * qty, 2),
                slug=generate_product_slug(sku, variant_name, db),
                product_type=base_product.product_type or "ROPA",
                is_published=False,
                images=base_product.images if base_product.images else []
            )
            db.add(variant)
            db.flush()
            variants_created += 1
        else:
            # Actualizar costo ponderado y stock de la variante existente
            stock_actual = variant.stock or 0
            costo_actual = variant.my_cost or 0.0
            stock_nuevo = stock_actual + qty
            weighted_cost = (stock_actual * costo_actual + qty * unit_cost) / stock_nuevo if stock_nuevo > 0 else unit_cost
            
            variant.stock = stock_nuevo
            variant.entry_count = (variant.entry_count or 0) + qty
            variant.my_cost = round(weighted_cost, 2)
            variant.current_cost_total = round(weighted_cost * stock_nuevo, 2)
            if item.new_price_sale:
                variant.price_sale = item.new_price_sale
            elif data.base_price_sale:
                variant.price_sale = data.base_price_sale

        # 3. Registrar entrada individual en StockEntry
        total_item_cost = round(qty * unit_cost, 2)
        new_entry = StockEntryModel(
            product_id=variant.id,
            quantity=qty,
            unit_cost=unit_cost,
            total_cost=total_item_cost,
            provider=data.provider or "PROVEEDOR GENÉRICO",
            paid_from_cash=False
        )
        db.add(new_entry)
        entries_created += 1
        total_units += qty

    # 4. Actualizar Prenda Base (stock consolidado de todas sus variantes)
    all_children = db.query(ProductModel).filter(ProductModel.parent_id == base_product.id).all()
    if all_children:
        base_product.stock = sum(c.stock or 0 for c in all_children)
    else:
        base_product.stock = (base_product.stock or 0) + total_units

    base_product.entry_count = (base_product.entry_count or 0) + total_units
    base_product.my_cost = round(unit_cost, 2)

    # 5. Si el usuario marcó pagar desde caja, registrar egreso consolidado
    if data.paid_from_cash and total_units > 0:
        total_batch_cost = round(total_units * unit_cost, 2)
        db.add(CashMovementModel(
            description=f"Pago Pedido Lote {base_product.ref} ({total_units} prendas)",
            amount=total_batch_cost,
            type="SALIDA",
            category="REINVERSION"
        ))

    db.commit()
    db.refresh(base_product)

    return BatchStockEntryResponse(
        message=f"Lote de {total_units} prendas registrado exitosamente para la referencia {base_product.ref}",
        base_product_id=base_product.id,
        base_ref=base_product.ref,
        total_units=total_units,
        unit_cost=round(unit_cost, 2),
        total_cost=round(total_units * unit_cost, 2),
        entries_created=entries_created,
        variants_created=variants_created
    )
