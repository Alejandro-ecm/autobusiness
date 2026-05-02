"""
ONNX-based object detector for Caja IA.

Expects a YOLOv8 model exported to ONNX:
    from ultralytics import YOLO
    YOLO("best.pt").export(format="onnx", imgsz=640, simplify=True)

Place the resulting best.onnx in  ai-engine/models/best.onnx
Optionally place ai-engine/models/classes.txt  (one class name per line).
"""
import asyncio
import base64
import io
import logging
from pathlib import Path

import numpy as np
from PIL import Image

log = logging.getLogger("detector")

MODEL_PATH   = Path("/app/models/best.onnx")
CLASSES_PATH = Path("/app/models/classes.txt")

# A real YOLOv8n ONNX is ~13 MB; the placeholder stub is ~2.7 MB.
# Only activate backend detection when a genuine model is present.
_MIN_MODEL_MB = 8.0

_session    = None
_class_names: list[str] = []
_lock       = asyncio.Lock()


# ── Public API ────────────────────────────────────────────────────────────────

def model_available() -> bool:
    if not MODEL_PATH.exists():
        return False
    size_mb = MODEL_PATH.stat().st_size / 1_000_000
    return size_mb >= _MIN_MODEL_MB


def model_info() -> dict:
    if not model_available():
        return {"model_available": False}
    names = _class_names or _load_classes()
    return {
        "model_available": True,
        "model_type": "custom",
        "classes": names,
        "model_path": str(MODEL_PATH),
    }


async def detect(image_b64: str, confidence: float = 0.65) -> list[dict]:
    """Run inference on a base64-encoded JPEG. Returns list of detection dicts."""
    session, class_names = await _get_session()

    img_bytes = base64.b64decode(image_b64)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    orig_w, orig_h = pil_img.size

    tensor = _preprocess(pil_img)                   # [1, 3, 640, 640]
    loop   = asyncio.get_event_loop()
    output = await loop.run_in_executor(
        None,
        lambda: session.run(None, {session.get_inputs()[0].name: tensor})[0],
    )                                                # [1, 4+nc, 8400]

    return _postprocess(output, orig_w, orig_h, confidence, class_names)


# ── Internal ──────────────────────────────────────────────────────────────────

async def _get_session():
    global _session, _class_names
    if _session is not None:
        return _session, _class_names
    async with _lock:
        if _session is not None:
            return _session, _class_names
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 2
        opts.intra_op_num_threads = 2
        _session = ort.InferenceSession(str(MODEL_PATH), opts)
        _class_names = _load_classes()
        log.info("ONNX session loaded — classes: %d", len(_class_names))
    return _session, _class_names


def _load_classes() -> list[str]:
    if CLASSES_PATH.exists():
        return [l.strip() for l in CLASSES_PATH.read_text().splitlines() if l.strip()]
    return []


def _preprocess(img: Image.Image) -> np.ndarray:
    """Resize + normalize to [1, 3, 640, 640] float32."""
    img = img.resize((640, 640), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0   # [640, 640, 3]
    arr = arr.transpose(2, 0, 1)[np.newaxis]         # [1, 3, 640, 640]
    return np.ascontiguousarray(arr)


def _postprocess(
    output: np.ndarray,
    orig_w: int,
    orig_h: int,
    conf_thresh: float,
    class_names: list[str],
    iou_thresh: float = 0.45,
) -> list[dict]:
    """
    YOLOv8 ONNX output: [1, 4+nc, 8400]
    Returns [{class, confidence, bbox: [x, y, w, h]}]
    """
    pred = output[0].T                               # [8400, 4+nc]
    nc   = pred.shape[1] - 4

    boxes      = pred[:, :4]
    cls_scores = pred[:, 4:]
    cls_ids    = cls_scores.argmax(axis=1)
    confs      = cls_scores.max(axis=1)

    mask   = confs > conf_thresh
    boxes  = boxes[mask]
    cls_ids = cls_ids[mask]
    confs  = confs[mask]

    if len(boxes) == 0:
        return []

    # cx/cy/w/h (relative to 640) → x1/y1/x2/y2 in original pixels
    bx = boxes.copy()
    bx[:, 0] = (boxes[:, 0] - boxes[:, 2] / 2) * orig_w / 640
    bx[:, 1] = (boxes[:, 1] - boxes[:, 3] / 2) * orig_h / 640
    bx[:, 2] = (boxes[:, 0] + boxes[:, 2] / 2) * orig_w / 640
    bx[:, 3] = (boxes[:, 1] + boxes[:, 3] / 2) * orig_h / 640

    keep = _nms(bx, confs, iou_thresh)

    results = []
    for i in keep:
        x1, y1, x2, y2 = bx[i]
        cid  = int(cls_ids[i])
        name = class_names[cid] if cid < len(class_names) else str(cid)
        results.append({
            "class":      name,
            "confidence": round(float(confs[i]), 3),
            "bbox":       [float(x1), float(y1), float(x2 - x1), float(y2 - y1)],
        })
    return results


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> list[int]:
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas  = (x2 - x1) * (y2 - y1)
    order  = scores.argsort()[::-1]
    keep   = []
    while order.size:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter  = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou    = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        order  = order[np.where(iou <= iou_thresh)[0] + 1]
    return keep
