from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserCreate, UserUpdate
from app.core.security import get_password_hash
from app.api.deps import get_current_user, get_current_active_admin

router = APIRouter()

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/", response_model=List[UserOut])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Any active user might need to see the users to select sales
    return db.query(User).all()

@router.post("/", response_model=UserOut)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_active_admin)):
    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")
    
    db_user = User(
        username=user_in.username,
        full_name=user_in.full_name,
        role=user_in.role,
        status=user_in.status,
        vendedor_tipo=user_in.vendedor_tipo, # Nuevo campo
        comision_pct=user_in.comision_pct,   # Nuevo campo
        hashed_password=get_password_hash(user_in.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_active_admin)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data:
        if update_data["password"]: # Solo actualizamos si no es vacío
            db_user.hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]
        
    for field, value in update_data.items():
        setattr(db_user, field, value)
        
    db.commit()
    db.refresh(db_user)
    return db_user