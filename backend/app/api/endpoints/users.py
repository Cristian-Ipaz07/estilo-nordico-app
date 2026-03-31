from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

from app.db.database import get_db
from app.models.user import User as UserModel
from app.schemas.user import User, UserCreate, Token # Importamos los esquemas
from app.core import security # Para encriptar y crear tokens
from app.crud import users as crud_users # Para usar la lógica de guardado

router = APIRouter()

# 1. RUTA PARA CREAR USUARIO (Con Encriptación)
@router.post("/", response_model=User)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    
    # Usamos la función de seguridad para encriptar antes de guardar
    hashed_password = security.get_password_hash(user.password)
    
    new_user = UserModel(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password # <--- Ahora es segura
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 2. RUTA PARA LOGIN (Obtener el acceso)
@router.post("/login")
def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(UserModel).filter(UserModel.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )
    
    access_token = security.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# 3. VER TODOS LOS USUARIOS (Tu código original)
@router.get("/", response_model=List[User])
def get_users(db: Session = Depends(get_db)):
    return db.query(UserModel).all()