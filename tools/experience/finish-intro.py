#!/usr/bin/env python3
"""Finish the ErgoFlex intro: grade, dissolves, end card, titles, score, masters.

    python3 tools/experience/finish-intro.py exports/cinematic-intro-20261030 [--draft] [--only master|deliver]

Reads <dir>/edl.json, <dir>/titles-src.json, <dir>/renders/NN.mkv (falls back
to <dir>/standin/NN.* for pipeline tests), <dir>/score/score.wav (optional),
<dir>/grade.json (optional per-chapter trims). Writes <dir>/final/:
  master-textless.mkv     graded, dissolved, end-card logo, near-lossless
  ErgoFlex-Intro-1080p.mp4 / -textless.mp4, ErgoFlex-Intro-720p.mp4 / -textless.mp4
  titles.json (absolute in/out for app overlays), titles.ass, poster.jpg
--chapter-titles <chapter id> <in> <out>: burn only that chapter's titles (titles-src, chapter seconds) onto a chapter video.
--draft renders a fast 960×540 preview (final/draft.mp4) instead.
--title-still T --bg IMG --out PNG renders one titled frame (T: film seconds, or <chapter>:<chapter seconds>) over IMG
  with the same titles.ass (pairs with --draft for 960x540), e.g. to compare a title against a Director Mode still.
Title shadows: a title's optional 'shadow' {blur, opacity, paths} (Director Mode's shadow editor) replaces the fitted
  line boxes with ASS vector drawings (m / l / b) at the same darkness and softness; blur / opacity alone
  restyle the fitted boxes. Path points are 1920x1080 pixels relative to the title anchor (128, 912).
--with-logo (with --title-still): the still also gets the end card's shade and wordmark as the master lays them (their
  fade at that time, the same scale / overlay expressions), so a still shows the whole end card.
End card (titles-src 'logo' / 'cta', Director Mode's end-card blocks, experience/end-card.mjs): optional logo show_delay
  (s the picture's wordmark and shade come in after rel_in, where the score's logo hit stays), optional logo x / y (its
  centre, 1920x1080 px; default 960, 0.73 H) and scale (x the film's 22 % of the width); optional cta x (its centre;
  default the wordmark's) and rel_out (null = to the film's end). Absent: everything exactly as before.
--size 2560x1440 masters at that size (chapter renders must match); the HQ file is ErgoFlex-Intro-<H>p.mp4 with the
  bitrate cap scaled by pixel count. Titles stay authored on the 1920×1080 grid (libass scales PlayRes to the frame).
"""
import json, math, os, subprocess, sys, glob, shutil, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def _fonts_dir():
    # app-reference/ is git-ignored: a git worktree has none, so fall back to the desk's / the main checkout's copy.
    for base in (os.environ.get('ERGO_FONTS'), ROOT, r'F:\ErgoFlex_Render\ErgoFlex_Custom_Shop', r'C:\work\ergoflex-cine'):
        if not base: continue
        f = base if os.path.exists(os.path.join(base, 'Poppins-SemiBold.ttf')) else os.path.join(base, 'app-reference/assets/google_fonts')
        if os.path.exists(os.path.join(f, 'Poppins-SemiBold.ttf')): return f
    return os.path.join(ROOT, 'app-reference/assets/google_fonts')
FONTS = _fonts_dir()
BLUE = '&H00EC8813&'
BOX_A, BOX_BLUR, SCRIM_BLOCK = 'B0', 18, False   # title line boxes: alpha B0 = 31% black, soft edge (HQ20 F); SCRIM_BLOCK True = the old block scrim  # #1388ec as ASS BGR

X0_LEFT = 128
ANCHOR = (128, 912)   # title anchor: the headline's left edge / bottom line (Director Mode's film-titles.mjs ANCHOR)
# A title's optional 'place' (film-titles.mjs PLACES; absent = lower-left, everything as before): (x, line y offset,
# ASS alignment, box alpha). top-*: the eyebrow's top 110 px from the top edge, as the supporting line's bottom is from
# the bottom lower left; *-right: lines flush right at 1920 - 128 (\an3); top boxes darker ('70', 56% black) since they
# sit over skies and windows. Custom shadow paths are relative to the placed anchor.
PLACE_DY, BOX_A_TOP = 110 - (812 - 28), '70'
PLACES = {'lower-left': (128, 0, 1, None), 'top-left': (128, PLACE_DY, 1, BOX_A_TOP), 'top-right': (1920 - 128, PLACE_DY, 3, BOX_A_TOP)}
LINE_TIMING = {'eyebrow': (0, 10), 'title': (140, 14), 'detail': (380, 10)}   # (delay ms, rise px) as below

def ass_num(v):
    v = round(float(v) + 0.0, 2); return str(int(v)) if v == int(v) else f'{v:g}'

def ass_drawing(path, anchor=ANCHOR):
    """A shadow path as an ASS drawing in absolute 1920x1080 coordinates (film-titles.mjs assDrawing())."""
    P, (ax, ay) = path['points'], anchor
    xy = lambda x, y: f'{ass_num(x + ax)} {ass_num(y + ay)}'
    out = ['m ' + xy(P[0]['x'], P[0]['y'])]
    for i, p in enumerate(P):
        q = P[(i + 1) % len(P)]
        if not p.get('out') and not q.get('in'): out.append('l ' + xy(q['x'], q['y'])); continue
        o, n = p.get('out') or [0, 0], q.get('in') or [0, 0]
        out.append(f"b {xy(p['x'] + o[0], p['y'] + o[1])} {xy(q['x'] + n[0], q['y'] + n[1])} {xy(q['x'], q['y'])}")
    return ' '.join(out)

def run(cmd, cwd=None):
    print('$', ' '.join(c if len(c) < 120 else c[:117] + '…' for c in cmd), flush=True)
    if cmd[0] == 'ffmpeg':
        # Bound decoder/filter concurrency for 12-input films on desktop machines.
        # ffmpeg otherwise starts a full CPU-sized pool for every input.
        threads = str(max(1, int(os.environ.get('ERGO_RENDER_THREADS', '4'))))
        bounded = [cmd[0], '-filter_complex_threads', threads, '-filter_threads', threads]
        for arg in cmd[1:]:
            if arg == '-i': bounded += ['-threads', '2']
            bounded.append(arg)
        cmd = bounded[:-1] + ['-threads', threads, bounded[-1]]
    subprocess.run(cmd, check=True, cwd=cwd)

