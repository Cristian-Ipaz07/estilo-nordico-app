from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from app.db.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.payment_history import PaymentHistory
from app.models.cash_movement import CashMovement
from app.schemas.sale import SaleCreate, SaleUpdate, SaleResponse, PaymentUpdate
from typing import List, Optional
import asyncio
from app.api.endpoints.webhooks import emit_webhook
from datetime import datetime, timezone, timedelta

router = APIRouter()

# Zona horaria Colombia UTC-5
TZ_CO = timezone(timedelta(hours=-5))

def parse_sale_date(date_str: str) -> datetime:
    """Convierte 'YYYY-MM-DD' a datetime en mediodia de Colombia (seguro para timezones)."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    # Mediodía en Colombia → sin ambigüedad de día por timezone
    return datetime(d.year, d.month, d.day, 12, 0, 0, tzinfo=TZ_CO)

def get_colombia_now() -> datetime:
    return datetime.now(TZ_CO)


@router.get("/cogs")
def get_cogs(start: Optional[str] = None, end: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Calcula el Costo de Mercancía Vendida (COGS) real:
    COGS = SUM(item.quantity × product.my_cost) para las ventas en el rango.
    """
    query = db.query(
        func.coalesce(func.sum(SaleItem.quantity * Product.my_cost), 0)
    ).join(
        Product, SaleItem.product_id == Product.id
    ).join(
        Sale, SaleItem.sale_id == Sale.id
    )
    if start:
        query = query.filter(func.date(Sale.created_at) >= start)
    if end:
        query = query.filter(func.date(Sale.created_at) <= end)

    cogs_total = query.scalar() or 0
    return {"cogs_total": round(cogs_total, 2)}


# ── GET / — listar ventas (más recientes primero) ────────────────────────────
@router.get("/", response_model=List[SaleResponse])
def read_sales(status: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Sale).options(
            selectinload(Sale.items).selectinload(SaleItem.product),
            selectinload(Sale.payment_history),
            selectinload(Sale.user),
            selectinload(Sale.creator)
        )
        if status:
            query = query.filter(Sale.status == status)
        return query.order_by(Sale.created_at.desc()).all()
    except Exception as e:
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            db.execute(text("ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS account VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            db.commit()
            query = db.query(Sale).options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.payment_history),
                selectinload(Sale.user)
            )
            if status:
                query = query.filter(Sale.status == status)
            return query.order_by(Sale.created_at.desc()).all()
        except Exception:
            raise e


# ── POST / — crear venta ─────────────────────────────────────────────────────
@router.post("/", response_model=SaleResponse)
def create_sale(sale_data: SaleCreate, db: Session = Depends(get_db)):
    # Bug 1 fix: si viene sale_date retroactiva, usarla como created_at
    if sale_data.sale_date:
        try:
            created_at_val = parse_sale_date(sale_data.sale_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    else:
        created_at_val = get_colombia_now()

    # Determinar estado: en_domicilio, por_confirmar, separado o pagado
    if sale_data.status in ("en_domicilio", "por_confirmar"):
        status = sale_data.status
    else:
        is_separado = sale_data.amount_paid < sale_data.total_price
        status = "separado" if is_separado else "pagado"

    new_sale = Sale(
        customer_name=sale_data.customer_name,
        total_sale=sale_data.total_price,
        amount_paid=sale_data.amount_paid,
        balance_due=max(0.0, sale_data.total_price - sale_data.amount_paid),
        status=status,
        sale_channel=sale_data.sale_channel or "LOCAL",
        payment_method=sale_data.payment_method or "EFECTIVO_TIENDA",
        user_id=sale_data.user_id,
        created_by=sale_data.created_by,
        created_at=created_at_val,
        delivery_address=sale_data.delivery_address,
        delivery_notes=sale_data.delivery_notes,
    )

    db.add(new_sale)
    db.flush()

    # Registrar historial de abonos / pagos iniciales
    if sale_data.payments and len(sale_data.payments) > 0:
        for p in sale_data.payments:
            p_amt = float(p.get("amount") or 0.0)
            if p_amt > 0:
                p_acc = p.get("account") or sale_data.payment_method or "EFECTIVO_TIENDA"
                p_notes = p.get("notes") or f"Pago inicial ({p_acc})"
                db.add(PaymentHistory(
                    sale_id=new_sale.id,
                    amount=p_amt,
                    account=p_acc,
                    payment_date=created_at_val,
                    notes=p_notes
                ))
    elif sale_data.amount_paid > 0:
        db.add(PaymentHistory(
            sale_id=new_sale.id,
            amount=sale_data.amount_paid,
            account=sale_data.payment_method or "EFECTIVO_TIENDA",
            payment_date=created_at_val,
            notes=f"Pago inicial ({sale_data.payment_method or 'EFECTIVO_TIENDA'})"
        ))

    # Procesar cada producto del carrito
    for item in sale_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()

        if not product or product.stock < item.quantity:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para: {product.name if product else 'ID ' + str(item.product_id)}"
            )

        product.stock -= item.quantity

        sale_item = SaleItem(
            sale_id=new_sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price_at_sale=item.unit_price,                  # precio REAL vendido (con descuento)
            total_item=item.quantity * item.unit_price,
            original_price=product.price_sale or 0.0,       # precio de lista (para ver descuento)
        )
        db.add(sale_item)

    db.commit()
    db.refresh(new_sale)

    # -- Webhook: Notificar venta completada (Fase 1.5) --
    try:
        sale_data_webhook = {
            "sale_id": new_sale.id,
            "customer": new_sale.customer_name,
            "total": new_sale.total_sale,
            "status": new_sale.status,
            "items": [
                {
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "price": item.price_at_sale,
                }
                for item in new_sale.items
            ],
        }
        asyncio.create_task(emit_webhook("sale_completed", sale_data_webhook))
    except Exception:
        pass  # No bloquear la venta por un webhook fallido

    return new_sale


