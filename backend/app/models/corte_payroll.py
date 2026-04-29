from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone, timedelta


def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))


class CorteConfig(Base):
    """
    Guarda la configuración de porcentajes de socios POR corte.
    Esto asegura que el historial contable no se vea afectado
    si los porcentajes cambian en el futuro.
    """
    __tablename__ = "corte_config"

    id             = Column(Integer, primary_key=True, index=True)
    periodo_start  = Column(String, nullable=False)       # "2026-04-01"
    periodo_end    = Column(String, nullable=False)        # "2026-04-30"
    # Porcentajes de socios (se guarda la foto del momento del corte)
    pct_cristian   = Column(Float, nullable=True, default=16.0)
    pct_david      = Column(Float, nullable=True, default=51.0)
    pct_estefania  = Column(Float, nullable=True, default=33.0)
    # Monto manual a distribuir (puede diferir de la utilidad neta calculada)
    monto_distribuir = Column(Float, nullable=True, default=0.0)
    # Ajuste de inventario manual (mercancía fuera del sistema)
    ajuste_inventario = Column(Float, nullable=True, default=0.0)
    created_at     = Column(DateTime, default=get_colombia_time)


class CortePayroll(Base):
    """
    Registro de nómina por empleado por período de corte.
    Todos los campos son Optional para no romper datos históricos.
    """
    __tablename__ = "corte_payroll"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    periodo_start  = Column(String, nullable=False)
    periodo_end    = Column(String, nullable=False)
    horas          = Column(Float, nullable=True, default=0.0)
    valor_hora     = Column(Float, nullable=True, default=5000.0)
    total_salario  = Column(Float, nullable=True, default=0.0)
    pagado         = Column(Boolean, nullable=True, default=False)
    cash_movement_id = Column(Integer, nullable=True)  # Referencia al movimiento de caja generado
    created_at     = Column(DateTime, default=get_colombia_time)

    user = relationship("User")
