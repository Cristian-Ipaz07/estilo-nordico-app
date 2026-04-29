"""
fix_categories.py
─────────────────────────────────────────────────────────────────────────────
Migración segura: normaliza categorías 'Otro' / 'Otros' → 'INGRESO_VENTA_EXTERNA'
en la tabla cash_movements.

SEGURIDAD:
  1. Hace un backup de la DB antes de cualquier cambio.
  2. Muestra un preview de los registros afectados.
  3. Pide confirmación explícita (escribe 'SI' para continuar).
  4. Ejecuta solo un UPDATE — nunca DELETE ni INSERT.
  5. Verifica el resultado final y muestra conteo.

Ejecutar desde la carpeta /backend:
  python scripts/fix_categories.py
"""

import sys
import shutil
from pathlib import Path
from datetime import datetime

# ── Configuración ─────────────────────────────────────────────────────────────
DB_PATH = Path(__file__).parent.parent / "estilo_nordico.sqlite3"
BACKUP_DIR = Path(__file__).parent.parent / "backups"

# Variantes a normalizar (todas se mapean a INGRESO_VENTA_EXTERNA)
CATEGORIAS_A_NORMALIZAR = ("Otro", "Otros", "otro", "otros", "OTRO", "OTROS")
CATEGORIA_DESTINO = "INGRESO_VENTA_EXTERNA"


def hacer_backup() -> Path:
    """Crea una copia exacta de la DB con timestamp antes de tocar nada."""
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"estilo_nordico_BACKUP_{ts}.sqlite3"
    shutil.copy2(DB_PATH, dest)
    print(f"  ✅ Backup creado en: {dest}")
    return dest


def main():
    import sqlite3

    print("\n" + "=" * 65)
    print("  FIX CATEGORÍAS — Estilo Nórdico")
    print("  Normaliza Otro/Otros → INGRESO_VENTA_EXTERNA")
    print("=" * 65)

    # ── Validar que existe la DB ──────────────────────────────────────────────
    if not DB_PATH.exists():
        print(f"\n  ❌ ERROR: No se encontró la DB en {DB_PATH}")
        sys.exit(1)

    print(f"\n  📂 DB encontrada: {DB_PATH}")
    print(f"  📦 Tamaño actual: {DB_PATH.stat().st_size / 1024:.1f} KB")

    # ── Hacer backup ANTES de cualquier cambio ────────────────────────────────
    print("\n  [1/4] Creando backup de seguridad...")
    backup_path = hacer_backup()

    # ── Conectar y mostrar preview ────────────────────────────────────────────
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    placeholders = ",".join("?" * len(CATEGORIAS_A_NORMALIZAR))
    query_preview = f"""
        SELECT id, description, amount, type, category, created_at
        FROM cash_movements
        WHERE category IN ({placeholders})
        ORDER BY created_at
    """

    cur.execute(query_preview, CATEGORIAS_A_NORMALIZAR)
    filas = cur.fetchall()

    print(f"\n  [2/4] Preview — Registros a migrar: {len(filas)}")
    print("  " + "-" * 60)

    if not filas:
        print("  ℹ️  No hay registros con categoría 'Otro' u 'Otros'.")
        print("  No se requiere migración.\n")
        con.close()
        sys.exit(0)

    total_monto = 0.0
    for f in filas:
        id_, desc, monto, tipo, cat, fecha = f
        total_monto += monto
        print(f"  ID {id_:4d} | {fecha[:10]} | {tipo:7s} | {cat:6s} → {CATEGORIA_DESTINO} | ${monto:>12,.0f} | {desc[:35]}")

    print("  " + "-" * 60)
    print(f"  Total registros: {len(filas)}  |  Suma montos: ${total_monto:,.0f}")
    print()

    # ── Confirmación explícita ────────────────────────────────────────────────
    print("  [3/4] Confirmación requerida")
    print("  ⚠️  Se actualizará SOLO la columna 'category'. No se elimina ninguna fila.")
    respuesta = input("  ¿Deseas continuar? Escribe  SI  para confirmar: ").strip()

    if respuesta != "SI":
        print("\n  🛑 Migración cancelada. La DB no fue modificada.")
        print(f"  El backup en {backup_path} puede eliminarse manualmente si no lo necesitas.")
        con.close()
        sys.exit(0)

    # ── Ejecutar UPDATE ───────────────────────────────────────────────────────
    print("\n  [4/4] Ejecutando migración...")

    update_sql = f"""
        UPDATE cash_movements
        SET category = ?
        WHERE category IN ({placeholders})
    """
    cur.execute(update_sql, (CATEGORIA_DESTINO, *CATEGORIAS_A_NORMALIZAR))
    filas_actualizadas = cur.rowcount
    con.commit()

    # ── Verificación post-migración ───────────────────────────────────────────
    cur.execute(
        f"SELECT COUNT(*) FROM cash_movements WHERE category IN ({placeholders})",
        CATEGORIAS_A_NORMALIZAR
    )
    restantes = cur.fetchone()[0]

    cur.execute(
        "SELECT COUNT(*), SUM(amount) FROM cash_movements WHERE category = ?",
        (CATEGORIA_DESTINO,)
    )
    total_ive = cur.fetchone()

    con.close()

    print(f"\n  ✅ Migración completada:")
    print(f"     Filas actualizadas   : {filas_actualizadas}")
    print(f"     Registros restantes  : {restantes}  (debe ser 0)")
    print(f"     Total INGRESO_VENTA_EXTERNA ahora: {total_ive[0]} registros / ${total_ive[1] or 0:,.0f}")

    if restantes > 0:
        print("\n  ⚠️  ATENCIÓN: Aún quedan registros sin normalizar. Verifica manualmente.")
    else:
        print("\n  🎉 Todas las categorías normalizadas correctamente.")

    print(f"\n  🔒 Backup guardado en: {backup_path}")
    print("     Puedes restaurarlo si algo no cuadra.\n")


if __name__ == "__main__":
    main()
