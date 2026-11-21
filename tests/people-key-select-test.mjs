// People keys select like the camera's diamonds (21 Nov 2026, Vico: "when I'm editing the poses I want to be able to
// click on the diamonds and have them be selectable, with the highlighted options shown in the inspector. Just like I can
// click the camera diamonds"). A person's row is collapsed by default and its diamonds there were drawn with
// pointer-events: none, so a click on one fell through to the lane (a marquee that cleared the selection). Now:
//   - a collapsed row's diamond is a key button: it stands for the row's keys at that second (people-track.mjs keysAt),
//     click selects them (a pose key first: pose mode and the Inspector take it), Shift adds / takes out (clickPick),
//     a drag moves them, a marquee takes them, it is drawn selected when they all are;
//   - the pose panel's diamonds and ◀ Key ▶ select the same key on the sheet (keyPicked), a sheet key that is not a pose
//     key leaves the pose tool with none (setKey), moves carry it along;
//   - Delete / the header's 🗑 take the sheet's picked keys first (a joint key: only that joint);
//   - the selection header reads "◆ Pose key · Omar  3.20 s · 2 joints", as a camera view's does.
//   node tests/people-key-select-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sheet,sheetKeys,keysAt,clickPick,pick,poseKeyId,shiftKeys,deleteKeys} from '../experience/people-track.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json'),'utf8'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r/g,'');
const Q=[0,0,0,1],turn=[.1,0,0,.995];

// ---- 1 keysAt: on every chapter's people, every collapsed diamond stands for at least one key, all of them real keys
// of its row at that second, no joint key (part of its pose key) and no linked set-off (its edge already is one)
let dots=0;
for(const s of cut.shots){
  if(!s.people?.cast?.length)continue;
  const rows=sheet(s.people,s.seconds),keys=sheetKeys(rows);
  for(const r of rows)for(const t of r.summary){
    const ids=keysAt(r,t);dots++;
    assert.ok(ids.length>0,`${s.id} ${r.row} at ${t}: a diamond with no key`);
    for(const id of ids){const k=keys.get(id);assert.ok(k,`${id} is a key`);assert.equal(k.row,r.row);assert.ok(Math.abs(k.t-t)<1e-6);assert.notEqual(k.kind,'joint');assert.ok(!k.linked);}
    assert.equal(new Set(ids).size,ids.length,'each key once');
  }
}
assert.ok(dots>20,`the cut has collapsed diamonds (${dots})`);
assert.deepEqual(keysAt(null,1),[]);

// ---- 2 pose keys (none in the cut yet: Omar's are written in pose mode): the collapsed diamond at a pose key's second
// takes that pose key, first (before an edge at the same second), and not its joints
const oil=structuredClone(cut.shots.find(s=>s.id==='oilers')),T=oil.seconds,P=oil.people;
const kai=P.cast.find(e=>e.key==='kai'),edge=P.when.kai[0][0];         // Kai's change to typing (12.75 s)
kai.poseKeys=[{t:2,pose:{upperarm_l:turn,lowerarm_l:turn}},{t:edge,pose:{head:turn},ease:'hold'}];
{
  const rows=sheet(P,T),row=rows.find(r=>r.row==='kai'),keys=sheetKeys(rows);
  assert.deepEqual(keysAt(row,2),[poseKeyId('kai',2)],'2 s: the pose key alone');
  const at=keysAt(row,edge);
  assert.equal(at[0],poseKeyId('kai',edge),'the pose key first (pose mode and the Inspector take it)');
  assert.ok(at.some(id=>keys.get(id).kind==='change'),'and the change at that second');
  assert.ok(!at.some(id=>keys.get(id).kind==='joint'),'joints are part of their key');
  // what the diamond's click does with them (the Director's pointerup): select, Shift adds, Shift again takes them out
  let sel=clickPick(new Set(['x']),at);assert.deepEqual([...sel].sort(),[...at].sort(),'a click replaces the selection');
  sel=clickPick(new Set(['x']),at,true);assert.deepEqual([...sel].sort(),['x',...at].sort(),'Shift adds');
  sel=clickPick(sel,at,true);assert.deepEqual([...sel],['x'],'Shift on a selected diamond takes its keys out');
  sel=clickPick(new Set(['x',at[0]]),at,true);assert.equal(sel.size,1+at.length,'Shift on a half-selected diamond completes it');
  assert.deepEqual([...clickPick(new Set(['a']),['b'],true)],[...pick(new Set(['a']),['b'],{toggle:true})],'one key: as before');
  // moved and deleted as the expanded rows' keys are (one edit): the pose key and the edge together
  const ks=at.map(id=>keys.get(id)),m=shiftKeys(P,ks,.5,T);assert.ok(!m.error,m.error);
  assert.equal(m.people.when.kai[0][0],edge+.5,'the change moved');assert.ok(m.people.cast.find(e=>e.key==='kai').poseKeys.some(k=>Math.abs(k.t-edge-.5)<1e-6),'the pose key moved');
  const d=deleteKeys(P,ks);assert.equal(d.removed,1,'Delete takes the pose key');assert.equal(d.skipped.length,1,'the change is timing: kept');
}
// a placement with postures (one model's keys): the diamond takes that model's key id, as the pose tool asks for it
{
  const p=structuredClone(cut.shots.find(s=>s.id==='oilers').people),e=p.cast.find(x=>x.key==='kai');
  e.postures={[e.id]:{poseKeys:[{t:3,pose:{head:Q}}]}};
  const row=sheet(p,T).find(r=>r.row==='kai');assert.deepEqual(keysAt(row,3),[poseKeyId('kai',3,null,e.id)]);
}

