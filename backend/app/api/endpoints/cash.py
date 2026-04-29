from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta
from app.db.database import get_db
from app.models.cash_movement import CashMovement
from pydantic import BaseModel
from typing import Optional

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

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
    payment_date: Optional[str] = None  # Allow client to specify or default

class CashMovementResponse(BaseModel):
    id: int
    description: str
    amount: float
    type: str
    category: str
    payment_date: datetime
    created_at: datetime

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
    )
    if movement.payment_date:
        try:
            db_movement.payment_date = datetime.fromisoformat(movement.payment_date)
        except Exception:
            pass

    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    return db_movement


@router.get("/", response_model=List[CashMovementResponse])
def get_movements(db: Session = Depends(get_db)):
    return db.query(CashMovement).order_by(CashMovement.created_at.desc()).all()


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
    if movement.payment_date is not None:
        try:
            mov.payment_date = datetime.fromisoformat(movement.payment_date)
        except Exception:
            pass

    db.commit()
    db.refresh(mov)
    return mov