def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

ASS_HEAD = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Eyebrow,Poppins SemiBold,28,' + BLUE + ',&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,6,0,1,0,1.2,1,0,0,0,1',
    'Style: Title,Poppins SemiBold,86,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,-0.6,0,1,0,2,1,0,0,0,1',
    'Style: Detail,Poppins,40,&H00E6DED6,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,0.2,0,1,0,1.5,1,0,0,0,1',
    'Style: Scrim,Poppins,20,&HFF000000,&HFF000000,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1',
    # HQ20 (Vico: the title scrim was "a giant box ... it should be fitting to the background of the text"; picked F):
    # each line gets its own soft box sized to its own text (BorderStyle 3: an opaque box from the line's glyph extents,
    # Outline = padding, OutlineColour = 30% black), same font / size / spacing as the line it sits behind.
    f'Style: BoxEyebrow,Poppins SemiBold,28,&HFF000000,&HFF000000,&H{BOX_A}000000,&H{BOX_A}000000,0,0,0,0,100,100,6,0,3,16,0,1,0,0,0,1',
    f'Style: BoxTitle,Poppins SemiBold,86,&HFF000000,&HFF000000,&H{BOX_A}000000,&H{BOX_A}000000,0,0,0,0,100,100,-0.6,0,3,26,0,1,0,0,0,1',
    f'Style: BoxDetail,Poppins,40,&HFF000000,&HFF000000,&H{BOX_A}000000,&H{BOX_A}000000,0,0,0,0,100,100,0.2,0,3,20,0,1,0,0,0,1',
    'Style: CTA,Poppins Medium,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,1.5,0,1,0,1.5,5,0,0,0,1', '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']

# ---- auto shadow: tight, never-overlapping boxes (film-titles.mjs fittedBox / separateBoxes / fittedPaths) -------------
# One box per line, sized to the glyphs (ascender line to descender line + a little padding) instead of libass' full
# line cell, drawn as an ASS vector shape. Boxes that would still touch are trimmed to meet halfway, so no pixel is
# covered twice and the 31 % black never stacks. Same arithmetic as film-titles.mjs (the Director preview).
FONT_REAL, DESC, ASC = 1762 / 1000, 627 / 1762, 1135 / 1762   # libass sizes Poppins by winAscent + winDescent
FALLBACK_REAL, FALLBACK_ASC = 2288 / 2048, 1854 / 2288        # Arial, for the glyphs Poppins lacks (the film's ″)
GLYPH_ASC, GLYPH_DESC = .74, .275
TIGHT_PAD = {'eyebrow': (14, 9), 'title': (22, 14), 'detail': (16, 10)}   # (horizontal, vertical) px around the glyphs
POPPINS_FILES = {400: 'Poppins-Regular', 500: 'Poppins-Medium', 600: 'Poppins-SemiBold', 700: 'Poppins-Bold'}
_FONT_CACHE = {}

def alpha_hex(opacity):
    return f"{max(0, min(255, round(255 * (1 - opacity)))):02X}"

def r2(v):
    return math.floor(v * 100 + .5) / 100              # JS Math.round, not Python's banker's rounding

def _font(name, path):
    """(advance widths by code point, units per em) of a TTF, cached; None when the file cannot be read."""
    if name in _FONT_CACHE: return _FONT_CACHE[name]
    out = None
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(path, lazy=True); cmap, hmtx = f.getBestCmap(), f['hmtx']
        out = ({c: hmtx[g][0] for c, g in cmap.items()}, f['head'].unitsPerEm)
    except Exception as e:
        print(f'WARNING: cannot read {path} to measure title text ({e}); the shadow boxes use an estimate', file=sys.stderr)
    _FONT_CACHE[name] = out; return out

def _poppins(weight):
    for w in sorted(POPPINS_FILES, key=lambda k: abs(k - weight)):
        path = os.path.join(FONTS, POPPINS_FILES[w] + '.ttf')
        if os.path.exists(path): return _font(POPPINS_FILES[w], path)
    return None

def _fallback_font():
    for path in (r'C:\Windows\Fonts\arial.ttf', '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf', '/Library/Fonts/Arial.ttf',
                 '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'):
        if os.path.exists(path): return _font('fallback:' + path, path)
    return None

