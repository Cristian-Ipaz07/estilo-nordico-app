from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Usuario embebido en la respuesta de nómina ────────────────────────────────
class UserInPayroll(BaseModel):
    id: int
    full_name: Optional[str] = None
    username: Optional[str] = None
    comision_pct: Optional[float] = 0.0

    class Config:
        from_attributes = True


# ── Corte Payroll ─────────────────────────────────────────────────────────────
class CortePayrollCreate(BaseModel):
    user_id: int
    periodo_start: str
    periodo_end: str
    horas: Optional[float] = 0.0
    valor_hora: Optional[float] = 5000.0


class CortePayrollUpdate(BaseModel):
    horas: Optional[float] = None
    valor_hora: Optional[float] = None


class CortePayrollResponse(BaseModel):
    id: int
    user_id: int
    periodo_start: str
    periodo_end: str
    horas: Optional[float] = 0.0
    valor_hora: Optional[float] = 5000.0
    total_salario: Optional[float] = 0.0
    pagado: Optional[bool] = False
    cash_movement_id: Optional[int] = None
    created_at: datetime
    user: Optional[UserInPayroll] = None

    class Config:
        from_attributes = True


# ── Corte Config (socios) ─────────────────────────────────────────────────────
class CorteConfigCreate(BaseModel):
    periodo_start: str
    periodo_end: str
    pct_cristian: Optional[float] = 16.0
    pct_david: Optional[float] = 51.0
    pct_estefania: Optional[float] = 33.0
    monto_distribuir: Optional[float] = 0.0
    ajuste_inventario: Optional[float] = 0.0


class CorteConfigResponse(CorteConfigCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
