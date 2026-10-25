"""Builds the self-hosted background-removal model in public/models/isnet/.

Source: IS-Net "isnet-general-use" (Qin et al., DIS, Apache-2.0), ONNX export published in the
rembg project's GitHub release (MIT). This script, run once at build time:
  1. keeps only the main mask output (drops 6 unused side outputs and their layers),
  2. stores weights as float16 with a Cast back to float32 (half the download, same results:
     max difference 0.0016 on a 0..1 mask), so it runs on both WebGPU and the CPU backend,
  3. splits the file into parts under 24 MB (static hosts such as Cloudflare Pages cap files at 25 MiB),
  4. writes model.json with the part list, total size and SHA-256.

Run: python scripts/build-bg-model.py   (needs onnx, numpy; downloads ~180 MB once into .font-build/)
"""
from pathlib import Path
import hashlib, json, urllib.request
import numpy as np
import onnx, onnx.utils
from onnx import helper, numpy_helper, TensorProto

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.font-build' / 'models'
OUT = ROOT / 'public' / 'models' / 'isnet'
SOURCE = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx'
PART = 24 * 1000 * 1000

CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
raw = CACHE / 'isnet-general-use.onnx'
if not raw.exists():
    urllib.request.urlretrieve(SOURCE, raw)

main_only = CACHE / 'isnet-main.onnx'
model = onnx.load(raw)
onnx.utils.extract_model(str(raw), str(main_only), [model.graph.input[0].name], [model.graph.output[0].name])

model = onnx.load(main_only)
graph = model.graph
initializers, casts = [], []
for init in graph.initializer:
    array = numpy_helper.to_array(init)
    if array.dtype == np.float32 and array.size > 16:
        half = init.name + '__fp16'
        initializers.append(numpy_helper.from_array(array.astype(np.float16), half))
        casts.append(helper.make_node('Cast', [half], [init.name], to=TensorProto.FLOAT, name=init.name + '__cast'))
    else:
        initializers.append(init)
del graph.initializer[:]
graph.initializer.extend(initializers)
nodes = list(graph.node)
del graph.node[:]
graph.node.extend(casts + nodes)
onnx.checker.check_model(model)
data = model.SerializeToString()

for old in OUT.glob('isnet.part*'):
    old.unlink()
parts = []
for i in range(0, len(data), PART):
    name = f'isnet.part{len(parts) + 1}'
    (OUT / name).write_bytes(data[i:i + PART])
    parts.append(name)
(OUT / 'model.json').write_text(json.dumps({
    'name': 'IS-Net general use (DIS)',
    'license': 'Apache-2.0',
    'input': 1024,
    'mean': [0.5, 0.5, 0.5],
    'std': [1.0, 1.0, 1.0],
    'bytes': len(data),
    'sha256': hashlib.sha256(data).hexdigest(),
    'parts': parts,
}, indent=1))
(OUT / 'LICENSE.txt').write_text(
    'IS-Net (Highly Accurate Dichotomous Image Segmentation), "isnet-general-use" weights\n'
    'Copyright (c) Xuebin Qin et al. Licensed under the Apache License, Version 2.0.\n'
    'https://github.com/xuebinqin/DIS  -  ONNX export: https://github.com/danielgatis/rembg (MIT)\n'
    'Modified for KittySuite: unused side outputs removed, weights stored as float16, file split into parts.\n'
    'Full licence text: https://www.apache.org/licenses/LICENSE-2.0\n')
print(len(data), parts)
