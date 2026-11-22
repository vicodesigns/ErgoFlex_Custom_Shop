// Writes tools/experience/_gym-still.cjs: render-still.cjs plus --probe <file.js>: after each still's bake, the probe
// (a function source, run in the stage iframe) is evaluated and its result written next to the still as probe-t<t>.json.
// Untracked helper (it must sit in tools/experience: render-still resolves the repo from __dirname).
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const src = fs.readFileSync(path.join(root, 'tools/experience/render-still.cjs'), 'utf8');
const anchor = 'fs.writeFileSync(raw,png);';
if (!src.includes(anchor)) throw Error('anchor not found');
const hook = anchor + "if(opts.probe){const r=await frame.evaluate('('+fs.readFileSync(opts.probe,'utf8')+')()');fs.writeFileSync(path.join(opts.out,tag+'-probe-t'+t+'.json'),JSON.stringify(r,null,1));console.log('probe written t='+t);}";
fs.writeFileSync(path.join(root, 'tools/experience/_gym-still.cjs'), src.replace(anchor, hook));
console.log('ok');
