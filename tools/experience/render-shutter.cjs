// The film's shutter for render-cut.cjs --blur N (S29, 2026-11-15).
//
// N sub-frames per output frame, 180 degrees: an output frame averages the last round(N/2) of its N sub-frames (it is
// at sub-frame k*N and blends k*N-open+1 .. k*N). Until 2026-11-15 every one of the N sub-frames was baked and ffmpeg
// threw the closed half away (tmix=frames=open, then select every N-th); now only the `open` kept sub-frames are baked,
// at exactly the same sub-frame times, so --blur N costs open (not N) bakes a frame: --blur 8 (4 taps over 12.5 ms at
// 30 fps) costs what --blur 4 cost before.
//
// shutterPlan(outFrames, blur) -> { sub, open, order, vf }
//   order: the sub-frame indices to bake, in stream order (relative to the render's first sub-frame; render-cut adds n0
//          and samples chapter seconds (n0+n)/(fps*sub) as before). Output frame k is order[k*open .. k*open+open-1].
//   vf:    the ffmpeg filters that blend each group of `open` into one frame (the stream runs at fps*open).
// The first output frame has no earlier sub-frames: its group repeats sub-frame 0, which is what ffmpeg's tmix did
// before (it fills its window with copies of the first frame), so frame 0 is the bare sub-frame 0 as it was.
function shutterPlan(outFrames, blur) {
  const sub = Math.max(1, Number(blur) | 0), open = Math.max(1, Math.round(sub / 2)), order = [];
  for (let k = 0; k < outFrames; k++) for (let j = open - 1; j >= 0; j--) order.push(Math.max(0, k * sub - j));
  const vf = open > 1 ? [`tmix=frames=${open}:weights=${Array(open).fill(1).join(' ')}`, `select=eq(mod(n\\,${open})\\,${open - 1})`] : [];
  return { sub, open, order, vf };
}

module.exports = { shutterPlan };
