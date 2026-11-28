// node cmp.mjs keys.json|base|none [fps] [t0] [t1] [dump.json]: maya (any shown) hand+finger joint deviation from the key-less motion, plus motion metrics
import fs from 'node:fs';
const W='file:///C:/Users/Vico/polish-wt/wellness-maya-hands/';
const { filmFrames, chapterShot, motionOf, worstOf } = await import(W+'tests/lib/people-film-run.mjs');
const [kf, fpsA='120', t0A='8.8', t1A='10.8', dump] = process.argv.slice(2); const fps=+fpsA;
const shot=chapterShot('wellness'), ID='people-maya-stand-type-41';
const mk = which => f => { const p=f.cast[0].postures[ID]; if(which==='none') delete p.poseKeys; else if(which!=='base') p.poseKeys=JSON.parse(fs.readFileSync(which,'utf8')); return f; };
const times=[]; for(let n=Math.round(+t0A*fps); n<=Math.round(+t1A*fps); n++) times.push(n/fps);
const A=await filmFrames({shot,key:/^maya/,times,edit:mk(kf)}), B=await filmFrames({shot,key:/^maya/,times,edit:mk('none')});
const PTS=n=>/^(hand|lowerarm|upperarm)_[lr]$|^(thumb|index|middle|ring|pinky)_03_[lr]$/.test(n);
let worst={d:0}, worstY={d:0}; const per=[];
for(let i=0;i<A.length;i++){ const a=A[i],b=B[i]; if(!a.room||!b.room) continue; let dm=0,dn='',dy=0;
  for(const n of Object.keys(a.room)) if(PTS(n)){ const p=a.room[n],q=b.room[n]; const d=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]); if(!/upperarm|lowerarm/.test(n)){ if(d>dm){dm=d;dn=n;} dy=Math.min(dy,p[1]-q[1]); } }
  per.push([a.t,dm,dy,a.shown.join('|')]); if(dm>worst.d) worst={d:dm,t:a.t,n:dn}; if(dy<worstY.d) worstY={d:dy,t:a.t}; }
console.log(kf,'hand/finger-tip joints vs key-less motion: max', worst.d.toFixed(2),'mm', worst.n,'at',worst.t?.toFixed(3),' lowest (y below motion)', worstY.d.toFixed(2),'mm at', worstY.t?.toFixed(3));
const m=motionOf(A.filter(r=>r.room)); console.log('motion @'+fps, ['step','dstep','jump','turn'].map(f=>{const w=worstOf(m,f);return f+' '+w.value.toFixed(2)+' ('+w.point+' '+w.at?.toFixed(3)+')';}).join('  '));
for (const [t,d,y,s] of per.filter((_,i)=>i%Math.round(fps/10)===0)) process.stdout.write(t.toFixed(2)+':'+d.toFixed(1)+' ');
console.log(); if(dump) fs.writeFileSync(dump, JSON.stringify(A.map(r=>({t:r.t,shown:r.shown,room:r.room}))));
