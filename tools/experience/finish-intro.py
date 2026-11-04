#!/usr/bin/env python3
"""Finish the ErgoFlex intro: grade, dissolves, end card, titles, score, masters.

    python3 tools/experience/finish-intro.py exports/cinematic-intro-20261030 [--draft] [--only master|deliver]

Reads <dir>/edl.json, <dir>/titles-src.json, <dir>/renders/NN.mkv (falls back
to <dir>/standin/NN.* for pipeline tests), <dir>/score/score.wav (optional),
<dir>/grade.json (optional per-chapter trims). Writes <dir>/final/:
  master-textless.mkv     graded, dissolved, end-card logo, near-lossless
  ErgoFlex-Intro-1080p.mp4 / -textless.mp4, ErgoFlex-Intro-720p.mp4 / -textless.mp4
  titles.json (absolute in/out for app overlays), titles.ass, poster.jpg
--draft renders a fast 960×540 preview (final/draft.mp4) instead.
--size 2560x1440 masters at that size (chapter renders must match); the HQ file is ErgoFlex-Intro-<H>p.mp4 with the
  bitrate cap scaled by pixel count. Titles stay authored on the 1920×1080 grid (libass scales PlayRes to the frame).
"""
import json, os, subprocess, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONTS = os.path.join(ROOT, 'app-reference/assets/google_fonts')
BLUE = '&H00EC8813&'  # #1388ec as ASS BGR

def run(cmd):
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
    subprocess.run(cmd, check=True)

def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    draft = '--draft' in sys.argv
    wip = '--wip' in sys.argv  # full-res, fast encode, one titled MP4 for review
    hq_only = '--hq-only' in sys.argv  # full master and the 1080p (CRF 18, 9.5 Mbps cap) + poster; skips textless/720p
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    d = os.path.abspath(args[0]); out = os.path.join(d, 'final'); os.makedirs(out, exist_ok=True)
    edl = json.load(open(os.path.join(d, 'edl.json'), encoding='utf-8'))
    src = json.load(open(os.path.join(d, 'titles-src.json'), encoding='utf-8'))
    grade = json.load(open(os.path.join(d, 'grade.json'), encoding='utf-8')) if os.path.exists(os.path.join(d, 'grade.json')) else {}
    ch = edl['chapters']; X = edl['dissolve']; total = edl['total']; fps = edl['fps']
    start = {c['id']: c['start'] for c in ch}

    # ---- titles.json (absolute) + ASS -------------------------------------
    titles = [dict(id=f"{t['chapter']}-{i}", chapter=t['chapter'], start=round(start[t['chapter']] + t['rel_in'], 3),
                   end=round(start[t['chapter']] + t['rel_out'], 3), eyebrow=t['eyebrow'], title=t['title'], detail=t['detail'], scrim=t.get('scrim'))
              for i, t in enumerate(src['titles'])]
    logo_at = start[src['logo']['chapter']] + src['logo']['rel_in']
    cta = dict(id='cta', chapter=src['cta']['chapter'], start=round(start[src['cta']['chapter']] + src['cta']['rel_in'], 3),
               end=round(total, 3), text=src['cta']['text'])
    json.dump(dict(schema='ergoflex.intro-titles', version=1, duration=total, fps=fps,
                   placement=dict(anchor='bottom-left', safeArea=0.9, eyebrowColor='#1388EC',
                                  note='Coordinates for a 1920×1080 frame: text left edge x=128; eyebrow/title/detail bottoms at y=812/912/970. Wordmark centered at y=788 (22% of width); CTA centered at y=904.'),
                   titles=[{k: v for k, v in t.items() if k != 'scrim'} for t in titles], cta=cta, logo=dict(start=round(logo_at, 3))),
              open(os.path.join(out, 'titles.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

    size = sys.argv[sys.argv.index('--size') + 1] if '--size' in sys.argv else '1920x1080'
    W, H = (960, 540) if draft else tuple(int(v) for v in size.split('x'))
    px = W * H / (1920 * 1080)
    ass = [
        '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Eyebrow,Poppins SemiBold,28,' + BLUE + ',&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,6,0,1,0,1.2,1,0,0,0,1',
        'Style: Title,Poppins SemiBold,86,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,-0.6,0,1,0,2,1,0,0,0,1',
        'Style: Detail,Poppins,40,&H00E6DED6,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,0.2,0,1,0,1.5,1,0,0,0,1',
        'Style: Scrim,Poppins,20,&HFF000000,&HFF000000,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1',
        'Style: CTA,Poppins Medium,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,1.5,0,1,0,1.5,5,0,0,0,1', '',
        '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    X0 = 128
    CTA_Y = 904
    for t in titles:
        a, b = t['start'], t['end']
        # Soft, blurred scrim behind the text block; fades with it.
        ass.append(f'Dialogue: 0,{ts(a - .2)},{ts(b + .2)},Scrim,,0,0,0,,{{\\an7\\pos(0,0)\\p1\\1c&H000000&\\1a&HFF&\\blur90\\t(0,900,\\1a&H{t.get('scrim') or '90'}&)\\t({int((b - a) * 1000 - 300)},{int((b - a) * 1000 + 400)},\\1a&HFF&)}}m 0 730 l 1300 730 1300 1080 0 1080{{\\p0}}')
        def line(layer, style, y, text, delay, rise=14):
            dur = int((b - a) * 1000)
            return (f'Dialogue: {layer},{ts(a + delay / 1000)},{ts(b)},{style},,0,0,0,,'
                    f'{{\\an1\\move({X0},{y + rise},{X0},{y},0,900)\\fad(650,420)\\blur5\\t(0,700,\\blur0)}}{text}')
        ass.append(line(1, 'Eyebrow', 812, t['eyebrow'], 0, 10))
        ass.append(line(1, 'Title', 912, t['title'], 140))
        ass.append(line(1, 'Detail', 970, t['detail'], 380, 10))
    ass.append(f'Dialogue: 1,{ts(cta["start"])},{ts(total)},CTA,,0,0,0,,{{\\an5\\move(960,{CTA_Y + 10},960,{CTA_Y},0,1100)\\fad(900,1400)\\blur4\\t(0,800,\\blur0)}}{cta["text"]}')
    open(os.path.join(out, 'titles.ass'), 'w', encoding='utf-8').write('\n'.join(ass) + '\n')

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
        lw = int(W * .22)
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
            f'[shaded][logo]overlay=x=(W-w)/2:y=H*0.73-h/2:shortest=1,'
            # Light luma grain dithers gradients in the dark voids.
            f'noise=c0s={3 if not draft else 0}:c0f=t,format=yuv420p,trim=0:{total}[v]')
        filters.append(look)
        script = os.path.join(out, 'filter.txt'); open(script, 'w', encoding='utf-8').write(';\n'.join(filters))
        enc = ['-c:v', 'libx264', '-preset', 'ultrafast' if draft else 'veryfast' if wip else 'slow', '-crf', '23' if draft else '14' if wip else '9', '-pix_fmt', 'yuv420p'] + COLOR
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
    hq = os.path.join(out, f'ErgoFlex-Intro-{H}p.mp4')
    run(['ffmpeg', '-v', 'error', '-stats', '-y', '-i', master, *audio_in, '-map', '0:v', '-map', '1:a', '-vf', subs, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', '18', '-maxrate', f'{int(9500 * px)}k', '-bufsize', f'{int(19000 * px)}k',
         '-pix_fmt', 'yuv420p', '-g', str(fps * 2), '-x264-params', 'aq-mode=3', *COLOR, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', hq])
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
