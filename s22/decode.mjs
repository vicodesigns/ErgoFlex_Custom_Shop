// Read-only: decode an EXT_meshopt_compression GLB into a plain GLB (scratch output).
import { MeshoptDecoder } from 'file:///C:/work/ergoflex-cine/node_modules/meshoptimizer/meshopt_decoder.mjs';
import fs from 'fs';
const [src, dst] = process.argv.slice(2);
const b = fs.readFileSync(src); let off = 12, js, bin;
while (off < b.length) { const len = b.readUInt32LE(off), ty = b.readUInt32LE(off + 4); const c = b.subarray(off + 8, off + 8 + len); off += 8 + len; if (ty === 0x4E4F534A) js = JSON.parse(c.toString()); else bin = c; }
await MeshoptDecoder.ready;
const parts = []; let total = 0;
for (const bv of js.bufferViews) {
  const ext = bv.extensions?.EXT_meshopt_compression; let data;
  if (ext) { const out = new Uint8Array(ext.count * ext.byteStride); const s = bin.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength);
    MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, s, ext.mode, ext.filter || 'NONE'); data = out; if (ext.byteStride) bv.byteStride = bv.target === 34963 ? undefined : (ext.mode === 'ATTRIBUTES' ? ext.byteStride : undefined); delete bv.extensions; }
  else if (bv.buffer === 0) data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); else { data = new Uint8Array(bv.byteLength); }
  const pad = (4 - (total % 4)) % 4; if (pad) { parts.push(new Uint8Array(pad)); total += pad; }
  bv.buffer = 0; bv.byteOffset = total; bv.byteLength = data.length; parts.push(data); total += data.length;
}
js.buffers = [{ byteLength: total }];
const body = Buffer.concat(parts.map(p => Buffer.from(p))); let j = Buffer.from(JSON.stringify(js)); while (j.length % 4) j = Buffer.concat([j, Buffer.from(' ')]);
let bb = body; while (bb.length % 4) bb = Buffer.concat([bb, Buffer.alloc(1)]);
const h = Buffer.alloc(12); h.write('glTF', 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + bb.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(dst, Buffer.concat([h, jh, j, bh, bb]));
