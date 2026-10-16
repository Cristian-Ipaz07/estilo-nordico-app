"""
API Pública — Endpoints de solo lectura para la tienda web.
NO requiere autenticación. NO expone datos financieros (my_cost, cost_total, etc).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.models.product import Product as ProductModel
from app.schemas.product import ProductPublic

router = APIRouter()


@router.get("/products", response_model=List[ProductPublic])
def list_public_products(
    product_type: Optional[str] = Query(None, description="Filtrar por tipo: CHAQUETA, PERFUME, RELOJ, ROPA, ACCESORIO"),
    category: Optional[str] = Query(None, description="Filtrar por categoría: Hombre, Mujer, Unisex"),
    subcategory: Optional[str] = Query(None, description="Filtrar por subcategoría: Camiseta, Buso, Pantalon, etc."),
    brand: Optional[str] = Query(None, description="Filtrar por marca: Yanbal, Avon, etc."),
    in_stock: Optional[bool] = Query(None, description="Solo productos con stock > 0"),
    search: Optional[str] = Query(None, description="Búsqueda por nombre o referencia"),
    limit: int = Query(100, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Lista productos publicados para la tienda web."""
    # Auto-publicar variantes de chaquetas 5080 para asegurar sincronización en vivo con la web
    try:
        db.query(ProductModel).filter(
            ProductModel.ref.ilike("5080%"),
            ProductModel.is_published == False
        ).update({"is_published": True}, synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

    query = db.query(ProductModel).filter(
        ProductModel.is_published == True,
        ProductModel.is_active == True,
    )

    if product_type:
        query = query.filter(ProductModel.product_type == product_type.upper())
    if category:
        query = query.filter(ProductModel.category.ilike(f"%{category}%"))
    if subcategory:
        query = query.filter(ProductModel.subcategory.ilike(f"%{subcategory}%"))
    if brand:
        query = query.filter(ProductModel.brand.ilike(f"%{brand}%"))
    if in_stock is True:
        query = query.filter(ProductModel.stock > 0)
    if search:
        query = query.filter(
            (ProductModel.name.ilike(f"%{search}%")) |
            (ProductModel.ref.ilike(f"%{search}%"))
        )

    total = query.count()
    products = query.order_by(ProductModel.product_type, ProductModel.name).offset(offset).limit(limit).all()

    return products


@router.get("/products/{slug}", response_model=ProductPublic)
def get_public_product(slug: str, db: Session = Depends(get_db)):
    """Obtiene un producto individual por su slug (URL-friendly)."""
    product = db.query(ProductModel).filter(
        ProductModel.slug == slug,
        ProductModel.is_published == True,
        ProductModel.is_active == True,
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return product


@router.get("/products/id/{product_id}", response_model=ProductPublic)
def get_public_product_by_id(product_id: int, db: Session = Depends(get_db)):
    """Obtiene un producto individual por ID (fallback si no tiene slug)."""
    product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.is_published == True,
        ProductModel.is_active == True,
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return product


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Lista las categorías de productos disponibles con conteo."""
    from sqlalchemy import func
    results = db.query(
        ProductModel.product_type,
        func.count(ProductModel.id).label("count")
    ).filter(
        ProductModel.is_published == True,
        ProductModel.is_active == True,
    ).group_by(ProductModel.product_type).all()

    return [{"type": r[0], "count": r[1]} for r in results]


@router.get("/stock-check/{product_id}")
def check_stock(product_id: int, db: Session = Depends(get_db)):
    """Consulta rápida de stock para la web (tiempo real)."""
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {
        "id": product.id,
        "stock": product.stock,
        "available": (product.stock or 0) > 0
    }


@router.get("/navigation")
def get_public_navigation(db: Session = Depends(get_db)):
    """Retorna los departamentos y subcategorías que tienen productos ACTIVOS, PUBLICADOS y CON STOCK > 0."""
    from sqlalchemy import func
    
    results = db.query(
        ProductModel.category,
        ProductModel.subcategory,
        func.count(ProductModel.id).label("product_count"),
        func.sum(ProductModel.stock).label("total_stock")
    ).filter(
        ProductModel.is_published == True,
        ProductModel.is_active == True,
        ProductModel.stock > 0
    ).group_by(
        ProductModel.category,
        ProductModel.subcategory
    ).all()

    departments_map = {}
    for r in results:
        dept = (r[0] or "HOMBRE").strip().upper()
        subcat = (r[1] or "").strip().upper()
        if not subcat:
            continue
            
        if dept not in departments_map:
            departments_map[dept] = []
            
        departments_map[dept].append({
            "name": subcat.capitalize(),
            "code": subcat,
            "product_count": r[2],
            "total_stock": int(r[3] or 0)
        })

    active_subcategories = list(set((r[1] or "").strip().upper() for r in results if r[1]))

    return {
        "departments": departments_map,
        "active_subcategories": active_subcategories
    }