// ---- 3 the Director's wiring (the browser e2e, tests/director-people-sheet-e2e.mjs, clicks it on Windows)
const ed=read('experience/scene-people-editor.mjs'),pe=read('experience/scene-pose-editor.mjs'),dm=read('experience/director.mjs'),css=read('experience/director.css');
assert.match(ed,/\$\{r\.summary\.map\(t=>dotBtn\(r,t\)\)\.join\(''\)\}/,'the collapsed row draws its diamonds as keys');
assert.match(ed,/<button type="button" class="ps-dot \$\{on\?'selected':''\}" data-sk-at="\$\{t\}" data-sk-row=/,'a button, selected when its keys are');
assert.match(ed,/const keyEl=ev\.target\.closest\?\.\('\.ps-row \[data-sk\],\.ps-row \[data-sk-at\]'\)/,'pointerdown takes a diamond as a key, not the lane');
assert.match(ed,/const ids=keyEl\.dataset\.sk\?\[keyEl\.dataset\.sk\]:dotIds\(keyEl\)/,'its keys');
assert.match(ed,/setPicked\(clickPick\(picked,p\.ids,p\.shift\),\{focus:out\?null:p\.id\}\)/,'click / Shift+click');
assert.match(ed,/flatMap\(e=>e\.dataset\.sk\?\[e\.dataset\.sk\]:dotIds\(e\)\)/,'a marquee takes them');
assert.match(ed,/p\.dots=\[\.\.\.document\.querySelectorAll\('\.ps-row \[data-sk-at\]'\)\]/,'a drag moves them');
assert.match(ed,/\[data-sk\],\[data-sk-at\],\.ps-row \.ps-lane/,'their click goes nowhere else');
assert.doesNotMatch(css,/\.ps-dot\{[^}]*pointer-events:none/,'no longer click-through');
assert.match(css,/#director-timeline \.ps-dot\.selected\{background:#fff;border-color:#ffcf4a;box-shadow:0 0 0 2px #ffcf4a\}/,'selected: the keys\' gold');
// the pose panel <-> the sheet
assert.match(pe,/cameraHeld=\(\)=>false,keyPicked=\(\)=>\{\}\}\)\{/,'the pose editor tells');
assert.equal((pe.match(/keyPicked\((k|d\.t|t)\);/g)||[]).length,3,'its diamonds\' click, tap and ◀ Key ▶');
assert.match(pe,/setKey:t=>\{if\(key\)selT=t;\}/);
assert.match(ed,/keyPicked:t=>poseKeyPicked\(t\)/);
assert.match(ed,/function poseKeyPicked\(t\)\{[^}]*poseKeyId\(key,t,null,model\)/);
assert.match(ed,/if\(!k\|\|k\.kind!=='pose'&&k\.kind!=='joint'\)pose\.setKey\(null\);/,'a sheet key that is not a pose key: none in the pose tool');
assert.match(ed,/picked=new Set\(\);pose\.setKey\(null\);rerender\(\);status\('No key selected\.'\)/,'Esc clears both');
assert.match(ed,/pose\.setKey\(Math\.round\(\(st\+dt\)\*1000\)\/1000\)/,'a move carries it');
// Delete and the header
assert.match(ed,/remove:k=>\{if\(k===undefined&&picked\.size\)\{deletePicked\(\);return;\}/,'🗑: the picked keys first');
assert.match(ed,/poseKeySelected:\(\)=>pose\.selectedKey\(\)!==null&&!picked\.size,/,'Delete routes to the sheet keys while they are picked');
assert.match(dm,/person\.key\?row\('◆',person\.name,person\.detail,\['delete'\]\)/,'the header reads as the key');
// people modules are versioned (a stale module would keep the old click-through rows)
assert.match(dm,/scene-people-editor\.mjs\?v=pose-key-select-20261121/);
assert.match(ed,/scene-pose-editor\.mjs\?v=pose-key-select-20261121/);assert.match(ed,/people-track\.mjs\?v=pose-key-select-20261121/);
console.log(`people-key-select-test: ok (${dots} collapsed diamonds across the cut stand for real keys; click, Shift, drag, marquee, pose panel and Delete share one selection)`);
