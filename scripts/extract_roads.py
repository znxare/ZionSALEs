"""Road network from the master plan: mask grey roads -> clean -> thin to
centre lines -> graph of junctions/ends joined by simplified polylines.
Writes src/lib/roadNetwork.ts (coordinates in % of the plan)."""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

HERE = os.environ.get("ROADS_OUT", os.path.dirname(os.path.abspath(__file__)))  # preview images go here
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.asarray(Image.open(os.path.join(REPO, 'public/master-plan/l1.webp')).convert('RGB')).astype(np.int16)
H0, W0 = im.shape[:2]

mx, mn, mean = im.max(2), im.min(2), im.mean(2)
mask = ((mx - mn) <= 10) & (mean >= 200) & (mean <= 236)

# Work at half resolution (1800 x 1274): plenty for routing.
S = 2
h, w = H0 // S, W0 // S
m = mask[:h * S, :w * S].reshape(h, S, w, S).mean((1, 3)) >= 0.5


def shift(a, dy, dx):
    out = np.zeros_like(a)
    ys = slice(max(dy, 0), h + min(dy, 0)); yd = slice(max(-dy, 0), h + min(-dy, 0))
    xs = slice(max(dx, 0), w + min(dx, 0)); xd = slice(max(-dx, 0), w + min(-dx, 0))
    out[ys, xs] = a[yd, xd]
    return out


def dilate(a, r):
    out = a.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                out |= shift(a, dy, dx)
    return out


def erode(a, r):
    return ~dilate(~a, r)


def components(a):
    lab = np.zeros(a.shape, np.int32)
    sizes = [0]
    n = 0
    ys, xs = np.nonzero(a)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        q = deque([(y0, x0)]); lab[y0, x0] = n; cnt = 0
        while q:
            y, x = q.popleft(); cnt += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; q.append((yy, xx))
        sizes.append(cnt)
    return lab, np.array(sizes)


# Close small gaps (lines/trees drawn over roads), then drop specks.
m = erode(dilate(m, 3), 3)
m = dilate(erode(m, 1), 1)  # open: remove hairlines/hatching
lab, sizes = components(m)
keep = sizes >= 1500
keep[0] = False
m = keep[lab]
print('road pixels', int(m.sum()), 'components kept', int(keep.sum()))


# Zhang-Suen thinning (vectorised).
def thin(img):
    img = img.copy().astype(np.uint8)
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2 = P[:-2, 1:-1]; p3 = P[:-2, 2:]; p4 = P[1:-1, 2:]; p5 = P[2:, 2:]
            p6 = P[2:, 1:-1]; p7 = P[2:, :-2]; p8 = P[1:-1, :-2]; p9 = P[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            B = sum(n.astype(np.int32) for n in nb)
            seq = nb + [p2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.int32) for i in range(8))
            if step == 0:
                c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                c = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            rm = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if rm.any():
                img[rm] = 0; changed = True
        if not changed:
            return img.astype(bool)


sk = thin(m)
print('skeleton pixels', int(sk.sum()))

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def neighbours(sk, y, x):
    out = []
    for dy, dx in NB:
        yy, xx = y + dy, x + dx
        if 0 <= yy < h and 0 <= xx < w and sk[yy, xx]:
            out.append((yy, xx))
    return out


# Prune short spurs (thinning artefacts), a few passes.
for _ in range(3):
    ends = [(y, x) for y, x in zip(*np.nonzero(sk)) if len(neighbours(sk, y, x)) == 1]
    for e in ends:
        path = [e]; prev = None; cur = e
        while True:
            nb = [p for p in neighbours(sk, *cur) if p != prev and p not in path]
            if len(nb) != 1 or len(path) > 14:
                break
            prev, cur = cur, nb[0]
            if len(neighbours(sk, *cur)) > 2:
                break
            path.append(cur)
        if len(path) <= 14 and len(neighbours(sk, *cur)) > 2:
            for p in path:
                sk[p] = False

# Graph: nodes = pixels with degree != 2; chains between them become edges.
deg = {}
for y, x in zip(*np.nonzero(sk)):
    deg[(y, x)] = len(neighbours(sk, y, x))
