from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncpg
import os
import logging
from dotenv import load_dotenv
from brain.business_brain import BusinessBrain
from brain.vendedor import VendedorIA
from brain import detector

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ai-engine")

DB_URL = os.getenv("DATABASE_URL", "postgresql://autobusiness:autobusiness_secret@localhost:5432/autobusiness")
pool: asyncpg.Pool = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=10)
    log.info("AI Engine started — DB pool ready")
    yield
    await pool.close()


app = FastAPI(title="AutoBusiness AI Engine", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-engine"}


@app.post("/analyze/{business_id}")
async def analyze_business(business_id: str):
    """Análisis completo — persiste todos los insights, devuelve el top 1."""
    brain = BusinessBrain(pool, business_id)
    result = await brain.analyze()
    log.info("analyze business=%s status=%s insights=%d", business_id, result["businessStatus"], result["totalInsights"])
    return {"businessId": business_id, **result}


@app.get("/insights/{business_id}")
async def get_insights(business_id: str):
    """Todos los insights activos ordenados por prioridad."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, type, status, title, diagnosis, cause, action, impact, impact_amount, priority
               FROM ai_insights WHERE business_id = $1 AND is_dismissed = false
               ORDER BY priority DESC, created_at DESC LIMIT 10""",
            business_id
        )
    return {"insights": [dict(r) for r in rows]}


@app.get("/top-insight/{business_id}")
async def get_top_insight(business_id: str):
    """Solo el 1 problema más importante del negocio ahora mismo."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT id, type, status, title, diagnosis, cause, action, impact, impact_amount, priority
               FROM ai_insights WHERE business_id = $1 AND is_dismissed = false
               ORDER BY priority DESC, created_at DESC LIMIT 1""",
            business_id
        )
    if not row:
        return {"insight": None, "businessStatus": "GREEN"}
    insight = dict(row)
    return {"insight": insight, "businessStatus": insight["status"]}


@app.get("/finance/{business_id}")
async def get_finance_summary(business_id: str):
    brain = BusinessBrain(pool, business_id)
    return await brain.get_finance_summary()


@app.post("/marketing/{business_id}/generate")
async def generate_marketing(business_id: str):
    brain = BusinessBrain(pool, business_id)
    return await brain.generate_marketing_posts()


# ── Vendedor IA (WhatsApp) ────────────────────────────────────────────────────

@app.post("/vendedor/{business_id}/reply")
async def vendedor_reply(business_id: str, body: dict):
    """
    Responde un mensaje de cliente (WhatsApp o Instagram) con reglas locales (sin LLM).
    Body: {text: str, from?: str, test?: bool, channel?: 'whatsapp'|'instagram'}
    test=true salta la validación de 'empleado activo' (para el panel de pruebas).
    """
    text = (body.get("text") or "").strip()
    if not text:
        return {"reply": None, "enabled": True}

    channel = body.get("channel") or "whatsapp"
    employee_type = "vendedor_ig" if channel == "instagram" else "vendedor"

    vendedor = VendedorIA(pool, business_id)
    if not body.get("test") and not await vendedor.is_enabled(employee_type):
        return {"reply": None, "enabled": False}

    try:
        reply = await vendedor.responder(text)
    except Exception as e:
        log.error("vendedor reply error business=%s: %s", business_id, e)
        return {"reply": None, "enabled": True, "error": str(e)}

    # Instagram no renderiza *negritas* — quitar los asteriscos de WhatsApp
    if reply and channel == "instagram":
        reply = reply.replace("*", "")

    log.info("vendedor business=%s channel=%s msg=%r replied=%s", business_id, channel, text[:60], bool(reply))
    return {"reply": reply, "enabled": True}


# ── Caja IA endpoints ─────────────────────────────────────────────────────────

@app.get("/detect-info")
async def detect_info():
    """Tell the frontend whether a custom ONNX model is ready."""
    return detector.model_info()


@app.post("/detect/{business_id}")
async def detect_objects(business_id: str, body: dict):
    """
    Accepts {image: <base64 JPEG>, confidence: 0.65}.
    Runs YOLOv8 ONNX inference and returns detections matched to the catalog.
    """
    if not detector.model_available():
        return {"detections": [], "model_available": False}

    image_b64  = body.get("image")
    confidence = float(body.get("confidence", 0.65))

    if not image_b64:
        raise HTTPException(400, "image field is required")

    try:
        raw = await detector.detect(image_b64, confidence)
    except Exception as e:
        log.error("Detection error: %s", e)
        return {"detections": [], "error": str(e)}

    # Fetch catalog for this business
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id::text, name, price, stock
               FROM products WHERE business_id = $1 AND is_active = true""",
            business_id,
        )
    products = [dict(r) for r in rows]

    # Match each detection to the catalog by class name similarity
    out = []
    for det in raw:
        product = _match_product(det["class"], products)
        out.append({**det, "product": product})

    log.info("detect business=%s raw=%d matched=%d", business_id, len(raw), sum(1 for d in out if d["product"]))
    return {"detections": out, "model_available": True}


def _match_product(class_name: str, products: list[dict]) -> dict | None:
    """Match YOLO class name to catalog entry by keyword overlap."""
    keywords = class_name.lower().replace("_", " ").replace("-", " ").split()
    best, best_score = None, 0
    for prod in products:
        prod_words = prod["name"].lower().split()
        score = sum(1 for kw in keywords for pw in prod_words if kw in pw or pw in kw)
        if score > best_score:
            best_score, best = score, prod
    if best_score > 0:
        return {"id": best["id"], "name": best["name"],
                "price": float(best["price"]), "stock": best["stock"]}
    return None
