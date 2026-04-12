#!/usr/bin/env python3
"""
Convert yolo26m1280.pt → CoreML using TorchScript trace path.
This avoids coremltools' embedded TF runtime (no mutex deadlock).

Usage:
  /Applications/Xcode.app/.../python3 scripts/export-coreml.py
"""

import os
import sys
import shutil
from pathlib import Path

MODEL_PATH = "/Users/arjun/Acne_Detect/yolo26m1280.pt"
IOS_ASSETS_DIR = Path(__file__).parent.parent / "ios" / "Glow"
EXPORTS_DIR = Path(__file__).parent.parent / "model-exports"
EXPORTS_DIR.mkdir(exist_ok=True)

import torch
import numpy as np

print(f"torch: {torch.__version__}")

try:
    import coremltools as ct
    print(f"coremltools: {ct.__version__}")
except ImportError:
    print("ERROR: pip install coremltools")
    sys.exit(1)

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: pip install ultralytics")
    sys.exit(1)

# ── Load model ────────────────────────────────────────────────────────────────
print(f"\nLoading {MODEL_PATH}…")
yolo = YOLO(MODEL_PATH)
pt_model = yolo.model.eval().float()

# Wrap the model so it always returns a single tensor [1, 300, 6].
# End2end YOLO returns (detections_tensor, aux_dict) in eval mode;
# torch.jit.trace requires a consistent, tensor-only output.
class DetectorWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.model(x)
        # End2end: out is a tensor [1,300,6] or tuple where first elem is detections
        if isinstance(out, (list, tuple)):
            return out[0]
        return out

wrapper = DetectorWrapper(pt_model).eval()

# ── TorchScript trace ─────────────────────────────────────────────────────────
print("Tracing with torch.jit.trace…")
dummy_input = torch.zeros(1, 3, 1280, 1280)
with torch.no_grad():
    test_out = wrapper(dummy_input)
print(f"Wrapper output shape: {test_out.shape}")   # expect [1, 300, 6]

with torch.no_grad():
    traced = torch.jit.trace(wrapper, dummy_input, strict=False)

traced_path = EXPORTS_DIR / "yolo26m1280_traced.pt"
traced.save(str(traced_path))
print(f"Traced model saved: {traced_path}")

# ── coremltools convert (PyTorch path, no TF) ─────────────────────────────────
print("\nConverting TorchScript → CoreML (PyTorch path, no TF)…")
ml_model = ct.convert(
    traced,
    source="pytorch",
    convert_to="mlprogram",
    minimum_deployment_target=ct.target.iOS16,
    inputs=[ct.TensorType(
        name="images",
        shape=(1, 3, 1280, 1280),
        dtype=np.float32,
    )],
    compute_units=ct.ComputeUnit.CPU_AND_NE,
)
print("Conversion complete.")

# ── Save ──────────────────────────────────────────────────────────────────────
dest_coreml = EXPORTS_DIR / "yolo-acne.mlpackage"
if dest_coreml.exists():
    shutil.rmtree(dest_coreml)
ml_model.save(str(dest_coreml))
print(f"Saved: {dest_coreml}  ({sum(f.stat().st_size for f in dest_coreml.rglob('*') if f.is_file()) / 1e6:.1f} MB)")

ios_dest = IOS_ASSETS_DIR / "yolo-acne.mlpackage"
if ios_dest.exists():
    shutil.rmtree(ios_dest)
shutil.copytree(str(dest_coreml), str(ios_dest))
print(f"Placed in iOS project: {ios_dest}")
print("\niOS CoreML export done.")
