"""Builds the self-hosted image upscaling model in public/models/esrgan/.

Source: Real-ESRGAN "realesr-general-x4v3" (SRVGGNetCompact, BSD-3-Clause, Xintao Wang et al.)
from the project's GitHub release. The PyTorch checkpoint is read without PyTorch (it is a zip
of a pickle plus raw float32 storages) and rebuilt as an ONNX graph:
  conv3x3 + PReLU, 32 x (conv3x3 + PReLU), conv3x3 to 48 channels, DepthToSpace(4),
  plus the nearest-neighbour 4x upsampled input (the network predicts the residual).

Run: python scripts/build-upscale-model.py   (needs onnx, numpy)
"""
from pathlib import Path
import hashlib, io, json, pickle, urllib.request, zipfile
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.font-build' / 'models'
OUT = ROOT / 'public' / 'models' / 'esrgan'
SOURCE = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
checkpoint = CACHE / 'realesr-general-x4v3.pth'
if not checkpoint.exists():
    urllib.request.urlretrieve(SOURCE, checkpoint)


def load_torch_zip(path):
    """Minimal reader for PyTorch's zip checkpoint format (float32 tensors only)."""
    archive = zipfile.ZipFile(path)
    prefix = archive.namelist()[0].split('/')[0]

    def rebuild(storage, offset, size, stride, *_):
        array = np.frombuffer(storage, dtype=np.float32)
        return np.lib.stride_tricks.as_strided(array[offset:], shape=size, strides=[s * 4 for s in stride]).copy()

    class Unpickler(pickle.Unpickler):
        def find_class(self, module, name):
            if name == '_rebuild_tensor_v2':
                return rebuild
            if module == 'collections' and name == 'OrderedDict':
                import collections
                return collections.OrderedDict
            if module.startswith('torch'):
                return name  # storage type markers such as FloatStorage
            return super().find_class(module, name)

        def persistent_load(self, pid):
            _, kind, key, _location, _numel = pid
            assert kind in ('FloatStorage', 'float') or 'Float' in str(kind), kind
            return archive.read(f'{prefix}/data/{key}')

    return Unpickler(io.BytesIO(archive.read(f'{prefix}/data.pkl'))).load()


state = load_torch_zip(checkpoint)
state = state.get('params', state)
convs = sorted({int(k.split('.')[1]) for k in state if k.endswith('.weight') and state[k].ndim == 4})
prelus = sorted({int(k.split('.')[1]) for k in state if k.endswith('.weight') and state[k].ndim == 1})
assert len(convs) == 34 and len(prelus) == 33, (len(convs), len(prelus))

nodes, inits = [], []
current = 'input'
for i, index in enumerate(convs):
    w, b = state[f'body.{index}.weight'], state[f'body.{index}.bias']
    inits += [numpy_helper.from_array(w.astype(np.float32), f'w{i}'), numpy_helper.from_array(b.astype(np.float32), f'b{i}')]
    nodes.append(helper.make_node('Conv', [current, f'w{i}', f'b{i}'], [f'c{i}'], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
    current = f'c{i}'
    if index + 1 in prelus:
        slope = state[f'body.{index + 1}.weight'].astype(np.float32).reshape(-1, 1, 1)
        inits.append(numpy_helper.from_array(slope, f'a{i}'))
        nodes.append(helper.make_node('PRelu', [current, f'a{i}'], [f'p{i}']))
        current = f'p{i}'
nodes.append(helper.make_node('DepthToSpace', [current], ['shuffled'], blocksize=4, mode='CRD'))
inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], np.float32), 'scales'))
nodes.append(helper.make_node('Resize', ['input', '', 'scales'], ['base'], mode='nearest'))
nodes.append(helper.make_node('Add', ['shuffled', 'base'], ['output']))
graph = helper.make_graph(
    nodes, 'realesr-general-x4v3',
    [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, 'h', 'w'])],
    [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, 'H', 'W'])],
    inits,
)
model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)])
model.ir_version = 8
onnx.checker.check_model(model)
data = model.SerializeToString()
(OUT / 'realesr-general-x4v3.onnx').write_bytes(data)
(OUT / 'model.json').write_text(json.dumps({
    'name': 'Real-ESRGAN general x4v3', 'license': 'BSD-3-Clause', 'scale': 4,
    'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'parts': ['realesr-general-x4v3.onnx'],
}, indent=1))
(OUT / 'LICENSE.txt').write_text(urllib.request.urlopen('https://raw.githubusercontent.com/xinntao/Real-ESRGAN/master/LICENSE').read().decode()
    + '\nWeights: realesr-general-x4v3.pth, https://github.com/xinntao/Real-ESRGAN. Converted to ONNX for KittySuite.\n')
print(len(data))
