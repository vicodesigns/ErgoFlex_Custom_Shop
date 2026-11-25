// Auto title shadow (2026-11-25): tight per-line boxes that never overlap, the same in the Director preview
// (film-titles.mjs fittedPaths) and the film burn (finish-intro.py title_dialogues). Vico: "their shadows overlap so it's
// twice as dark ... the rectangles around the text need to be tighter so they don't overlay each other".
//   node tests/title-auto-shadow-test.mjs        (python3 on PATH)
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {fittedPaths,expandedLines,placeOf,ANCHOR,cleanTitle} from '../experience/film-titles.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),X=path.join(root,'tools/experience');
const FI=path.join(X,'finish-intro.py');
// The burn's own text measure (fontTools advances), so the preview geometry can be built from the same widths.
const widths=lines=>JSON.parse(execFileSync('python3',['-c',
  `import importlib.util,json,sys
sp=importlib.util.spec_from_file_location('fi',sys.argv[1]);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
print(json.dumps([m.text_width(l['size'],l['spacing'],l['weight'],l['text']) for l in json.load(sys.stdin)]))`,FI],{input:JSON.stringify(lines),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}}));
const CASES=[
  ['one line each',{eyebrow:'ERGOFLEX',title:'Level up your every day.',detail:'Better health. More joy.'}],
  ['two-line headline (ch1)',{eyebrow:'ERGOFLEX',title:'Meet the workstation\nthat moves with you.',detail:'More comfort. Clearer focus. More joy in your work.'}],
  ['three-line headline, two-line support',{eyebrow:'DESIGNED FOR MOTION',title:'Make room for\nwhat comes next,\nevery single day.',detail:'Built to adapt\nto your every move.'}],
  ['moved + resized lines',{eyebrow:'SIT',title:'Head',detail:'Sub',typography:{eyebrow:{dy:40,size:42},detail:{dy:-40,size:44,dx:12}}}],
  ['top-right, scaled',{eyebrow:'E',title:'Right aligned title',detail:'Right aligned support',place:'top-right',scale:1.3}],
  ['fallback glyph',{eyebrow:'E',title:'Rise to 52.5″',detail:'Sit to focus.'}],
];
const asBox=p=>{const xs=p.points.map(q=>q.x),ys=p.points.map(q=>q.y);return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};};
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-auto-shadow-'));
try{
  const titles=CASES.map(([,c],i)=>({chapter:'rise',rel_in:3+i*10,rel_out:9+i*10,...c}));
  fs.writeFileSync(path.join(TMP,'edl.json'),JSON.stringify({fps:30,dissolve:1.5,total:100,chapters:[{index:1,id:'rise',duration:100,start:0,end:100}],transitions:[]}));
  fs.writeFileSync(path.join(TMP,'titles-src.json'),JSON.stringify({titles,cta:{chapter:'rise',rel_in:90,rel_out:null,text:''},logo:{chapter:'rise',rel_in:90}}));
  execFileSync('python3',[FI,TMP,'--titles-only'],{stdio:'ignore',env:{...process.env,PYTHONUTF8:'1'}});
  const ass=fs.readFileSync(path.join(TMP,'final','titles.ass'),'utf8').split(/\r?\n/);
  const shapes=ass.filter(l=>/,Scrim,.*\\p1/.test(l));
  // drawing 'm x y l x y l x y l x y' -> absolute box
  const drawn=l=>{const d=l.slice(l.lastIndexOf('}',l.lastIndexOf('{\\p0}')-1)+1,l.lastIndexOf('{\\p0}')),n=d.match(/-?\d+(\.\d+)?/g).map(Number),xs=n.filter((_,i)=>i%2===0),ys=n.filter((_,i)=>i%2===1);
    return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys),n:n.length/2};};
  let k=0;
  for(const [name,c] of CASES){
    const t=cleanTitle({id:'rise-'+k,rel_in:3+k*10,rel_out:9+k*10,...c},100),lines=expandedLines(t),P=placeOf(t);
    const w=widths(lines.map(L=>({size:L.size,spacing:L.spacing,weight:L.weight,text:L.text})));
    const measure=(L,text)=>w[lines.findIndex(x=>x.text===text&&x.key===L.key)];
    measure.rise=(L,text)=>/[″]/.test(text)?L.size*Math.max(0,1854/2288-1135/1762):0;
    const fit=fittedPaths(t,measure),boxes=fit.map(p=>asBox(p));
    // 1. nothing overlaps: any two boxes that share width are separated vertically (no pixel is covered twice)
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];
      if(a.x0<b.x1&&b.x0<a.x1)assert.ok(a.y1<=b.y0+1e-6||b.y1<=a.y0+1e-6,`${name}: boxes ${i} and ${j} must not overlap (${JSON.stringify(a)} / ${JSON.stringify(b)})`);}
    // 2. tight: no box is taller than the line's own glyph band + padding (the libass line cell + padding was 138 for the headline)
    lines.forEach((L,i)=>assert.ok(boxes[i].y1-boxes[i].y0<L.size*1.25,`${name}: line ${i} box height ${boxes[i].y1-boxes[i].y0} is tight`));
    // 3. the burn draws the same boxes (absolute film px, scaled about the anchor) as the Director preview
    const own=shapes.filter(l=>l.includes(`,0:00:${String(9+k*10).padStart(2,'0')}.00,Scrim`));
    assert.equal(own.length,lines.length,`${name}: one shape per line in the burn`);
    const s=t.scale??1,pos=t.position,[ax,ay]=P.anchor;
    own.forEach((l,i)=>{const d=drawn(l),want=boxes[i];
      const e=(v,ref)=>Math.abs(v-ref)<=.06+.02*s;
      const ox=(pos?pos.x:P.x),oy=912+(P.dy);
      assert.ok(e(d.x0,ox+want.x0*s)&&e(d.x1,ox+want.x1*s)&&e(d.y0,oy+want.y0*s)&&e(d.y1,oy+want.y1*s),`${name}: line ${i} burn ${JSON.stringify(d)} vs preview ${JSON.stringify(want)}`);});
    k++;
  }
  console.log(`Auto title shadow: ${CASES.length} titles (1-3 line headlines, moved / resized lines, placed + scaled, fallback glyph): boxes never overlap, are tight to the glyphs, and the burn's ASS shapes equal the Director's fitted paths.`);
}finally{fs.rmSync(TMP,{recursive:true,force:true});}
