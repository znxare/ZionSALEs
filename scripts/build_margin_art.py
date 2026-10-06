"""Margin art for the public map: finds the blank paper around the estate on the master plan, then
  - bakes a soft terrain overlay (contour lines + hill shading) into public/plan-terrain.webp, only on
    that paper and fading in away from the estate;
  - writes src/lib/marginSpots.ts: where stars, village lights and kites may go (all on the paper).
Run:  python scripts/build_margin_art.py     (needs numpy and Pillow)"""
import os
import numpy as np
from PIL import Image
from collections import deque

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 900, 636                      # analysis size (the plan is 1.4151 : 1)
OW = 1800                            # overlay width
OH = round(OW * H / W)

# Places on the plan (x0, y0, x1, y1 in % of the plan) that must stay clear of stars, lights and shading.
KEEP_CLEAR = {
    'logo': (66, 14, 96, 30),
    'legend': (6, 66, 29, 95),
    'credits': (87, 83, 100, 98),
    'compass': (0, 90, 5, 100),
    'cartouche': (72.5, 30.0, 97.5, 49.5),
    'postcard': (9.0, 3.0, 31.0, 20.5),
}

src = Image.open(os.path.join(REPO, 'public/master-plan/l1.webp')).convert('RGB')
sm = np.asarray(src.resize((W, H), Image.LANCZOS)).astype(int)
r, g, b = sm[..., 0], sm[..., 1], sm[..., 2]
lum = (r + g + b) / 3
warm = (r - b >= 7) & (g - b >= 6) & (g >= r - 6)
cand = (warm & (lum > 170) & (lum < 245)) | ((r - b >= 4) & (lum > 140) & (lum <= 170) & (g >= r - 8))


def dilate(a, k):
    out = a.copy()
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            if dy * dy + dx * dx <= k * k:
                out |= np.roll(np.roll(a, dy, 0), dx, 1)
    return out


def erode(a, k):
    return ~dilate(~a, k)


m = dilate(erode(erode(dilate(cand, 3), 3), 5), 5)

