from pydantic import BaseModel, EmailStr
from typing import Optional

# Esquema base con los datos comunes
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

# Esquema para CREAR un usuario (Aquí sí pedimos la contraseña)
class UserCreate(UserBase):
    password: str

# Esquema para MOSTRAR un usuario (Aquí NO incluimos la contraseña por seguridad)
class User(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

# Esquema para el TOKEN de acceso (Login)
class Token(BaseModel):
    access_token: str
    token_type: str

# Esquema para los datos que van dentro del Token
class TokenData(BaseModel):
    email: Optional[str] = None