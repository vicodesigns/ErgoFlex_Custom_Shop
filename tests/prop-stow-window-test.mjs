// The Props lane draws a film item the desk puts away (easel, painter shelf, drafting kit) only while it is shown.
import {stowHides,stowWindow,hasStowRule,EASEL_ANGLE} from '../experience/prop-stow-window.mjs';
import {deskItemDisposition} from '../desk-auto-stow.mjs';
import {legacyMotionToClips,sampleClipMotion} from '../experience/desk-clips.mjs';
import fs from 'node:fs';
let bad=0;const check=(ok,what)=>{console.log((ok?'ok   ':'FAIL ')+what);if(!ok)bad++;};
// 1. the same decision as the desk's auto-stow for every name and angle the rules mention
const names=['accessory:artist-easel','artist painting','accessory:painter-shelf','painter accessory shelf','accessory:drafting-kit','architect floor plan','accessory:task-light','accessory:monitor-arm','accessory:easel-rail','flat-monitor'];
let same=true;
for(const recipe of ['artist','architect','office'])for(const n of names)for(const tilt of [0,5,9,10,30,49.9,50,65,80]){
  const item={obj:{userData:{},isGroup:false,isMesh:false,children:[],name:n},saved:{role:'desktop',propId:'',label:''}},real=deskItemDisposition(item,tilt,recipe)==='hide',mine=stowHides(n,tilt,recipe);
  if(real!==mine){same=false;console.log('  differs:',recipe,n,tilt,real,mine);}
}
check(same,'stowHides agrees with deskItemDisposition (hide vs stay/stow)');
check(hasStowRule('Accessory:artist-easel')&&!hasStowRule('Accessory:task-light')&&!hasStowRule('Flat monitor'),'only easel, painter shelf and drafting kit have a window');
// 2. the finale's artist desk: the tilt move 65 -> 30 (7 - 11.2 s, linear) crosses 50 deg at 8.8 s
const sub=JSON.parse(fs.readFileSync(new URL('../exports/cinematic-intro-20261110-alt/director-film/hero-subshots.json',import.meta.url))).shots;
const B=sub.find(s=>s.subshot==='B'),m=legacyMotionToClips(B.motion,48),tilt=t=>sampleClipMotion(m,t).tilt;
const lo=4.7,hi=12.8,w=stowWindow('accessory:artist-easel','artist',tilt,lo,hi);
check(w&&w.from===lo&&Math.abs(w.to-8.8)<.06,'artist easel on screen '+JSON.stringify(w)+' (the desk crosses '+EASEL_ANGLE+' deg at 8.8 s)');
const p=stowWindow('accessory:painter-shelf','artist',tilt,lo,hi);check(p&&Math.abs(p.to-w.to)<.01,'painter shelf leaves with the easel '+JSON.stringify(p));
check(stowWindow('accessory:task-light','artist',tilt,lo,hi)===null&&stowWindow('Flat monitor','artist',tilt,lo,hi)===null,'items without a rule keep the whole stretch');
// 3. the architect desk (35 deg, under 50 all the time it is on): the drafting kit is there the whole time
const C=sub.find(s=>s.subshot==='C');check(stowWindow('accessory:drafting-kit','architect',t=>sampleClipMotion(legacyMotionToClips(C.motion,48),t).tilt,12.5,20.4)===null,'architect desk (under 50 deg while it is on): the drafting kit keeps its whole stretch');
check(stowWindow('accessory:artist-easel','artist',()=>65,lo,hi)===null,'always above 50: the bar stays whole');
check(stowWindow('accessory:artist-easel','artist',()=>20,lo,hi)===null,'never shown: the bar stays whole');
console.log(bad?'FAILED: '+bad:'all ok');process.exit(bad?1:0);
