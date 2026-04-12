#!/usr/bin/env python3
"""
Export yolo26m1280.pt to:
  - CoreML (.mlpackage) for iOS      → ios/Glow/yolo-acne.mlpackage
  - ONNX  (.onnx)      for Android   → modules/yolo-detector/android/src/main/assets/yolo-acne.onnx

Requires Python 3.11 with a patched coremltools (see README note).
Usage:
  python3.11 scripts/export-models.py

Patches applied (one-time, already done):
  - /opt/homebrew/lib/python3.11/site-packages/coremltools/converters/mil/frontend/torch/ops.py
    line 3048: dtype(x.val) → dtype(x.val.item() if hasattr(x.val,'item') else x.val)
"""

import sys
import shutil
from pathlib import Path

MODEL_PATH       = "/Users/arjun/Acne_Detect/yolo26m1280.pt"
IOS_ASSETS_DIR   = Path(__file__).parent.parent / "ios" / "Glow"
ANDROID_ASSETS   = (
    Path(__file__).parent.parent
    / "modules" / "yolo-detector" / "android" / "src" / "main" / "assets"
)
EXPORTS_DIR = Path(__file__).parent.parent / "model-exports"

EXPORTS_DIR.mkdir(exist_ok=True)
ANDROID_ASSETS.mkdir(parents=True, exist_ok=True)

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: pip install ultralytics")
    sys.exit(1)

model = YOLO(MODEL_PATH)
print(f"Loaded: {MODEL_PATH}")
print(f"Output shape: (1, 300, 6)  [end2end with NMS built-in]\n")

# ── iOS: CoreML ───────────────────────────────────────────────────────────────
print("=== iOS: CoreML export (ultralytics PyTorch → CoreML) ===")
coreml_path = model.export(format="coreml", imgsz=1280, nms=False, half=False)
coreml_path = Path(str(coreml_path))

dest_coreml = EXPORTS_DIR / "yolo-acne.mlpackage"
if dest_coreml.exists():
    shutil.rmtree(dest_coreml)
shutil.copytree(str(coreml_path), str(dest_coreml))

ios_dest = IOS_ASSETS_DIR / "yolo-acne.mlpackage"
if ios_dest.exists():
    shutil.rmtree(ios_dest)
shutil.copytree(str(coreml_path), str(ios_dest))
print(f"✓ iOS CoreML → {ios_dest}\n")

# ── Android: ONNX (loaded by ONNX Runtime for Android) ───────────────────────
print("=== Android: ONNX export ===")
onnx_path = model.export(format="onnx", imgsz=1280, simplify=True, opset=17, half=False)
onnx_path = Path(str(onnx_path))

dest_onnx = EXPORTS_DIR / "yolo-acne.onnx"
shutil.copy(str(onnx_path), str(dest_onnx))

android_dest = ANDROID_ASSETS / "yolo-acne.onnx"
shutil.copy(str(onnx_path), str(android_dest))
print(f"✓ Android ONNX → {android_dest}\n")

# ── Summary ───────────────────────────────────────────────────────────────────
print("=== Summary ===")
ios_size = sum(f.stat().st_size for f in ios_dest.rglob("*") if f.is_file()) / 1e6
print(f"iOS  CoreML  {ios_size:.1f} MB  → {ios_dest}")
print(f"Android ONNX {android_dest.stat().st_size / 1e6:.1f} MB  → {android_dest}")

print("\nNext steps:")
print("  iOS:     Build via Xcode (yolo-acne.mlpackage already in project.pbxproj)")
print("  Android: npx expo prebuild --platform android && npx expo run:android")
