// Director camera edits -> Export cut -> the film: the camera the film builds from an export (director-bridge.py
// import, build-round8-director.py --import and its pass, camera-spline.mjs) is exactly the camera Render still and
// the live view use for the same keys (film-render.mjs filmCamera). A synthetic chapter with a hold and a cut, plus
// every real chapter of HQ (default exports/cinematic-intro-20261104-hq14) when its director pages are present.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {filmCamera,filmRenderShot} from '../experience/film-render.mjs';
import {moveCameraKey} from '../experience/camera-track.mjs';
import {cleanCut} from '../experience/cuts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tools=path.join(root,'tools/experience');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-export-'));
const py=(...args)=>execFileSync('python3',args,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();

// The page cut (director-bridge.py link), as build-round8-director.py --pages makes it.
function pageCut(shotFile,id){
  const out=path.join(tmp,'link.json');py(path.join(tools,'director-bridge.py'),'link',shotFile,'--json',out,...(id?['--shot',id]:[]));
  return JSON.parse(fs.readFileSync(out,'utf8'));
}
// What Vico does in the live view: move a story key, re-frame another, add a key of his own, change nothing else.
function edit(cut){
  const s=structuredClone(cut.shots[0]),keys=s.camera.keys,i=Math.min(2,keys.length-2),T=s.seconds;
  let list=moveCameraKey(keys,keys[i].id,keys[i].time+.35/T);
  const j=list.findIndex(k=>k.id===keys[1].id);list[j]={...list[j],view:{...list[j].view,position:list[j].view.position.map((v,n)=>v+[.21,-.07,.13][n]),fov:list[j].view.fov+2}};
  const a=list.at(-2),b=list.at(-1),mid=(a.time+b.time)/2;
  list=[...list,{id:crypto.randomUUID(),time:mid,label:'My new view',easing:'smooth',view:{...a.view,position:a.view.position.map((v,n)=>v+[-.3,.15,.2][n]),target:[...b.view.target]}}].sort((x,y)=>x.time-y.time);
  s.camera={keys:list};
  return cleanCut({...cut,shots:[s]});   // Export cut writes the cleaned cut
}
// The film's path for that export: build-round8-director.py --import (director-bridge.py import) and its pass.
function filmFromExport(film,exported,hasShotFile){
  const H=path.join(tmp,'hq-'+film.id);fs.rmSync(H,{recursive:true,force:true});fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[film]}));
  if(hasShotFile)fs.writeFileSync(path.join(H,'shots','02.json'),JSON.stringify(film));
  const ex=path.join(tmp,`Film-chapter-${film.id}.json`);fs.writeFileSync(ex,JSON.stringify(exported));
  const script=path.join(tools,'build-round8-director.py');py(script,H,'--import',ex);
  if(film.id==='awaken'){   // chapter 1: build-round8-opener.py takes director-camera.json's keys into its own plan
    const dc=JSON.parse(fs.readFileSync(path.join(H,'director-camera.json'),'utf8')),f=path.join(H,'awaken.json');
    fs.writeFileSync(f,JSON.stringify({seconds:film.seconds,cameraPlan:{...film.cameraPlan,keys:dc.keys}}));
    execFileSync('node',[path.join(tools,'camera-spline.mjs'),f],{stdio:'ignore'});return JSON.parse(fs.readFileSync(f,'utf8')).camera.keys;
  }
  py(script,H);
  const read=f=>JSON.parse(fs.readFileSync(path.join(H,f),'utf8'));
  const fromCut=read('review-cut.json').shots[0].camera.keys,fromShot=hasShotFile?read('shots/02.json').camera.keys:fromCut;
  assert.deepEqual(fromShot,fromCut,`${film.id}: shots/NN.json and review-cut.json get the same camera`);
  return fromShot;
}
function check(name,film,cut,hasShotFile){
  // Untouched page: the live view / still camera is the film's camera.
  const s0=cut.shots[0];
  const same=filmCamera(film,s0.camera.keys,s0.seconds).camera.keys;
  assert.deepEqual(same.map(k=>[k.time,k.view]),film.camera.keys.map(k=>[k.time,k.view]),`${name}: the page's keys give the film's own camera`);
  const exported=edit(cut),s=exported.shots[0],still=filmRenderShot(film,s,s.camera.keys).camera.keys;
  assert.deepEqual(filmCamera(film,s.camera.keys,s.seconds).camera.keys,still,`${name}: live view camera = Render still camera`);
  const built=filmFromExport(film,exported,hasShotFile);
  assert.deepEqual(built.map(k=>[k.time,k.easing,k.view]),still.map(k=>[k.time,k.easing,k.view]),`${name}: the film built from Export cut = Render still`);
  return still.length;
}

// Synthetic chapter: a hold, a cut, easeIn off.
const v=(x,z,fov=40)=>({position:[x,1.6,z],target:[0,1,0],fov});
const synthetic={id:'rise',room:'home',kind:'lift',seconds:16,title:'Synthetic',motion:{version:2,initial:{height:28,tilt:0,x:0,z:0,yaw:0},clips:[]},
  cameraPlan:{easeIn:false,easeOut:true,keys:[{at:0,...v(2,2),label:'Open'},{at:3.2,...v(2.4,1.6),label:'Push'},{at:6.1,...v(1.2,2.8,44),label:'Rest',hold:1.5},{at:10,...v(-1,3,38),label:'Cut in',cut:true},{at:13.3,...v(-1.6,2.6),label:'Drift'},{at:16,...v(-2,2.2),label:'Land'}]}};
{
  const f=path.join(tmp,'synthetic.json');fs.writeFileSync(f,JSON.stringify(synthetic));
  execFileSync('node',[path.join(tools,'camera-spline.mjs'),f],{stdio:'ignore'});const film=JSON.parse(fs.readFileSync(f,'utf8'));
  check('synthetic',film,pageCut(f),true);
  console.log('Director export: a synthetic chapter with a hold and a cut: moved, re-framed and added keys export to exactly the camera Render still and the live view show.');
}
// The real chapters.
const H=path.join(root,process.env.HQ||'exports/cinematic-intro-20261104-hq14'),list=path.join(H,'director-chapters.json');
if(fs.existsSync(list)){
  const out=[];
  for(const c of JSON.parse(fs.readFileSync(list,'utf8')).chapters){
    const film=JSON.parse(fs.readFileSync(path.join(root,c.shot.replace(/^\//,'')),'utf8')),f=path.join(tmp,c.id+'.json');fs.writeFileSync(f,JSON.stringify(film));
    out.push(c.id+' '+check(c.id,film,pageCut(f),c.id!=='oilers'));
  }
  console.log(`Director export: ${out.length} film chapters (${out.join(', ')} baked keys): page keys = the film camera; edits = Render still = the film built from the export.`);
}else console.log('Director export: real chapters skipped (no director-chapters.json).');
fs.rmSync(tmp,{recursive:true,force:true});
