from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta
from app.db.database import get_db
from app.models.cash_movement import CashMovement
from pydantic import BaseModel
from typing import Optional

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5))).replace(tzinfo=None)

# ── Normalización de categorías ───────────────────────────────────────────────
# Garantiza que variantes históricas ('Otro', 'Otros', 'otro', 'otros')
# siempre queden unificadas como INGRESO_VENTA_EXTERNA.
_CATEGORIA_ALIAS = {
    "otro": "INGRESO_VENTA_EXTERNA",
    "otros": "INGRESO_VENTA_EXTERNA",
}

def normalizar_categoria(categoria: str) -> str:
    """Unifica variantes de categoría a su forma canónica."""
    return _CATEGORIA_ALIAS.get(categoria.strip().lower(), categoria.strip().upper())

router = APIRouter()

class CashMovementCreate(BaseModel):
    description: str
    amount: float
    type: str  # 'ENTRADA' or 'SALIDA'
    category: str
    account: Optional[str] = "EFECTIVO_TIENDA"
    payment_date: Optional[str] = None  # Allow client to specify or default

class CashMovementResponse(BaseModel):
    id: int
    description: str
    amount: float
    type: str
    category: str
    account: Optional[str] = "EFECTIVO_TIENDA"
    payment_date: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.post("/", response_model=CashMovementResponse)
def create_movement(movement: CashMovementCreate, db: Session = Depends(get_db)):
    categoria_normalizada = normalizar_categoria(movement.category)

    db_movement = CashMovement(
        description=movement.description,
        amount=movement.amount,
        type=movement.type,
        category=categoria_normalizada,
        account=movement.account or "EFECTIVO_TIENDA",
    )
    if movement.payment_date:
        try:
            p_date = datetime.fromisoformat(movement.payment_date)
            db_movement.payment_date = p_date
            db_movement.created_at = p_date
        except Exception:
            pass

    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    return db_movement


@router.get("/", response_model=List[CashMovementResponse])
def get_movements(db: Session = Depends(get_db)):
    try:
        return db.query(CashMovement).order_by(CashMovement.created_at.desc()).all()
    except Exception as e:
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS account VARCHAR DEFAULT 'EFECTIVO_TIENDA';"))
            db.commit()
            return db.query(CashMovement).order_by(CashMovement.created_at.desc()).all()
        except Exception:
            raise e


@router.delete("/{movement_id}")
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    mov = db.query(CashMovement).filter(CashMovement.id == movement_id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movement not found")

    db.delete(mov)
    db.commit()
    return {"message": "Movement deleted"}


class CashMovementUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category: Optional[str] = None
    account: Optional[str] = None
    payment_date: Optional[str] = None

@router.put("/{movement_id}", response_model=CashMovementResponse)
def update_movement(movement_id: int, movement: CashMovementUpdate, db: Session = Depends(get_db)):
    mov = db.query(CashMovement).filter(CashMovement.id == movement_id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movement not found")

    if movement.description is not None:
        mov.description = movement.description
    if movement.amount is not None:
        mov.amount = movement.amount
    if movement.type is not None:
        mov.type = movement.type
    if movement.category is not None:
        mov.category = normalizar_categoria(movement.category)
    if movement.account is not None:
        mov.account = movement.account
    if movement.payment_date is not None:
        try:
            mov.payment_date = datetime.fromisoformat(movement.payment_date)
        except Exception:
            pass

    db.commit()
    db.refresh(mov)
    return mov


ACCOUNT_LABELS = {
    "EFECTIVO_TIENDA": "Efectivo Tienda (Gaveta)",
    "NEQUI_CRISTIAN": "Nequi Cristian (Turno Tienda)",
    "NEQUI_DAVID": "Nequi David (Turno Tienda)",
    "EFECTIVO_CASA": "Efectivo en Casa (Caja Mayor)",
    "NEQUI_CASA": "Nequi en Casa (Caja Mayor / Consolidado)",
    "BANCOLOMBIA": "Bancolombia / Cuenta (Casa)",
}

class CashTransferCreate(BaseModel):
    source_account: str
    destination_account: str
    amount: float
    description: Optional[str] = None
    transfer_date: Optional[str] = None

@router.post("/transfer")
def transfer_funds(data: CashTransferCreate, db: Session = Depends(get_db)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto a trasladar debe ser mayor a 0")
    if data.source_account == data.destination_account:
        raise HTTPException(status_code=400, detail="La cuenta de origen y destino deben ser diferentes")

    src_label = ACCOUNT_LABELS.get(data.source_account, data.source_account)
    dst_label = ACCOUNT_LABELS.get(data.destination_account, data.destination_account)
    user_note = f" - {data.description.strip()}" if data.description and data.description.strip() else ""

    p_date = get_colombia_time()
    if data.transfer_date:
        try:
            if "T" in data.transfer_date:
                p_date = datetime.fromisoformat(data.transfer_date)
            else:
                p_date = datetime.strptime(data.transfer_date, "%Y-%m-%d").replace(hour=12, minute=0, second=0, tzinfo=timezone(timedelta(hours=-5)))
        except Exception:
            pass

    out_mov = CashMovement(
        description=f"Traslado enviado a {dst_label}{user_note}",
        amount=data.amount,
        type="SALIDA",
        category="TRASLADO_INTERNO",
        account=data.source_account,
        payment_date=p_date,
        created_at=p_date
    )

    in_mov = CashMovement(
        description=f"Traslado recibido desde {src_label}{user_note}",
        amount=data.amount,
        type="ENTRADA",
        category="TRASLADO_INTERNO",
        account=data.destination_account,
        payment_date=p_date,
        created_at=p_date
    )

    db.add(out_mov)
    db.add(in_mov)
    db.commit()
    db.refresh(out_mov)
    db.refresh(in_mov)

    return {
        "message": f"Traslado de ${data.amount:,.0f} registrado con éxito de {src_label} a {dst_label}",
        "out_movement_id": out_mov.id,
        "in_movement_id": in_mov.id
    }
