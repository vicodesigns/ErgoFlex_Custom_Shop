"""Linear RGBA for the sculpted crop and its matching strand maps."""
import math

import numpy as np


def pixels():
    # Tile of overlapping short, bent fibres. Wrap each stroke at both borders.
    size = 384
    rng = np.random.default_rng(8154)
    dy, dx = np.mgrid[-8:9, -8:9]
    tone = rng.uniform(.65, 1.0, (size, size))
    for _ in range(1250):
        cx, cy = rng.integers(0, size, 2)
        radius = rng.uniform(2., 6.)
        angle = rng.uniform(0, math.tau)
        ix = (cx + np.arange(-8, 9)) % size
        iy = (cy + np.arange(-8, 9)) % size
        arc = np.clip(np.cos(np.arctan2(dy, dx) - angle) + .35, 0, 1)
        strand = np.exp(-((np.hypot(dx, dy) - radius) / .85) ** 2) * arc
        tone[np.ix_(iy, ix)] += rng.uniform(.2, 1.0) * strand
    width, height = 1024, 512
    y, x = np.mgrid[:height, :width]
    fibres = tone[(y * size * 2 // height) % size, (x * size * 5 // width) % size]
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = fibres[:, :, None] * np.array([.105, .079, .062])
    # Thin the first few millimetres into the existing shaved hairline.
    rgba[:, :, 3] = np.clip(y / 13 + .42 * (fibres - 1) + rng.uniform(-.27, .27, fibres.shape), 0, 1)
    return rgba
