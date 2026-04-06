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

router = APIRouter()

class CashMovementCreate(BaseModel):
    description: str
    amount: float
    type: str # 'ENTRADA' or 'SALIDA'
    category: str
    payment_date: Optional[str] = None # Allow client to specify or default
    
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
    db_movement = CashMovement(
        description=movement.description,
        amount=movement.amount,
        type=movement.type,
        category=movement.category
    )
    if movement.payment_date:
        # Convert YYYY-MM-DD or standard ISO to datetime correctly, here we just try parsing standard
        try:
           db_movement.payment_date = datetime.fromisoformat(movement.payment_date)
        except:
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
    # To maintain consistency, we should maybe not allow deleting, but let's provide it just in case non-CIERRE CAJA
    mov = db.query(CashMovement).filter(CashMovement.id == movement_id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movement not found")
    
    db.delete(mov)
    db.commit()
    return {"message": "Movement deleted"}
