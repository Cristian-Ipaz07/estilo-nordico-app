"""
Sistema de Webhooks — Emite eventos cuando ocurren acciones en el ERP.
Permite que n8n, la web y otros sistemas reaccionen automáticamente.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.database import get_db
import httpx
import asyncio
import os
import json
from datetime import datetime, timezone, timedelta

router = APIRouter()

def get_colombia_time():
    return datetime.now(timezone(timedelta(hours=-5)))

# ── Configuración de webhooks ────────────────────────────────────────────────
# URLs de destino para notificaciones (configurables via .env)
WEBHOOK_URLS = {
    "sale_completed": os.getenv("WEBHOOK_SALE_COMPLETED", ""),
    "stock_updated": os.getenv("WEBHOOK_STOCK_UPDATED", ""),
    "product_published": os.getenv("WEBHOOK_PRODUCT_PUBLISHED", ""),
}


class WebhookPayload(BaseModel):
    event: str
    timestamp: str
    data: dict


async def emit_webhook(event: str, data: dict):
    """Envía el payload del webhook a las URLs configuradas de forma asíncrona."""
    url = WEBHOOK_URLS.get(event, "")
    if not url:
        return  # Sin URL configurada, no hacer nada

    payload = WebhookPayload(
        event=event,
        timestamp=get_colombia_time().isoformat(),
        data=data,
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json=payload.model_dump())
    except Exception as e:
        # Log pero no bloquear la operación principal
        print(f"[Webhook] Error enviando {event}: {e}")


@router.get("/config")
def get_webhook_config():
    """Muestra la configuración actual de webhooks (sin secretos)."""
    return {
        event: {"url": url, "active": bool(url)}
        for event, url in WEBHOOK_URLS.items()
    }
