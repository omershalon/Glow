#!/usr/bin/env python3
"""
Convert yolo26m1280.pt → TFLite for Android.

Usage:
  /Applications/Xcode.app/.../python3 scripts/export-tflite.py
"""

import sys
import shutil
from pathlib import Path

MODEL_PATH = "/Users/arjun/Acne_Detect/yolo26m1280.pt"
MODULE_ANDROID_ASSETS = (
    Path(__file__).parent.parent
    / "modules" / "yolo-detector" / "android" / "src" / "main" / "assets"
)
EXPORTS_DIR = Path(__file__).parent.parent / "model-exports"
EXPORTS_DIR.mkdir(exist_ok=True)
MODULE_ANDROID_ASSETS.mkdir(parents=True, exist_ok=True)

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: pip install ultralytics")
    sys.exit(1)

print(f"Loading {MODEL_PATH}…")
model = YOLO(MODEL_PATH)

print("Exporting TFLite…")
tflite_path = model.export(
    format="tflite",
    imgsz=1280,
    int8=False,
    half=False,
)
tflite_path = Path(str(tflite_path))
print(f"Export: {tflite_path}  ({tflite_path.stat().st_size / 1e6:.1f} MB)")

dest_tflite = EXPORTS_DIR / "yolo-acne.tflite"
shutil.copy(str(tflite_path), str(dest_tflite))
print(f"Copied to {dest_tflite}")

android_dest = MODULE_ANDROID_ASSETS / "yolo-acne.tflite"
shutil.copy(str(tflite_path), str(android_dest))
print(f"Placed in Android module assets: {android_dest}")
print("\nAndroid TFLite export done.")
