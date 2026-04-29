from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.models.corte_payroll import CortePayroll, CorteConfig
from app.models.user import User
from app.models.cash_movement import CashMovement
from app.schemas.corte_payroll import (
    CortePayrollCreate, CortePayrollUpdate, CortePayrollResponse,
    CorteConfigCreate, CorteConfigResponse
)

router = APIRouter()


# ── NÓMINA ────────────────────────────────────────────────────────────────────

@router.get("/payroll", response_model=List[CortePayrollResponse])
def get_payroll(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista los registros de nómina de un período. Si no existe el período, 
    lo inicializa con todos los usuarios activos y valor_hora=5000."""
    query = db.query(CortePayroll)
    if start:
        query = query.filter(CortePayroll.periodo_start == start)
    if end:
        query = query.filter(CortePayroll.periodo_end == end)

    records = query.all()

    # Auto-inicializar si no hay registros para este período
    if not records and start and end:
        users = db.query(User).filter(User.status == "Activo").all()
        for u in users:
            rec = CortePayroll(
                user_id=u.id,
                periodo_start=start,
                periodo_end=end,
                horas=0.0,
                valor_hora=5000.0,
                total_salario=0.0,
                pagado=False
            )
            db.add(rec)
        db.commit()
        records = query.all()

    return records


@router.post("/payroll/sync", response_model=List[CortePayrollResponse])
def sync_payroll_users(
    start: str,
    end: str,
    db: Session = Depends(get_db)
):
    """Sincroniza usuarios activos en un período de nómina.
    Detecta usuarios activos que NO tienen registro en el período dado
    y los crea automáticamente, sin tocar los registros existentes."""
    existing_user_ids = {
        r.user_id
        for r in db.query(CortePayroll).filter(
            CortePayroll.periodo_start == start,
            CortePayroll.periodo_end == end
        ).all()
    }

    users = db.query(User).filter(User.status == "Activo").all()
    added = []
    for u in users:
        if u.id not in existing_user_ids:
            rec = CortePayroll(
                user_id=u.id,
                periodo_start=start,
                periodo_end=end,
                horas=0.0,
                valor_hora=5000.0,
                total_salario=0.0,
                pagado=False
            )
            db.add(rec)
            added.append(rec)

    if added:
        db.commit()
        for r in added:
            db.refresh(r)

    # Devolver todos los registros del período (incluyendo los ya existentes)
    return db.query(CortePayroll).filter(
        CortePayroll.periodo_start == start,
        CortePayroll.periodo_end == end
    ).all()


@router.put("/payroll/{record_id}", response_model=CortePayrollResponse)
def update_payroll(record_id: int, data: CortePayrollUpdate, db: Session = Depends(get_db)):
    """Actualiza horas y/o valor_hora de un registro de nómina. 
    Recalcula total_salario automáticamente."""
    rec = db.query(CortePayroll).filter(CortePayroll.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registro de nómina no encontrado")
    if rec.pagado:
        raise HTTPException(status_code=400, detail="Este pago ya fue marcado como pagado y no puede modificarse")

    if data.horas is not None:
        rec.horas = data.horas
    if data.valor_hora is not None:
        rec.valor_hora = data.valor_hora

    rec.total_salario = round((rec.horas or 0) * (rec.valor_hora or 0), 2)
    db.commit()
    db.refresh(rec)
    return rec


@router.post("/payroll/{record_id}/pagar")
def pagar_nomina(record_id: int, db: Session = Depends(get_db)):
    """Marca el registro como pagado y crea un movimiento de SALIDA en Caja."""
    rec = db.query(CortePayroll).filter(CortePayroll.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if rec.pagado:
        raise HTTPException(status_code=400, detail="Este salario ya fue pagado")
    if not rec.total_salario or rec.total_salario <= 0:
        raise HTTPException(status_code=400, detail="El total del salario debe ser mayor a 0 antes de marcar como pagado")

    nombre = rec.user.full_name if rec.user else f"Usuario #{rec.user_id}"

    # Crear movimiento de caja
    mov = CashMovement(
        description=f"SALARIO {nombre.upper()} — {rec.periodo_start} al {rec.periodo_end}",
        amount=rec.total_salario,
        type="SALIDA",
        category="SALARIO"
    )
    db.add(mov)
    db.flush()

    rec.pagado = True
    rec.cash_movement_id = mov.id
    db.commit()
    db.refresh(rec)

    return {
        "message": f"Salario de {nombre} registrado en caja exitosamente",
        "salario": rec.total_salario,
        "cash_movement_id": mov.id
    }


# ── CONFIGURACIÓN DE SOCIOS ───────────────────────────────────────────────────

@router.get("/config", response_model=Optional[CorteConfigResponse])
def get_config(start: str, end: str, db: Session = Depends(get_db)):
    """Obtiene la configuración de un corte específico (porcentajes de socios, monto a distribuir)."""
    cfg = db.query(CorteConfig).filter(
        CorteConfig.periodo_start == start,
        CorteConfig.periodo_end == end
    ).first()
    return cfg  # Puede ser None si es el primer corte de ese período


@router.post("/config", response_model=CorteConfigResponse)
def upsert_config(data: CorteConfigCreate, db: Session = Depends(get_db)):
    """Crea o actualiza la configuración de un corte (upsert por período).
    Guarda los porcentajes en la foto del momento para preservar el historial."""
    cfg = db.query(CorteConfig).filter(
        CorteConfig.periodo_start == data.periodo_start,
        CorteConfig.periodo_end == data.periodo_end
    ).first()

    if cfg:
        cfg.pct_cristian = data.pct_cristian
        cfg.pct_david = data.pct_david
        cfg.pct_estefania = data.pct_estefania
        cfg.monto_distribuir = data.monto_distribuir
        cfg.ajuste_inventario = data.ajuste_inventario
    else:
        cfg = CorteConfig(**data.model_dump())
        db.add(cfg)

    db.commit()
    db.refresh(cfg)
    return cfg
