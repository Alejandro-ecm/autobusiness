"""
Vendedor IA — responde mensajes de WhatsApp de clientes 100% local (sin LLM).

Reglas de intención + búsqueda difusa de productos directo en PostgreSQL.
Cada respuesta usa el catálogo real del negocio (precio y stock en vivo).
"""
import os
import re
import unicodedata

APP_BASE_URL = os.getenv("APP_BASE_URL", "https://autobusiness.skytechnologieslatam.com")

# Palabras que no aportan al buscar un producto
STOPWORDS = {
    "hola", "buenas", "buenos", "dias", "tardes", "noches", "que", "cual", "cuanto",
    "cuanta", "cuantos", "cuestan", "cuesta", "vale", "valen", "sale", "salen",
    "precio", "precios", "de", "del", "la", "el", "los", "las", "un", "una", "unos",
    "unas", "me", "te", "se", "lo", "le", "y", "o", "a", "al", "en", "por", "para",
    "con", "sin", "tiene", "tienes", "tienen", "hay", "habra", "queda", "quedan",
    "venden", "vendes", "vende", "manejan", "manejas", "quiero", "quisiera", "busco",
    "necesito", "dame", "deme", "das", "favor", "porfavor", "porfa", "gracias",
    "disponible", "disponibles", "stock", "existencia", "existencias", "es", "esta",
    "estan", "ese", "esa", "eso", "este", "esto", "tu", "su", "mi", "si", "no",
    "como", "donde", "ando", "buscando", "saber", "decir", "ver", "algo", "todavia",
    "aun", "ahorita", "oye", "oiga", "disculpa", "disculpe", "pregunta", "duda",
    "producto", "productos", "articulo", "articulos", "cosa", "cosas", "marca",
}

GREETING_WORDS = {"hola", "holaa", "holaaa", "buenas", "hey", "ey", "alo", "hello", "hi", "ola", "saludos", "wenas"}
GREETING_PHRASES = ("buenos dias", "buenas tardes", "buenas noches", "buen dia", "que tal", "como estas", "como esta")

CATALOG_KEYWORDS = ("catalogo", "productos", "que vendes", "que venden", "que tienes", "que tienen",
                    "que manejan", "lista de precios", "tu tienda", "su tienda", "menu", "ver tienda", "inventario")
HOURS_KEYWORDS = ("horario", "horarios", "a que hora", "abren", "cierran", "abierto", "cerrado", "atienden")
LOCATION_KEYWORDS = ("direccion", "ubicacion", "ubicados", "donde estan", "donde esta", "donde se encuentran",
                     "domicilio", "local", "sucursal", "como llego", "mapa")
THANKS_KEYWORDS = ("gracias", "muchas gracias", "thank", "ok gracias", "vale gracias", "perfecto", "excelente", "genial")
BYE_KEYWORDS = ("adios", "hasta luego", "bye", "nos vemos", "buena noche", "que descanses")
HUMAN_KEYWORDS = ("humano", "persona", "alguien real", "encargado", "dueno", "duena", "atencion personal", "hablar con")


