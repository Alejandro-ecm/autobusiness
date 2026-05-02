#!/usr/bin/env python3
"""
Entrena YOLOv8 con tus productos y exporta a ONNX para la Caja IA.

INSTALACIÓN (solo en tu PC, no en el servidor):
    pip install ultralytics

USO:
    python train_yolov8.py --data dataset/data.yaml --epochs 100 --name mi_modelo

ESTRUCTURA DEL DATASET:
    dataset/
    ├── data.yaml          ← describe las clases y carpetas
    ├── images/
    │   ├── train/         ← fotos para entrenar (80%)
    │   └── val/           ← fotos para validar  (20%)
    └── labels/
        ├── train/         ← anotaciones .txt en formato YOLO
        └── val/

FORMATO DE data.yaml:
    path: ./dataset
    train: images/train
    val:   images/val
    nc: 3
    names:
      0: coca_cola_600
      1: sabritas_roja
      2: agua_bonafont_500

FORMATO DE ANOTACIONES (.txt, un archivo por imagen):
    <class_id> <cx> <cy> <w> <h>    ← valores 0-1 relativos al tamaño de la imagen
    Ejemplo: 0 0.512 0.423 0.180 0.320

HERRAMIENTAS DE ANOTACIÓN RECOMENDADAS:
    - Roboflow (web, gratuito): https://roboflow.com
    - LabelImg (escritorio): pip install labelImg

CONSEJOS PARA BUENAS DETECCIONES:
    - Mínimo 50-100 fotos por producto
    - Variedad de ángulos, iluminaciones y fondos
    - Fotos borrosas o mal iluminadas = predicciones malas
    - Más datos = mejor modelo
"""

import argparse
import shutil
from pathlib import Path

def parse_args():
    p = argparse.ArgumentParser(description="Entrena YOLOv8 y exporta a ONNX")
    p.add_argument("--data",   default="dataset/data.yaml", help="Ruta al data.yaml")
    p.add_argument("--model",  default="yolov8n.pt",        help="Modelo base (n=nano, s=small, m=medium)")
    p.add_argument("--epochs", type=int, default=100,        help="Épocas de entrenamiento")
    p.add_argument("--imgsz",  type=int, default=640,        help="Tamaño de imagen")
    p.add_argument("--batch",  type=int, default=16,         help="Batch size (baja si se acaba la RAM)")
    p.add_argument("--name",   default="autobusiness",       help="Nombre del experimento")
    p.add_argument("--device", default="cpu",                help="cpu | 0 (GPU nvidia) | mps (Mac)")
    p.add_argument("--export-only", action="store_true",     help="Solo exportar, no entrenar")
    p.add_argument("--weights", default=None,                help="Pesos .pt para --export-only")
    return p.parse_args()


def train(args):
    from ultralytics import YOLO

    print(f"\n{'='*60}")
    print(f"  Entrenando con {args.data}")
    print(f"  Modelo base  : {args.model}")
    print(f"  Épocas       : {args.epochs}")
    print(f"  Dispositivo  : {args.device}")
    print(f"{'='*60}\n")

    model = YOLO(args.model)
    results = model.train(
        data    = args.data,
        epochs  = args.epochs,
        imgsz   = args.imgsz,
        batch   = args.batch,
        name    = args.name,
        device  = args.device,
        # Augmentaciones útiles para POS (productos en mostrador)
        flipud  = 0.0,     # no voltear verticalmente (productos tienen orientación)
        fliplr  = 0.5,
        degrees = 10.0,
        hsv_h   = 0.015,
        hsv_s   = 0.7,
        hsv_v   = 0.4,
    )

    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    print(f"\n✅ Entrenamiento terminado. Mejor modelo: {best_pt}")
    return best_pt


def export_to_onnx(pt_path: Path, imgsz: int = 640):
    from ultralytics import YOLO

    print(f"\nExportando {pt_path} → ONNX...")
    model  = YOLO(str(pt_path))
    result = model.export(format="onnx", imgsz=imgsz, simplify=True, opset=12)
    onnx_path = Path(str(result))
    print(f"✅ ONNX exportado: {onnx_path}")
    return onnx_path


def export_classes(pt_path: Path, out_dir: Path):
    """Guarda classes.txt con los nombres de clase del modelo."""
    from ultralytics import YOLO
    model = YOLO(str(pt_path))
    names = [model.names[i] for i in sorted(model.names)]
    txt   = out_dir / "classes.txt"
    txt.write_text("\n".join(names))
    print(f"✅ Clases guardadas: {txt}")
    print(f"   Clases: {names}")
    return txt


def copy_to_engine(onnx_path: Path, classes_path: Path):
    """Copia el modelo al directorio de la IA del servidor."""
    dst = Path(__file__).parent / "models"
    dst.mkdir(exist_ok=True)

    shutil.copy2(onnx_path,   dst / "best.onnx")
    shutil.copy2(classes_path, dst / "classes.txt")

    print(f"\n🚀 Modelo copiado a {dst}/")
    print("   Reconstruye el contenedor para activarlo:")
    print("   docker compose build ai-engine && docker compose up -d ai-engine")


def main():
    args = parse_args()

    if args.export_only:
        if not args.weights:
            print("Error: --export-only requiere --weights ruta/a/best.pt")
            return
        pt = Path(args.weights)
    else:
        pt = train(args)

    onnx = export_to_onnx(pt, args.imgsz)
    classes = export_classes(pt, onnx.parent)
    copy_to_engine(onnx, classes)

    print(f"\n{'='*60}")
    print("  ¡Listo! Pasos siguientes:")
    print("  1. docker compose build ai-engine")
    print("  2. docker compose up -d ai-engine")
    print("  3. Abre Caja IA — verás 'Modelo personalizado activo'")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
