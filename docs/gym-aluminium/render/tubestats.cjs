// node tubestats.cjs  : luma / chroma / spread of the tilt-actuator tube pixels (bright, low-chroma pixels in a box) in the stills
const sharp = require('F:/eng-gym/node_modules/sharp');
const jobs = [
  ['wellness t0.4 (before)', 'F:/eng-gym-scratch/before/wellness/07-still-1920x1080-t0.4.png', [884, 530, 82, 41]],
  ['rise t0.5 (before)', 'F:/eng-gym-scratch/before/rise/02-still-1920x1080-t0.5.png', [900, 770, 130, 100]],
  ['wellness t0.4 (rough 0.14 try)', 'F:/eng-gym-scratch/after/wellness/07-still-1920x1080-t0.4.png', [884, 530, 82, 41]],
];
(async () => {
  for (const [name, f, [l, t, w, h]] of jobs) {
    const { data, info } = await sharp(f).extract({ left: l, top: t, width: w, height: h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const L = [], C = [];
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2], y = .2126 * r + .7152 * g + .0722 * b, ch = Math.max(r, g, b) - Math.min(r, g, b);
      if (y > 110 && ch < 40) { L.push(y); C.push(ch); }
    }
    const m = a => a.reduce((x, y) => x + y, 0) / a.length, sd = a => Math.sqrt(m(a.map(x => (x - m(a)) ** 2)));
    console.log(name, 'n=' + L.length, 'luma mean', m(L).toFixed(1), 'sd', sd(L).toFixed(1), 'chroma mean', m(C).toFixed(1));
  }
})();
