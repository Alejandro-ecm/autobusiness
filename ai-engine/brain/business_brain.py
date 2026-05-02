"""
Business Brain — Motor central de IA de AutoBusiness
Genera diagnósticos accionables en lenguaje humano
"""
from datetime import datetime, timedelta, timezone
from typing import Any
import asyncpg
import uuid


class BusinessBrain:
    def __init__(self, pool: asyncpg.Pool, business_id: str):
        self.pool = pool
        self.business_id = business_id

    async def analyze(self) -> dict:
        """Análisis completo. Persiste todos los insights y devuelve el #1 prioritario."""
        async with self.pool.acquire() as conn:
            all_insights = []
            all_insights += await self._analyze_revenue(conn)
            all_insights += await self._analyze_inventory(conn)
            all_insights += await self._analyze_margins(conn)
            all_insights += await self._analyze_slow_products(conn)

            # Ordenar por prioridad DESC
            all_insights.sort(key=lambda x: x["priority"], reverse=True)

            await conn.execute("DELETE FROM ai_insights WHERE business_id = $1", self.business_id)
            for insight in all_insights:
                await conn.execute(
                    """INSERT INTO ai_insights
                       (id, business_id, type, status, title, diagnosis, cause, action, impact, impact_amount, priority, expires_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
                    str(uuid.uuid4()), self.business_id,
                    insight["type"], insight["status"], insight["title"],
                    insight["diagnosis"], insight.get("cause"), insight["action"],
                    insight.get("impact"), insight.get("impactAmount"),
                    insight["priority"],
                    datetime.now(timezone.utc) + timedelta(hours=24)
                )

            top = all_insights[0] if all_insights else None
            overall_status = "GREEN"
            if any(i["status"] == "RED" for i in all_insights):
                overall_status = "RED"
            elif any(i["status"] == "YELLOW" for i in all_insights):
                overall_status = "YELLOW"

            return {
                "businessStatus": overall_status,
                "topInsight": top,
                "totalInsights": len(all_insights),
            }

    # ─── Análisis de ingresos ──────────────────────────────────────────────────

    async def _analyze_revenue(self, conn) -> list[dict]:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        prev_week_start = now - timedelta(days=14)

        today_revenue = await conn.fetchval(
            """SELECT COALESCE(SUM(total), 0) FROM sales
               WHERE business_id=$1 AND created_at >= $2 AND status='completed'""",
            self.business_id, today_start
        ) or 0

        week_revenue = await conn.fetchval(
            """SELECT COALESCE(SUM(total), 0) FROM sales
               WHERE business_id=$1 AND created_at >= $2 AND created_at < $3 AND status='completed'""",
            self.business_id, week_start, now
        ) or 0

        prev_week_revenue = await conn.fetchval(
            """SELECT COALESCE(SUM(total), 0) FROM sales
               WHERE business_id=$1 AND created_at >= $2 AND created_at < $3 AND status='completed'""",
            self.business_id, prev_week_start, week_start
        ) or 0

        insights = []

        if prev_week_revenue > 0:
            growth = ((week_revenue - prev_week_revenue) / prev_week_revenue) * 100
            if growth < -20:
                diff = prev_week_revenue - week_revenue
                insights.append({
                    "type": "REVENUE_DROP",
                    "status": "RED",
                    "title": f"Ventas bajaron {abs(growth):.0f}% esta semana",
                    "diagnosis": f"Tus ingresos bajaron ${diff:,.0f} comparado con la semana pasada",
                    "cause": "Menor tráfico, competencia o productos desabastecidos",
                    "action": "Revisa qué productos no se han vendido y activa una promoción hoy",
                    "impact": f"Recuperar ${diff * 0.5:,.0f}/semana con 1 promoción",
                    "impactAmount": float(diff * 0.5),
                    "priority": 10,
                })
            elif growth > 15:
                insights.append({
                    "type": "REVENUE_UP",
                    "status": "GREEN",
                    "title": f"Ventas subieron {growth:.0f}% esta semana",
                    "diagnosis": f"Tus ingresos crecieron ${week_revenue - prev_week_revenue:,.0f} vs la semana pasada",
                    "cause": "Mayor tráfico o mix de productos rentable",
                    "action": "Asegura stock de los productos más vendidos esta semana",
                    "impactAmount": float(week_revenue - prev_week_revenue),
                    "priority": 3,
                })

        return insights

    # ─── Análisis de inventario ────────────────────────────────────────────────

    async def _analyze_inventory(self, conn) -> list[dict]:
        low_stock = await conn.fetch(
            """SELECT name, stock, min_stock, price FROM products
               WHERE business_id=$1 AND is_active=true AND stock <= min_stock
               ORDER BY stock ASC""",
            self.business_id
        )

        out_of_stock = [p for p in low_stock if p["stock"] == 0]
        near_empty = [p for p in low_stock if 0 < p["stock"] <= p["min_stock"]]

        insights = []

        if out_of_stock:
            names = ", ".join(p["name"] for p in out_of_stock[:3])
            lost_revenue = sum(float(p["price"]) * 10 for p in out_of_stock)
            insights.append({
                "type": "OUT_OF_STOCK",
                "status": "RED",
                "title": f"{len(out_of_stock)} producto(s) sin stock",
                "diagnosis": f"Sin inventario: {names}{'...' if len(out_of_stock) > 3 else ''}",
                "cause": "No se realizó reabastecimiento a tiempo",
                "action": f"Haz pedido urgente hoy — estás perdiendo ventas ahora mismo",
                "impact": f"Pérdida estimada: ${lost_revenue:,.0f}/día",
                "impactAmount": float(lost_revenue),
                "priority": 9,
            })

        if near_empty:
            names = ", ".join(p["name"] for p in near_empty[:3])
            insights.append({
                "type": "STOCK_LOW",
                "status": "YELLOW",
                "title": f"{len(near_empty)} producto(s) con stock bajo",
                "diagnosis": f"Stock bajo: {names}{'...' if len(near_empty) > 3 else ''}",
                "cause": "Consumo mayor al esperado o reabastecimiento tardío",
                "action": "Pide proveedor esta semana para evitar desabasto",
                "priority": 6,
            })

        return insights

    # ─── Análisis de márgenes ──────────────────────────────────────────────────

    async def _analyze_margins(self, conn) -> list[dict]:
        low_margin = await conn.fetch(
            """SELECT name, price, cost,
               CASE WHEN price > 0 THEN ((price - cost) / price * 100) ELSE 0 END AS margin
               FROM products
               WHERE business_id=$1 AND is_active=true AND cost > 0 AND price > 0
                 AND ((price - cost) / price * 100) < 20
               ORDER BY margin ASC
               LIMIT 5""",
            self.business_id
        )

        if not low_margin:
            return []

        names = ", ".join(p["name"] for p in low_margin[:3])
        avg_margin = sum(float(p["margin"]) for p in low_margin) / len(low_margin)

        potential = sum(
            float(p["price"]) * 0.15 * 30
            for p in low_margin
        )

        return [{
            "type": "LOW_MARGIN",
            "status": "YELLOW",
            "title": f"Margen bajo en {len(low_margin)} productos",
            "diagnosis": f"Estos productos dan menos del 20% de ganancia: {names}",
            "cause": f"Margen promedio {avg_margin:.0f}% — costo elevado o precio bajo de mercado",
            "action": "Sube precio 15% o cambia proveedor. Primero prueba con 1 producto",
            "impact": f"Ganancia extra potencial: ${potential:,.0f}/mes",
            "impactAmount": float(potential),
            "priority": 7,
        }]

    # ─── Productos lentos / sin rotación ─────────────────────────────────────

    async def _analyze_slow_products(self, conn) -> list[dict]:
        slow = await conn.fetch(
            """SELECT p.name, p.price, p.stock,
               COALESCE(SUM(si.quantity), 0) AS units_sold
               FROM products p
               LEFT JOIN sale_items si ON si.product_id = p.id
               LEFT JOIN sales s ON s.id = si.sale_id
                   AND s.created_at >= NOW() - INTERVAL '30 days'
               WHERE p.business_id = $1 AND p.is_active = true AND p.stock > 20
               GROUP BY p.id, p.name, p.price, p.stock
               HAVING COALESCE(SUM(si.quantity), 0) < 3
               ORDER BY units_sold ASC
               LIMIT 5""",
            self.business_id
        )

        if not slow:
            return []

        names = ", ".join(p["name"] for p in slow[:3])
        frozen_capital = sum(float(p["price"]) * float(p["stock"]) for p in slow)

        return [{
            "type": "SLOW_MOVING",
            "status": "YELLOW",
            "title": f"{len(slow)} productos sin rotación en 30 días",
            "diagnosis": f"Tienes ${frozen_capital:,.0f} de capital congelado en: {names}",
            "cause": "Productos sin demanda, precio alto o poca visibilidad",
            "action": "Aplica 20% descuento esta semana o publícalos en WhatsApp hoy",
            "impact": f"Liberar ${frozen_capital * 0.7:,.0f} en capital circulante",
            "impactAmount": float(frozen_capital * 0.7),
            "priority": 5,
        }]

    # ─── Resumen financiero ────────────────────────────────────────────────────

    async def get_finance_summary(self) -> dict:
        async with self.pool.acquire() as conn:
            now = datetime.now(timezone.utc)
            month_start = now - timedelta(days=30)

            revenue = await conn.fetchval(
                """SELECT COALESCE(SUM(total), 0) FROM sales
                   WHERE business_id=$1 AND created_at >= $2 AND status='completed'""",
                self.business_id, month_start
            ) or 0

            cost = await conn.fetchval(
                """SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0)
                   FROM sale_items si JOIN sales s ON s.id = si.sale_id
                   WHERE s.business_id=$1 AND s.created_at >= $2 AND s.status='completed'""",
                self.business_id, month_start
            ) or 0

            top_products = await conn.fetch(
                """SELECT p.name, SUM(si.quantity) as qty, SUM(si.subtotal) as revenue,
                   SUM(si.unit_cost * si.quantity) as cost
                   FROM sale_items si
                   JOIN sales s ON s.id = si.sale_id
                   JOIN products p ON p.id = si.product_id
                   WHERE s.business_id=$1 AND s.created_at >= $2 AND s.status='completed'
                   GROUP BY p.id, p.name
                   ORDER BY revenue DESC LIMIT 5""",
                self.business_id, month_start
            )

            gross_profit = float(revenue) - float(cost)
            margin = (gross_profit / float(revenue) * 100) if float(revenue) > 0 else 0

            return {
                "period": "últimos 30 días",
                "revenue": float(revenue),
                "cost": float(cost),
                "grossProfit": gross_profit,
                "margin": round(margin, 1),
                "topProducts": [
                    {
                        "name": p["name"],
                        "qty": int(p["qty"]),
                        "revenue": float(p["revenue"]),
                        "profit": float(p["revenue"]) - float(p["cost"]),
                        "margin": round((float(p["revenue"]) - float(p["cost"])) / float(p["revenue"]) * 100, 1)
                        if float(p["revenue"]) > 0 else 0
                    }
                    for p in top_products
                ],
                "simulation": {
                    "price_up_10": round(gross_profit * 1.15, 2),
                    "price_up_15": round(gross_profit * 1.22, 2),
                    "message": f"Si subes precios 10% → ganancia extra ${gross_profit * 0.15:,.0f}/mes"
                }
            }

    # ─── Generador de marketing ────────────────────────────────────────────────

    async def generate_marketing_posts(self) -> dict:
        async with self.pool.acquire() as conn:
            business = await conn.fetchrow(
                "SELECT name FROM businesses WHERE id=$1", self.business_id
            )
            slow_products = await conn.fetch(
                """SELECT p.name, p.price FROM products p
                   LEFT JOIN sale_items si ON si.product_id = p.id
                   LEFT JOIN sales s ON s.id = si.sale_id
                       AND s.created_at >= NOW() - INTERVAL '14 days'
                   WHERE p.business_id=$1 AND p.is_active=true AND p.is_online=true
                   GROUP BY p.id, p.name, p.price
                   HAVING COALESCE(SUM(si.quantity), 0) < 2
                   LIMIT 3""",
                self.business_id
            )

            business_name = business["name"] if business else "Nuestra tienda"
            posts = []

            for product in slow_products:
                discounted = float(product["price"]) * 0.8
                posts.append({
                    "platform": "whatsapp",
                    "type": "promotion",
                    "product": product["name"],
                    "content": (
                        f"🔥 *OFERTA ESPECIAL — {business_name}*\n\n"
                        f"📦 {product['name']}\n"
                        f"~~${float(product['price']):.0f}~~ → *${discounted:.0f} MXN* (20% OFF)\n\n"
                        f"⏰ Solo por hoy. ¡Escríbenos ahora!\n"
                        f"📱 Disponible en nuestra tienda online"
                    ),
                    "originalPrice": float(product["price"]),
                    "discountedPrice": discounted,
                })

            if not posts:
                posts.append({
                    "platform": "whatsapp",
                    "type": "general",
                    "content": (
                        f"¡Hola! Somos *{business_name}* 👋\n\n"
                        f"Tenemos todo lo que necesitas disponible.\n"
                        f"Escríbenos para ver nuestro catálogo completo 📦"
                    )
                })

            return {"posts": posts, "count": len(posts)}