def text_width(size, spacing, weight, text):
    """The line's advance width (film px) as libass sets it: each glyph's advance at size / FONT_REAL px (no kerning, no
    hinting), Arial at size / FALLBACK_REAL for glyphs Poppins lacks, plus the spacing after every glyph. Same as the
    Director's measure()."""
    pop, fb = _poppins(weight), None
    w = 0.0
    for ch in text:
        c = ord(ch)
        if pop and c in pop[0]: w += pop[0][c] / pop[1] * size / FONT_REAL
        else:
            fb = fb or _fallback_font()
            w += (fb[0].get(c, fb[1] // 2) / fb[1] * size / FALLBACK_REAL) if fb else .55 * size / FONT_REAL
        w += spacing
    return w

def has_fallback(size, weight, text):
    pop = _poppins(weight)
    return bool(pop) and any(ord(ch) not in pop[0] for ch in text)

def fitted_box(key, size, y, dx, width, align='left', up=0):
    """One tight box (relative to the title anchor, unscaled): film-titles.mjs fittedBox()."""
    ph, pv = TIGHT_PAD[key]; em = size / FONT_REAL; base = y - DESC * size
    y0 = base - GLYPH_ASC * em - pv - up - ANCHOR[1]; y1 = base + GLYPH_DESC * em + pv - ANCHOR[1]
    if align == 'right': return dict(x0=dx - width - ph, x1=dx + ph, y0=y0, y1=y1)
    if align == 'center': return dict(x0=dx - width / 2 - ph, x1=dx + width / 2 + ph, y0=y0, y1=y1)
    return dict(x0=X0_LEFT + dx - ph - ANCHOR[0], x1=X0_LEFT + dx + width + ph - ANCHOR[0], y0=y0, y1=y1)

def separate_boxes(boxes):
    """Trim boxes that overlap vertically (and share some width) to meet at the middle of the overlap: separateBoxes()."""
    order = sorted(range(len(boxes)), key=lambda i: (boxes[i]['y0'], i))
    for k in range(len(order) - 1):
        a, b = boxes[order[k]], boxes[order[k + 1]]
        if a['y1'] > b['y0'] and a['x0'] < b['x1'] and b['x0'] < a['x1']:
            mid = (a['y1'] + b['y0']) / 2; a['y1'] = b['y0'] = mid
    return boxes

def box_path(b):
    return {'points': [{'x': r2(x), 'y': r2(y)} for x, y in ((b['x0'], b['y0']), (b['x1'], b['y0']), (b['x1'], b['y1']), (b['x0'], b['y1']))]}

def title_dialogues(titles):
    """ASS Dialogue lines for titles carrying absolute 'start' / 'end' seconds (the film's burn-in look, shared with --chapter-titles)."""
    ass = []
    for t in titles:
        a, b = t['start'], t['end']
        X0, DY, AN, BOX_PLACE = PLACES[t.get('place', 'lower-left')]
        if t.get('position'):
            X0 = float(t['position']['x'])
            DY = float(t['position']['y']) - 912
        # optional 'align' (film-titles.mjs ALIGNS): the anchor x is each line's left edge / centre / right edge
        if t.get('align') in ('left', 'center', 'right') and {'left': 1, 'center': 2, 'right': 3}[t['align']] != AN:
            AN = {'left': 1, 'center': 2, 'right': 3}[t['align']]
            if not t.get('position'): X0 = {1: 128, 2: 960, 3: 1920 - 128}[AN]
        scale = max(.1, min(5, float(t.get('scale', 1))))
        if scale == 1: scale = 1
        typography = t.get('typography') or {}
        # (Until HQ20: one soft, blurred 1300 x 350 scrim behind the text block, per-title 'scrim' alpha; now fitted line boxes.)
        if SCRIM_BLOCK: ass.append(f'Dialogue: 0,{ts(a - .2)},{ts(b + .2)},Scrim,,0,0,0,,{{\\an7\\pos(0,0)\\p1\\1c&H000000&\\1a&HFF&\\blur90\\t(0,900,\\1a&H{t.get('scrim') or '90'}&)\\t({int((b - a) * 1000 - 300)},{int((b - a) * 1000 + 400)},\\1a&HFF&)}}m 0 730 l 1300 730 1300 1080 0 1080{{\\p0}}')
        def type_tags(style):
            key = {'Eyebrow': 'eyebrow', 'Title': 'title', 'Detail': 'detail'}[style]
            cfg = {k: v for k, v in (typography.get(key) or {}).items() if k not in ('dx', 'dy', 'lineHeight', 'caps')}   # dx / dy / lineHeight / caps: position and copy only, no style tags
            if not cfg and scale == 1: return ''
            size, weight, spacing, border, shadow = {'Eyebrow': (28,600,6,16,1.2), 'Title': (86,600,-.6,26,2), 'Detail': (40,400,.2,20,1.5)}[style]
            # spacing default: the Style's as libass applies it (it ignores a negative Style Spacing; a \fsp override is honoured)
            tags = f"\\fs{ass_num(float(cfg.get('size', size))*scale)}\\fsp{ass_num(float(cfg.get('spacing', max(0, spacing)))*scale)}\\b{int(cfg.get('weight', weight))}\\i{1 if cfg.get('italic') else 0}\\bord{ass_num(float(cfg.get('strokeW', 0))*scale)}\\shad{ass_num(float(cfg.get('shadowDist', shadow))*scale)}"
            family = {400: 'Poppins', 500: 'Poppins Medium', 600: 'Poppins SemiBold', 700: 'Poppins'}[int(cfg.get('weight', weight))]
            tags += '\\fn' + family
            color = cfg.get('color')
            if color: tags += '\\1c&H' + color[5:7] + color[3:5] + color[1:3] + '&'
            # text options (all optional; none set = the tags above, byte for byte): outline colour, shadow colour, opacity.
            # \\alpha would also reset the shadow's own transparency, so the alphas are set one by one: the text and the
            # outline get 1 - opacity, the shadow its own opacity (default the film's) x the text's.
            bgr = lambda c: c[5:7] + c[3:5] + c[1:3]
            if float(cfg.get('strokeW', 0)) > 0 and cfg.get('strokeColor'): tags += '\\3c&H' + bgr(cfg['strokeColor']) + '&'
            if cfg.get('shadowColor'): tags += '\\4c&H' + bgr(cfg['shadowColor']) + '&'
            op = float(cfg['opacity']) if 'opacity' in cfg else None
            if op is not None:
                tags += f"\\1a&H{alpha_hex(op)}&"
                if float(cfg.get('strokeW', 0)) > 0: tags += f"\\3a&H{alpha_hex(op)}&"
            if op is not None or 'shadowOpacity' in cfg:
                base = {'Eyebrow': 1 - 0xB4 / 255, 'Title': 1 - 0xA0 / 255, 'Detail': 1 - 0xA0 / 255}[style]
                tags += f"\\4a&H{alpha_hex(float(cfg.get('shadowOpacity', base)) * (1 if op is None else op))}&"
            return tags
        # Director Mode's per-line offsets (typography.<line>.dx / dy, film px before the title's scale): that line alone moves.
        def offset(style):
            c = typography.get({'Eyebrow': 'eyebrow', 'Title': 'title', 'Detail': 'detail'}[style]) or {}
            return float(c.get('dx', 0)), float(c.get('dy', 0))
        def line(layer, style, y, text, delay, rise=14):
            dx, dy = offset(style)
            y = 912 + (y + dy - 912)*scale; x = X0 + dx*scale if dx else X0
            rise *= scale
            dur = int((b - a) * 1000)
            return (f'Dialogue: {layer},{ts(a + delay / 1000)},{ts(b)},{style},,0,0,0,,'
                    f'{{{type_tags(style)}\\an{AN}\\move({ass_num(x)},{ass_num(y + DY + rise)},{ass_num(x)},{ass_num(y + DY)},0,900)\\fad(650,420)\\blur5\\t(0,700,\\blur0)}}{text}')
        # Director Mode's shadow: blur / opacity restyle the auto boxes; paths replace them (one drawing each, timed like its line).
        sh = t['shadow']; blur = ass_num(float(sh.get('blur', BOX_BLUR))*scale)
        alpha = f"{max(0, min(255, round(255 * (1 - float(sh['opacity']))))):02X}" if 'opacity' in sh else (BOX_PLACE or BOX_A)
        def shadow_dialogue(p, delay, rise):
            if scale != 1:
                p = {**p, 'points': [{**q, 'x': q['x']*scale, 'y': q['y']*scale, **{k: [v*scale for v in q[k]] for k in ('in','out') if k in q}} for q in p['points']]}
            rise *= scale
            return (f'Dialogue: 0,{ts(a + delay / 1000)},{ts(b)},Scrim,,0,0,0,,{{\\an7\\move(0,{rise},0,0,0,900)\\fad(650,420)\\p1\\bord0\\shad0'
                    f'\\1c&H000000&\\1a&H{alpha}&\\blur{blur}}}{ass_drawing(p, (X0, ANCHOR[1] + DY))}{{\\p0}}')
        for p in sh.get('paths') or []:
            delay, rise = LINE_TIMING.get(p.get('line'), (0, 10))
            ass.append(shadow_dialogue(p, delay, rise))
        # Multi-line titles (Enter -> '\n'): match experience/film-titles.mjs LINE_LEAD = 0.74.
        # Single-line titles emit the exact same single Dialogue as before (byte-identical golden ASS).
        LINE_LEAD = 0.74
        BASE_SIZES = {'eyebrow': 28, 'title': 86, 'detail': 40}
        raw_title = (t.get('title') or '').replace('\r\n', '\n').replace('\r', '\n')
        title_parts = raw_title.split('\n') if raw_title else []
        title_size = float((typography.get('title') or {}).get('size', 86))
        def step_of(key):
            c = typography.get(key) or {}; size = float(c.get('size', BASE_SIZES[key]))
            return float(c['lineHeight']) * size / FONT_REAL if c.get('lineHeight') is not None else size * LINE_LEAD
        title_extra = (max(0, len(title_parts) - 1) * step_of('title')) if (typography.get('title') or {}).get('lineHeight') is not None else max(0, len(title_parts) - 1) * title_size * LINE_LEAD
        def cased(key, s):
            caps = (typography.get(key) or {}).get('caps')
            return s.upper() if caps == 'upper' else s.lower() if caps == 'lower' else s
        texts, fits = [], []    # the text dialogues, and every non-empty line for the auto shadow boxes
        for style, y, key, delay, rise in (('Eyebrow', 812, 'eyebrow', 0, 10), ('Title', 912, 'title', 140, 14), ('Detail', 970, 'detail', 380, 10)):
            raw = cased(key, (t.get(key) or '').replace('\r\n', '\n').replace('\r', '\n'))
            if '\n' not in raw and (key != 'eyebrow' or title_extra == 0):
                texts.append(line(1, style, y, raw, delay, rise))
                if raw: fits.append((style, key, y, raw, delay, rise))
                continue
            parts = raw.split('\n') if raw else []
            step = step_of(key)
            base_y = (y - title_extra) if key == 'eyebrow' else y
            direction = 1 if key == 'detail' else -1
            n = len(parts)
            for i, part in enumerate(parts):
                if not part: continue
                sub_y = round(base_y - (n - 1 - i) * step, 2) if direction < 0 else round(base_y + i * step, 2)
                texts.append(line(1, style, sub_y, part, delay, rise))
                fits.append((style, key, sub_y, part, delay, rise))
        if not SCRIM_BLOCK and not sh.get('paths'):
            boxes = []
            for style, key, y, text, delay, rise in fits:
                dx, dy = offset(style)
                cfg = typography.get(key) or {}
                size = float(cfg.get('size', BASE_SIZES[key])); weight = int(cfg.get('weight', {'eyebrow': 600, 'title': 600, 'detail': 400}[key]))
                spacing = float(cfg.get('spacing', max(0, {'eyebrow': 6, 'title': -.6, 'detail': .2}[key])))
                up = size * max(0, FALLBACK_ASC - ASC) if has_fallback(size, weight, text) else 0
                boxes.append(fitted_box(key, size, y + dy, dx, text_width(size, spacing, weight, text), {1: 'left', 2: 'center', 3: 'right'}[AN], up))
            for (style, key, y, text, delay, rise), box in zip(fits, separate_boxes(boxes)):
                ass.append(shadow_dialogue(box_path(box), delay, rise))
        ass += texts
    return ass

def logo_aspect(path, default=304 / 1400):
    """Height / width of the end-card wordmark PNG (its IHDR), or the film's wordmark's when the file cannot be read."""
    try:
        with open(path, 'rb') as f: b = f.read(24)
        if b[:8] == b'\x89PNG\r\n\x1a\n':
            w, h = int.from_bytes(b[16:20], 'big'), int.from_bytes(b[20:24], 'big')
            if w > 0 and h > 0: return h / w
    except OSError: pass
    return default


def logo_start(start, logo):
    """The film second the wordmark (and its shade) starts to come in: its chapter's start + rel_in, + show_delay when set.
    rel_in is also where the score puts its logo hit (build-cine-score.py); show_delay moves the picture only, so the
    hit can sound first (the hero's desk turns white on it, the wordmark follows)."""
    return start[logo['chapter']] + logo['rel_in'] + float(logo.get('show_delay', 0))


def end_logo(logo):
    """The wordmark's centre (1920x1080 px) and scale, defaults filled in, plus whether any was set (Director end card)."""
    return dict(x=float(logo.get('x', 960)), y=float(logo.get('y', 1080 * .73)), scale=max(.1, min(5, float(logo.get('scale', 1)))),
                placed=any(k in logo for k in ('x', 'y')), scaled='scale' in logo)

def logo_w(W, L):
    """The wordmark's width in output pixels: 22 % of the frame (x its scale when set)."""
    return int(W * .22 * L['scale']) if L['scaled'] else int(W * .22)

def logo_xy(L):
    """The wordmark's overlay position: centred at 0.73 H (the film's), or at its own centre when set."""
    if not L['placed']: return 'x=(W-w)/2:y=H*0.73-h/2'
    return f"x=W*{L['x'] / 1920:.6f}-w/2:y=H*{L['y'] / 1080:.6f}-h/2"


def chapter_titles(argv):
    """--chapter-titles <chapter id> <in video> <out video>: burn ONE chapter's titles (titles-src.json, chapter seconds, no film
    offset) onto a chapter file with the film's own ASS look. No dissolves, end card, wordmark or CTA (those belong to the film).
    Video re-encoded like the watcher's PhoneCopy (x264 slow, two-pass, same bitrate rule), audio copied, duration / fps kept."""
    i = argv.index('--chapter-titles'); pos = [a for a in argv[1:i] + argv[i + 1:] if not a.startswith('--')]
    if len(pos) != 4: sys.exit('usage: finish-intro.py <cut dir> --chapter-titles <chapter id> <in video> <out video>')
    d, cid, vin, vout = pos[0], pos[1], os.path.abspath(pos[2]), os.path.abspath(pos[3])
    d = os.path.abspath(d)
    try: src = json.load(open(os.path.join(d, 'titles-src.json'), encoding='utf-8'))
    except (OSError, ValueError) as e: sys.exit(f'chapter-titles: cannot read {os.path.join(d, "titles-src.json")}: {e}')
    known = {t['chapter'] for t in src['titles']} | {src.get('cta', {}).get('chapter'), src.get('logo', {}).get('chapter')}
    if os.path.exists(os.path.join(d, 'edl.json')):
        known |= {c['id'] for c in json.load(open(os.path.join(d, 'edl.json'), encoding='utf-8'))['chapters']}
    known.discard(None)
    if cid not in known: sys.exit(f'chapter-titles: unknown chapter id {cid!r} (known: {", ".join(sorted(known))}); nothing written')
    if not os.path.isfile(vin): sys.exit(f'chapter-titles: input video missing: {vin}; nothing written')
    mine = [t for t in src['titles'] if t['chapter'] == cid]     # hero: its own entries only; the CTA / wordmark stay film-only
    os.makedirs(os.path.dirname(vout) or '.', exist_ok=True)
    part = vout + '.part.mp4'
    if not mine:
        print(f'chapter-titles: {cid} has no titles: plain copy'); shutil.copyfile(vin, part); os.replace(part, vout); return
    titles = [dict(chapter=cid, start=float(t['rel_in']), end=float(t['rel_out']), eyebrow=t['eyebrow'], title=t['title'], detail=t['detail'],
                   scrim=t.get('scrim'), shadow=t.get('shadow') or {}, **({k: t[k] for k in ('position', 'scale', 'typography', 'align') if k in t}), **({'place': t['place']} if t.get('place') in PLACES else {})) for t in mine]
    tmp = tempfile.mkdtemp(prefix='chtitles-')
    try:
        assf = os.path.join(tmp, 'titles.ass'); open(assf, 'w', encoding='utf-8').write('\n'.join(ASS_HEAD + title_dialogues(titles)) + '\n')
        # Windows: no drive colons in a filtergraph, so ffmpeg runs inside tmp with the .ass and the Poppins files beside it.
        for f in glob.glob(os.path.join(FONTS, 'Poppins-*.ttf')): shutil.copy(f, tmp)
        subs = 'subtitles=filename=titles.ass:fontsdir=.'
        pr = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vin], capture_output=True, text=True)
        dur = float(pr.stdout.strip() or 0)
        if dur <= 0: sys.exit(f'chapter-titles: cannot read the duration of {vin}')
        kb = int(min(6000, 27.5 * 8192 / dur - 128)); pl = 'pp'   # the watcher's PhoneCopy bitrate rule
        enc = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', f'{kb}k', '-pix_fmt', 'yuv420p']
        run(['ffmpeg', '-v', 'error', '-y', '-i', vin, '-vf', subs, *enc, '-pass', '1', '-passlogfile', pl, '-an', '-f', 'null', os.devnull], cwd=tmp)
        run(['ffmpeg', '-v', 'error', '-y', '-i', vin, '-vf', subs, *enc, '-pass', '2', '-passlogfile', pl, '-map', '0:v', '-map', '0:a?',
             '-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', part], cwd=tmp)
        os.replace(part, vout)
    except subprocess.CalledProcessError as e:
        if os.path.exists(part): os.remove(part)
        sys.exit(f'chapter-titles: ffmpeg failed ({e.returncode}); nothing written')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f'chapter-titles: {cid}: {len(mine)} title(s) -> {vout}')

