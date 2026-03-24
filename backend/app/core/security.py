from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuración de seguridad
SECRET_KEY = "tu_clave_secreta_super_segura_aqui" # Cambia esto luego
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # El token dura 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str):
    # Recortamos a 72 caracteres para evitar el error de bcrypt
    # y nos aseguramos de que sea un string limpio.
    safe_password = password[:72] 
    return pwd_context.hash(safe_password)

def verify_password(plain_password: str, hashed_password: str):
    # También recortamos aquí para que la validación coincida
    safe_password = plain_password[:72]
    return pwd_context.verify(safe_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt