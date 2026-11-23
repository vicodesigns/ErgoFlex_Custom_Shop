"""Linear RGBA 1024x1024 multi-variant hair-card atlas for sculpted long wavy hair.

Four UV columns (u in [0..0.25], [0.25..0.50], [0.50..0.75], [0.75..1.00]),
Blender pixel orientation (row 0 = v=0 tips/edge, row H-1 = v=1 root/part):
  Col 0: Dense inner foundation lock — full root/mid-shaft, staggered V-feathered tips
  Col 1: Sculpted mid-layer wave clumps — 3-4 separated glossy sub-locks with airy gaps
  Col 2: Outer wispy / face-framing tendrils — light separated strands for soft silhouette
  Col 3: Scalp cap & feathered parting — radial root fibres fading softly at the hairline
"""
import math

import numpy as np


def _dilate_rgb(rgb, alpha, steps=12):
    """Bleed strand RGB outward into transparent pixels so WebP/mipmaps never fringe dark."""
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


def _draw_card_column(height, col_w, rng, spec):
    """Render one vertical hair-card column (v=0 tips at bottom, v=1 root at top)."""
    v = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]       # (H, 1)
    u = np.linspace(0.0, 1.0, col_w, dtype=np.float32)[None, :]        # (1, W)

    # Accumulate alpha coverage, weighted strand luminance, and subtle warm/cool hue shift
    cov = np.zeros((height, col_w), dtype=np.float32)
    lum_sum = np.zeros((height, col_w), dtype=np.float32)
    warm_sum = np.zeros((height, col_w), dtype=np.float32)
    w_sum = np.zeros((height, col_w), dtype=np.float32)

    clumps = spec['clumps']
    for c_idx, clump in enumerate(clumps):
        cu0, cu1, tip_v, wave_amp, wave_freq, wave_phase, n_strands, density = clump
        center = 0.5 * (cu0 + cu1)
        half_w = 0.5 * (cu1 - cu0)

        for _ in range(n_strands):
            # Distribute strand anchor across clump width with denser core
            s_off = rng.normal(0.0, 0.42)
            s_off = float(np.clip(s_off, -1.05, 1.05))
            u_root = center + s_off * half_w * 0.88
            # Taper clump gently toward its tip and keep strands flowing coherently
            taper_to = center + s_off * half_w * spec.get('tip_taper', 0.36)
            # Individual strand tip varies organically around the clump's tip_v
            s_tip = float(np.clip(tip_v + rng.uniform(-0.07, 0.14) + 0.08 * abs(s_off), 0.015, 0.58))
            s_root_end = float(rng.uniform(0.955, 1.005))

            # Coherent clump S-wave + subtle individual micro-wave
            ind_amp = rng.uniform(-0.012, 0.012)
            ind_freq = wave_freq + rng.uniform(-0.7, 0.7)
            ind_phase = wave_phase + rng.uniform(-0.55, 0.55)
            # Blend from root position to tapered tip position
            s_pos = np.clip((v - s_tip) / max(1e-4, 1.0 - s_tip), 0.0, 1.0)
            env = np.maximum(0.0, np.sin(np.pi * np.clip(1.0 - s_pos, 0.0, 1.0))) ** 0.75
            u_curve = (
                taper_to + (u_root - taper_to) * (s_pos ** 0.78)
                + (wave_amp * np.sin(wave_freq * math.tau * (1.0 - v) + wave_phase)
                   + ind_amp * np.sin(ind_freq * math.tau * (1.0 - v) + ind_phase)) * env
            )

            # Strand half-width in normalized column u (1.1 - 2.4 px at 256px width)
            sigma = rng.uniform(spec['w_min'], spec['w_max']) / col_w
            # Taper slightly finer right at the tip
            tip_fade = np.clip((v - s_tip) / 0.11, 0.0, 1.0)
            root_fade = np.clip((s_root_end - v) / spec.get('root_fade', 0.035), 0.0, 1.0)
            length_mask = (tip_fade ** 0.8) * (root_fade ** 0.7)

            # Keep away from hard column borders so adjacent UV columns never bleed
            du = u - u_curve
            profile = np.exp(-0.5 * (du / sigma) ** 2) * length_mask * density

            # Per-strand natural melanin variation (deep espresso shadows to warm chestnut highlights)
            strand_lum = rng.uniform(0.48, 1.64)
            if rng.random() < 0.16:
                strand_lum *= rng.uniform(1.22, 1.48)  # occasional lighter sun-kissed catchlight fibre
            # Subtle ridge shading along the strand's wave crest
            crest = 0.88 + 0.16 * np.cos(wave_freq * math.tau * (1.0 - v) + wave_phase + 0.4)
            # Subtle internal clump AO (outer strands slightly brighter than deep core)
            clump_depth = 0.80 + 0.28 * abs(s_off)
            warmth = rng.uniform(-0.12, 0.18)

            weight = profile
            cov = 1.0 - (1.0 - cov) * np.clip(1.0 - weight * 0.92, 0.0, 1.0)
            lum_sum += weight * strand_lum * crest * clump_depth
            warm_sum += weight * warmth
            w_sum += weight

    # Clean guard margins on column edges (4px each side) so atlas tiles never leak
    margin = 4.0 / col_w
    edge_guard = np.clip(np.minimum(u, 1.0 - u) / margin, 0.0, 1.0)
    alpha = np.clip(cov * edge_guard, 0.0, 1.0)

    # Root-to-tip tonal gradient: richer deeper roots, lustrous mid-shaft, warm slightly lighter tips
    lum = np.where(w_sum > 1e-4, lum_sum / np.maximum(w_sum, 1e-4), 0.85)
    warm = np.where(w_sum > 1e-4, warm_sum / np.maximum(w_sum, 1e-4), 0.0)
    root_ao = 0.58 + 0.48 * (1.0 - np.clip((v - 0.68) / 0.32, 0.0, 1.0) ** 1.6)
    mid_sheen = 1.0 + 0.18 * np.exp(-((v - 0.56) / 0.24) ** 2)
    tip_lift = 1.0 + 0.12 * np.clip((0.28 - v) / 0.28, 0.0, 1.0)
    lum = lum * root_ao * mid_sheen * tip_lift

    # Rich, luminous warm dark chestnut-brunette (clearly readable strands in both Cycles & Three.js)
    base = np.array([0.092, 0.055, 0.034], dtype=np.float32)
    rgb = np.empty((height, col_w, 3), dtype=np.float32)
    rgb[:, :, 0] = base[0] * lum * (1.0 + 0.22 * warm)
    rgb[:, :, 1] = base[1] * lum * (1.0 + 0.07 * warm)
    rgb[:, :, 2] = base[2] * lum * (1.0 - 0.14 * warm)

    # Soft silky hair-fibre catchlights on brightest strands
    glint = np.clip((lum - 1.15) / 0.62, 0.0, 1.0) ** 1.3
    rgb += glint[:, :, None] * np.array([0.052, 0.036, 0.024], dtype=np.float32)
    rgb = np.clip(rgb, 0.005, 1.0)
    rgb = _dilate_rgb(rgb, alpha, steps=14)
    return np.concatenate([rgb, alpha[:, :, None]], axis=2)


