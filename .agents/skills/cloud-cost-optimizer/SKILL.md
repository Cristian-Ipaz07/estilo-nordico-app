---
name: cloud-cost-optimizer
description: Experto en optimización de arquitectura cloud para Supabase (PostgreSQL/Storage), Render (FastAPI/Node) y Vercel. Diseña pipelines WebP client-side, mitigación de Egress, sincronización multi-dispositivo y cachés en memoria para escalar apps sin costos de infraestructura.
---

# 🚀 CLOUD COST OPTIMIZER & PERFORMANCE ARCHITECT
> **Propósito**: Patrones de arquitectura de alta eficiencia para construir aplicaciones web y móviles sobre el Free Tier de Supabase, Render y Vercel sin saturar límites de Egress, Storage ni CPU.

---

## 💎 PATRÓN 1: PIPELINE WEBP CLIENT-SIDE & STORAGE LIMPIO
*Evita subir imágenes crudas (5-10 MB de cámaras móviles) a la nube. Reduce el peso un 98.5% en el navegador antes de la subida.*

### 1. Compresión en el Navegador con Canvas (JavaScript / React)
```javascript
export async function compressImageToWebP(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Error en compresión WebP'));
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const optimizedFile = new File([blob], cleanName, { type: 'image/webp' });
            resolve(optimizedFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
```

### 2. Borrado Físico Automático de Archivos Huérfanos
Al eliminar un producto o actualizar su foto en Supabase PostgreSQL, ejecutar siempre la eliminación física en Supabase Storage:
```python
# FastAPI / Python
from supabase import create_client

def delete_storage_file(file_url: str):
    try:
        # Extraer nombre del archivo del URL público
        file_path = file_url.split('/public/products/')[-1]
        supabase.storage.from_('products').remove([file_path])
    except Exception as e:
        logger.warning(f"No se pudo eliminar archivo físico: {e}")
```

---

## 🛡️ PATRÓN 2: BLINDAJE DE EGRESS EN SUPABASE (LÍMITE 5 GB/MES)

### Regla #1: Endpoints Escalares para Contadores y Badges (15 bytes vs 250 KB)
**NUNCA** consultar `GET /sales/` o `GET /products/` completos para pintar una campana de notificaciones o un badge numérico.
```python
# CORRECTO: Retorna {"count": 1} (~15 bytes)
@router.get("/pending-count")
def get_pending_count(db: Session = Depends(get_db)):
    count = db.query(func.count(Order.id)).filter(
        Order.status == "pending"
    ).scalar() or 0
    return {"count": count}
```

### Regla #2: Page Visibility API (Pausa en Segundo Plano)
Los celulares, tablets y laptops bloqueadas no deben consumir datos:
```javascript
const pollStatus = useCallback(() => {
  // Congela peticiones si la pestaña está oculta o el celular bloqueado
  if (typeof document !== 'undefined' && document.hidden) return;
  fetch('/api/pending-count').then(...);
}, []);

useEffect(() => {
  pollStatus();
  // Al volver a la app o desbloquear pantalla, sincroniza de inmediato
  const onVisible = () => { if (!document.hidden) pollStatus(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', pollStatus);
  const timer = setInterval(pollStatus, 90000); // 90s relajado
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', pollStatus);
    clearInterval(timer);
  };
}, [pollStatus]);
```

### Regla #3: In-Memory TTL Cache en FastAPI (Render)
Para comprobaciones frecuentes de sincronización (`/sync-version`), almacena el hash en la RAM de Render durante 5-10 segundos:
```python
import time
_cache = {"version": None, "timestamp": 0.0}

@router.get("/sync-version")
def get_sync_version(db: Session = Depends(get_db)):
    now = time.time()
    if _cache["version"] and (now - _cache["timestamp"]) < 5.0:
        return {"version": _cache["version"]}

    # Consulta ligera
    v = f"{db.query(func.max(Item.updated_at)).scalar()}_{db.query(func.count(Item.id)).scalar()}"
    _cache["version"] = v
    _cache["timestamp"] = now
    return {"version": v}
```

---

## 📱 PATRÓN 3: COMPATIBILIDAD MULTI-DISPOSITIVO (TABLETS, MÓVILES Y PCS)

### 1. Copiado de Fotos y Datos (Desktop vs Táctil)
En iPads, iPhones y Android, el portapapeles binario está bloqueado. Usa Web Share API multinivel:
```javascript
export async function shareOrCopyImage(imageUrl, title, text) {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const file = new File([blob], 'prenda.png', { type: blob.type });

    // Móvil / Tablet con menú nativo de compartir (WhatsApp, Telegram, Guardar)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return { success: true, mode: 'share' };
    }

    // Desktop: Copiado al portapapeles
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return { success: true, mode: 'clipboard' };
    }
  } catch (err) {
    // Fallback: copiar enlace de texto
    await navigator.clipboard.writeText(imageUrl);
    return { success: true, mode: 'link' };
  }
}
```

---

## 💰 PATRÓN 4: CONTABILIDAD Y CUADRATURA EXACTA DE CAJA
1. **Dinero Real en Caja (`payment_history`) vs Valor Facturado (`total_sale`)**:
   - En ventas a crédito, apartados o contraentrega, **solo registrar en caja el dinero efectivamente recaudado**.
   - El saldo restante se clasifica como cuenta por cobrar / deuda pendiente.
2. **Entregas Contraentrega**:
   - Excluir del total de ventas cobradas hasta que el repartidor liquide el dinero en la gaveta o cuenta bancaria.