node_px = [p for p, d in deg.items() if d != 2]
node_id = {p: i for i, p in enumerate(node_px)}
edges = []
seen = set()
for p in node_px:
    for q in neighbours(sk, *p):
        if (p, q) in seen:
            continue
        chain = [p, q]; prev = p; cur = q
        while cur not in node_id:
            nb = [r for r in neighbours(sk, *cur) if r != prev]
            # prefer non-diagonal continuation if several
            if not nb:
                break
            prev, cur = cur, nb[0]
            chain.append(cur)
        if cur not in node_id:
            # dangling loop; make its end a node
            node_id[cur] = len(node_px); node_px.append(cur)
        seen.add((p, q)); seen.add((chain[-1], chain[-2]))
        if node_id[p] == node_id[chain[-1]] and len(chain) < 4:
            continue
        edges.append((node_id[p], node_id[chain[-1]], chain))


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    ab = b - a; L = np.hypot(*ab)
    best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        p = np.array(pts[i], float)
        d = abs(ab[0] * (a[1] - p[1]) - ab[1] * (a[0] - p[0])) / L if L else np.hypot(*(p - a))
        if d > best:
            best, bi = d, i
    if best > eps:
        return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)
    return [pts[0], pts[-1]]


# Bridge small gaps: dead-ends close to another part of the network.
ends = [p for p in node_px if deg.get(p, 0) == 1]
sk_pts = np.array(list(zip(*np.nonzero(sk))))
bridges = 0
for e in ends:
    d = np.hypot(sk_pts[:, 0] - e[0], sk_pts[:, 1] - e[1])
    # ignore the end's own chain (within 25 px along the network is approximated by a radius test + direction)
    cand = np.nonzero((d > 3) & (d <= 18))[0]
    if not len(cand):
        continue
    # only if not already connected nearby via the skeleton: BFS limited depth
    near = set()
    q = deque([(e, 0)]); vis = {e}
    while q:
        c, k = q.popleft()
        near.add(c)
        if k >= 30:
            continue
        for r in neighbours(sk, *c):
            if r not in vis:
                vis.add(r); q.append((r, k + 1))
    best = None
    for i in cand:
        t = tuple(sk_pts[i])
        if t in near:
            continue
        if best is None or d[i] < d[best]:
            best = i
    if best is None:
        continue
    t = tuple(sk_pts[best])
    if t not in node_id:
        # split: make it a node; find the edge containing it and split it
        for k, (a, b, chain) in enumerate(edges):
            if t in chain:
                j = chain.index(t)
                node_id[t] = len(node_px); node_px.append(t)
                edges[k] = (a, node_id[t], chain[:j + 1])
                edges.append((node_id[t], b, chain[j:]))
                break
        else:
            continue
    edges.append((node_id[e], node_id[t], [e, t]))
    bridges += 1
print('nodes', len(node_px), 'edges', len(edges), 'bridges', bridges)

# Export in % of the plan (pixel centres).
fx = lambda x: round((x + 0.5) * S / W0 * 100, 3)
fy = lambda y: round((y + 0.5) * S / H0 * 100, 3)
nodes_out = [[fx(x), fy(y)] for (y, x) in node_px]
edges_out = []
for a, b, chain in edges:
    simp = rdp([(y, x) for (y, x) in chain], 0.8)
    mid = [c for p in simp[1:-1] for c in (fx(p[1]), fy(p[0]))]
    edges_out.append([a, b, mid])

json.dump({'nodes': nodes_out, 'edges': edges_out}, open(os.path.join(HERE, 'roads.json'), 'w'))

# Preview
prev = (im[::S, ::S][:h, :w] * 0.5 + 120).clip(0, 255).astype(np.uint8)
from PIL import ImageDraw
img = Image.fromarray(prev)
d = ImageDraw.Draw(img)
for a, b, chain in edges:
    simp = rdp([(y, x) for (y, x) in chain], 0.8)
    d.line([(x, y) for (y, x) in simp], fill=(220, 30, 30), width=3)
for (y, x) in node_px:
    d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(30, 60, 220))
img.save(os.path.join(HERE, 'roads_graph.png'))
print('ok')

# --- Pixel-graph export (routing runs on the centre-line pixels directly) ---
lab2, sizes2 = components(sk)
print('skeleton components', len(sizes2) - 1, 'sizes', sorted(sizes2[1:].tolist(), reverse=True)[:6])
main = int(np.argmax(sizes2[1:]) + 1)
pts = np.array([(x, y) for y, x in zip(*np.nonzero(lab2 == main))], dtype=np.uint16)
import base64
b64 = base64.b64encode(pts.astype('<u2').tobytes()).decode()
ts = f"""// Generated from the master plan (grey roads → centre lines) by the road
// extraction script. Each road pixel on a {w} x {h} grid over the plan
// (x, y pairs, little-endian uint16, base64). Routing runs on these.
export const ROAD_GRID = {{ width: {w}, height: {h} }};
export const ROAD_PIXELS_B64 = '{b64}';
"""
open(os.path.join(REPO, 'src/lib/roadNetwork.ts'), 'w', encoding='utf-8').write(ts)
print('exported', len(pts), 'pixels', len(b64), 'chars')