def _norm(text: str) -> str:
    """minúsculas + sin acentos + sin signos."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s]", " ", text).strip()


def _singular(word: str) -> str:
    if len(word) > 4 and word.endswith("es"):
        return word[:-2]
    if len(word) > 3 and word.endswith("s"):
        return word[:-1]
    return word


def _fmt_price(value) -> str:
    return f"${float(value):,.2f}"


class VendedorIA:
    def __init__(self, pool, business_id: str):
        self.pool = pool
        self.business_id = business_id

    async def is_enabled(self) -> bool:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT enabled FROM ai_employees
                   WHERE business_id = $1 AND employee_type = 'vendedor'""",
                self.business_id,
            )
        return bool(row and row["enabled"])

    async def responder(self, text: str) -> str:
        biz = await self._get_business()
        if not biz:
            return None
        norm = _norm(text)

        if self._is_greeting(norm):
            return self._greeting_reply(biz)
        if any(k in norm for k in CATALOG_KEYWORDS):
            return await self._catalog_reply(biz)
        if any(k in norm for k in HOURS_KEYWORDS):
            return self._hours_reply(biz)
        if any(k in norm for k in LOCATION_KEYWORDS):
            return self._location_reply(biz)
        if any(k in norm for k in HUMAN_KEYWORDS):
            return self._human_reply(biz)
        if any(k in norm for k in THANKS_KEYWORDS) and len(norm.split()) <= 4:
            return "¡Con gusto! 😊 Si necesitas algo más, aquí estoy 24/7."
        if any(k in norm for k in BYE_KEYWORDS) and len(norm.split()) <= 4:
            return f"¡Hasta pronto! Gracias por contactar a *{biz['name']}* 👋"

        # Por defecto: buscar productos mencionados en el mensaje
        return await self._product_reply(norm, biz)

    # ── Intenciones ───────────────────────────────────────────────────────────

    def _is_greeting(self, norm: str) -> bool:
        words = norm.split()
        if not words:
            return False
        only_greeting = all(w in GREETING_WORDS for w in words)
        return only_greeting or (any(p in norm for p in GREETING_PHRASES) and len(words) <= 5)

    def _greeting_reply(self, biz) -> str:
        return (
            f"¡Hola! 👋 Soy el asistente virtual de *{biz['name']}*.\n\n"
            "Puedo ayudarte al instante con:\n"
            "💲 *Precios* — escribe el nombre del producto\n"
            "📦 *Stock* — pregunta si tenemos algo disponible\n"
            "🛍️ Escribe *catálogo* para ver nuestros productos\n"
            "🕒 Escribe *horario* o 📍 *ubicación*\n\n"
            "¿Qué producto te interesa?"
        )

    async def _catalog_reply(self, biz) -> str:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT name, price, stock FROM products
                   WHERE business_id = $1 AND is_active = true AND stock > 0
                   ORDER BY name ASC LIMIT 10""",
                self.business_id,
            )
        if not rows:
            return f"Por ahora no tenemos productos publicados, pero pregúntame en unos días. 🙏"
        lines = [f"🛍️ Algunos productos de *{biz['name']}*:\n"]
        for r in rows:
            lines.append(f"• {r['name']} — {_fmt_price(r['price'])}")
        lines.append(f"\n🌐 Catálogo completo y pedidos en línea:\n{self._store_url(biz)}")
        lines.append("\nPregúntame por cualquier producto y te digo precio y stock al momento. 😊")
        return "\n".join(lines)

    def _hours_reply(self, biz) -> str:
        if biz.get("business_hours"):
            return f"🕒 Nuestro horario:\n{biz['business_hours']}"
        return ("🕒 Aún no tengo registrado el horario exacto, pero deja tu mensaje "
                "y el equipo te responde en cuanto abra. 🙏")

    def _location_reply(self, biz) -> str:
        if biz.get("address"):
            return f"📍 Nos encuentras en:\n{biz['address']}\n\n¡Te esperamos! 😊"
        return ("📍 Aún no tengo registrada la dirección, pero puedes hacer tu pedido "
                f"en línea aquí:\n{self._store_url(biz)}")

    def _human_reply(self, biz) -> str:
        phone = biz.get("phone")
        extra = f" al 📞 {phone}" if phone else ""
        return (f"Entiendo, en un momento alguien del equipo de *{biz['name']}* te atiende personalmente{extra}. "
                "Mientras tanto, si quieres te puedo dar precios y stock al instante. 😊")

    async def _product_reply(self, norm: str, biz) -> str:
        terms = [_singular(w) for w in norm.split() if w not in STOPWORDS and len(w) >= 3]
        if not terms:
            return self._greeting_reply(biz)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT name, price, stock FROM products
                   WHERE business_id = $1 AND is_active = true""",
                self.business_id,
            )

        scored = []
        for r in rows:
            name_words = [_singular(w) for w in _norm(r["name"]).split()]
            score = 0
            for t in terms:
                for nw in name_words:
                    if t == nw:
                        score += 3
                    elif len(t) >= 4 and (t in nw or nw in t):
                        score += 2
            if score > 0:
                scored.append((score, r))

        if not scored:
            return (
                f"Mmm, no encontré \"{' '.join(terms)}\" en nuestro catálogo. 🤔\n\n"
                f"Puedes ver todo lo que tenemos aquí:\n{self._store_url(biz)}\n\n"
                "O escribe *catálogo* y te muestro los productos. 😊"
            )

        scored.sort(key=lambda x: (-x[0], x[1]["name"]))
        top_score = scored[0][0]
        matches = [r for s, r in scored if s == top_score][:5] if len(scored) > 1 else [scored[0][1]]

        if len(matches) == 1:
            p = matches[0]
            stock = int(p["stock"])
            if stock > 0:
                disp = f"✅ Disponible ({stock} en stock)" if stock <= 15 else "✅ Disponible"
                return (
                    f"*{p['name']}*\n"
                    f"💲 Precio: {_fmt_price(p['price'])}\n"
                    f"{disp}\n\n"
                    f"¿Te lo apartamos? También puedes pedirlo en línea:\n{self._store_url(biz)}"
                )
            return (
                f"*{p['name']}*\n"
                f"💲 Precio: {_fmt_price(p['price'])}\n"
                f"❌ Por el momento está agotado 😔\n\n"
                f"Mira otras opciones en:\n{self._store_url(biz)}"
            )

        lines = ["Encontré varias opciones 👇\n"]
        for p in matches:
            stock = int(p["stock"])
            mark = "✅" if stock > 0 else "❌ agotado"
            lines.append(f"• {p['name']} — {_fmt_price(p['price'])} {mark}")
        lines.append("\n¿Cuál te interesa? 😊")
        return "\n".join(lines)

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_business(self):
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT name, slug, phone, address, business_hours
                   FROM businesses WHERE id = $1 AND is_active = true""",
                self.business_id,
            )
        return dict(row) if row else None

    def _store_url(self, biz) -> str:
        return f"{APP_BASE_URL}/tienda/{biz['slug']}"
