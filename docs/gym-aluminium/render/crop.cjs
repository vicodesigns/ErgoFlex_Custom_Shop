// node crop.cjs in.png out.png left top width height scale   (zoomed crop)
const sharp = require('F:/eng-gym/node_modules/sharp');
const [, , i, o, l, t, w, h, s] = process.argv;
sharp(i).extract({ left: +l, top: +t, width: +w, height: +h }).resize(Math.round(w * (s || 4)), Math.round(h * (s || 4)), { kernel: 'lanczos3' }).toFile(o).then(() => console.log('ok'));
