import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def fmt(n):
    try:
        return f"${n:,.0f}".replace(",", ".")
    except:
        return str(n)

def audit():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("=" * 65)
    print("  AUDITORÍA: INGRESO_VENTA_EXTERNA por tipo")
    print("=" * 65)

    # ── Resumen por tipo ───────────────────────────────────────────
    cur.execute("""
        SELECT type, count(*), sum(amount)
        FROM cash_movements
        WHERE category = 'INGRESO_VENTA_EXTERNA'
        GROUP BY type ORDER BY type;
    """)
    rows = cur.fetchall()
    print("\n📊 INGRESO_VENTA_EXTERNA breakdown:")
    for r in rows:
        print(f"   type={r[0]:10} → {r[1]:3} registros | Total: {fmt(r[2])}")

    # ── ENTRADAS (OK, estas sí son ingresos reales) ────────────────
    cur.execute("""
        SELECT id, payment_date::date, description, amount
        FROM cash_movements
        WHERE category = 'INGRESO_VENTA_EXTERNA' AND type = 'ENTRADA'
        ORDER BY payment_date;
    """)
    entradas = cur.fetchall()
    print(f"\n✅ ENTRADAS reales ({len(entradas)} registros) — éstas SE QUEDAN como INGRESO_VENTA_EXTERNA:")
    for r in entradas:
        print(f"   ID {r[0]:4} | {r[1]} | {str(r[2])[:45]:45} | {fmt(r[3])}")

    # ── SALIDAS mal clasificadas (estas NO son ingresos) ───────────
    cur.execute("""
        SELECT id, payment_date::date, description, amount
        FROM cash_movements
        WHERE category = 'INGRESO_VENTA_EXTERNA' AND type = 'SALIDA'
        ORDER BY payment_date;
    """)
    salidas = cur.fetchall()
    total_salidas = sum(r[3] for r in salidas)
    print(f"\n⚠️  SALIDAS mal clasificadas ({len(salidas)} registros) — éstas DEBEN corregirse:")
    for r in salidas:
        print(f"   ID {r[0]:4} | {r[1]} | {str(r[2])[:45]:45} | {fmt(r[3])}")

    # ── Impacto en Total Recaudo ───────────────────────────────────
    cur.execute("SELECT sum(amount) FROM cash_movements WHERE category = 'VENTA' AND type = 'ENTRADA'")
    ventas = cur.fetchone()[0] or 0
    cur.execute("SELECT sum(amount) FROM cash_movements WHERE category = 'INGRESO_VENTA_EXTERNA' AND type = 'ENTRADA'")
    ing_ext = cur.fetchone()[0] or 0

    print(f"\n{'─'*65}")
    print(f"  TOTAL RECAUDO ACTUAL   = Ventas {fmt(ventas)} + Ext {fmt(ing_ext)} = {fmt(ventas + ing_ext)}")
    print(f"  Si corriges las SALIDAS, Ingresos Externos quedarán en:    {fmt(ing_ext)}")
    print(f"  Nuevo Total Recaudo estimado:                               {fmt(ventas + ing_ext)}")
    print(f"{'─'*65}")

    if not salidas:
        print("\n✅ No hay SALIDAS mal clasificadas. La DB ya está correcta.")
        conn.close()
        return

    print(f"\n  Las {len(salidas)} SALIDAS ({fmt(total_salidas)}) serán reclasificadas a → 'GASTO'")
    print("  (Puedes cambiar la categoría destino editando 'nueva_cat' en el script)")
    confirm = input("\n¿Ejecutar corrección? (SI/NO): ")
    if confirm.strip().upper() != "SI":
        print("❌ Cancelado. No se tocó nada.")
        conn.close()
        return

    # ── Categoría destino para las SALIDAS ────────────────────────
    nueva_cat = "GASTO"   # ← cambia aquí si quieres otra categoría

    ids = [r[0] for r in salidas]
    cur.execute(
        f"UPDATE cash_movements SET category = %s WHERE id = ANY(%s)",
        (nueva_cat, ids)
    )
    conn.commit()
    print(f"\n✅ ¡Éxito! {len(salidas)} registros SALIDA reclasificados a '{nueva_cat}'.")

    # ── Nuevo estado ───────────────────────────────────────────────
    cur.execute("SELECT sum(amount) FROM cash_movements WHERE category = 'INGRESO_VENTA_EXTERNA' AND type = 'ENTRADA'")
    ing_ext_nuevo = cur.fetchone()[0] or 0
    print(f"   → Ingresos Externos ahora: {fmt(ing_ext_nuevo)}")
    print(f"   → Nuevo Total Recaudo estimado: {fmt(ventas + ing_ext_nuevo)}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    audit()