def _draw_scalp_column(height, col_w, rng):
    """Col 3: scalp under-cap & soft feathered hairline (v=0 forehead edge -> v=1 crown part)."""
    v = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]
    u = np.linspace(0.0, 1.0, col_w, dtype=np.float32)[None, :]

    # Continuous fine root strands radiating vertically from part (v=1) to hairline (v=0)
    n_u = col_w
    base_noise = rng.normal(0.0, 1.0, n_u).astype(np.float32)
    # Multi-scale horizontal fibre frequencies with slight wavy drift
    drift = 3.2 * np.sin(0.014 * np.arange(height)[:, None] + 0.045 * np.arange(col_w)[None, :])
    x_idx = (np.arange(col_w)[None, :] + drift) % n_u
    fine = np.interp(x_idx, np.arange(n_u), base_noise, period=n_u)
    med = np.sin(0.32 * x_idx + 1.4 * np.sin(0.06 * x_idx))
    clump = np.sin(0.11 * x_idx + 0.8 * np.cos(0.03 * x_idx))

    lum = np.clip(0.86 + 0.17 * fine + 0.13 * med + 0.10 * clump, 0.45, 1.42)
    # Deeper shadow right at the parting root line, slightly brighter over the crown curve
    lum *= 0.72 + 0.30 * (np.maximum(0.0, np.sin(np.pi * np.clip(v, 0.0, 1.0))) ** 0.65)

    # Soft, organic feathered baby-hair hairline along v=0..0.16 (zero jagged teeth)
    edge_jit = 0.018 * np.sin(5.0 * math.tau * u) + 0.012 * np.sin(13.0 * math.tau * u + 1.1) + 0.014 * fine
    alpha = np.clip((v - 0.055 + edge_jit) / 0.11, 0.0, 1.0)
    wisps = np.clip((fine * 0.5 + 0.5) * np.clip((v - 0.01) / 0.08, 0.0, 1.0), 0.0, 1.0)
    alpha = np.clip(np.maximum(alpha, wisps * 0.55 * (v < 0.15)), 0.0, 1.0)

    base = np.array([0.092, 0.055, 0.034], dtype=np.float32)
    rgb = np.clip(base[None, None, :] * lum[:, :, None], 0.005, 1.0)
    rgb = _dilate_rgb(rgb, alpha, steps=10)
    return np.concatenate([rgb, alpha[:, :, None]], axis=2)


