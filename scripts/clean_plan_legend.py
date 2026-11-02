"""Paints the numbered red markers and the printed legend out of the master plan pictures.

The public map labels the gates and amenities itself (see PlanLandmarks.tsx), so the baked-in
numbered markers (1-8) and the legend box (including 'Camp site' and 'Power transmission lines',
which the estate does not want shown to guests) are removed from every level of the plan:
public/master-plan/l0.webp, l1.webp, l2/*.webp, l3/*.webp.

Run once from the repo root on the ORIGINAL pictures (git checkout public/master-plan first if
you need to run it again):  python scripts/clean_plan_legend.py
Needs: numpy, Pillow, opencv-python-headless.
"""
import math
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'master-plan')
TILE = 1024

# name, width, height, tiled
LEVELS = [
    ('l0', 1600, 1132, False),
    ('l1', 3600, 2547, False),
    ('l2', 7200, 5093, True),
    ('l3', 11233, 7946, True),
]

# Centres of the numbered markers on the plan itself, as fractions of the plan (measured on l1).
MARKERS = [
    (0.2259, 0.2728), (0.3821, 0.3331), (0.3477, 0.4076), (0.4816, 0.4693), (0.1489, 0.5436),
    (0.4383, 0.5633), (0.4024, 0.5837), (0.1580, 0.5847), (0.4507, 0.7451), (0.4699, 0.7963),
]
MARKER_R = 0.0066  # fraction of the plan width: the red disc, its white rim and its shadow

# The legend block (x0, y0, x1, y1) and the clean strip of paper below it that supplies the grain.
LEGEND = (0.084, 0.713, 0.274, 0.918)
DONOR = (0.084, 0.924, 0.274, 0.986)


def read_level(name, w, h, tiled, x0, y0, x1, y1):
    """The pixels of a level inside the box, stitched from whichever tiles cover it."""
    canvas = np.zeros((y1 - y0, x1 - x0, 3), np.uint8)
    for (path, ox, oy) in tiles_for(name, w, h, tiled, x0, y0, x1, y1):
        im = np.array(Image.open(path).convert('RGB'))
        th, tw = im.shape[:2]
        sx0, sy0 = max(x0, ox), max(y0, oy)
        sx1, sy1 = min(x1, ox + tw), min(y1, oy + th)
        canvas[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = im[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox]
    return canvas


def write_level(name, w, h, tiled, x0, y0, canvas):
    y1, x1 = y0 + canvas.shape[0], x0 + canvas.shape[1]
    for (path, ox, oy) in tiles_for(name, w, h, tiled, x0, y0, x1, y1):
        im = np.array(Image.open(path).convert('RGB'))
        th, tw = im.shape[:2]
        sx0, sy0 = max(x0, ox), max(y0, oy)
        sx1, sy1 = min(x1, ox + tw), min(y1, oy + th)
        im[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = canvas[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0]
        Image.fromarray(im).save(path, 'WEBP', quality=90, method=5)


def tiles_for(name, w, h, tiled, x0, y0, x1, y1):
    if not tiled:
        return [(os.path.join(ROOT, f'{name}.webp'), 0, 0)]
    out = []
    for ty in range(y0 // TILE, (y1 - 1) // TILE + 1):
        for tx in range(x0 // TILE, (x1 - 1) // TILE + 1):
            out.append((os.path.join(ROOT, name, f'{tx}_{ty}.webp'), tx * TILE, ty * TILE))
    return out


def clean_legend(name, w, h, tiled):
    lx0, ly0, lx1, ly1 = (int(LEGEND[0] * w), int(LEGEND[1] * h), int(LEGEND[2] * w), int(LEGEND[3] * h))
    dx0, dy0, dx1, dy1 = (int(DONOR[0] * w), int(DONOR[1] * h), int(DONOR[2] * w), int(DONOR[3] * h))
    pad = max(8, int(w * 0.004))
    bx0, by0, bx1, by1 = lx0 - pad, ly0 - pad, lx1 + pad, dy1
    img = read_level(name, w, h, tiled, bx0, by0, bx1, by1)

    # Smooth colour for the hole: inpaint a small copy, then blow it back up.
    mask = np.zeros(img.shape[:2], np.uint8)
    mask[ly0 - by0:ly1 - by0, lx0 - bx0:lx1 - bx0] = 255
    k = max(1, int(w / 220))
    small = cv2.resize(img, (img.shape[1] // k, img.shape[0] // k), interpolation=cv2.INTER_AREA)
    msmall = cv2.resize(mask, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST)
    msmall = cv2.dilate(msmall, np.ones((3, 3), np.uint8))
    fill = cv2.inpaint(small, msmall, 3, cv2.INPAINT_TELEA)
    fill = cv2.resize(fill, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC).astype(np.float32)

    # The paper's grain from the clean strip below the legend, tiled over the hole.
    donor = img[dy0 - by0:dy1 - by0, dx0 - bx0:dx1 - bx0].astype(np.float32)
    sigma = max(2.0, w / 400)
    grain = donor - cv2.GaussianBlur(donor, (0, 0), sigma * 3)
    hh, ww = ly1 - ly0, lx1 - lx0
    reps_y, reps_x = math.ceil(hh / grain.shape[0]) + 1, math.ceil(ww / grain.shape[1]) + 1
    big = np.tile(np.concatenate([grain, grain[::-1]], axis=0), (reps_y // 2 + 1, 1, 1))
    big = np.tile(np.concatenate([big, big[:, ::-1]], axis=1), (1, reps_x // 2 + 1, 1))
    patch = fill[ly0 - by0:ly1 - by0, lx0 - bx0:lx1 - bx0] + big[:hh, :ww]

    # Feathered edges so no seam shows.
    f = max(6, int(w * 0.003))
    alpha = np.ones((hh, ww), np.float32)
    ramp = np.linspace(0, 1, f, dtype=np.float32)
    alpha[:f] *= ramp[:, None]; alpha[-f:] *= ramp[::-1][:, None]
    alpha[:, :f] *= ramp[None, :]; alpha[:, -f:] *= ramp[::-1][None, :]
    region = img[ly0 - by0:ly1 - by0, lx0 - bx0:lx1 - bx0].astype(np.float32)
    mixed = region * (1 - alpha[..., None]) + patch * alpha[..., None]
    img[ly0 - by0:ly1 - by0, lx0 - bx0:lx1 - bx0] = np.clip(mixed, 0, 255).astype(np.uint8)
    write_level(name, w, h, tiled, bx0, by0, img)


def clean_markers(name, w, h, tiled):
    r = max(4, int(MARKER_R * w))
    m = int(r * 2.2)
    for fx, fy in MARKERS:
        cx, cy = int(fx * w), int(fy * h)
        x0, y0, x1, y1 = cx - m, cy - m, cx + m, cy + m
        img = read_level(name, w, h, tiled, x0, y0, x1, y1)
        mask = np.zeros(img.shape[:2], np.uint8)
        cv2.circle(mask, (m, m), r, 255, -1)
        out = cv2.inpaint(img, mask, max(3, r // 3), cv2.INPAINT_TELEA)
        write_level(name, w, h, tiled, x0, y0, out)


if __name__ == '__main__':
    for name, w, h, tiled in LEVELS:
        print('cleaning', name)
        clean_legend(name, w, h, tiled)
        clean_markers(name, w, h, tiled)
    print('done')