# ── PUT /{sale_id} — editar venta ────────────────────────────────────────────
@router.put("/{sale_id}", response_model=SaleResponse)
def update_sale(sale_id: int, sale_data: SaleUpdate, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if sale_data.customer_name is not None:
        db_sale.customer_name = sale_data.customer_name

    # El "vendedor" se guarda en sale_channel para compatibilidad con el modelo actual
    if sale_data.seller is not None:
        db_sale.sale_channel = sale_data.seller
    if sale_data.user_id is not None:
        db_sale.user_id = sale_data.user_id
    if sale_data.created_by is not None:
        db_sale.created_by = sale_data.created_by
    if sale_data.payment_method is not None:
        db_sale.payment_method = sale_data.payment_method

    if sale_data.amount_paid is not None:
        db_sale.amount_paid = sale_data.amount_paid
        db_sale.balance_due = max(0.0, db_sale.total_sale - sale_data.amount_paid)
        if sale_data.status is None:
            db_sale.status = "pagado" if db_sale.balance_due <= 0 else "separado"

    if sale_data.status is not None:
        db_sale.status = sale_data.status

    if sale_data.delivery_address is not None:
        db_sale.delivery_address = sale_data.delivery_address

    if sale_data.delivery_notes is not None:
        db_sale.delivery_notes = sale_data.delivery_notes

    if sale_data.sale_date:
        try:
            db_sale.created_at = parse_sale_date(sale_data.sale_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    db.commit()
    db.refresh(db_sale)
    return db_sale


# ── PATCH /{sale_id}/payment — registrar abono ───────────────────────────────
@router.patch("/{sale_id}/payment")
def register_payment(
    sale_id: int, amount: float,
    account: Optional[str] = "EFECTIVO_TIENDA",
    payment_date: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    db_sale.amount_paid += amount
    db_sale.balance_due = max(0, db_sale.total_sale - db_sale.amount_paid)

    if db_sale.balance_due <= 0:
        db_sale.status = "pagado"

    # Registrar el abono en el historial
    payment = PaymentHistory(
        sale_id=db_sale.id,
        amount=amount,
        account=account or "EFECTIVO_TIENDA",
        notes=notes or f"Abono registrado ({account or 'EFECTIVO_TIENDA'})"
    )
    if payment_date:
        try:
            payment.payment_date = parse_sale_date(payment_date)
        except ValueError:
            pass # fallback to default

    db.add(payment)
    db.commit()
    return {"message": "Abono registrado", "nuevo_saldo": db_sale.balance_due}


# ── DELETE /{sale_id}/payments/{payment_id} — eliminar abono erróneo ─────────
@router.delete("/{sale_id}/payments/{payment_id}")
def delete_payment(sale_id: int, payment_id: int, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    payment = db.query(PaymentHistory).filter(PaymentHistory.id == payment_id, PaymentHistory.sale_id == sale_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Abono no encontrado en esta venta")

    db_sale.amount_paid = max(0.0, db_sale.amount_paid - payment.amount)
    db_sale.balance_due = max(0.0, db_sale.total_sale - db_sale.amount_paid)
    if db_sale.balance_due > 0 and db_sale.status == "pagado":
        db_sale.status = "separado"

    db.delete(payment)
    db.commit()
    db.refresh(db_sale)
    return {"message": "Abono eliminado exitosamente", "nuevo_saldo": db_sale.balance_due, "amount_paid": db_sale.amount_paid}


# ── PUT /{sale_id}/payments/{payment_id} — editar fecha/monto/notas del abono ─
@router.put("/{sale_id}/payments/{payment_id}")
def update_payment(sale_id: int, payment_id: int, payment_data: PaymentUpdate, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    payment = db.query(PaymentHistory).filter(PaymentHistory.id == payment_id, PaymentHistory.sale_id == sale_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Abono no encontrado")

    if payment_data.amount is not None:
        diff = payment_data.amount - payment.amount
        payment.amount = payment_data.amount
        db_sale.amount_paid = max(0.0, db_sale.amount_paid + diff)
        db_sale.balance_due = max(0.0, db_sale.total_sale - db_sale.amount_paid)
        db_sale.status = "pagado" if db_sale.balance_due <= 0 else "separado"

    if payment_data.payment_date:
        try:
            payment.payment_date = parse_sale_date(payment_data.payment_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    if payment_data.account is not None:
        payment.account = payment_data.account
    if payment_data.notes is not None:
        payment.notes = payment_data.notes

    db.commit()
    db.refresh(db_sale)
    return {"message": "Abono actualizado", "nuevo_saldo": db_sale.balance_due, "amount_paid": db_sale.amount_paid}


# ── POST /{sale_id}/payments/{payment_id}/transfer — transferir abono a otra venta ─
@router.post("/{sale_id}/payments/{payment_id}/transfer")
def transfer_payment(sale_id: int, payment_id: int, target_sale_id: int, db: Session = Depends(get_db)):
    source_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    target_sale = db.query(Sale).filter(Sale.id == target_sale_id).first()
    if not source_sale:
        raise HTTPException(status_code=404, detail="Venta origen no encontrada")
    if not target_sale:
        raise HTTPException(status_code=404, detail="Venta destino no encontrada")
    
    payment = db.query(PaymentHistory).filter(PaymentHistory.id == payment_id, PaymentHistory.sale_id == sale_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Abono no encontrado en la venta origen")

    amount = payment.amount

    # Actualizar venta origen
    source_sale.amount_paid = max(0.0, source_sale.amount_paid - amount)
    source_sale.balance_due = max(0.0, source_sale.total_sale - source_sale.amount_paid)
    if source_sale.balance_due > 0 and source_sale.status == "pagado":
        source_sale.status = "separado"

    # Actualizar venta destino
    target_sale.amount_paid += amount
    target_sale.balance_due = max(0.0, target_sale.total_sale - target_sale.amount_paid)
    if target_sale.balance_due <= 0:
        target_sale.status = "pagado"

    # Reasignar el abono a la venta destino
    payment.sale_id = target_sale.id
    payment.notes = f"Transferido desde Venta #{source_sale.id} ({source_sale.customer_name})"

    db.commit()
    return {
        "message": f"Abono de ${amount:,.0f} transferido exitosamente a Venta #{target_sale.id} ({target_sale.customer_name})",
        "source_balance": source_sale.balance_due,
        "target_balance": target_sale.balance_due
    }


# ── DELETE /{sale_id} — eliminar venta y restituir stock ─────────────────────
@router.delete("/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    # Restituir stock de cada item si no estaba ya cancelado
    if db_sale.status != "cancelado":
        for item in db_sale.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.stock += item.quantity

    db.delete(db_sale)
    db.commit()
    return {"message": f"Venta #{sale_id} eliminada y stock restituido"}


# ── GET /{sale_id} — obtener venta individual ────────────────────────────────
@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return db_sale

# ?? POST /{sale_id}/confirm-delivery ? asentar cobro y entrega ??????????????
@router.post("/{sale_id}/confirm-delivery", response_model=SaleResponse)
def confirm_delivery(sale_id: int, account: Optional[str] = "EFECTIVO_TIENDA", register_cash: bool = True, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    amount_to_pay = db_sale.balance_due if db_sale.balance_due > 0 else (db_sale.total_sale - db_sale.amount_paid)
    db_sale.amount_paid = db_sale.total_sale
    db_sale.balance_due = 0.0
    db_sale.status = "pagado"

    if amount_to_pay > 0:
        acc = account or "EFECTIVO_TIENDA"
        db.add(PaymentHistory(
            sale_id=db_sale.id,
            amount=amount_to_pay,
            account=acc,
            notes=f"Cobro contraentrega domicilio confirmado ({acc})",
            payment_date=get_colombia_now()
        ))

        if register_cash:
            db.add(CashMovement(
                description=f"Cobro Domicilio Venta #{db_sale.id} - {db_sale.customer_name}",
                amount=amount_to_pay,
                type="ENTRADA",
                category="VENTA",
                account=acc
            ))

    db.commit()
    db.refresh(db_sale)
    return db_sale


# ?? POST /{sale_id}/cancel-delivery ? cliente rechaza, devolver stock ??????
@router.post("/{sale_id}/cancel-delivery", response_model=SaleResponse)
def cancel_delivery(sale_id: int, db: Session = Depends(get_db)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if db_sale.status == "cancelado":
        raise HTTPException(status_code=400, detail="Este pedido ya fue cancelado")

    # Restituir stock
    for item in db_sale.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            prod.stock += item.quantity

    db_sale.status = "cancelado"
    db.commit()
    db.refresh(db_sale)
    return db_sale
