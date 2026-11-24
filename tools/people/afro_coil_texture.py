"""Linear RGBA 1024x512 dual-zone texture + tangent normal map for sculpted natural 4C Afro coils.

Left half (u in [0.00..0.50]):
  Dense high-contrast seamless 4C coiled-hair base texture (deep espresso crevices + warm
  dark-umber coil rings) blended from two de-correlated seamless coil tiles so 4K close-ups
  have zero visible repeating-grid pattern, with a soft feathered tapered hairline along v=0..0.14.
Right half (u in [0.50..1.00]):
  Airy seamless micro-coil lace texture (individual tight C/S/O coil loops over open air)
  used on concentric outer parallax shells (+3mm, +6.5mm) to create a genuinely soft, fuzzy,
  3D coiled Afro silhouette and depth with zero flat card flakes.
"""
import math

import numpy as np

_CACHED = None


def _dilate_rgb(rgb, alpha, steps=10):
    out = rgb.copy()
    mask = alpha > 0.08
    for _ in range(steps):
        if mask.all():
            break
        acc = np.zeros_like(out)
        cnt = np.zeros(mask.shape, dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            sm = np.roll(mask, (dy, dx), axis=(0, 1))
            sr = np.roll(out, (dy, dx), axis=(0, 1))
            acc += sr * sm[:, :, None]
            cnt += sm
        fill = (~mask) & (cnt > 0)
        out[fill] = acc[fill] / cnt[fill, None]
        mask |= fill
    return out


def _coil_height_tile(size=512, seed=4091):
    """High-contrast seamless dense 4C coil heightfield in [0..1] for the sculpted base dome."""
    rng = np.random.default_rng(seed)
    dy, dx = np.mgrid[-14:15, -14:15]
    r_grid = np.hypot(dx, dy)
    ang_grid = np.arctan2(dy, dx)

    yy, xx = np.mgrid[:size, :size]
    macro = (
        0.50
        + 0.22 * np.sin(xx * math.tau * 9 / size + 0.9 * np.sin(yy * math.tau * 7 / size))
        + 0.22 * np.cos(yy * math.tau * 9 / size - 0.9 * np.cos(xx * math.tau * 8 / size))
        + 0.14 * np.sin((xx + yy) * math.tau * 13 / size)
    ).astype(np.float32)
    h = np.clip(0.18 + 0.30 * macro, 0.05, 0.55)

    for _ in range(5600):
        cx, cy = rng.integers(0, size, 2)
        radius = rng.uniform(1.8, 6.8)
        angle = rng.uniform(0, math.tau)
        width = rng.uniform(0.80, 1.45)
        ix = (cx + np.arange(-14, 15)) % size
        iy = (cy + np.arange(-14, 15)) % size
        arc = np.clip(np.cos(ang_grid - angle) + 0.60, 0.0, 1.0)
        ring = np.exp(-((r_grid - radius) / width) ** 2) * arc
        hole = np.exp(-((r_grid - max(0.4, radius - 1.7)) / 1.2) ** 2) * arc
        amp = rng.uniform(0.24, 0.74)
        patch = h[np.ix_(iy, ix)]
        h[np.ix_(iy, ix)] = np.clip(patch - 0.18 * hole + amp * ring, 0.02, 1.0)
    return h


def _airy_lace_tile(size=512, seed=4099):
    """Seamless airy micro-coil lace alpha + height for outer concentric fuzzy Afro halo shells."""
    rng = np.random.default_rng(seed)
    dy, dx = np.mgrid[-12:13, -12:13]
    r_grid = np.hypot(dx, dy)
    ang_grid = np.arctan2(dy, dx)

    alpha = np.zeros((size, size), dtype=np.float32)
    lum = np.zeros((size, size), dtype=np.float32)
    wsum = np.zeros((size, size), dtype=np.float32)

    # Cluster delicate fine coil loops into natural organic micro-clumps with open breathing air
    n_clusters = 190
    for _ in range(n_clusters):
        ccx, ccy = rng.integers(0, size, 2)
        n_loops = int(rng.integers(10, 22))
        for _ in range(n_loops):
            cx = int((ccx + rng.normal(0, 10.5)) % size)
            cy = int((ccy + rng.normal(0, 10.5)) % size)
            radius = rng.uniform(1.6, 5.2)
            angle = rng.uniform(0, math.tau)
            width = rng.uniform(0.65, 1.15)
            ix = (cx + np.arange(-12, 13)) % size
            iy = (cy + np.arange(-12, 13)) % size
            arc = np.clip(np.cos(ang_grid - angle) + 0.50, 0.0, 1.0)
            loop = np.exp(-((r_grid - radius) / width) ** 2) * arc
            strand_v = rng.uniform(0.35, 1.05)
            a_patch = alpha[np.ix_(iy, ix)]
            alpha[np.ix_(iy, ix)] = 1.0 - (1.0 - a_patch) * np.clip(1.0 - loop * 0.88, 0.0, 1.0)
            lum[np.ix_(iy, ix)] += loop * strand_v
            wsum[np.ix_(iy, ix)] += loop

    val = np.where(wsum > 1e-4, lum / np.maximum(wsum, 1e-4), 0.60)
    return np.clip(alpha, 0.0, 1.0), np.clip(val, 0.05, 1.0)


def _height_to_normal(h, strength=4.6):
    """Standard OpenGL tangent-space normal map (+X right, +Y up in Blender UV rows)."""
    gx = 0.5 * (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    gy = 0.5 * (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    inv_len = 1.0 / np.sqrt(gx * gx + gy * gy + nz * nz)
    nx = (-gx * inv_len) * 0.5 + 0.5
    ny = (-gy * inv_len) * 0.5 + 0.5
    nz = (nz * inv_len) * 0.5 + 0.5
    return np.stack([nx, ny, nz], axis=2).astype(np.float32)


def _build_all():
    global _CACHED
    if _CACHED is not None:
        return _CACHED

    h_px, half_w = 512, 512
    rng = np.random.default_rng(4092)
    tile_a = _coil_height_tile(512, seed=4091)
    tile_b = _coil_height_tile(512, seed=4127)
    lace_a1, lace_v1 = _airy_lace_tile(512, seed=4099)
    lace_a2, lace_v2 = _airy_lace_tile(512, seed=4153)

    deep = np.array([0.008, 0.006, 0.005], dtype=np.float32)
    crest = np.array([0.092, 0.065, 0.048], dtype=np.float32)

    # Low-frequency seamless blend mask to break up tile repetition at 4K close-up
    y, x = np.mgrid[:h_px, :half_w]
    ux = x * (math.tau / half_w)
    vy = y * (math.tau / h_px)
    mix = np.clip(
        0.50
        + 0.28 * np.sin(ux * 2.0 + 0.8 * np.cos(vy * 3.0))
        + 0.24 * np.cos(vy * 2.0 - 0.7 * np.sin(ux * 3.0 + 1.1)),
        0.0,
        1.0,
    ).astype(np.float32)

    # ---- Left half (512x512): Dense sculpted base dome + soft feathered hairline fade -----------
    h_La = tile_a[(y * 2) % 512, (x * 4) % 512]
    h_Lb = tile_b[(y * 2 + 193) % 512, (x * 4 + 271) % 512]
    h_L = np.clip(h_La * (1.0 - mix) + h_Lb * mix, 0.02, 1.0)
    c_t = np.clip(h_L ** 1.30, 0.0, 1.0)[:, :, None]
    rgb_L = deep[None, None, :] * (1.0 - c_t) + crest[None, None, :] * c_t
    # Soft natural tapered hairline over the first 24px (fades cleanly into forehead/temples/nape)
    edge_n = 0.36 * (h_L - 0.50) + rng.uniform(-0.16, 0.16, h_L.shape)
    alpha_L = np.clip((y / 24.0) + edge_n, 0.0, 1.0).astype(np.float32)
    rgb_L = _dilate_rgb(rgb_L, alpha_L, steps=10)
    nrm_L = _height_to_normal(h_L, strength=5.2)
    left = np.concatenate([rgb_L, alpha_L[:, :, None]], axis=2)

    # ---- Right half (512x512): Airy micro-coil lace for concentric fuzzy Afro parallax shells ---
    a_R1 = lace_a1[(y * 2) % 512, (x * 4) % 512]
    a_R2 = lace_a2[(y * 2 + 157) % 512, (x * 4 + 313) % 512]
    v_R1 = lace_v1[(y * 2) % 512, (x * 4) % 512]
    v_R2 = lace_v2[(y * 2 + 157) % 512, (x * 4 + 313) % 512]
    a_R = np.clip(a_R1 * (1.0 - mix) + a_R2 * mix, 0.0, 1.0)
    v_R = np.clip(v_R1 * (1.0 - mix) + v_R2 * mix, 0.05, 1.0)
    # Fade lace softly out near the tapered hairline (v < 0.16) so temples/fade stay ultra-clean!
    hairline_fade = np.clip((y - 26.0) / 56.0, 0.0, 1.0).astype(np.float32)
    a_R = np.clip(a_R * hairline_fade, 0.0, 1.0)
    # Guard 3px on seam between left & right UV halves
    guard = np.clip(np.minimum(x, half_w - 1 - x) / 3.0, 0.0, 1.0).astype(np.float32)
    a_R *= guard
    c_R_t = np.clip(v_R ** 1.15, 0.0, 1.0)[:, :, None]
    rgb_R = deep[None, None, :] * (1.0 - c_R_t) + (crest * 1.10)[None, None, :] * c_R_t
    rgb_R = _dilate_rgb(rgb_R, a_R, steps=10)
    nrm_R = _height_to_normal(v_R * a_R, strength=4.6)
    right = np.concatenate([rgb_R, a_R[:, :, None]], axis=2)

    rgba = np.concatenate([left, right], axis=1).astype(np.float32)
    nrm_rgb = np.concatenate([nrm_L, nrm_R], axis=1).astype(np.float32)
    nrm_rgba = np.concatenate([nrm_rgb, np.ones((h_px, half_w * 2, 1), dtype=np.float32)], axis=2)
    _CACHED = (rgba, nrm_rgba)
    return _CACHED


def pixels():
    """Return (512, 1024, 4) linear float32 RGBA in Blender row order (v=0 bottom)."""
    return _build_all()[0]


def normal_pixels():
    """Return (512, 1024, 4) linear float32 tangent-space normal map in Blender row order."""
    return _build_all()[1]