def pixels():
    """Return (1024, 1024, 4) linear float32 RGBA in Blender row order (v=0 bottom)."""
    height, col_w = 1024, 256
    rng = np.random.default_rng(20261123)

    # Col 0: Dense silky foundation volume lock (lush full body, soft feathered U/V tips)
    col0 = _draw_card_column(height, col_w, rng, {
        'w_min': 1.7, 'w_max': 3.0, 'tip_taper': 0.58, 'root_fade': 0.020,
        'clumps': [
            (0.05, 0.44, 0.09, 0.020, 1.15, 0.2, 155, 0.92),
            (0.28, 0.72, 0.03, 0.022, 1.25, 1.3, 175, 0.95),
            (0.56, 0.95, 0.11, 0.020, 1.10, 2.4, 155, 0.92),
        ],
    })

    # Col 1: Sculpted mid-layer salon wave locks (lush cohesive sub-locks, feathered ends — never stringy!)
    col1 = _draw_card_column(height, col_w, rng, {
        'w_min': 1.5, 'w_max': 2.5, 'tip_taper': 0.42, 'root_fade': 0.030,
        'clumps': [
            (0.05, 0.36, 0.14, 0.024, 1.35, 0.3, 130, 0.90),
            (0.28, 0.62, 0.04, 0.028, 1.45, 1.6, 150, 0.93),
            (0.52, 0.80, 0.09, 0.024, 1.30, 2.9, 130, 0.90),
            (0.72, 0.95, 0.19, 0.022, 1.50, 4.1, 105, 0.86),
        ],
    })

    # Col 2: Outer soft layered wisps & face-framing strands (feathery but healthy, never jagged)
    col2 = _draw_card_column(height, col_w, rng, {
        'w_min': 1.25, 'w_max': 2.1, 'tip_taper': 0.30, 'root_fade': 0.045,
        'clumps': [
            (0.07, 0.30, 0.18, 0.026, 1.50, 0.6, 85, 0.84),
            (0.32, 0.58, 0.05, 0.030, 1.45, 2.0, 100, 0.88),
            (0.58, 0.79, 0.13, 0.026, 1.60, 3.4, 82, 0.82),
            (0.77, 0.94, 0.25, 0.022, 1.65, 4.8, 65, 0.78),
        ],
    })

    # Col 3: Scalp under-cap with soft feathered hairline
    col3 = _draw_scalp_column(height, col_w, rng)

    return np.concatenate([col0, col1, col2, col3], axis=1).astype(np.float32)
