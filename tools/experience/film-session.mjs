// Film-review adapter. Loaded only by film-review.html on the isolated render origin.
import * as fx from './film-fx.mjs';
import * as THREE from 'three';
let shot, canvas;
const api=()=>window.ErgoPresentation;
window.FilmReview={
 async prepare(s){
  fx.clear();shot=s;fx.beforePrepare(s);
  try{await api().prepare(s);}finally{fx.unhookPreset();}
  await fx.install({...s,__stageClip:'exports/cinematic-intro-20261030/post/screen-film.mp4'});
  return {screens:fx.listScreens(s),clocks:fx.listClocks()};
 },
 async beginBake(w,h){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;api().beginBake(w,h);},
 async bakeFrame(t,out,seconds){await fx.frame(t,seconds,{video:true});try{await api().bakeFrame(t,out,seconds+(shot.screenOffset||0));}finally{fx.after();}},
 endBake(){api().endBake();},
 async still(t){await this.beginBake(1920,1080);try{await this.bakeFrame(t,canvas,t*shot.seconds);return canvas.toDataURL('image/jpeg',.94);}finally{this.endBake();}},
 audit(){
  const root=window.ErgoFlex.workspaceRoom?.root,items=[];
  root?.traverse(o=>{if(/^Prop:.*(chair|steelcase|table)/i.test(o.name)&&o.visible){const b=new THREE.Box3().setFromObject(o);items.push({name:o.name,position:b.getCenter(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3)),size:b.getSize(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3))});}});
  return items;
 }
};