def main():
    if '--chapter-titles' in sys.argv: return chapter_titles(sys.argv)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    draft = '--draft' in sys.argv
    wip = '--wip' in sys.argv  # full-res, fast encode, one titled MP4 for review
    hq_only = '--hq-only' in sys.argv  # full master and the HQ deliverables (+ 10-bit HEVC OLED master) + poster; skips textless/720p
    no_hevc = '--no-hevc' in sys.argv
    fmt = sys.argv[sys.argv.index('--format') + 1] if '--format' in sys.argv else ('h264' if no_hevc else 'both')
    if fmt not in ('both', 'hevc', 'h264'): raise SystemExit(f'--format must be both, hevc or h264, not {fmt!r}')
    if no_hevc and fmt == 'both': fmt = 'h264'
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    fps_override = int(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else None
    d = os.path.abspath(args[0]); out = os.path.join(d, 'final'); os.makedirs(out, exist_ok=True)
    edl = json.load(open(os.path.join(d, 'edl.json'), encoding='utf-8'))
    src = json.load(open(os.path.join(d, 'titles-src.json'), encoding='utf-8'))
    grade = json.load(open(os.path.join(d, 'grade.json'), encoding='utf-8')) if os.path.exists(os.path.join(d, 'grade.json')) else {}
    ch = edl['chapters']; X = edl['dissolve']; total = edl['total']; fps = fps_override or edl['fps']
    start = {c['id']: c['start'] for c in ch}

    # ---- titles.json (absolute) + ASS -------------------------------------
    titles = [dict(id=f"{t['chapter']}-{i}", chapter=t['chapter'], start=round(start[t['chapter']] + t['rel_in'], 3),
                   end=round(start[t['chapter']] + t['rel_out'], 3), eyebrow=t['eyebrow'], title=t['title'], detail=t['detail'], scrim=t.get('scrim'),
                   shadow=t.get('shadow') or {}, **({k: t[k] for k in ('position', 'scale', 'typography', 'align') if k in t}), **({'place': t['place']} if t.get('place') in PLACES and t['place'] != 'lower-left' else {}))
              for i, t in enumerate(src['titles'])]
    logo_at = logo_start(start, src['logo'])
    L = end_logo(src['logo'])
    cta_out = src['cta'].get('rel_out')
    cta_end = min(total, start[src['cta']['chapter']] + float(cta_out)) if cta_out is not None else total
    cta = dict(id='cta', chapter=src['cta']['chapter'], start=round(start[src['cta']['chapter']] + src['cta']['rel_in'], 3),
               end=round(cta_end, 3), text=src['cta']['text'])
    # optional (polish1124): the CTA's fade-in (s, default 0.9) and size (px on a 1080 frame, default 46); its fade-out is
    # always the film's last 1.4 s fade
    cta_in = float(src['cta'].get('fade_in', 0.9)); cta_px = int(src['cta'].get('size', 46))
    if cta['start'] >= total - 1.4:
        print(f"WARNING: the CTA starts at {cta['start']} s, inside or after the film's last fade (from {total - 1.4:.3f} s): it will not be seen", file=sys.stderr)
    json.dump(dict(schema='ergoflex.intro-titles', version=1, duration=total, fps=fps,
                   placement=dict(anchor='bottom-left', safeArea=0.9, eyebrowColor='#1388EC',
                                  note='Coordinates for a 1920×1080 frame: text left edge x=128; eyebrow/title/detail bottoms at y=812/912/970. Wordmark centered at y=788 (22% of width); CTA centered at y=904.'),
                   titles=[{k: v for k, v in t.items() if k not in ('scrim', 'shadow')} for t in titles], cta=cta,
                   logo=dict(start=round(logo_at, 3), **{k: src['logo'][k] for k in ('x', 'y', 'scale') if k in src['logo']})),
              open(os.path.join(out, 'titles.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

    size = sys.argv[sys.argv.index('--size') + 1] if '--size' in sys.argv else '1920x1080'
    W, H = (960, 540) if draft else tuple(int(v) for v in size.split('x'))
    px = W * H / (1920 * 1080)
    ass = list(ASS_HEAD)
    CTA_Y = 904
    ass += title_dialogues(titles)
    if 'gap' in src['cta']:
        # polish1124 hero3: the CTA set under the wordmark, in the 1920x1080 ASS frame (libass scales it with the output, so
        # 720p, 1080p and 4K keep the same proportions as the wordmark, which is always 22 % of the width at y = 0.73 H):
        # its line top 'gap' px under the wordmark's box, centred on the wordmark's axis; 'font' (default Poppins Medium)
        # and 'spacing' (letter-spacing, px) optional.
        # Director end card: the wordmark's centre / scale (logo x, y, scale) and the CTA's own centre (cta x) and end (rel_out).
        lb = L['y'] + 1920 * .22 * L['scale'] * logo_aspect(os.path.join(d, 'post', 'logo-color.png')) / 2
        cy = lb + float(src['cta']['gap'])
        cx = ass_num(src['cta'].get('x', L['x']))
        fade_out = 1400 if cta_end >= total - 1e-6 else max(0, min(1400, int((cta_end - cta['start']) * 500)))
        tags = (f'\\an8\\move({cx},{cy + 10:.1f},{cx},{cy:.1f},0,1100)\\fad({int(round(cta_in * 1000))},{fade_out})\\fs{cta_px}'
                f'\\fn{src["cta"].get("font", "Poppins Medium")}\\fsp{float(src["cta"].get("spacing", 1.5)):g}\\blur4\\t(0,800,\\blur0)')
        ass.append(f'Dialogue: 1,{ts(cta["start"])},{ts(cta_end)},CTA,,0,0,0,,{{{tags}}}{cta["text"]}')
        # optional (film audit, 4th cut): a small line under the CTA, e.g. the web address. cta.sub = {text, size (px, default 30), gap (px under
        # the CTA line's box, default 6), delay (s after the CTA, default 0.5), font (default Poppins), spacing (default 2.5)}; absent = nothing added.
        sub = src['cta'].get('sub')
        if isinstance(sub, dict) and sub.get('text'):
            sy = cy + cta_px * 1.762 + float(sub.get('gap', 6))
            s_start = min(cta_end - 0.2, cta['start'] + float(sub.get('delay', 0.5)))
            stags = (f'\\an8\\move({cx},{sy + 10:.1f},{cx},{sy:.1f},0,1100)\\fad({int(round(cta_in * 1000))},{fade_out})\\fs{int(sub.get("size", 30))}'
                     f'\\fn{sub.get("font", "Poppins")}\\fsp{float(sub.get("spacing", 2.5)):g}\\1c&HE6DED6&\\blur4\\t(0,800,\\blur0)')
            ass.append(f'Dialogue: 1,{ts(s_start)},{ts(cta_end)},CTA,,0,0,0,,{{{stags}}}{sub["text"]}')
    else:
        ass.append(f'Dialogue: 1,{ts(cta["start"])},{ts(total)},CTA,,0,0,0,,{{\\an5\\move(960,{CTA_Y + 10},960,{CTA_Y},0,1100)\\fad({int(round(cta_in * 1000))},1400)\\fs{cta_px}\\blur4\\t(0,800,\\blur0)}}{cta["text"]}')
    open(os.path.join(out, 'titles.ass'), 'w', encoding='utf-8').write('\n'.join(ass) + '\n')

    if '--title-still' in sys.argv:
        v = sys.argv[sys.argv.index('--title-still') + 1]
        at = start[v.split(':')[0]] + float(v.split(':')[1]) if ':' in v else float(v)
        bg, png = sys.argv[sys.argv.index('--bg') + 1], sys.argv[sys.argv.index('--out') + 1]
        fp = (lambda p: os.path.relpath(p).replace(os.sep, '/')) if os.name == 'nt' else (lambda p: p)
        subs_f = f"subtitles=filename={fp(os.path.join(out, 'titles.ass'))}:fontsdir={fp(FONTS)}"
        if '--with-logo' in sys.argv:
            # the end card as the master lays it: the shade (fade in from logo_at - 1 over 2.2 s), the wordmark (in over
            # 1.4 s from logo_at, out with the film's last 1.4 s), both at their alpha at that time, the master's expressions
            ramp = lambda t0, dur: max(0.0, min(1.0, (at - t0) / dur))
            sa = ramp(logo_at - 1.0, 2.2); la = ramp(logo_at, 1.4) * (1 - ramp(total - 1.4, 1.4))
            graph = (f'[0:v]scale={W}:{H}:flags=lanczos,format=gbrp[bg];[1:v]scale={W}:{H},format=rgba,colorchannelmixer=aa={sa:.6f}[shade];'
                     f'[bg][shade]overlay[shaded];[2:v]scale={logo_w(W, L)}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa={la:.6f}[logo];'
                     f'[shaded][logo]overlay={logo_xy(L)},format=yuv444p,setpts=PTS+{at:.4f}/TB,{subs_f}[v]')
            run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(fps), '-i', bg, '-i', os.path.join(d, 'post', 'shade.png'),
                 '-i', os.path.join(d, 'post', 'logo-color.png'), '-filter_complex', graph, '-map', '[v]', '-frames:v', '1', png])
            return
        # format=yuv444p: libass burns onto the film's YUV frames; on an RGB frame ffmpeg's blend writes white as 235.
        run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(fps), '-i', bg, '-vf',
             f"scale={W}:{H}:flags=lanczos,format=yuv444p,setpts=PTS+{at:.4f}/TB,{subs_f}",
             '-frames:v', '1', png])
        return
    if '--titles-only' in sys.argv: return
    # ---- master: grade + dissolves + end card -------------------------------
    master = os.path.join(out, 'draft-textless.mkv' if draft else 'wip-textless.mkv' if wip else 'master-textless.mkv')
    if only != 'deliver':
        inputs, filters = [], []
        # Optional per-transition dissolve lengths (edl.transitions, ≤ dissolve).
        # Each stays centred on its EDL dissolve centre, so music sync and total hold.
        # An entry may be [duration, shift]: shift (s) moves the dissolve off its
        # centre, e.g. to finish before an on-screen beat. It must stay within the handles.
        # A third field picks the xfade type (default fade), e.g. [1.5, 0, 'smoothleft'] or
        # [0.8, 0, 'fadeblack'] for seams where a cross-dissolve would show two desks at once.
        tr = [v if isinstance(v, list) else [v, 0] for v in edl.get('transitions', [X] * (len(ch) - 1))]
        xd = [min(X, float(v[0])) for v in tr]; xs = [float(v[1]) for v in tr]; xt = [v[2] if len(v) > 2 else 'fade' for v in tr]
        tail_trim = lambda i: X / 2 - xs[i] - xd[i] / 2      # removed from chapter i's end
        head_trim = lambda i: X / 2 + xs[i - 1] - xd[i - 1] / 2  # removed from chapter i's start
        assert all(tail_trim(i) >= -1e-6 and head_trim(i + 1) >= -1e-6 for i in range(len(ch) - 1)), 'dissolve shift exceeds the handles'
        for i, c in enumerate(ch):
            f = os.path.join(d, 'renders', f'{c["index"]:02d}.mkv')
            if not os.path.exists(f):
                f = (glob.glob(os.path.join(d, 'standin', f'{c["index"]:02d}.*')) or [None])[0]
                if not f: sys.exit(f'Missing render for chapter {c["index"]} ({c["id"]})')
                print(f'  chapter {c["index"]}: using stand-in {os.path.basename(f)}')
            inputs += ['-i', f]
            g = grade.get(c['id'], {})
            # Per-chapter primary trims, then the shared look.
            prim = f"eq=brightness={g.get('brightness', 0)}:contrast={g.get('contrast', 1)}:saturation={g.get('saturation', 1)}:gamma={g.get('gamma', 1)}"
            temp = g.get('temp', 0)  # + warm / − cool
            # Optional highlight roll-off for chapters with clipped whites.
            curve = f",curves=master='{g['curves']}'" if g.get('curves') else ''
            head = head_trim(i) if i else 0; tail = tail_trim(i) if i < len(ch) - 1 else 0
            filters.append(f'[{i}:v]tpad=stop_mode=clone:stop_duration=5,trim={head:.4f}:{c["duration"] - tail:.4f},setpts=PTS-STARTPTS,fps={fps},scale={W}:{H}:flags=lanczos,'
                           f'{prim},format=gbrp{curve},colorbalance=rm={temp * .5}:bm={-temp * .5}:rh={temp * .6}:bh={-temp * .6}'
                           + (f",split[cb{i}][cg{i}];[cg{i}]curves=master='0/0 0.6/0 1/0.9',gblur=sigma={16 if not draft else 8}[cgb{i}];[cb{i}][cgb{i}]blend=all_mode=screen:all_opacity={g['bloom']}" if g.get('bloom') else '')
                           + f',format=yuv444p,setsar=1[c{i}]')
        span = lambda i: ch[i]['duration'] - (head_trim(i) if i else 0) - (tail_trim(i) if i < len(ch) - 1 else 0)
        prev = 'c0'; acc = span(0)
        for i in range(1, len(ch)):
            xdur = xd[i - 1]; off = acc - xdur
            filters.append(f'[{prev}][c{i}]xfade=transition={xt[i - 1]}:duration={xdur}:offset={off:.4f}[x{i}]')
            prev = f'x{i}'; acc = off + span(i)
        li = len(ch)
        inputs += ['-loop', '1', '-framerate', str(fps), '-i', os.path.join(d, 'post', 'logo-color.png'),
                   '-loop', '1', '-framerate', str(fps), '-i', os.path.join(d, 'post', 'shade.png')]
        lw = logo_w(W, L)
        bloom_sigma = 14 if not draft else 7
        look = (
            # Shared look: soft highlight bloom, gentle filmic S-curve with lifted
            # blacks and rolled highlights, cool shadows / warm highlights, vignette.
            f'[{prev}]format=gbrp,split[base][glow];'
            f'[glow]curves=master=\'0/0 0.72/0 1/0.80\',gblur=sigma={bloom_sigma}[g];'
            f'[base][g]blend=all_mode=screen:all_opacity=0.11,'
            f"curves=master='0/0.015 0.15/0.135 0.5/0.5 0.85/0.87 1/0.98',"
            f'colorbalance=rs=-0.008:gs=0:bs=0.008:rh=0.018:gh=0.006:bh=-0.016,eq=saturation=1.06,'
            f'vignette=angle=0.42,'
            f'fade=t=in:st=0:d=1.2,fade=t=out:st={total - 1.4:.3f}:d=1.4[graded];'
            # End card: darken toward the bottom, then the wordmark.
            f'[{li + 1}:v]scale={W}:{H},format=rgba,trim=0:{total},fade=t=in:st={logo_at - 1.0:.3f}:d=2.2:alpha=1[shade];'
            f'[graded][shade]overlay=shortest=1[shaded];'
            f'[{li}:v]scale={lw}:-1:flags=lanczos,format=rgba,trim=0:{total},fade=t=in:st={logo_at:.3f}:d=1.4:alpha=1,fade=t=out:st={total - 1.4:.3f}:d=1.4:alpha=1[logo];'
            # Keep master clean 10-bit (no 8-bit dark-void dithering grain baked in) so the 10-bit HEVC OLED master
            # gets pure banding-free gradients; 8-bit H.264 deliverables add light dithering grain on their own pass.
            f'[shaded][logo]overlay={logo_xy(L)}:shortest=1,'
            f'format={"yuv420p" if (draft or wip) else "yuv420p10le"},trim=0:{total}[v]')
        filters.append(look)
        script = os.path.join(out, 'filter.txt'); open(script, 'w', encoding='utf-8').write(';\n'.join(filters))
        master_pix = 'yuv420p' if (draft or wip) else 'yuv420p10le'
        enc = ['-c:v', 'libx264', '-preset', 'ultrafast' if draft else 'veryfast' if wip else 'slow', '-crf', '23' if draft else '14' if wip else '9', '-pix_fmt', master_pix] + COLOR
        run(['ffmpeg', '-v', 'error', '-stats', '-y', *inputs, *FILTER_SCRIPT(script), '-map', '[v]', '-r', str(fps), *enc, master])

    if only == 'master': return
    # ---- deliverables -------------------------------------------------------
    score = os.path.join(d, 'score', 'score.wav')
    audio_in = ['-i', score] if os.path.exists(score) else ['-f', 'lavfi', '-t', str(total), '-i', 'anullsrc=r=48000:cl=stereo']
    # Filter args can't hold a Windows drive colon: use cwd-relative forward-slash paths there.
    fp = (lambda p: os.path.relpath(p).replace(os.sep, '/')) if os.name == 'nt' else (lambda p: p)
    subs = f"subtitles=filename={fp(os.path.join(out, 'titles.ass'))}:fontsdir={fp(FONTS)}"
    if wip:
        run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, *audio_in, '-vf', subs, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', *COLOR, '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', os.path.join(out, 'ErgoFlex-Intro-WIP.mp4')])
        return
    if draft:
        run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, *audio_in, '-vf', subs, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', os.path.join(out, 'draft.mp4')])
        return
    # Scale H.264 bitrate cap with both pixel count and framerate (4K @ 60 fps -> 75M maxrate / 150M bufsize; 4K @ 30 fps -> 37.5M / 75M)
    fps_scale = max(1.0, fps / 30.0)
    max_k = int(round(9375 * px * fps_scale))
    buf_k = max_k * 2
    if fmt in ('both', 'h264'):
        hq = os.path.join(out, f'ErgoFlex-Intro-{H}p.mp4')
        vf_8bit = f'{subs},noise=c0s=3:c0f=t,format=yuv420p'
        run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, *audio_in, '-map', '0:v', '-map', '1:a', '-vf', vf_8bit, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', '15', '-maxrate', f'{max_k}k', '-bufsize', f'{buf_k}k',
             '-pix_fmt', 'yuv420p', '-g', str(fps * 2), '-x264-params', 'aq-mode=3', *COLOR, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', hq])
    # 10-bit H.265/HEVC OLED showcase master (pure 10-bit gradients, zero 8-bit dithering grain, hvc1 Apple/Windows/Android tag)
    if fmt in ('both', 'hevc'):
        hevc = os.path.join(out, f'ErgoFlex-Intro-{H}p-10bit-hevc.mp4')
        run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, *audio_in, '-map', '0:v', '-map', '1:a', '-vf', f'{subs},format=yuv420p10le', '-c:v', 'libx265', '-preset', 'slow', '-crf', '15', '-tag:v', 'hvc1',
             '-pix_fmt', 'yuv420p10le', '-g', str(fps * 2), '-x265-params', 'aq-mode=3', *COLOR, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', hevc])
    for name, vf, rate, ab in [] if hq_only else [
                               ('ErgoFlex-Intro-1080p-textless.mp4', 'null', '6M', '192k'),
                               ('ErgoFlex-Intro-720p.mp4', subs + ',scale=1280:720:flags=lanczos', '2500k', '128k'),
                               ('ErgoFlex-Intro-720p-textless.mp4', 'scale=1280:720:flags=lanczos', '2500k', '128k')]:
        dst = os.path.join(out, name); log = os.path.join(out, 'x264pass-' + name)
        common = ['-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-b:v', rate, '-maxrate', str(int(float(rate[:-1]) * 1.6)) + rate[-1], '-bufsize', str(int(float(rate[:-1]) * 3)) + rate[-1],
                  '-pix_fmt', 'yuv420p', '-g', str(fps * 2), '-x264-params', 'aq-mode=3', '-passlogfile', log] + COLOR
        run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, '-map', '0:v', *common, '-pass', '1', '-an', '-f', 'null', os.devnull])
        run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, *audio_in, '-map', '0:v', '-map', '1:a', *common, '-pass', '2',
             '-c:a', 'aac', '-b:a', ab, '-ar', '48000', '-shortest', '-movflags', '+faststart', dst])
        for f in glob.glob(log + '*'): os.remove(f)
    # Poster: the clean end-card frame (desk + wordmark), no burned-in text.
    run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-vf', f'select=gte(t\\,{total - 2.6:.2f}),scale={W}:{H}', '-frames:v', '1', '-q:v', '2', os.path.join(out, 'poster.jpg')])

def _ffmpeg_major():
    try: return int(subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.split()[2].split('.')[0].lstrip('n'))
    except Exception: return 6
# -filter_complex_script was replaced by the '-/filter_complex file' form in ffmpeg 7 and later removed (Win box runs 9.x).
FILTER_SCRIPT = (lambda f: ['-/filter_complex', f]) if _ffmpeg_major() >= 7 else (lambda f: ['-filter_complex_script', f])
COLOR = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
if __name__ == '__main__':
    main()
