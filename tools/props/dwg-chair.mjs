#!/usr/bin/env node
// Local conversion of the supplied Steelcase polyface CAD model. No uploads.
// npm install --prefix /tmp/ef-chair-cad @mlightcad/libredwg-web --ignore-scripts
// node tools/props/dwg-chair.mjs /tmp/ef-chair-cad/node_modules/@mlightcad/libredwg-web
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
const root = path.resolve(import.meta.dirname, '../..');
const readerPath = path.resolve(process.argv[2] || '/tmp/ef-chair-cad/node_modules/@mlightcad/libredwg-web');
const { LibreDwg, Dwg_File_Type } = await import(pathToFileURL(path.join(readerPath, 'dist/libredwg-web.js')));
const lib = await LibreDwg.create(path.join(readerPath, 'wasm/'));
const source = 'models/chairs/SteelCaseLeapv262AUAH.dwg';
const bytes = fs.readFileSync(path.join(root, source));
const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const pointer = lib.dwg_read_data(data, Dwg_File_Type.DWG);
const database = lib.convert(pointer);
if (database.header.INSUNITS !== 1) throw new Error('Expected inch units; do not guess CAD scale.');
const dxf = lib.dwg_write_dxf(data);
if (!dxf) throw new Error('DWG could not be read as DXF.');
const lines = new TextDecoder().decode(dxf).trimEnd().split(/\r?\n/);
const records = [];
for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i]), value = lines[i + 1]?.trim();
    if (code === 0) records.push({ type: value, fields: {} });
    else if (records.length) records.at(-1).fields[code] = value;
}
const parts = []; let current = null, section = '';
for (const record of records) {
    const f = record.fields;
    if (record.type === 'SECTION') section = f[2];
    if (record.type === 'ENDSEC') section = '';
    if (section !== 'ENTITIES') continue;
    if (record.type === 'POLYLINE') {
        if ((Number(f[70]) & 64) === 0) throw new Error('Unsupported non-polyface chair geometry.');
        current = { layer: f[8], vertices: [], faces: [] }; parts.push(current);
    } else if (record.type === 'SEQEND') current = null;
    else if (record.type === 'VERTEX' && current) {
        if (f[71] !== undefined) current.faces.push([71, 72, 73, 74].filter(k => Number(f[k])).map(k => Math.abs(Number(f[k])) - 1));
        else current.vertices.push([10, 20, 30].map(k => Number(f[k] || 0)));
    }
}
if (parts.length !== 23) throw new Error(`Expected 23 chair parts; found ${parts.length}.`);
const sourcePoints = parts.flatMap(p => p.vertices);
const min = [0,1,2].map(a => Math.min(...sourcePoints.map(p => p[a])));
const max = [0,1,2].map(a => Math.max(...sourcePoints.map(p => p[a])));
const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
const document = new Document(), buffer = document.createBuffer(), scene = document.createScene('Steelcase Leap V2');
const materials = {
    'AFUSE-3D-003': document.createMaterial('Charcoal upholstery').setBaseColorFactor([.085,.1,.115,1]).setRoughnessFactor(.95),
    'AFUSE-3D-014': document.createMaterial('Satin metal').setBaseColorFactor([.32,.34,.36,1]).setMetallicFactor(.65).setRoughnessFactor(.4),
    'AFUSE-3D-022': document.createMaterial('Black polymer').setBaseColorFactor([.035,.04,.045,1]).setRoughnessFactor(.7)
};
let tris = 0;
for (const [n, part] of parts.entries()) {
    const points = part.vertices.map(p => [(p[0]-cx)*.0254, (p[2]-min[2])*.0254, -(p[1]-cy)*.0254]);
    const indices = [];
    for (const face of part.faces) {
        if (face.length < 3 || face.some(i => i < 0 || i >= points.length)) throw new Error('Invalid polyface vertex index.');
        for (let i = 1; i < face.length - 1; i++) indices.push(face[0],face[i],face[i+1]);
    }
    const normals = points.map(() => [0,0,0]);
    for (let i = 0; i < indices.length; i += 3) {
        const [a,b,c] = indices.slice(i,i+3).map(j => points[j]);
        const u = b.map((v,k)=>v-a[k]), v = c.map((v,k)=>v-a[k]);
        const normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
        for (const j of indices.slice(i,i+3)) normal.forEach((v,k)=>normals[j][k]+=v);
    }
    const normalArray = normals.flatMap(v => { const length = Math.hypot(...v)||1; return v.map(n=>n/length); });
    const position = document.createAccessor().setType('VEC3').setArray(new Float32Array(points.flat())).setBuffer(buffer);
    const normal = document.createAccessor().setType('VEC3').setArray(new Float32Array(normalArray)).setBuffer(buffer);
    const index = document.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer);
    const primitive = document.createPrimitive().setAttribute('POSITION',position).setAttribute('NORMAL',normal).setIndices(index).setMaterial(materials[part.layer]);
    if (!materials[part.layer]) throw new Error(`Unknown chair material layer ${part.layer}`);
    scene.addChild(document.createNode(`Leap part ${n+1}`).setMesh(document.createMesh().addPrimitive(primitive))); tris += indices.length/3;
}
const id = 'steelcase-leap-v2', file = `assets/props/${id}.glb`;
await new NodeIO().write(path.join(root,file),document);
const size = [(max[0]-min[0])*25.4,(max[2]-min[2])*25.4,(max[1]-min[1])*25.4];
const indexFile = path.join(root,'assets/props/index.json'), index = JSON.parse(fs.readFileSync(indexFile));
const entry = {id,name:'Steelcase Leap V2 with headrest',category:'furniture',scenes:['home','office','creative'],file,anchor:'floor',size,min:[-size[0]/2,0,-size[2]/2],max:[size[0]/2,size[1],size[2]/2],tris,bytes:fs.statSync(path.join(root,file)).size,source,license:'unconfirmed',attribution:'Steelcase; CAD supplied by user',sizeNote:'Authored inch units preserved. CAD layers assigned charcoal upholstery, black polymer and satin metal.'};
index.props = index.props.filter(p=>p.id!==id); index.props.push(entry); index.generated=new Date().toISOString();
fs.writeFileSync(indexFile,JSON.stringify(index,null,1)+'\n');
console.log(JSON.stringify(entry,null,2));
lib.dwg_free(pointer);
