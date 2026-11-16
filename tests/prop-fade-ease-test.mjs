// Prop fades (S33 B1): show.ease 'smooth' (the Director and the film draw with the same curve; absent = the straight
// line every earlier entry has, unchanged), and the film's own keyed-opacity fades (a hand-made film edit) as the Props
// lane's window, kept when the window is retimed.
//   node tests/prop-fade-ease-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {cleanShow,cleanPropEdit,showFactor,showEase,keyedFadeWindow,filmFadeKeys,combineFilmFade,showOverFilm} from '../experience/prop-edits.mjs';
globalThis.window??={ErgoFlex:{}};const {showFactor:filmShowFactor}=await import('../tools/experience/film-edits.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;

// ---- the format: ease only 'smooth', only with a fade; everything else as before
assert.deepEqual(cleanShow({from:1,to:5,fadeOut:1,ease:'smooth'}),{from:1,to:5,fadeOut:1,ease:'smooth'});
assert.deepEqual(cleanShow({from:1,to:5,fadeOut:1,ease:'bouncy'}),{from:1,to:5,fadeOut:1},'an unknown ease is dropped (linear)');
assert.deepEqual(cleanShow({from:1,to:5,ease:'smooth'}),{from:1,to:5},'no fade: nothing to ease');
assert.deepEqual(cleanShow({from:1.004,to:5.256,fadeIn:.4,fadeOut:0}),{from:1,to:5.26,fadeIn:.4},'an entry written before is cleaned exactly as before');
assert.deepEqual(cleanPropEdit({match:'^a$',show:{from:0,to:3,fadeIn:1,ease:'smooth'}}).show,{from:0,to:3,fadeIn:1,ease:'smooth'});

// ---- the curve: linear is the old formula exactly; smooth = smoothstep, half way at the midpoint; Director = film
const old=(w,t)=>{if(t<w.from-1e-6||t>w.to+1e-6)return 0;let f=1;if(w.fadeIn>0)f=Math.min(f,(t-w.from)/w.fadeIn);if(w.fadeOut>0)f=Math.min(f,(w.to-t)/w.fadeOut);return Math.max(0,Math.min(1,f));};
const lin={from:2,to:8,fadeIn:1,fadeOut:1},smooth={...lin,ease:'smooth'};
for(let t=0;t<=10;t+=.05){
  assert.equal(showFactor(lin,t),old(lin,t),'linear: unchanged at '+t);
  assert.ok(near(showFactor(lin,t),filmShowFactor({show:lin},{},t)),'film = Director (linear) at '+t);
  assert.ok(near(showFactor(smooth,t),filmShowFactor({show:smooth},{},t)),'film = Director (smooth) at '+t);
}
assert.ok(near(showFactor(smooth,7.5),.5)&&near(showFactor(lin,7.5),.5),'a 1 s fade out is half way at its midpoint either way');
assert.ok(near(showFactor(smooth,7.25),.84375)&&near(showFactor(lin,7.25),.75),'a quarter in: smooth 0.84, linear 0.75 (eased: slow to start)');
assert.ok(near(showFactor(smooth,7.95),.00725)&&showFactor(smooth,7.95)<showFactor(lin,7.95),'and it lands softly');
assert.ok(near(showFactor(smooth,2.5),.5)&&near(showFactor(smooth,2.1),.028),'fade in the same way');
assert.equal(showEase(null,.3),.3);
// a desk's edit counts from its sub-shot start in the film, as before
assert.ok(near(filmShowFactor({desk:'office',show:smooth},{renderRange:[10,30]},17.5),.5));

// ---- the film's own fades (the real cut: create's drafting kit, easel rail, easel, pen display; commons' backpack)
const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json'),'utf8')),shot=id=>cut.shots.find(s=>s.id===id);
const create=shot('create'),T=create.seconds||40;
const kit=keyedFadeWindow(filmFadeKeys(create,'^Accessory:drafting-kit$'),0,T);
assert.deepEqual(kit,{from:7,to:18.7,fadeIn:.4,fadeOut:1.8},'drafting kit: on 7.0–18.7 s, in 0.4 s, out 1.8 s');
assert.deepEqual(keyedFadeWindow(filmFadeKeys(create,'^Accessory:artist-easel$'),0,T),{from:17.5,to:Math.round(T*100)/100,fadeIn:1.8,fadeOut:0});
assert.deepEqual(keyedFadeWindow(filmFadeKeys(create,'^Prop:atelier-artist-pen-display-oak$'),0,T),{from:0,to:7.4,fadeIn:0,fadeOut:.4});
assert.deepEqual(keyedFadeWindow(filmFadeKeys(shot('commons'),'^Prop:backpack-daypack$'),0,30),{from:0,to:5.4,fadeIn:0,fadeOut:.3});
assert.equal(filmFadeKeys(create,'^Prop:ergoflex-artist-stool$'),null,'a show window is not a keyed fade');
assert.equal(keyedFadeWindow([[0,1],[7.85,1],[9.85,.4],[43.4,.4],[44.8,1]],0,50),null,'a dip is not an on-screen window');
assert.equal(keyedFadeWindow([[0,.5],[3,.5]]),null,'constant: no window');
assert.equal(filmFadeKeys({sceneEdits:[{match:'^x$',opacity:[[0,0],[1,1]],director:true}]},'^x$'),null,'only the film\'s hand-made edits');

// THE BUG (Vico, S33): the Props lane drew the drafting kit's bar over the whole chapter with no fade, and dragging its
// end wrote show:{from:0,to:<end>} with no fadeOut: the kit was cut off at the new end. Now the bar is the film's
// window, and a retime of its end to 15 s keeps the 1.8 s fade (and leaves the fade in to the film's own keys):
const bar=combineFilmFade({from:0,to:T,fadeIn:0,fadeOut:0,ease:null,timed:false},kit,false);
assert.deepEqual([bar.from,bar.to,bar.fadeIn,bar.fadeOut,bar.timed],[7,18.7,.4,1.8,false],'the bar is the film\'s window with its ramps');
const retimed=showOverFilm(kit,0,T,{from:bar.from,to:15,fadeIn:bar.fadeIn,fadeOut:Math.min(bar.fadeOut,15-bar.from)});
assert.deepEqual([retimed.from,retimed.fadeIn,retimed.to,retimed.fadeOut],[0,0,15,1.8],'end moved: fade out 1.8 s kept; the start stays open (the film fades it in)');
// what the stage then draws: the film's keyed opacity times the Director's window
const keyed=t=>{const k=filmFadeKeys(create,'^Accessory:drafting-kit$');if(t<=k[0][0])return k[0][1];if(t>=k.at(-1)[0])return k.at(-1)[1];let i=0;while(k[i+1][0]<t)i++;const [a,x]=k[i],[b,y]=k[i+1];return x+(y-x)*(t-a)/(b-a);};
const drawn=t=>keyed(t)*showFactor(retimed,t);
assert.ok(near(drawn(7.2),.5,1e-6),'fades in as the film has it (no second ramp)');
assert.equal(drawn(13),1);assert.ok(near(drawn(14.1),.5,1e-6),'fades out over 1.8 s to 15 s');assert.equal(drawn(15.05),0);
for(let t=13.2;t<=15;t+=.1)assert.ok(drawn(t)<=drawn(t-.1)+1e-9&&drawn(t-.1)-drawn(t)<.06,'smoothly, no step at '+t.toFixed(1));
// with the Director's window on it the bar shows the combined window: in from the film, out from the Director
const back=combineFilmFade({from:0,to:15,fadeIn:0,fadeOut:1.8,ease:null,timed:true},kit,true);
assert.deepEqual([back.from,back.to,back.fadeIn,back.fadeOut],[7,15,.4,1.8]);
// a fade length changed on the film's side is written (a longer ramp)
assert.deepEqual(showOverFilm(kit,0,T,{from:7,to:18.7,fadeIn:1,fadeOut:1.8}),{from:7,to:T,fadeIn:1,fadeOut:0});

// ---- the importer keeps ease (tools/experience/build-round8-director.py clean_show)
const py=process.env.PYTHON||'python';
const out=execFileSync(py,['-X','utf8','-c',`import importlib.util,sys,json;sys.argv=['x','--noop'];src=open(r'${path.join(root,'tools/experience/build-round8-director.py')}',encoding='utf8').read();ns={};exec(compile(src[src.index('def clean_show'):src.index('def desk_and_show')],'clean_show','exec'),ns);print(json.dumps([ns['clean_show']({'from':1,'to':5,'fadeOut':1,'ease':'smooth'}),ns['clean_show']({'from':1,'to':5,'ease':'smooth'}),ns['clean_show']({'from':1.004,'to':5.256,'fadeIn':.4})]))`]).toString();
assert.deepEqual(JSON.parse(out),[{from:1,to:5,fadeOut:1,ease:'smooth'},{from:1,to:5},{from:1,to:5.26,fadeIn:.4}],'the importer: ease kept with a fade, the rest as before');
console.log('PASS prop-fade-ease: smooth = smoothstep in the Director and the film (linear unchanged), the film\'s own fades kept on a retime, the importer keeps ease');
