"""Run after generate-app-icon.swift to package its PNGs for macOS and Windows."""
from pathlib import Path
import struct

root = Path(__file__).resolve().parent.parent / 'assets'
def png(size):
    name = f'icon_{size}x{size}.png' if size <= 512 else 'icon_512x512@2x.png'
    return (root / 'TechHub.iconset' / name).read_bytes()

images = [(size, png(size)) for size in (16, 32, 64, 128, 256)]
offset = 6 + 16 * len(images)
entries = []
for size, data in images:
    entries.append(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
    offset += len(data)
(root / 'TechHub.ico').write_bytes(struct.pack('<HHH', 0, 1, len(images)) + b''.join(entries) + b''.join(data for _, data in images))

chunks = []
for kind, size in [(b'icp4', 16), (b'icp5', 32), (b'icp6', 64), (b'ic07', 128), (b'ic08', 256), (b'ic09', 512), (b'ic10', 1024)]:
    data = png(size)
    chunks.append(kind + struct.pack('>I', len(data) + 8) + data)
payload = b''.join(chunks)
(root / 'TechHub.icns').write_bytes(b'icns' + struct.pack('>I', len(payload) + 8) + payload)