# only the paper connected to the image border is margin
seen = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if m[y, x] and not seen[y, x]:
            seen[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if m[y, x] and not seen[y, x]:
            seen[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True; q.append((ny, nx))
margin = seen

# ---------------------------------------------------------------- the keep-clear boxes
def box_mask(w, h, pad=0.0):
    out = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in KEEP_CLEAR.values():
        out[int((y0 - pad) / 100 * h):int((y1 + pad) / 100 * h) + 1, int((x0 - pad) / 100 * w):int((x1 + pad) / 100 * w) + 1] = True
    return out


# ---------------------------------------------------------------- terrain overlay
def gauss_fft(a, sigma):
    fy = np.fft.fftfreq(a.shape[0])[:, None]
    fx = np.fft.fftfreq(a.shape[1])[None, :]
    k = np.exp(-2 * (np.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * k))


rng = np.random.default_rng(11)


def noise(cell):
    small = rng.normal(size=(max(4, OH // cell), max(4, OW // cell))).astype(np.float32)
    big = Image.fromarray(small, mode='F').resize((OW, OH), Image.BICUBIC)
    a = np.asarray(big, dtype=np.float32)
    return (a - a.mean()) / (a.std() + 1e-6)


h = 1.0 * noise(260) + 0.55 * noise(130) + 0.28 * noise(64) + 0.1 * noise(30)
h = gauss_fft(h, 6)
hn = (h - h.min()) / (h.max() - h.min())

levels = np.floor(hn * 16).astype(int)
edge = (levels != np.roll(levels, -1, 1)) | (levels != np.roll(levels, -1, 0))
major = ((levels % 4) != (np.roll(levels, -1, 1) % 4)) | ((levels % 4) != (np.roll(levels, -1, 0) % 4))
major = major & edge
line = gauss_fft(edge.astype(np.float32), 0.9) * 2.6
line_major = gauss_fft(dilate(major, 1).astype(np.float32), 0.9) * 2.6
ac = np.clip(0.17 * line + 0.17 * line_major, 0, 0.36)

gy, gx = np.gradient(gauss_fft(h, 5))
shade = np.clip((-(gx + gy)) * 60, -1, 1)
a_light = np.clip(shade, 0, 1) * 0.13
a_dark = np.clip(-shade, 0, 1) * 0.12

# how far inside the margin each point is (soft), so the art fades in away from the estate
mm = np.asarray(Image.fromarray((margin * 255).astype(np.uint8)).resize((OW, OH), Image.BILINEAR)).astype(np.float32) / 255
depth = np.clip((gauss_fft(mm, 26) - 0.6) / 0.32, 0, 1) * (mm > 0.5)
clear = gauss_fft(box_mask(OW, OH, 0.8).astype(np.float32), 8)
weight = depth * (1 - np.clip(clear * 1.6, 0, 1))

ac *= weight
a_light *= weight
a_dark *= weight
as_ = np.maximum(a_light, a_dark)
alpha = ac + as_ * (1 - ac)
c_line = np.array([128, 102, 64], np.float32)
c_shade = np.where((a_light >= a_dark)[..., None], np.array([255, 251, 238], np.float32), np.array([98, 78, 50], np.float32))
rgb = (ac[..., None] * c_line + (as_ * (1 - ac))[..., None] * c_shade) / np.maximum(alpha[..., None], 1e-5)
out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
dest = os.path.join(REPO, 'public/plan-terrain.webp')
Image.fromarray(out, 'RGBA').save(dest, 'WEBP', quality=58, method=6)
print('terrain overlay', OW, 'x', OH, os.path.getsize(dest) // 1024, 'KB')

# ---------------------------------------------------------------- spots on the paper
safe = erode(margin, 4) & ~box_mask(W, H, 0.5)
ys, xs = np.nonzero(safe)
srng = np.random.default_rng(5)


def pick(n, weights=None):
    idx = srng.choice(len(xs), size=n, replace=False)
    return [(round(xs[i] / W * 100, 2), round(ys[i] / H * 100, 2)) for i in idx]


stars = [(x, y, round(0.5 + srng.random() * 1.1, 2), int(srng.integers(0, 5))) for x, y in pick(260)]

# village lights: a few clusters on the hills / far paper, each a handful of warm windows
clusters = []
hill_zones = [(4, 6, 24, 40), (49, 0, 86, 7), (0, 38, 9, 56), (96, 40, 100, 80), (60, 90, 86, 100)]
lights = []
for zx0, zy0, zx1, zy1 in hill_zones:
    zone = [(x, y) for x, y in zip(xs, ys) if zx0 <= x / W * 100 <= zx1 and zy0 <= y / H * 100 <= zy1]
    if not zone:
        continue
    for _ in range(2):
        cx, cy = zone[int(srng.integers(0, len(zone)))]
        for _k in range(int(srng.integers(5, 9))):
            ox, oy = srng.normal(0, 7), srng.normal(0, 5)
            px, py = (cx + ox) / W * 100, (cy + oy) / H * 100
            if 0 <= px <= 100 and 0 <= py <= 100 and margin[min(H - 1, max(0, int(py / 100 * H))), min(W - 1, max(0, int(px / 100 * W)))]:
                lights.append((round(px, 2), round(py, 2), round(0.6 + srng.random() * 0.8, 2), int(srng.integers(0, 4))))

fmt = lambda pts: '[' + ', '.join('[' + ', '.join(str(v) for v in p) + ']' for p in pts) + ']'
text = f"""// Generated by scripts/build_margin_art.py - do not edit by hand.
// Spots on the blank paper around the estate (% of the plan): [x, y, size, group].
export const STARS: [number, number, number, number][] = {fmt(stars)};
export const VILLAGE_LIGHTS: [number, number, number, number][] = {fmt(lights)};
"""
open(os.path.join(REPO, 'src/lib/marginSpots.ts'), 'w', newline='\n', encoding='utf-8').write(text)
print('stars', len(stars), 'village lights', len(lights))
