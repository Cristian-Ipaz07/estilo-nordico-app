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
    raw_url = WEBHOOK_URLS.get(event, "") or os.getenv(f"WEBHOOK_{event.upper()}", "")
    target_urls = [u.strip() for u in raw_url.split(",") if u.strip()]
    
    # Soporte unificado para Vercel Deploy Hook (si está configurado VERCEL_DEPLOY_HOOK o WEBHOOK_SALE_COMPLETED con vercel.com)
    deploy_hook = os.getenv("VERCEL_DEPLOY_HOOK", "").strip() or os.getenv("WEBHOOK_SALE_COMPLETED", "").strip()
    if deploy_hook and "vercel.com" in deploy_hook:
        if deploy_hook not in target_urls:
            target_urls.append(deploy_hook)

    if not target_urls:
        return  # Sin URL configurada, no hacer nada

    payload = WebhookPayload(
        event=event,
        timestamp=get_colombia_time().isoformat(),
        data=data,
    )

    for url in target_urls:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(url, json=payload.model_dump())
        except Exception as e:
            # Log pero no bloquear la operación principal
            print(f"[Webhook] Error enviando {event} a {url}: {e}")


@router.get("/config")
def get_webhook_config():
    """Muestra la configuración actual de webhooks (sin secretos)."""
    return {
        event: {"url": url, "active": bool(url)}
        for event, url in WEBHOOK_URLS.items()
    }
