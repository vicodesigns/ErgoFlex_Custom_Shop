import {enhanceGizmo,mmPerUnitOf} from './gumball.mjs';
let altHeld=false;   // Alt held as a prop drag starts: Alt+drag copies (P3)
import {noteStudioValue} from './studio-sync.mjs';
import {layersOn,splitPermanent,writePermanentLayers,permanentCells,foldDeskHides,LAYERS_KEY} from './layers-exchange.mjs';
import {FOLLOW_LABELS,cleanPlace,cleanPropEdit,cleanAddEdit,isAddEdit,newAddId,propKey,propTarget,DESK_SURFACES,onDesk,effectivePropEdits,escapeRegex,propName,describePropEdit,studioSceneIds,writeSceneAssets,keyedFadeWindow,filmFadeKeys,combineFilmFade,showOverFilm} from './prop-edits.mjs';
import {stackRows} from './lane-rows.mjs';
import {stowWindow,EASEL_ANGLE,filmVisibleKeys,keyedWindow} from './prop-stow-window.mjs';
import {legacyMotionToClips,sampleClipMotion} from './desk-clips.mjs';
import {createPropLibrary,deskItem} from './prop-library.mjs';
import {groupPanelHtml,groupCentreDelta,pickMode} from './prop-selection.mjs';
import {dropToSurface} from './drop-to-surface.mjs';
// Director "Props": click a prop in the view (not in light mode) to select it, then move / rotate / scale it with
// the gizmo (W / E / T, Shift snaps) or the Prop inspector, hide it (Delete), reset it. Edits go to the chapter's
// cut shot (shot.propEdits, film sceneEdits format, prop-edits.mjs); film-fx applies them after the film's own
// sceneEdits on the live stage, in Render still and in the film. Studio is never written, except by
// "Make permanent in Studio…", which Vico confirms prop by prop.
// "+ Add prop" (Props tab, timeline "+ Prop"): the library browser (prop-library.mjs); the pick goes on the desktop
// under the screen centre (desk-sized items) or on the floor in front of the camera, selected with the gizmo. Its
// edit is an add entry (prop-edits.mjs cleanAddEdit: its own transform in the desk's or the room's frame); Delete or
// Reset to the film removes it.
// Multi-select (prop-selection.mjs): Shift+click adds, Ctrl/Cmd+click toggles, click empty clears; everything selected
// (room props and desk items alike, all are prop edits) moves, turns, hides and resets together, one undo step each.
// A gizmo drag moves the live object at once (restored by __directorPropsRestore before film-fx re-installs).
// The timeline's Props lane: one bar per desk item, added prop and edited prop over the seconds it is on screen. Drag a
// bar's ends (or the Prop inspector's "On screen" fields) to set when it appears and leaves, with a fade in and out
// (prop-edits.mjs show). In a chapter the film renders as sub-shots (the finale) every desk has its own bars under its
// stretch of the Desk versions lane, and an edit belongs to the desk it was made on (prop-edits.mjs desk).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r3=v=>Math.round(v*1000)/1000,r1=v=>Math.round(v*10)/10;
const wrapDeg=d=>{d=((d+180)%360+360)%360-180;return Math.abs(d)<1e-6?0:d;};
const MODES={translate:'Move',rotate:'Rotate',scale:'Scale'},VERB={translate:'Moved',rotate:'Rotated',scale:'Scaled'};
const STATE_KEY='ergoflex.sceneAssets.v1';
export function createScenePropEditor({bridge,shot,film,commit,status,open,rerender,roomDesk=()=>false,onSelect=()=>{},lightsShowing=()=>false,fold=()=>{},person=()=>false,blocked=()=>false,
  scope=()=>null,versions=()=>[],seconds=()=>0,time=()=>0,seek=()=>{}}){
  let sel=null,others=[],lockedKeys=()=>new Set(),itemsCache=null,itemsAt=0,flash=null,pivotAt=0,pivotDirty=true,mode='translate',tools=null,booting=null,drag=null,snapping=false,pending=null,dialogPlan=null,placing=false;
  const snaps=new Map(),frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow;
  const three=()=>bridge.stage()?.three?.();
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  const sceneOf=()=>three()?.scene||null;
  // Every user-facing text says the friendly name ('Steelcase leap v2'); the raw object name ('Prop:steelcase-leap-v2')
  // only shows in tooltips and the inspector's small grey line.
  const label=o=>o?.userData?.directorAdd?.label||propName(o?.name),nice=n=>propName(n||'');
  // ---- the cut
  const edits=()=>effectivePropEdits(film(),shot());
  const editOfKey=key=>edits().find(e=>propKey(e)===key)||null;
  const editedCount=()=>edits().length;
  // ---- a desk of its own and time on screen (prop-edits.mjs desk / show)
  // scope(): the desk on stage in a chapter rendered as sub-shots {n, preset, label, start, from, to}, null elsewhere.
  // versions(): that chapter's desks in time order ([] elsewhere). A new edit there belongs to the desk on stage.
  const deskNow=()=>scope()||null;
  const withDesk=t=>{const d=deskNow();return d?.preset&&!t.desk?{...t,desk:d.preset}:t;};
  const END=100000,r2=v=>Math.round(v*100)/100;   // show.to END: until the desk (or the chapter) ends
  // Where an edit's seconds count from and when it can be on screen, in chapter seconds: {t0, lo, hi, desk, n, label}.
  // A desk's edit counts from its sub-shot's start (t0) and can show while that desk is the one on screen (lo…hi).
  function spanOf(desk,n=null){
    const T=seconds()||0;if(!desk)return {t0:0,lo:0,hi:T};
    const list=versions().filter(v=>v.preset===desk),t=time(),v=list.find(x=>x.n===n)||list.find(x=>x.n===deskNow()?.n)||list.find(x=>t>=x.from&&t<x.to)||list[0];
    return v?{t0:v.start,lo:v.from,hi:Math.min(T,v.to),desk,n:v.n,label:v.label}:{t0:0,lo:0,hi:T,desk,missing:true};
  }
  // An edit's time on screen within its span, in chapter seconds.
  function onScreen(e,span){
    const w=e?.show,clamp=x=>Math.max(span.lo,Math.min(span.hi,x));
    return {from:w?clamp(span.t0+w.from):span.lo,to:w?clamp(span.t0+w.to):span.hi,fadeIn:w?.fadeIn||0,fadeOut:w?.fadeOut||0,ease:w?.ease==='smooth'?'smooth':null,timed:!!w};
  }
  // B1 (S33): the film's own fade of an item (a hand-made film edit with a keyed opacity, prop-edits.mjs keyedFadeWindow):
  // the drafting kit in create fades in at 7.0 s and out from 16.9 to 18.7 s. Before, the Props lane did not know it:
  // the bar ran the whole chapter with no ramps, and dragging its end wrote show:{to} with NO fade, so the prop was cut
  // off at the new end (or in the middle of the film's own fade) instead of fading. Now the bar is that window with its
  // ramps, a retime keeps its fades, and a Director window is drawn as it combines with the film's.
  // 17 Nov 2026 (Vico, create: the painter shelf "really comes in at 12.7" while the lane said "the whole chapter"): and
  // the film's own visible keys of a desk accessory (film-fx accessories.add[].visible, the shelf held hidden until
  // 12.6 s), as a window with cut ends (within the keyed fade when it has one too). Not in a chapter of sub-shots.
  function filmFade(target,span){
    const keys=filmFadeKeys(film(),target?.match),op=keys?keyedFadeWindow(keys,span.lo,span.hi):null;
    const vk=versions().length?null:filmVisibleKeys(film()?.accessories,`${target?.match||''} ${String(target?.path||'').split('>').pop()} ${target?.label||''}`);
    return (vk&&keyedWindow(vk,op,span.lo,span.hi))||op;
  }
  // An item's time on screen as the stage draws it: the Director's window, within the film's own fade when it has one.
  const screenOf=(e,target,span)=>combineFilmFade(onScreen(e,span),filmFade(target||e,span),!!e?.show);
  // The show for chapter seconds from…to in a span: an end on the span's edge stays open; the whole time is no show.
  function showFor(span,{from,to,fadeIn=0,fadeOut=0,ease=null}){
    const atLo=from<=span.lo+.05,atHi=to>=span.hi-.05;
    if(atLo&&atHi&&!fadeIn&&!fadeOut)return undefined;
    return {from:atLo&&!fadeIn?0:r2(Math.max(0,from-span.t0)),to:atHi&&!fadeOut?END:r2(to-span.t0),...(fadeIn?{fadeIn:r2(fadeIn)}:{}),...(fadeOut?{fadeOut:r2(fadeOut)}:{}),...(ease==='smooth'&&(fadeIn||fadeOut)?{ease:'smooth'}:{})};
  }
  const timeText=(s,span)=>s.from<=span.lo+.05&&s.to>=span.hi-.05?(span.desk?'the whole time its desk is on screen':'the whole chapter'):`${r1(s.from)}–${r1(s.to)} s`;
  // Writes a prop's time on screen (m: {key, target}); next in chapter seconds.
  function writeShow(m,next,span,name){
    const e=editOfKey(m.key),nat=filmFade(m.target||e,span),show=showFor(span,nat?showOverFilm(nat,span.lo,span.hi,next):next),edit={...m.target,...(e||{}),show};if(show===undefined)delete edit.show;
    const fades=[next.fadeIn?`fades in ${r1(next.fadeIn)} s`:'',next.fadeOut?`fades out ${r1(next.fadeOut)} s`:'',(next.fadeIn||next.fadeOut)?(next.ease==='smooth'?'smooth':'linear'):''].filter(Boolean).join(', ');
    write(m.key,edit,`${name}: on screen ${timeText(next,span)}${fades?', '+fades:''}.`);
  }
  // Every prop write: seeds shot.propEdits from the film's earlier-exported entries first (like camera keys).
  function write(key,next,text,{undoKey=null}={}){
    if(next&&!cleanPropEdit(next)&&!isNoopEdit(next)){status(`${CANT_SAVE}: ${UNUSUAL}`,true);rerender();return;}
    commit(()=>{const s=shot(),list=edits().filter(e=>propKey(e)!==key),clean=next&&cleanPropEdit(next);s.propEdits=clean?[...list,clean]:list;},{key:undoKey,render:false});
    status(text);rerender();
  }
  // One undo step for several props at once: changes [{key, next | null}].
  function writeMany(changes,text,also=null){
    for(const c of changes)if(c.next&&!cleanPropEdit(c.next)&&!isNoopEdit(c.next)){status(`${CANT_SAVE}: ${UNUSUAL}`,true);rerender();return;}
    commit(()=>{const keys=new Set(changes.map(c=>c.key)),list=edits().filter(e=>!keys.has(propKey(e)));for(const c of changes){const clean=c.next&&cleanPropEdit(c.next);if(clean)list.push(clean);}shot().propEdits=list;also?.();},{key:null,render:false});
    pivotDirty=true;status(text);rerender();
  }
  // ---- what can't be kept
  // The status text whenever a selected item can't become a Director edit (said when it's selected and when it's moved).
  const CANT_SAVE='This item can\'t be saved in the film yet',UNUSUAL='its name is too long or unusual for a film edit.';
  const isNoopEdit=e=>!e.position&&!e.rotation&&!e.scale&&e.hide===undefined;
  // Why the film couldn't keep an edit to o with target t ('' = it can): the cleaned edit must find exactly o again.
  function unrecordable(o,t){
    const probe=cleanPropEdit({...t,position:[.1,0,0]});if(!probe)return UNUSUAL;
    let f;try{f=win().__filmEdits.editTargets(probe);}catch{return 'the film can\'t look it up.';}
    return f.length===1&&f[0]===o?'':f.some(x=>x===o)?'the film can\'t tell it apart from other items with the same name.':'the film can\'t find it again by its name.';
  }
  // Studio's own room editing also lives in the stage (studio.js RoomInteractions and the scene desks' object editor:
  // click-drag moves a furnishing or a desk item, Delete removes it, a double click opens Studio's item gizmo). Its
  // window capture listener runs before the Director's and stops the click, so in a room with Studio furnishings (the
  // Humboldt library) the Director never saw the click and Studio's drag moved the prop where nothing records it (the
  // stage's storage is throwaway). In Director Mode the Director owns the pointer: Studio's item editing is off here.
  // Anything Studio still moves says so in the status line.
  const MUTED=Symbol('director');
  function muteStudioEditing(){
    const api=win()?.ErgoFlex;if(!api)return;
    const ri=api.roomInteractions;
    if(ri&&!ri[MUTED]){ri[MUTED]=true;try{ri.end?.();ri.select?.(null);}catch{}ri.enabled=()=>false;
      const end=ri.onEditEnd;ri.onEditEnd=edit=>{studioMoved();return end?.(edit);};}
    const ctx=api.sceneDesks?.ctx,objects=api.sceneDesks?.objects;
    if(ctx&&!ctx[MUTED]){ctx[MUTED]=true;try{objects?.endDrag?.();}catch{}ctx.objectsEditable=()=>false;ctx.rearrange=()=>false;}
    if(api.itemGizmo?.active)try{api.itemGizmo.close();}catch{}
  }
  function studioMoved(){status(`${CANT_SAVE}: Studio's room editing moved it, not the Director. Undo in Studio or reload the chapter, then click it and use the Director's gizmo.`,true);}
  // ---- stage objects
  const filmEdit=o=>(o?.userData.__filmFxEdits||[]).filter(e=>e.director).at(-1)||null;
  const handMoves=o=>(o?.userData.__filmFxEdits||[]).filter(e=>!e.director&&(e.position||e.rotation||e.scale!==undefined));
  const pathOf=o=>{const scene=sceneOf(),out=[];for(let p=o;p&&p!==scene;p=p.parent)out.unshift(p.name||p.type);return out.join(' > ');};
  const inScene=o=>{const scene=sceneOf();for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
  const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const isOurs=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls||/^Cinematic effects$|^Film lights$/.test(p.name))return true;return false;};
  // The prop a click means: one item of the desk's daily kit (the open notebook…), the innermost Studio scene asset or
  // desk accessory, else the library prop (Prop:…). On the desk model itself only such props count, never its parts.
  function meaningful(o,{above=null}={}){
    const scene=sceneOf(),desk=win()?.ErgoFlex?.loadedModel;let fallback=null,skipping=!!above;
    for(let p=o;p&&p!==scene;p=p.parent){
      if(p.userData?.directorAdd&&!skipping)return p;
      if(p===desk)return skipping?null:fallback;
      if(skipping){if(p===above)skipping=false;continue;}
      if(p.parent?.userData?.dayKit)return p;
      if(p.userData?.sceneAsset||p.userData?.dayKit||/^Accessory:/.test(p.name))return p;
      if(!fallback&&(/^Prop:/.test(p.name)||p.userData?.propId))fallback=p;
    }
    return skipping?null:fallback;
  }
  // Props riding on the desk (on the desk model, its daily kit, its mounts and dressing): their edits are kept along
  // the parent's own axes (space:'local'), so they follow lift and tilt whatever pose the edit is installed at.
  function ridesDesk(o){const desk=win()?.ErgoFlex?.loadedModel;for(let p=o?.parent;p;p=p.parent)if(p===desk||p.userData?.dayKit||/^(Scene dressing|Accessory mount|Desk dressing):/.test(p.name))return true;return false;}
  const ON_DESK='It sits on the desk and travels with it, so Studio\'s room layout can\'t hold it. Keep it as a chapter edit.';
  const onDeskItself=o=>{const desk=win()?.ErgoFlex?.loadedModel;for(let p=o;p;p=p.parent)if(p===desk||p.userData?.dayKit)return true;return false;};
  // The film target for a prop: its name, plus its Studio key, path or position when others share the name.
  function targetFor(o){
    const E=win().__filmEdits,t={match:'^'+escapeRegex(o.name||'')+'$',label:o.name||'Unnamed prop'},only=x=>{const f=E.editTargets(x);return f.length===1&&f[0]===o;};
    if(o.userData.sceneAssetKey){t.asset=o.userData.sceneAssetKey;if(only(t))return t;delete t.asset;}
    if(only(t))return t;
    t.path='^'+escapeRegex(pathOf(o))+'$';if(only(t))return t;delete t.path;
    const w=o.getWorldPosition(o.position.clone()),twins=E.editTargets(t).filter(x=>x!==o).map(x=>{const p=x.getWorldPosition(x.position.clone());return Math.hypot(p.x-w.x,p.z-w.z);});
    t.near=[r3(w.x),r3(w.z),r3(Math.max(.01,Math.min(.3,(Math.min(...twins,1)||.02)*.45)))];
    if(only(t))return t;
    throw Error(`${label(o)} can't be told apart from an identical prop at the same spot, so it can't be edited on its own.`);
  }
  // The target of the prop under a click or in a list: its own installed Director edit's, else its name's, kept to
  // the desk on stage in a sub-shot chapter.
  function targetOf(o){const mine=filmEdit(o)&&cleanPropEdit(filmEdit(o));return mine||withDesk(targetFor(o));}
  // The prop as film-fx placed it (before any live drag) and where it is without the Director's edit.
  function installed(o){const s=snaps.get(o);return s?{position:s.position.clone(),rotation:o.rotation.clone().setFromQuaternion(s.quaternion,o.rotation.order),scale:s.scale.clone()}:{position:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone()};}
  const parentScale=o=>{const {THREE}=tools;if(!o.parent)return new THREE.Vector3(1,1,1);o.parent.updateWorldMatrix(true,false);return o.parent.getWorldScale(new THREE.Vector3());};
  function base(o){
    const {THREE}=tools,E=filmEdit(o),st=installed(o);o.parent?.updateMatrixWorld(true);
    const local=st.position.clone();if(E?.position&&E.space==='local')local.sub(new THREE.Vector3(...E.position).divide(parentScale(o)));
    const world=local.clone();if(o.parent)o.parent.localToWorld(world);
    if(E?.position&&E.space!=='local')world.sub(new THREE.Vector3(...E.position));
    const rot=st.rotation.clone();if(E?.rotation){rot.x-=THREE.MathUtils.degToRad(E.rotation[0]||0);rot.y-=THREE.MathUtils.degToRad(E.rotation[1]||0);rot.z-=THREE.MathUtils.degToRad(E.rotation[2]||0);}
    const scale=st.scale.clone();if(Array.isArray(E?.scale))scale.divide(new THREE.Vector3(...E.scale));else if(Number.isFinite(E?.scale))scale.divideScalar(E.scale);
    const out={world,rot,scale};if(ridesDesk(o)){out.local=o.parent?o.parent.worldToLocal(world.clone()):world.clone();}return out;
  }
  // An edit from the prop's state now (after a drag or typed numbers) relative to base().
  // Turns: of the two Euler triples for the same rotation, the one nearest the film's (a turn about y stays a turn
  // about y, not ±180° on x and z). Scale: kept between ×0.01 and ×100, never mirrored.
  function editFrom(o,b,{world,rot,scale}={}){
    const {THREE}=tools,w=world||o.getWorldPosition(new THREE.Vector3()),r=rot||o.rotation,s=scale||o.scale,deg=THREE.MathUtils.radToDeg;
    const [a0,a1,a2]=(r.order||'XYZ').toLowerCase().split(''),alt={[a0]:r[a0]+Math.PI,[a1]:Math.PI-r[a1],[a2]:r[a2]+Math.PI};
    const turn=e=>['x','y','z'].map(k=>wrapDeg(deg(e[k]-b.rot[k]))),plain=turn(r),other=turn(alt),size=t=>t.reduce((n,v)=>n+Math.abs(v),0);
    const clamp=v=>Math.round(Math.min(100,Math.max(.01,Math.abs(v)))*1e4)/1e4;
    const position=b.local?(o.parent?o.parent.worldToLocal(w.clone()):w.clone()).sub(b.local).multiply(parentScale(o)):w.clone().sub(b.world);
    return {space:b.local?'local':undefined,position:position.toArray().map(r3),rotation:(size(other)<size(plain)-1e-6?other:plain).map(r1),scale:[s.x/b.scale.x,s.y/b.scale.y,s.z/b.scale.z].map(clamp)};
  }
  // ---- added props: their own transform in the parent's frame (prop-edits.mjs cleanAddEdit)
  const parentK=o=>{const {THREE}=tools;if(!o.parent)return 1;o.parent.updateWorldMatrix(true,false);return o.parent.getWorldScale(new THREE.Vector3()).x||1;};
  const libScale=o=>1000*win().__filmEdits.mmScale()/parentK(o);
  function addFrom(o,e,{position,rotation,scale}={}){
    const k=parentK(o),b=libScale(o),deg=tools.THREE.MathUtils.radToDeg;
    return cleanAddEdit({...e,position:position||o.position.toArray().map(v=>r3(v*k)),rotation:rotation||[o.rotation.x,o.rotation.y,o.rotation.z].map(v=>r1(wrapDeg(deg(v)))),
      scale:scale||[o.scale.x/b,o.scale.y/b,o.scale.z/b].map(v=>Math.round(Math.min(100,Math.max(.01,Math.abs(v)))*1e4)/1e4)});
  }
  // ---- "Travels with" (film-edits.mjs follow / place): the surface a prop follows, chosen here; it stays where it is on
  // screen at the moment of choosing and follows that surface from then on. Its edit holds its own transform there.
  const isFollow=e=>!!(e&&!isAddEdit(e)&&e.follow&&e.place);
  // metres per scene unit (the desk is scaled to the scene, about 0.62 m a unit): the inspector shows real metres
  const metresPerUnit=()=>{const w=win()?.ErgoFlex,sc=w?.workspaceRoom?.scale||w?.workspaceAccessories?.scale;return sc>0?1/(sc*1000):1;};
  function placeFrom(o){const deg=tools.THREE.MathUtils.radToDeg;return cleanPlace({position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z].map(v=>wrapDeg(deg(v))),scale:o.scale.toArray()});}
  // the surface a prop is on now: the nearest frame among its parents (for the select's "as the film places it")
  function surfaceNow(o){const E=win()?.__filmEdits;if(!E?.followFrame)return null;for(let p=o.parent;p;p=p.parent){if(p.userData?.filmFxLift)return 'lift';for(const k of ['desk','shelf','lower-shelf','base-shelf'])if(E.followFrame(k)===p)return k;}return 'room';}
  // the desktop shelf unit: the shelf the prop is over (its lowest surface below it, within the shelf's size)
  function shelfOf(o){
    const E=win().__filmEdits,{THREE}=tools,w=o.getWorldPosition(new THREE.Vector3());let best='shelf',bestY=Infinity;
    for(const k of ['shelf','lower-shelf']){const f=E.followFrame(k);if(!f)continue;f.updateWorldMatrix(true,false);const p=f.worldToLocal(w.clone()),sz=f.userData.surfaceSize||{width:2000,depth:1000};
      const over=Math.abs(p.x)<=sz.depth/2+80&&Math.abs(p.z)<=sz.width/2+80,y=p.y>=-30?p.y:1e6+Math.abs(p.y);if(over&&y<bestY){bestY=y;best=k;}}
    return best;
  }
  // The frame a prop will follow, measured once the stage has drawn the desk where it is now (17 Nov, Windows: picked
  // right after a change the shelf's frame was still at an old pose, y 0, so the place was 1.4 m off and the controller
  // floated over the shelf from the next frame on). The playhead is re-applied and the frame read until two frames agree.
  async function settledFrame(kind){
    const E=win()?.__filmEdits,w=win();if(!E?.followMatrix)return null;
    try{seek(time());}catch{}bridge.stage()?.wake?.(600);
    const frame=()=>new Promise(r=>{let done=false;const go=()=>{if(!done){done=true;r();}};try{w.requestAnimationFrame(go);}catch{}setTimeout(go,60);});
    let last=null;
    for(let i=0;i<40;i++){
      await frame();const F=E.followMatrix(kind);if(!F)return null;
      if(i>=3&&last&&F.elements.every((v,k)=>Math.abs(v-last.elements[k])<1e-7))return F;last=F;
    }
    return last;
  }
  const placeIn=(F,W)=>{const {THREE}=tools,local=F.clone().invert().multiply(W),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();local.decompose(p,q,sc);
    const r=new THREE.Euler().setFromQuaternion(q),deg=THREE.MathUtils.radToDeg;return cleanPlace({position:p.toArray(),rotation:[r.x,r.y,r.z].map(v=>wrapDeg(deg(v))),scale:sc.toArray()});};
  // After the film has re-installed a new follow: the prop must still be where it was picked (W, world); if the frame had
  // moved on since, the place is measured again (the same undo step).
  let followCheck=null;
  async function checkFollow(){
    const c=followCheck;if(!c||performance.now()>c.until){followCheck=null;return;}
    const o=current();if(!o||sel?.key!==c.key){followCheck=null;return;}const e=editOfKey(c.key);if(!isFollow(e)||e.follow!==c.kind){followCheck=null;return;}
    if(o.parent!==win()?.__filmEdits?.followFrame?.(c.kind))return;   // not re-installed on its frame yet: the next time
    followCheck=null;
    const F=await settledFrame(c.kind);if(!F||current()!==o)return;o.updateWorldMatrix(true,false);
    const {THREE}=tools,a=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),b=new THREE.Vector3().setFromMatrixPosition(c.W);
    if(a.distanceTo(b)*metresPerUnit()<.002)return;
    console.warn('[props] travels with: re-measured',c.kind,'off by',(a.distanceTo(b)*metresPerUnit()).toFixed(3),'m');
    write(c.key,{...e,place:placeIn(F,c.W)},`${label(o)} travels with ${FOLLOW_LABELS[c.kind].replace(/ \(.*\)$/,'').toLowerCase()} (measured again once the desk was drawn).`,{undoKey:'follow:'+c.key});
  }
  async function setFollow(kind){
    const o=current();if(!sel||!o)return;const e=editOfKey(sel.key);if(isAddEdit(e)){status('A prop you added goes where its own "on" says; move it with the Gumball.',true);return;}
    if(!kind){if(!isFollow(e)){rerender();return;}const next={...sel.target,...e};delete next.follow;delete next.place;write(sel.key,next,`${label(o)} is back on the surface the film puts it on.`);return;}
    const key=sel.key,target=sel.target;o.updateWorldMatrix(true,false);const W=o.matrixWorld.clone();
    if(kind==='unit'){if(!await settledFrame('shelf')&&!await settledFrame('lower-shelf')){status('That surface is not in this chapter.',true);rerender();return;}kind=shelfOf(o);}
    status(`Measuring where ${label(o)} sits on ${FOLLOW_LABELS[kind].replace(/ \(.*\)$/,'').toLowerCase()}…`);
    const F=await settledFrame(kind);if(!F){status('That surface is not in this chapter.',true);rerender();return;}
    if(sel?.key!==key){status('The selection changed: Travels with not set.',true);return;}
    const next={...target,...(editOfKey(key)||{}),follow:kind,place:placeIn(F,W)};delete next.position;delete next.rotation;delete next.scale;delete next.space;
    followCheck={key,kind,W,until:performance.now()+15000};
    write(key,next,`${label(o)} now travels with ${FOLLOW_LABELS[kind].replace(/ \(.*\)$/,'').toLowerCase()}, from where it is now. Undo puts it back.`,{undoKey:'follow:'+key});
  }
  function followSelect(o,e){
    const now=isFollow(e)?e.follow:'',unit=now==='shelf'||now==='lower-shelf',was=!now&&surfaceNow(o);
    const opt=(v,t)=>`<option value="${v}" ${(v==='unit'?unit:v===now)?'selected':''}>${escape(t)}</option>`;
    return `<label class="prop-follow" title="What the prop moves with as the desk lifts and tilts. It stays where it is on screen now and follows that from then on.">Travels with<select name="pp-follow">
      <option value="" ${now?'':'selected'}>As the film places it${was?' ('+escape((FOLLOW_LABELS[was]||was).replace(/ \(.*\)$/,'').toLowerCase())+')':''}</option>${opt('room','Room (stays)')}${opt('base-shelf','Base shelf (stays with the base)')}${opt('lift','Desk lift (rises, never tilts)')}${opt('desk','Desktop (rises and tilts)')}${opt('unit','Desktop shelf unit')}</select></label>
      ${unit?`<label class="prop-follow">Shelf<select name="pp-follow-shelf"><option value="shelf" ${now==='shelf'?'selected':''}>Top shelf</option><option value="lower-shelf" ${now==='lower-shelf'?'selected':''}>Lower shelf</option></select></label>`:''}`;
  }
  function changedFollow(o,e,name,v){
    if(!/^pp-p[xyz]$/.test(name)){status('Turn and size it with the Gumball (E rotate, R scale): it travels with a surface.',true);rerender();return;}
    if(Math.abs(v)>1000)throw Error('Positions run from -1000 to 1000 m.');const {THREE}=tools,w=o.getWorldPosition(new THREE.Vector3());w.setComponent('xyz'.indexOf(name[4]),v/metresPerUnit());
    o.position.copy(o.parent?o.parent.worldToLocal(w):w);o.updateMatrixWorld(true);write(sel.key,{...e,place:placeFrom(o)},`Moved ${label(o)}.`);
  }
  function changedAdd(o,e,name,v){
    let next=null,verb='Moved';
    if(/^pp-p[xyz]$/.test(name)){if(Math.abs(v)>1000)throw Error('Positions run from -1000 to 1000 m.');const {THREE}=tools,w=o.getWorldPosition(new THREE.Vector3());w.setComponent('xyz'.indexOf(name[4]),v/metresPerUnit());
      const local=o.parent?o.parent.worldToLocal(w):w,k=parentK(o);next={position:local.toArray().map(x=>r3(x*k))};}
    else if(/^pp-r[xyz]$/.test(name)){const r=e.rotation.slice();r['xyz'.indexOf(name[4])]=r1(wrapDeg(v));next={rotation:r};verb='Rotated';}
    else if(name==='pp-s'){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');next={scale:[v,v,v]};verb='Scaled';}
    else if(/^pp-s[xyz]$/.test(name)){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');const f=e.scale.slice();f['xyz'.indexOf(name[4])]=v;next={scale:f};verb='Scaled';}
    else return;
    write(sel.key,cleanAddEdit({...e,...next}),`${verb} ${label(o)}.`);
  }
  // Where a new prop goes: desk-sized items on the featured desk's desktop where the screen centre's ray meets it
  // (kept on the top), else on the floor where that ray meets it (or 1.5 m ahead), turned to face the camera.
  function placement(entry){
    const {THREE,t}=tools,E=win().__filmEdits,cam=t.camera,kind=deskItem(entry)&&E.addParent('desk')?'desk':'room',parent=E.addParent(kind);
    parent.updateWorldMatrix(true,false);cam.updateMatrixWorld();
    const k=parent.getWorldScale(new THREE.Vector3()).x||1,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),cam);
    const origin=new THREE.Vector3().setFromMatrixPosition(parent.matrixWorld),up=new THREE.Vector3(0,1,0).transformDirection(parent.matrixWorld);
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(kind==='desk'?up:new THREE.Vector3(0,1,0),origin);
    let hit=ray.ray.intersectPlane(plane,new THREE.Vector3());
    const camPos=cam.getWorldPosition(new THREE.Vector3());
    const mm=E.mmScale();   // scene units per millimetre
    if(kind==='room'&&(!hit||hit.distanceTo(camPos)>4000*mm)){const f=cam.getWorldDirection(new THREE.Vector3());f.y=0;if(f.lengthSq()<1e-6)f.set(0,0,-1);hit=camPos.clone().addScaledVector(f.normalize(),1500*mm);hit.y=origin.y;}
    const local=hit?parent.worldToLocal(hit.clone()):new THREE.Vector3();local.y=0;
    if(kind==='desk'){
      // Keep it on the top: the desktop's measured size (mm, width across local x, depth across local z), less the item.
      const size=parent.userData.surfaceSize,half=Math.max(...entry.size)/2+20;
      if(size?.width&&size?.depth){local.x=THREE.MathUtils.clamp(local.x,-Math.max(0,size.width/2-half),Math.max(0,size.width/2-half));local.z=THREE.MathUtils.clamp(local.z,-Math.max(0,size.depth/2-half),Math.max(0,size.depth/2-half));}
      else if(!hit||local.length()>400)local.set(0,0,0);
    }
    const toCam=parent.worldToLocal(camPos.clone()).sub(local),yaw=Math.atan2(toCam.x,toCam.z)*180/Math.PI;
    return {kind,position:local.toArray().map(v=>r3(v*k)),rotation:[0,r1(wrapDeg(yaw)),0]};
  }
  // Click-to-place: the surface under the cursor. On the featured desk's top it rides the desk; anywhere else it stands
  // in the room at that point (a table, a shelf, the floor), keeping the way it faces.
  function placeAt(o,e,point){
    const {THREE}=tools,E=win().__filmEdits;let kind='room',best=40;
    // The desk surface the point lies on (within 40 mm of its plane and inside its outline): the nearest one wins.
    for(const s of Object.keys(DESK_SURFACES)){const top=E.addParent(s);if(!top)continue;top.updateWorldMatrix(true,false);const l=top.worldToLocal(point.clone()),size=top.userData.surfaceSize;
      if(Math.abs(l.y)<best&&(!size||Math.abs(l.x)<=size.width/2+20&&Math.abs(l.z)<=size.depth/2+20)){best=Math.abs(l.y);kind=s;}}
    const parent=E.addParent(kind);parent.updateWorldMatrix(true,false);const k=parent.getWorldScale(new THREE.Vector3()).x||1,local=parent.worldToLocal(point.clone());if(onDesk(kind))local.y=0;
    let rotation=e.rotation;
    if(kind!==e.parent){const q=parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion())),r=new THREE.Euler().setFromQuaternion(q);rotation=[r.x,r.y,r.z].map(v=>r1(wrapDeg(v*180/Math.PI)));}
    write(sel.key,cleanAddEdit({...e,parent:kind,position:local.toArray().map(v=>r3(v*k)),rotation}),`Placed ${label(o)} ${onDesk(kind)?`on ${DESK_SURFACES[kind]} (it rides the desk's lift and tilt)`:'there, in the room'}.`);
  }
  async function addProp(entry){
    await ensure();if(!editing()){status('Pause the chapter first: props are added on the paused frame.',true);return;}
    // It comes in at the playhead (from the start when the playhead is within half a second of it) and stays to the
    // end of the chapter, or of the desk on stage in a sub-shot chapter: its bar in the Props lane trims it.
    const d=deskNow(),span=spanOf(d?.preset,d?.n),now=Math.max(span.lo,Math.min(span.hi,time())),late=now-span.lo>.5&&span.hi-now>=.3;
    const at=placement(entry),e=cleanAddEdit({add:{asset:entry.id},id:newAddId(),label:entry.name,parent:at.kind,position:at.position,rotation:at.rotation,scale:[1,1,1],
      ...(d?.preset?{desk:d.preset}:{}),...(late?{show:showFor(span,{from:r2(now),to:span.hi})}:{})});
    if(!e)throw Error(`${entry.name} can't be added (its library id is unusual).`);
    const key=propKey(e);write(key,e,`Added ${entry.name} ${at.kind==='desk'?'on the desk (it rides the lift and tilt)':'on the floor in front of the camera'}${d?` of Desk ${d.n} · ${d.label}`:''}${late?`, from ${r1(now)} s (drag its bar in the Props lane to change when it shows)`:''}: W move · E rotate · R scale · Shift snaps · Delete removes it.`);
    sel={key,target:propTarget(e),obj:null};onSelect();rerender();
    return e;
  }
  const library=createPropLibrary({status,room:()=>shot()?.room,roomName:()=>shot()?.room,
    load:async()=>{await ensure();return (await win().__filmEdits.propLibrary()).index.props;},
    onPick:entry=>{addProp(entry).catch(error=>status(error.message,true));}});
  // The object a selected prop is on stage now: none while another desk shows (a same-named item there is that desk's).
  function objOf(m){const d=(editOfKey(m.key)||m.target)?.desk;if(d&&d!==deskNow()?.preset){m.obj=null;return null;}if(m.obj&&!inScene(m.obj))m.obj=null;if(!m.obj&&tools)m.obj=find(m.key,m.target);return m.obj;}
  const current=()=>sel?objOf(sel):null;
  const members=()=>sel?[...others,sel]:[];
  const isSel=key=>members().some(m=>m.key===key);
  const group=()=>others.length>0;
  // Installed Director entries by prop key (one scene walk, kept until film-fx re-installs or for 1 s).
  let found=null,foundAt=0;
  function installedIndex(){
    const scene=sceneOf();if(!scene)return new Map();if(found&&performance.now()-foundAt<1000)return found;
    found=new Map();foundAt=performance.now();scene.traverse(o=>{for(const e of o.userData.__filmFxEdits||[])if(e.director){const k=propKey(e),was=found.get(k);if(!was||(!shown(was)&&shown(o)))found.set(k,o);}});return found;
  }
  function find(key,target){
    const scene=sceneOf();if(!scene)return null;const hit=installedIndex().get(key);if(hit&&inScene(hit))return hit;
    const e=editOfKey(key)||target||sel?.target;if(!e||!win()?.__filmEdits)return null;
    // Another desk's prop: the item of that name on stage now belongs to the desk that is showing, not to this edit.
    if(e.desk&&e.desk!==deskNow()?.preset)return null;
    // (an accessory in the scene twice, one copy under the hidden accessory mount: the drawn one)
    const f=win().__filmEdits.editTargets(e),live=f.filter(shown);return f.length===1?f[0]:live.length===1?live[0]:null;
  }
  // ---- stage tools: gizmo, selection box, picking
  async function boot(){
    const w=win(),t=three();if(!t)throw Error('The stage is still loading.');
    if(!w.__directorThree)await new Promise((resolve,reject)=>{w.__dirThreeDone=resolve;w.__dirThreeFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";w.document.head.append(s);});
    if(!w.__filmEdits)await new Promise((resolve,reject)=>{w.__dirEditsDone=resolve;w.__dirEditsFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="import('/tools/experience/film-edits.mjs').then(m=>{window.__filmEdits=m;window.__dirEditsDone();},e=>window.__dirEditsFail(e));";w.document.head.append(s);});
    muteStudioEditing();
    const {THREE,TransformControls}=w.__directorThree,group=new THREE.Group();group.name='Director prop tools';group.userData.directorTools=true;t.scene.add(group);
    const box=new THREE.BoxHelper(undefined,0x63d8f5);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=998;box.visible=false;group.add(box);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;gizmo.setSize(1.35);gizmo.setSpace('world');gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    enhanceGizmo(gizmo,{win:w,THREE,mmPerUnit:()=>mmPerUnitOf(w,THREE),status:t=>status(t),setSnap:on=>{snapping=on;syncSnap();}});   // P3: Rhino's Gumball (gumball.mjs)
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){drag={enabled:t.controls.enabled,obj:gizmo.object};t.controls.enabled=false;startDrag();}else{t.controls.enabled=drag?.enabled??true;endDrag();}});
    gizmo.addEventListener('objectChange',()=>{if(drag?.grp){moveGroupLive();status(`${mode==='translate'?'Moving ':'Turning '}${drag.grp.items.length} items together…`+(snapping?' (snapping)':' · Shift snaps'));return;}const o=current();if(o&&sel?.blocked){status(`${CANT_SAVE}: ${sel.blocked} It goes back when you let go.`,true);return;}if(o)status((mode==='translate'?'Moving ':mode==='rotate'?'Rotating ':'Scaling ')+label(o)+'…'+(snapping?' (snapping)':' · Shift snaps'));});
    const raycaster=new THREE.Raycaster(),dom=t.renderer.domElement;let down=null;
    dom.addEventListener('pointerdown',ev=>{down=ev.button===0&&(placing||!gizmo.dragging&&!gizmo.axis)?{x:ev.clientX,y:ev.clientY,alt:ev.altKey}:null;},true);
    dom.addEventListener('pointerup',ev=>{
      const d=down;down=null;if(!d||ev.button!==0||Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>5||gizmo.dragging||w.__directorDragging||lightsShowing()||!editing()||blocked())return;
      const r=dom.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);
      if(placing){const now=current(),e=sel&&editOfKey(sel.key);placing=false;
        if(now&&isAddEdit(e)){const h=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object)&&!isAncestor(now,h.object));if(h)placeAt(now,e,h.point);else{status('Nothing there to put it on.',true);rerender();}return;}}
      const hit=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object));
      // People are not props: a click on one selects them in the People tab (scene-people-editor.mjs).
      if(hit&&!placing&&person(hit.object)){if(sel)deselect();return;}
      const now=current(),o=hit&&(d.alt&&now&&isAncestor(now,hit.object)?meaningful(hit.object,{above:now}):meaningful(hit.object));
      const how=pickMode(ev);
      if(!o){if(sel&&how==='replace'){deselect();status('Nothing to edit there: click a prop (furniture, lamps, desk items). Esc deselects.');}return;}
      pick(o,{how});
    },true);
    // (snapping: hold Ctrl, gumball.mjs; Shift constrains since 17 Nov 2026, it used to snap; Alt+drag copies)
    const altKey=e=>{if(e.key==='Alt')altHeld=e.type==='keydown';};for(const d of [w,w.parent].filter(Boolean)){d.addEventListener('keydown',altKey,true);d.addEventListener('keyup',altKey,true);d.addEventListener('blur',()=>{altHeld=false;});}
    // End: drop the selected prop onto the surface below it (Shift+End: drop flat, Alt+End: align to the surface).
    const endKey=e=>{if(e.key!=='End'||e.ctrlKey||e.metaKey||!sel||!editing()||lightsShowing()||e.target?.closest?.('input,select,textarea,[contenteditable],#director-timeline')||document.querySelector('dialog[open]'))return;
      e.preventDefault();e.stopPropagation();dropSelected(e.altKey?'align':e.shiftKey?'flat':'drop').catch(error=>status(error.message,true));};
    for(const doc of [document,w.document])doc.addEventListener('keydown',endKey,true);
    w.__directorPropsRestore=()=>{for(const [o,s] of snaps){o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);}snaps.clear();};
    const pivot=new THREE.Object3D();pivot.name='Director group pivot';pivot.userData.directorTools=true;group.add(pivot);
    const boxes=[box],fbox=new THREE.BoxHelper(undefined,0xffd166);fbox.material.depthTest=false;fbox.material.transparent=true;fbox.renderOrder=999;fbox.visible=false;group.add(fbox);
    tools={THREE,group,box,boxes,fbox,pivot,gizmo,t};syncSnap();requestAnimationFrame(tick);return tools;
  }
  const isAncestor=(a,o)=>{for(let p=o;p;p=p.parent)if(p===a)return true;return false;};
  const ensure=()=>booting||=boot().then(t=>{learn();rerender();return t;},error=>{booting=null;throw error;});
  function syncSnap(){if(!tools)return;const g=tools.gizmo;g.setTranslationSnap(snapping?.05:null);g.setRotationSnap(snapping?tools.THREE.MathUtils.degToRad(15):null);g.setScaleSnap(snapping?.1:null);}
  // Highlight boxes (one per selected item), the group pivot (centre of the movable ones) and the gizmo.
  function syncBoxes(objs){
    const {THREE,group:g,boxes}=tools;
    while(boxes.length<objs.length){const b=new THREE.BoxHelper(undefined,0x63d8f5);b.material.depthTest=false;b.material.transparent=true;b.renderOrder=998;g.add(b);boxes.push(b);}
    boxes.forEach((b,i)=>{const o=objs[i];if(o){b.setFromObject(o);b.visible=true;b.material.opacity=shown(o)?1:.45;}else b.visible=false;});
  }
  function recentre(movable){
    const {THREE,pivot}=tools;if(!pivotDirty&&performance.now()-pivotAt<400)return;pivotDirty=false;pivotAt=performance.now();
    const box=new THREE.Box3();for(const o of movable)box.union(new THREE.Box3().setFromObject(o));
    if(box.isEmpty())return;box.getCenter(pivot.position);pivot.quaternion.identity();pivot.scale.set(1,1,1);pivot.updateMatrixWorld(true);
  }
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;muteStudioEditing();const {gizmo,fbox,pivot,t}=tools,live=editing();
    const ms=live?members():[],objs=ms.map(objOf),o=live?current():null;
    syncBoxes(live?objs.map(x=>x||null).filter(Boolean):[]);
    if(live&&flash&&flash.until>performance.now()&&inScene(flash.obj)){fbox.setFromObject(flash.obj);fbox.visible=true;fbox.material.opacity=.45+.55*Math.abs(Math.sin((flash.until-performance.now())/130));bridge.stage()?.wake?.(100);}else{fbox.visible=false;flash=null;}
    if(live&&group()&&mode==='scale')mode='translate';
    const movable=ms.map((m,i)=>m.blocked?null:objs[i]).filter(x=>x&&shown(x));
    if(live&&group()&&movable.length&&!placing){
      if(!gizmo.dragging){recentre(movable);}
      if(gizmo.object!==pivot)gizmo.attach(pivot);gizmo.setMode(mode);gizmo.setSpace('world');gizmo.visible=gizmo.enabled=true;
    }
    else if(o&&shown(o)&&!placing&&!group()){if(gizmo.object!==o)gizmo.attach(o);gizmo.setMode(mode);gizmo.setSpace(mode==='scale'?'local':'world');gizmo.visible=gizmo.enabled=true;}
    else if(!gizmo.dragging){if(gizmo.object)gizmo.detach();gizmo.visible=gizmo.enabled=false;}
    if(gizmo.dragging)bridge.stage()?.wake?.(300);
  }
  // ---- moving several at once: the gizmo drags the pivot; every item gets the pivot's change (world matrix delta)
  function beginGroup(){
    const {pivot}=tools;pivot.updateMatrixWorld(true);
    const items=members().map(m=>({m,o:objOf(m)})).filter(x=>x.o&&!x.m.blocked).map(({m,o})=>{if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});o.updateWorldMatrix(true,false);return {m,o,b:base(o),m0:o.matrixWorld.clone()};});
    return {p0:pivot.matrixWorld.clone(),items};
  }
  function applyDelta(g,D){
    const {THREE}=tools;
    for(const it of g.items){const p=it.o.parent;p?.updateWorldMatrix(true,false);const inv=p?p.matrixWorld.clone().invert():new THREE.Matrix4();inv.multiply(D.clone().multiply(it.m0)).decompose(it.o.position,it.o.quaternion,it.o.scale);it.o.updateMatrixWorld(true);}
    bridge.stage()?.wake?.(300);
  }
  function moveGroupLive(){const g=drag.grp,{pivot}=tools;pivot.updateMatrixWorld(true);applyDelta(g,pivot.matrixWorld.clone().multiply(g.p0.clone().invert()));}
  function endGroup(g,text){
    const changes=[];let skipped=members().length-g.items.length;
    for(const it of g.items){
      try{const e=editOfKey(it.m.key);let next;
        if(isAddEdit(e))next=addFrom(it.o,e);else next={...it.m.target,...(e||{}),...editFrom(it.o,it.b)};
        if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null))continue;changes.push({key:it.m.key,next});}
      catch(error){skipped++;console.warn('[props] group',error.message);}
    }
    if(!changes.length){status('Nothing moved.');rerender();return;}
    writeMany(changes,`${text} ${changes.length} items together${skipped?` (${skipped} could not be saved and stayed put)`:''}. One Undo puts them all back.`);
  }
  // Typed moves (inches / degrees, relative) on the group panel: the same path as a drag.
  function groupChanged(el){
    const name=el.name,v=Number(el.value);
    if(name==='pp-hide'){hide(el.checked);return;}
    if(el.value===''||!Number.isFinite(v))throw Error('Enter a number.');
    const {THREE,pivot}=tools,mm=win().__filmEdits.mmScale(),movable=members().map(objOf).filter(Boolean);pivotDirty=true;recentre(movable);
    let D,text;
    if(/^pp-gm[xyz]$/.test(name)){if(Math.abs(v)>1000)throw Error('Moves run up to 1000 inches.');const d=[0,0,0];d['xyz'.indexOf(name[5])]=v*25.4*mm;D=new THREE.Matrix4().makeTranslation(...d);text='Moved';}
    else if(name==='pp-gry'){D=groupCentreDelta(THREE,pivot.position,THREE.MathUtils.degToRad(wrapDeg(v)));text='Turned';}
    else return;
    const g=beginGroup();applyDelta(g,D);endGroup(g,text);
  }
    function startDrag(){const o=drag?.obj;if(!o)return;drag.copy=altHeld&&!group()?structuredClone(editOfKey(sel?.key)):null;if(o===tools.pivot){drag.grp=beginGroup();return;}if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});drag.base=base(o);}
  function endDrag(){
    if(drag?.grp){const g=drag.grp;drag=null;pivotDirty=true;endGroup(g,mode==='translate'?'Moved':'Turned');return;}
    const o=drag?.obj,b=drag?.base,was=drag?.copy;drag=null;if(!o||!b||!sel)return;
    // P3 Alt+drag (Rhino / Blender): a prop you added leaves a copy where it was; you moved the original
    if(was&&isAddEdit(was)){try{const e=editOfKey(sel.key)||was;write(sel.key,addFrom(o,e),`${VERB[mode]} ${label(o)}.`);const copy=cleanAddEdit({...was,id:newAddId()});if(copy)write(propKey(copy),copy,`Copied ${label(o)}: the copy stays where it was. Undo takes the copy away.`);}catch(error){status(error.message,true);}return;}
    if(was&&!isAddEdit(was))status('Alt+drag copies the props you added; a room prop moves as usual (+ Prop adds another).');
    if(sel.blocked){const s=snaps.get(o);if(s){o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);bridge.stage()?.wake?.(300);}status(`${CANT_SAVE}: ${sel.blocked} It is back where the film puts it.`,true);return;}
    try{const e=editOfKey(sel.key)||sel.target;
      if(isAddEdit(e)){write(sel.key,addFrom(o,e),`${VERB[mode]} ${label(o)}.`);return;}
      if(isFollow(e)){write(sel.key,{...e,place:placeFrom(o)},`${VERB[mode]} ${label(o)} (it travels with ${FOLLOW_LABELS[e.follow].replace(/ \(.*\)$/,'').toLowerCase()}).`);return;}
      const next={...sel.target,...(e||{}),...editFrom(o,b)};
      if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null)){status(label(o)+' did not move.');return;}
      write(sel.key,next,`${VERB[mode]} ${label(o)}. Undo puts it back; Render still shows the film look.`);}
    catch(error){status(error.message,true);}
  }
  // ---- selection
  // how: 'replace' (click), 'add' (Shift+click), 'toggle' (Ctrl/Cmd+click).
  // Box select (the 3D view's left-drag, view-nav.mjs): every prop whose screen box is inside `rect` (or, `touch`, that
  // the box touches), rect in the stage page's client pixels. how: replace | add | toggle (pickMode). Returns the count.
  function boxPick(rect,{touch=false,how='replace'}={}){
    const t=three();if(!t||!tools||!editing()||lightsShowing()||blocked())return 0;
    const {THREE}=tools,r=t.renderer.domElement.getBoundingClientRect(),seen=new Set(),found=[],box=new THREE.Box3(),v=new THREE.Vector3();
    t.scene.traverse(m=>{
      if(!m.isMesh||!shown(m)||isOurs(m)||person(m))return;const o=meaningful(m);if(!o||seen.has(o))return;seen.add(o);
      box.setFromObject(o);if(box.isEmpty())return;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(let i=0;i<8;i++){v.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(t.camera);if(v.z>1||v.z<-1)return;
        const px=r.left+(v.x+1)/2*r.width,py=r.top+(1-v.y)/2*r.height;x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);}
      const inside=x0>=rect.left&&x1<=rect.right&&y0>=rect.top&&y1<=rect.bottom,touches=x1>=rect.left&&x0<=rect.right&&y1>=rect.top&&y0<=rect.bottom;
      if(touch?touches:inside)found.push(o);
    });
    if(!found.length){if(how==='replace'&&sel)deselect();return 0;}
    found.forEach((o,i)=>pick(o,{how:i===0?how:how==='toggle'?'toggle':'add'}));
    status(`${found.length} prop${found.length===1?'':'s'} ${how==='toggle'?'toggled':'selected'} by the box. W move · E rotate · Delete hides.`);
    return found.length;
  }
  function pick(o,{how='replace'}={}){
    let target;try{target=targetOf(o);}catch(error){if(how==='replace'){sel=null;others=[];onSelect();rerender();}status(`${CANT_SAVE}: ${error.message}`,true);return;}
    const t=propTarget({...target,label:target.label||o.name||''});
    const key=propKey(t);
    if(lockedKeys().has(key)){status(`${label(o)} is locked in a layer: unlock the layer in Layers to pick it in the view.`,true);return;}
    const blocked=isAddEdit(filmEdit(o))?'':unrecordable(o,t),entry={key,target:t,obj:o,blocked};
    if(how==='replace')setMembers([entry]);
    else if(how==='toggle'&&isSel(key)){setMembers(members().filter(m=>m.key!==key));status(`${label(o)} removed from the selection (${members().length} selected).`);return;}
    else setMembers([...members().filter(m=>m.key!==key),entry]);
    if(group()){status(`${members().length} selected (${members().map(m=>nice(m.target.label)).slice(0,4).join(', ')}${members().length>4?'…':''}) · they move together · Shift+click adds, Ctrl+click adds or removes, click empty space clears.`);return;}
    if(blocked){status(`${CANT_SAVE}: ${blocked} Moving ${label(o)} here won't be kept.`,true);return;}
    const moves=handMoves(o).length?' The film also places it by hand; your edit adds to that.':'';
    const added=isAddEdit(filmEdit(o));
    status(`${label(o)} selected · W move · E rotate · R scale · Shift snaps · ${added?'Delete removes it (added in this chapter)':'Delete hides it in this chapter'} · Alt-click picks what it sits on · Shift+click adds more.${moves}`);
  }
  // The selection, last entry = the one the single-prop inspector shows.
  function setMembers(list){
    sel=list.at(-1)||null;others=list.slice(0,-1);pivotDirty=true;if(group()&&mode==='scale')mode='translate';onSelect();rerender();
  }
  function select(key,{how='replace'}={}){
    if(!tools){ensure().then(()=>select(key,{how})).catch(error=>status(error.message,true));return;}
    const e=editOfKey(key),o=find(key);if(!e&&!o)return;
    if(roomDesk({obj:o,edit:e||items().find(i=>i.key===key)?.target||null,key}))return;   // S32 hook (A): a room desk is the Desks tab's (director.mjs openRoomDeskFromProps)
    const entry={key,target:e?propTarget(e):items().find(i=>i.key===key)?.target||sel?.target,obj:o};
    if(how==='toggle'&&isSel(key))setMembers(members().filter(m=>m.key!==key));
    else setMembers(how==='replace'?[entry]:[...members().filter(m=>m.key!==key),entry]);
    status(o?`${label(o)} selected${o&&!shown(o)?' (hidden in this chapter: untick Hide to bring it back)':''}.`:`${e?.label?nice(e.label):'That prop'} is not in the room right now (the film setup did not find it).`,!o);
  }
  function deselect(){placing=false;if(!sel)return;sel=null;others=[];rerender();}
  // ---- edits from the inspector and keys
  function apply(change,text){
    const o=current();if(!sel)return;const e=editOfKey(sel.key)||{},next={...sel.target,...e,...change};
    for(const k of Object.keys(change))if(change[k]===undefined)delete next[k];
    write(sel.key,next,text);
  }
  function hide(on=true){
    if(group()){hideItems(members(),on);return true;}
    const o=current();if(!sel)return false;if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return true;}
    if(isAddEdit(editOfKey(sel.key))){remove();return true;}const name=o?label(o):nice(sel.target.label),filmHides=o&&(o.userData.__filmFxEdits||[]).some(e=>!e.director&&e.hide);
    apply({hide:on?true:filmHides?false:undefined},on?`Hid ${name} in this chapter. Undo, or untick Hide in Props, brings it back.`:`Showed ${name} again.`);return true;
  }
  // Hide / show several (the selection, or a layer's items [{key, target}]) as ordinary per-chapter hide edits: one undo step.
  function hideItems(list,on,also=null){
    const changes=[];let skipped=0;
    for(const m of list){
      if(m.blocked){skipped++;continue;}
      const e=editOfKey(m.key),o=m.obj&&inScene(m.obj)?m.obj:find(m.key,m.target),target=m.target||items().find(i=>i.key===m.key)?.target;
      if(!target&&!e){skipped++;continue;}
      if(isAddEdit(e)){if(on)changes.push({key:m.key,next:null});continue;}
      const filmHides=o&&(o.userData.__filmFxEdits||[]).some(x=>!x.director&&x.hide);
      changes.push({key:m.key,next:{...(target||{}),...(e||{}),hide:on?true:filmHides?false:undefined}});
    }
    for(const c of changes)if(c.next&&c.next.hide===undefined)delete c.next.hide;
    if(!changes.length){if(also)commit(also,{key:null,render:false});status(skipped?`${CANT_SAVE}: ${skipped} of them can't be kept in the film.`:'Nothing to change.',!!skipped);return;}
    writeMany(changes,`${on?'Hid':'Showed'} ${changes.length} item${changes.length===1?'':'s'} in this chapter${skipped?` (${skipped} can't be kept in the film)`:''}. One Undo brings ${on?'them back':'the change back'}.`,also);
  }
  // An added prop: Delete, Reset to the film and Remove all take it out of the chapter (Undo brings it back).
  function remove(){if(!sel)return;const e=editOfKey(sel.key);if(!isAddEdit(e))return;const name=e.label||nice(e.match);write(sel.key,null,`Removed ${name} (added in this chapter). Undo brings it back.`);sel=null;others=[];rerender();}
  function reset(){if(!sel)return;if(group()){const list=members().filter(m=>editOfKey(m.key));if(!list.length){status('They are already where the film puts them.');return;}writeMany(list.map(m=>({key:m.key,next:null})),`${list.length} items back to the film. One Undo brings them back.`);return;}if(isAddEdit(editOfKey(sel.key))){remove();return;}const name=sel.target.label?nice(sel.target.label):'The prop';if(!editOfKey(sel.key)){status(name+' is already where the film puts it.');return;}write(sel.key,null,`${name} back to the film.`);}
  function resetAll(){const n=editedCount();if(!n){status('No prop edits in this chapter: the props are the film\'s.');return;}const a=edits().filter(isAddEdit).length;commit(()=>{shot().propEdits=[];},{render:false});if(sel&&a)sel=null;status(`All props back to the film (${n} edit${n===1?'':'s'} cleared${a?`, ${a} added prop${a===1?'':'s'} removed`:''}). Undo brings them back.`);rerender();}
  async function changed(el){
    await ensure();if(group()){groupChanged(el);return;}
    if(sel&&el.name==='pp-t-curve'){setCurve(el.value);return;}
    if(sel&&/^pp-t-/.test(el.name)){changedTiming(el.name,el.value===''?NaN:Number(el.value));return;}
    const o=current();if(!sel||!o)return;const name=el.name,v=Number(el.value);
    if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);rerender();return;}
    if(name==='pp-hide'){hide(el.checked);return;}
    if(name==='pp-follow'||name==='pp-follow-shelf'){setFollow(el.value).catch(error=>{status('Travels with not set: '+error.message,true);rerender();});return;}
    if(el.value===''||!Number.isFinite(v))throw Error('Enter a number.');
    const added=editOfKey(sel.key);if(isAddEdit(added)){changedAdd(o,added,name,v);return;}
    if(isFollow(added)){changedFollow(o,added,name,v);return;}
    const b=base(o),{THREE}=tools,st=installed(o),world=st.position.clone();if(o.parent){o.parent.updateMatrixWorld(true);o.parent.localToWorld(world);}
    const e=editOfKey(sel.key)||{},rotNow=new THREE.Euler(b.rot.x,b.rot.y,b.rot.z,b.rot.order),turn=(e.rotation||[0,0,0]).slice(),fac=(e.scale||[1,1,1]).slice();
    let verb='Moved';
    if(/^pp-p[xyz]$/.test(name)){if(Math.abs(v)>1000)throw Error('Positions run from -1000 to 1000 m.');world.setComponent('xyz'.indexOf(name[4]),v/metresPerUnit());}
    else if(/^pp-r[xyz]$/.test(name)){turn['xyz'.indexOf(name[4])]=wrapDeg(v);verb='Rotated';}
    else if(name==='pp-s'){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');fac[0]=fac[1]=fac[2]=v;verb='Scaled';}
    else if(/^pp-s[xyz]$/.test(name)){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');fac['xyz'.indexOf(name[4])]=v;verb='Scaled';}
    else return;
    rotNow.x+=THREE.MathUtils.degToRad(turn[0]);rotNow.y+=THREE.MathUtils.degToRad(turn[1]);rotNow.z+=THREE.MathUtils.degToRad(turn[2]);
    const next={...sel.target,...e,...editFrom(o,b,{world,rot:rotNow,scale:b.scale.clone().multiply(new THREE.Vector3(...fac))})};
    write(sel.key,next,`${verb} ${label(o)}.`);
  }
  // ---- the chapter's editable things, for the Layers tab: [{key, target, obj, name, desk, hidden}]
  function items(){
    if(!tools||!three()?.scene)return [];if(itemsCache&&performance.now()-itemsAt<1500)return itemsCache;
    const seen=new Set(),out=[];
    sceneOf().traverse(x=>{if(!x.isMesh||isOurs(x))return;const o=meaningful(x);if(!o||seen.has(o))return;seen.add(o);
      try{const t=targetOf(o),key=propKey(t);
        // Two objects under one key (create: the desk's accessories are in the scene twice, a copy under the always
        // hidden "Accessory mount:desktop" and the drawn one under "Desk dressing:desktop", and the film's opacity edit
        // names them by name alone): the drawn one stands for the key, so the drafting kit and easel rail get their bars.
        const item={key,target:propTarget({...t,label:t.label||o.name||''}),obj:o,name:label(o),desk:onDeskItself(o)||ridesDesk(o),hidden:!shown(o)||editOfKey(key)?.hide===true,area:areaOf(o)};
        const had=out.findIndex(i=>i.key===key);if(had>=0){if(!shown(out[had].obj)&&shown(o))out[had]=item;return;}
        out.push(item);}catch{}
    });
    itemsAt=performance.now();return itemsCache=out;
  }
  // Room area: the nearest named group the prop sits in below the room's root ('' when it sits straight in the room).
  function areaOf(o){const root=win()?.ErgoFlex?.workspaceRoom?.root;let name='';for(let p=o.parent;p&&p!==root&&p!==sceneOf();p=p.parent){if(p.userData?.dayKit||/^(Scene dressing|Accessory mount|Desk dressing|Accessory):/.test(p.name))return '';if(p.name&&!/^(Group|Object3D|Scene)$/i.test(p.name)&&!/^Prop:|^Studio/.test(p.name))name=p.name;}return name;}
  // Select by keys (the Layers list): how replace | add | toggle. Items the film can't keep are still selected (and say so).
  async function selectKeys(keys,how='replace'){
    await ensure();const list=items(),entries=[];
    for(const k of keys){const i=list.find(x=>x.key===k);if(!i)continue;entries.push({key:k,target:i.target,obj:i.obj,blocked:isAddEdit(filmEdit(i.obj))?'':unrecordable(i.obj,i.target)});}
    if(!entries.length){if(how==='replace')setMembers([]);return 0;}
    let next;if(how==='replace')next=entries;else if(how==='toggle'){const rm=new Set(entries.map(e=>e.key).filter(isSel));next=[...members().filter(m=>!rm.has(m.key)),...entries.filter(e=>!rm.has(e.key))];}else next=[...members().filter(m=>!entries.some(e=>e.key===m.key)),...entries];
    setMembers(next);
    status(next.length>1?`${next.length} selected · they move together (W move · E rotate).`:`${label(next[0].obj)} selected · W move · E rotate · R scale · Delete hides it.`);return entries.length;
  }
  // "Shows where it is": a pulsing outline on the stage for ~1.5 s.
  function flashKey(key){const o=items().find(i=>i.key===key)?.obj;if(o)flash={obj:o,until:performance.now()+1500};}
  // ---- Drop to surface (drop-to-surface.mjs): the prop straight down onto what is below it.
  const surfaceName=obj=>{const m=meaningful(obj);if(m)return label(m);for(let p=obj;p;p=p.parent){const n=p.name&&!/^(Mesh|Object3D|Group|Scene|Cube|Plane)[\d._]*$/i.test(p.name)?p.name:'';if(n)return /^Room:/.test(n)?'the room':nice(n.replace(/^(Prop|Accessory|Desk dressing|Scene dressing):\s*/,''));}return 'the surface';};
  // One object: moves (and for flat / align turns) it live and says what happened; nothing is written. A caller with
  // several objects drops each, then writes each with writeLive. Returns {ok,reason} or {ok,o,base,distance,surface,text}.
  function dropObject(o,dropMode='drop'){
    if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});
    const b=base(o),was={p:o.position.clone(),q:o.quaternion.clone()},r=dropToSurface({THREE:tools.THREE,scene:sceneOf(),obj:o,mode:dropMode,mm:.001,skip:isOurs});
    if(!r.ok)return r;
    const inches=r.distance/.0254,abs=Math.abs(inches),surface=surfaceName(r.surface);
    const text=abs<.02?`${label(o)} already rests on ${surface}${r.rotated?' (now '+(dropMode==='align'?'aligned to it':'upright')+')':''}.`
      :`${inches>0?'Dropped':'Raised'} ${abs.toFixed(1)}\u2033 onto ${surface}${r.rotated?(dropMode==='align'?', aligned to it':', upright')+'':''}.`;
    const rests=abs<.02&&!r.rotated;if(rests){o.position.copy(was.p);o.quaternion.copy(was.q);o.updateMatrixWorld(true);}   // already on it: no edit
    return {...r,o,base:b,text,rests};
  }
  // The edit for an object moved live (a gizmo drag's end, or a drop), written as one undo step.
  function writeLive(o,b,text){
    const e=editOfKey(sel.key)||sel.target;
    if(isAddEdit(e)){write(sel.key,addFrom(o,e),text);return true;}
    if(isFollow(e)){write(sel.key,{...e,place:placeFrom(o)},text);return true;}
    const next={...sel.target,...(e||{}),...editFrom(o,b)};
    if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null)){status(text);return false;}
    write(sel.key,next,text);return true;
  }
  async function dropSelected(dropMode='drop'){
    await ensure();
    if(!sel){status('Select a prop first, then drop it onto the surface below.',true);return;}
    if(!editing()){status('Pause the chapter first: props are moved on the paused frame.',true);return;}
    if(group()){dropGroup(dropMode);return;}
    const o=current();if(!o){status('That prop is not in the room right now.',true);return;}
    if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return;}
    if(!shown(o)){status(`${label(o)} is hidden in this chapter: untick Hide first.`,true);return;}
    const had=snaps.has(o),r=dropObject(o,dropMode);
    if(!r.ok){if(!had)snaps.delete(o);status(r.reason,true);rerender();return;}
    if(r.rests){if(!had)snaps.delete(o);status(r.text);return;}
    try{writeLive(o,r.base,r.text);}catch(error){status(error.message,true);}
  }
  // Several selected: each drops straight down on its own (lowest first, so a stack settles from the bottom up),
  // all written as one undo step. Items that can't be saved, are hidden, already rest or have nothing below stay put.
  function dropGroup(dropMode){
    const dropped=[],rested=[],stuck=[],skipped=[];
    const list=members().map(m=>({m,o:objOf(m)})).sort((a,b)=>(a.o?a.o.getWorldPosition(new tools.THREE.Vector3()).y:0)-(b.o?b.o.getWorldPosition(new tools.THREE.Vector3()).y:0));
    for(const {m,o} of list){
      if(!o||m.blocked||!shown(o)){skipped.push(m);continue;}
      const had=snaps.has(o),r=dropObject(o,dropMode);
      if(!r.ok){if(!had)snaps.delete(o);stuck.push(r.reason);continue;}
      if(r.rests){if(!had)snaps.delete(o);rested.push(m);continue;}
      dropped.push({m,o,b:r.base});
    }
    const changes=[];
    for(const it of dropped){
      try{const e=editOfKey(it.m.key);const next=isAddEdit(e)?addFrom(it.o,e):{...it.m.target,...(e||{}),...editFrom(it.o,it.b)};
        if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null))continue;changes.push({key:it.m.key,next});}
      catch(error){skipped.push(it.m);console.warn('[props] group drop',error.message);}
    }
    const notes=[rested.length?`${rested.length} already rested`:'',stuck.length?`${stuck.length} had nothing below`:'',skipped.length?`${skipped.length} could not be moved`:''].filter(Boolean).join(', ');
    if(!changes.length){status(stuck[0]||(rested.length?'They already rest on the surface below.':'Nothing to drop.')+(skipped.length?` (${skipped.length} could not be moved)`:''),!!stuck.length);rerender();return;}
    writeMany(changes,`Dropped ${changes.length} items onto the surface below${notes?` (${notes})`:''}. One Undo puts them all back.`);
  }
  // ---- Make permanent in Studio: Studio's own room state through the studio server, never the file.
  function studioRoom(){
    const api=win()?.ErgoFlex;if(!api?.sceneAssetStates)return {reason:'The stage is still loading.'};
    const id=studioSceneIds(shot()).find(k=>api.sceneAssetStates.has(k));
    if(!id||!api.sceneAssetRegistry?.size)return {reason:'This room is built by the app, not a saved Studio layout.'};
    return {id,api};
  }
  // [{edit, key, name, change, obj, editorId, ok, why, transform | remove}]
  function plan(){
    const room=studioRoom(),{THREE}=tools||{};
    return edits().map((e,i)=>{
      const key=propKey(e),o=tools&&find(key),raw=e.label||o?.name||'',name=isAddEdit(e)?(e.label||nice(e.add.asset)):nice(raw),row={edit:e,key,name,raw,change:describePropEdit(e,{mpu:metresPerUnit()}),obj:o};
      if(isAddEdit(e))return addPlan(row,e,o,room,i);
      if(isFollow(e))return {...row,ok:false,why:'it travels with a surface of the desk in this chapter (Travels with is a Director setting)'};
      if(o&&onDeskItself(o))return {...row,ok:false,why:ON_DESK};
      if(room.reason)return {...row,ok:false,why:room.reason};
      if(!o)return {...row,ok:false,why:'Not in the room right now: the film setup did not find it.'};
      if(/^Accessory:/.test(o.name)||!o.userData.sceneAssetKey)return {...row,ok:false,why:/^Accessory:/.test(o.name)?'A desk accessory: it belongs to the desk build, not the room\'s Studio layout.':'Built by the app with the room, not a saved Studio item, so Studio can\'t keep a change to it.'};
      const editorId='scene:'+o.userData.sceneAssetKey;
      if(!room.api.sceneAssetRegistry.has(editorId))return {...row,ok:false,why:'Studio does not list this prop in this room\'s layout.'};
      if(handMoves(o).length&&(e.position||e.rotation||e.scale))return {...row,ok:false,why:'The film\'s own setup also moves this prop in this chapter, so Studio and the film would disagree. Keep it as a chapter edit.'};
      // Layers on: a chapter hide becomes a Studio hide at this chapter's time and size (the layers key), not a delete
      // from every chapter of the room; the chapter keeps its own hide edit (the film never reads the Studio's hides).
      if(e.hide===true)return {...row,ok:true,editorId,remove:true,change:row.change+(layersOn()?' → hidden in Studio (its time and size: below)':' → removed from the room in Studio')};
      if(!(e.position||e.rotation||e.scale))return {...row,ok:false,why:'Only shown in this chapter: Studio already shows it.'};
      if(snaps.has(o))return {...row,ok:false,why:'Finish the drag first.'};
      // Studio keeps the local transform under its parent without the room's daily staging (room-life.mjs).
      o.updateWorldMatrix(true,false);o.parent.updateWorldMatrix(true,false);
      const M=new THREE.Matrix4().copy(o.parent.matrixWorld).invert().multiply(o.matrixWorld),delta=o.userData.dailyDelta;if(delta)M.premultiply(new THREE.Matrix4().fromArray(delta).invert());
      const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();M.decompose(p,q,s);
      return {...row,ok:true,editorId,transform:{p:{x:p.x,y:p.y,z:p.z},q:{x:q.x,y:q.y,z:q.z,w:q.w},s:{x:s.x,y:s.y,z:s.z}},local:{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()},sceneId:room.id};
    });
  }
  // An added prop becomes a new Studio item in the room (as Studio's own library Add makes one); not on the desk.
  function addPlan(row,e,o,room,i){
    if(onDesk(e.parent))return {...row,ok:false,why:'Added on the desk: it travels with the desk, so Studio\'s room layout can\'t hold it. Keep it as a chapter edit.'};
    if(room.reason)return {...row,ok:false,why:room.reason};
    if(!o)return {...row,ok:false,why:'Not on the stage right now (still loading).'};
    if(o.parent!==room.api.workspaceRoom?.root)return {...row,ok:false,why:'Not in this room\'s Studio layout (the stage has no room here).'};
    if(snaps.has(o))return {...row,ok:false,why:'Finish the drag first.'};
    const key=`${shot().room}:custom:${Date.now()}-${i}:${e.add.asset}`,t={p:{x:o.position.x,y:o.position.y,z:o.position.z},q:{x:o.quaternion.x,y:o.quaternion.y,z:o.quaternion.z,w:o.quaternion.w},s:{x:o.scale.x,y:o.scale.y,z:o.scale.z}};
    return {...row,ok:true,editorId:'scene:'+key,studioKey:key,add:{propId:e.add.asset,position:[t.p.x,t.p.y,t.p.z]},transform:t,local:{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()},sceneId:room.id,change:row.change+' → a new item in the room in Studio'};
  }
  function permanentState(){
    const room=tools?studioRoom():{reason:'The Props tools are still starting.'};if(room.reason)return {ok:false,why:room.reason};
    if(!editedCount())return {ok:false,why:'No prop edits in this chapter yet.'};
    const rows=plan(),n=rows.filter(r=>r.ok).length;return n?{ok:true,n,rows}:{ok:false,why:rows[0]?.why||'Nothing to write.',rows};
  }
  const dialog=document.createElement('dialog');dialog.id='prop-permanent';dialog.setAttribute('aria-labelledby','prop-permanent-title');document.body.append(dialog);
  function openPermanent(){
    const st=permanentState();if(!st.rows&&!st.ok){status(st.why,true);return;}
    const room=studioRoom();dialogPlan=st.rows;
    dialog.innerHTML=`<div class="director-heading"><div><span class="director-kicker">MAKE PERMANENT IN STUDIO</span><h2 id="prop-permanent-title">Write these props to Studio?</h2></div></div>
      <p>Studio's <b>${escape(room.id||'')}</b> room keeps exactly these changes, for Studio and for every chapter in that room. This chapter's edits for them are then folded in (Studio holds them). Nothing else in Studio changes.</p>
      <ul class="prop-permanent-list">${st.rows.map((r,i)=>`<li class="${r.ok?'':'blocked'}"><label class="director-check"><input type="checkbox" data-permanent="${i}" ${r.ok?'checked':'disabled'}><span><b title="${escape(r.raw)}">${escape(r.name)}</b> · ${escape(r.change)}${r.ok?'':`<small>${escape(r.why)}</small>`}</span></label></li>`).join('')}</ul>
      ${layersOn()&&st.rows.some(r=>r.ok&&r.remove)?`<label class="director-check">Studio hides them <select data-permanent-cell>${permanentCells(shot()).map((c,i)=>`<option value="${escape(c.cell)}" ${i?'':'selected'}>${escape(c.label)}</option>`).join('')}</select></label><p class="director-hint">This chapter keeps its own hide: the film never reads Studio's hides.</p>`:''}
      <div class="director-actions"><button data-permanent-go class="primary" ${st.ok?'':'disabled'}>Write ${st.n||0} prop${st.n===1?'':'s'} to Studio</button><button data-permanent-cancel>Cancel</button></div><p class="director-hint" data-permanent-status role="status"></p>`;
    dialog.showModal();dialog.querySelector('[data-permanent-cancel]').focus();
  }
  dialog.addEventListener('change',()=>{const n=dialog.querySelectorAll('[data-permanent]:checked').length,b=dialog.querySelector('[data-permanent-go]');if(b){b.disabled=!n;b.textContent=`Write ${n} prop${n===1?'':'s'} to Studio`;}});
  dialog.addEventListener('click',async event=>{
    if(event.target.closest('[data-permanent-cancel]')){dialog.close();return;}
    const go=event.target.closest('[data-permanent-go]');if(!go)return;
    const rows=[...dialog.querySelectorAll('[data-permanent]:checked')].map(el=>dialogPlan[Number(el.dataset.permanent)]).filter(r=>r?.ok);if(!rows.length)return;
    go.disabled=true;const say=t=>{const el=dialog.querySelector('[data-permanent-status]');if(el)el.textContent=t;};say('Writing to Studio…');
    try{await makePermanent(rows,dialog.querySelector('[data-permanent-cell]')?.value||null);dialog.close();}catch(error){say(error.message);go.disabled=false;status(error.message,true);}
  });
  async function makePermanent(all,cell=null){
    const sceneId=all[0].sceneId||studioRoom().id,api=studioRoom().api,sync=window.__studioState,mem=api.sceneAssetStates.get(sceneId);
    // Layers on: stock props hidden in this chapter go to the layers key at `cell` (Studio-added ones are still taken out);
    // off: everything as before (sceneAssets: removed / added / transforms).
    const split=layersOn()?splitPermanent(all,new Set(mem?.added?.keys?.()||[])):{layers:[],assets:all},rows=split.assets;
    const got=await fetch('/api/studio-state',{cache:'no-store'});if(!got.ok)throw Error(`Studio's state is unavailable (${got.status}).`);
    const values=(await got.json()).values||{},changes=[];
    if(rows.length){const base=values[STATE_KEY]??null;changes.push({key:STATE_KEY,base,value:writeSceneAssets(base,sceneId,rows.map(r=>({editorId:r.editorId,...(r.add?{add:r.add,transform:r.transform}:r.remove?{remove:true}:{transform:r.transform})})))});}
    // a room desk this chapter hides: its chair / prop hides fold back into ONE desk entry (the Studio derives them)
    if(split.layers.length){const base=values[LAYERS_KEY]??null,layerRows=foldDeskHides(split.layers,shot()?.deskEdits||[]);changes.push({key:LAYERS_KEY,base,value:writePermanentLayers(base,sceneId,layerRows,cell||permanentCells(shot())[0].cell,{t:Date.now()})});}
    const posted=await fetch('/api/studio-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client:sync?.client||'director-'+Math.random().toString(36).slice(2,10),by:'Director',changes})});
    if(!posted.ok)throw Error(`Studio did not take the change (${posted.status}).`);const results=(await posted.json()).results||[];
    if(results.length!==changes.length||results.some(x=>!x||x.skipped||x.error))throw Error('Studio did not take the change: '+(results.find(x=>x?.skipped||x?.error)?.skipped||results.find(x=>x?.error)?.error||'no answer'));
    // This page's copy of the shared state (no second write: the sync script sees it as its own base) and the stage's memory.
    // The layers key is never handed to the stage: the film does not read it.
    try{const now=(await (await fetch('/api/studio-state',{cache:'no-store'})).json()).values||{};
      if(rows.length&&now[STATE_KEY]){const stored=now[STATE_KEY];sync?.base?.set(STATE_KEY,stored);localStorage.setItem(STATE_KEY,stored);bridge.stageStorage?.(STATE_KEY,stored);noteStudioValue(STATE_KEY,stored);}
      if(split.layers.length&&now[LAYERS_KEY]){const stored=now[LAYERS_KEY];sync?.base?.set(LAYERS_KEY,stored);localStorage.setItem(LAYERS_KEY,stored);noteStudioValue(LAYERS_KEY,stored);}}catch{}
    for(const r of rows){if(!mem)break;if(r.add){mem.added?.set?.(r.editorId,{editorId:r.editorId,propId:r.add.propId,position:r.add.position});mem.transforms.set(r.editorId,r.transform);continue;}if(r.remove){const a=mem.added;if(a?.has?.(r.editorId)){a.delete(r.editorId);mem.transforms.delete(r.editorId);}else mem.removed.add(r.editorId);}else mem.transforms.set(r.editorId,r.transform);}
    // The props keep their place on the stage once the chapter's edits are folded in (film-fx re-installs without them).
    // (only what sceneAssets now holds is folded: a hide written to the layers key stays this chapter's own edit)
    const keys=new Set(rows.map(r=>r.key));pending=rows.length?{rows,keys}:null;if(rows.length)fold(keys);
    if(group())setMembers(members().filter(m=>!keys.has(m.key)));else if(sel&&keys.has(sel.key))sel=null;
    status(`Made ${all.length} prop${all.length===1?'':'s'} permanent in Studio (${sceneId}): ${all.map(r=>r.name).join(', ')}.${rows.length?' This chapter\'s edits for them are folded in; Export cut so the film follows.':''}${split.layers.length?` ${split.layers.length} hidden in Studio for this chapter's time and size; the chapter keeps its own hide.`:''}`);
    rerender();
  }
  // ---- inspector (Props tab)
  // ---- On screen: when the selected prop appears and leaves, and its fades (chapter seconds in the fields)
  const selName=()=>{const o=current(),e=sel&&editOfKey(sel.key);return o?label(o):nice(e?.label||sel?.target.label||'');};
  const selSpan=()=>{const e=editOfKey(sel.key);return spanOf((e||sel.target).desk);};
  function timingHtml(){
    const e=editOfKey(sel.key),span=selSpan(),s=screenOf(e,sel.target,span),curve=!(s.fadeIn||s.fadeOut)?'cut':s.ease==='smooth'?'smooth':'linear';
    const num=(name,text,value,extra='')=>`<label>${text}<input name="${name}" type="number" step=".1" min="0" value="${value}" ${extra}></label>`;
    const where=span.missing?`Its desk (${escape(span.desk)}) is not in this chapter now, so it does not show.`:span.desk?`Belongs to Desk ${escape(span.n)} · ${escape(span.label)}, on screen ${r1(span.lo)}–${r1(span.hi)} s. It follows that desk if you reorder the desks.`:`The chapter runs 0–${r1(span.hi)} s.`;
    return `<div class="prop-timing" data-prop-timing><h5>On screen <small>${escape(timeText(s,span))}</small></h5>
      <div class="director-grid">${num('pp-t-from','Appears at (s)',r2(s.from))}${num('pp-t-to','Leaves at (s)',r2(s.to))}${num('pp-t-fin','Fade in (s)',s.fadeIn,'max="30"')}${num('pp-t-fout','Fade out (s)',s.fadeOut,'max="30"')}</div>
      <div class="director-grid prop-curve"><label>Curve<select name="pp-t-curve" title="How the fades run: Cut (no fade), Linear (a straight ramp) or Smooth (eased in and out)"><option value="cut" ${curve==='cut'?'selected':''}>Cut (0 s)</option><option value="linear" ${curve==='linear'?'selected':''}>Linear</option><option value="smooth" ${curve==='smooth'?'selected':''}>Smooth (ease in-out)</option></select></label>
      <span class="prop-fade-presets" role="group" aria-label="Fade length">${[['fast','Fast',.2],['medium','Medium',.5],['slow','Slow',1]].map(([k,l,v])=>`<button data-action="pp-t-${k}" title="Fade in and out ${v} s" aria-pressed="${s.fadeIn===v&&s.fadeOut===v}">${l} ${v} s</button>`).join('')}</span></div>
      ${s.film?`<p class="director-hint">The film ${s.film.keyed&&!s.film.fadeIn&&!s.film.fadeOut?'shows it':'fades it'} itself (${r1(s.film.from)}–${r1(s.film.to)} s${s.film.fadeIn?`, in ${r1(s.film.fadeIn)} s`:''}${s.film.fadeOut?`, out ${r1(s.film.fadeOut)} s`:''}): retimed, it keeps those fades; it can appear later and leave sooner than that, not outside it.</p>`:''}
      <div class="director-actions"><button data-action="pp-t-from-now" title="It appears at the playhead">Appear at playhead</button><button data-action="pp-t-to-now" title="It leaves at the playhead">Leave at playhead</button><button data-action="pp-t-all" ${s.timed?'':'disabled'} title="On screen the whole time again, no fades">Whole time</button></div>
      <p class="director-hint">${where} You can also drag the ends of its bar in the timeline's Props lane.</p></div>`;
  }
  function setTiming(change){
    if(!sel)return;if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return;}
    const span=selSpan();if(span.missing){status('Its desk is not in this chapter now: nothing to time.',true);return;}
    const s=screenOf(editOfKey(sel.key),sel.target,span),lo=s.film?Math.max(span.lo,s.film.from):span.lo,hi=s.film?Math.min(span.hi,s.film.to):span.hi,next={from:s.from,to:s.to,fadeIn:s.fadeIn,fadeOut:s.fadeOut,ease:s.ease,...change};
    if('from' in change)next.from=Math.max(lo,Math.min(change.from,next.to-.1));
    if('to' in change)next.to=Math.min(hi,Math.max(change.to,next.from+.1));
    if(next.to-next.from<.1){status('It needs at least a tenth of a second on screen.',true);rerender();return;}
    const len=next.to-next.from;next.fadeIn=Math.min(next.fadeIn,len);next.fadeOut=Math.min(next.fadeOut,len);
    writeShow(sel,next,span,selName());
  }
  function changedTiming(name,v){
    if(!Number.isFinite(v)||v<0)throw Error('Enter seconds, 0 or more.');
    if(name==='pp-t-from')setTiming({from:v});else if(name==='pp-t-to')setTiming({to:v});
    else if(name==='pp-t-fin')setTiming({fadeIn:Math.min(30,v)});else if(name==='pp-t-fout')setTiming({fadeOut:Math.min(30,v)});
  }
  // Curve: Cut = no fades; Linear / Smooth keep the fades (Medium 0.5 s each when there were none).
  function setCurve(curve){
    const s=screenOf(editOfKey(sel.key),sel.target,selSpan()),none=!(s.fadeIn||s.fadeOut);
    if(curve==='cut')setTiming({fadeIn:0,fadeOut:0,ease:null});
    else setTiming({ease:curve==='smooth'?'smooth':null,...(none?{fadeIn:.5,fadeOut:.5}:{})});
  }
  function panel(){
    if(!three()?.scene)return '<h3>Props</h3><p class="director-hint">Loading the chapter…</p>';
    const o=current(),e=sel&&editOfKey(sel.key),st=permanentState(),n=editedCount();
    const head=`<h3>Props</h3><p class="director-hint">Click a prop in the view to select it (not while Lights are shown). W move · E rotate · R scale · Shift snaps · Delete hides it. Edits stay in this chapter: Studio does not change.</p>
      <div class="director-actions"><button data-action="pp-add" class="prop-add-button" title="Add a model from the prop library: it goes on the desk or the floor in front of the camera, ready to move">+ Add prop</button><button data-action="pp-reset-all" ${n?'':'disabled'} title="Every prop back to the film in this chapter: one step, Undo brings them back">Reset all props to the film${n?' ('+n+')':''}</button><button data-action="pp-permanent" ${st.ok?'':'disabled'} title="${escape(st.ok?'Write these prop edits into Studio\'s room layout (you confirm each one)':st.why)}">Make permanent in Studio…</button></div>${st.ok?'':`<p class="director-hint" data-permanent-why>${escape(st.why)}</p>`}`;
    if(!sel)return head+'<p class="director-hint">No prop selected. Shift+click adds to the selection, Ctrl+click adds or removes.</p>';
    if(group())return head+groupPanelHtml({members:members().map(m=>({key:m.key,name:nice(m.target.label||''),desk:!!(objOf(m)&&(onDeskItself(objOf(m))||ridesDesk(objOf(m)))),hidden:editOfKey(m.key)?.hide===true||(!!objOf(m)&&!shown(objOf(m))),blocked:m.blocked,missing:!objOf(m)})),mode,escape,edited:members().some(m=>editOfKey(m.key)),extra:dropButtons()});
    if(!o)return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4 title="${escape(sel.target.label||'')}">${escape(nice(sel.target.label))}</h4><p class="director-hint">${(e||sel.target).desk&&(e||sel.target).desk!==deskNow()?.preset?'It belongs to another desk of this chapter: click its bar in the Props lane to go to that desk.':'Not in the room right now (the film setup did not find it).'}</p>${timingHtml()}<div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'}>Reset to the film</button></div></div>`;
    if(!tools)return head;if(isAddEdit(e))return head+addPanel(o,e);if(isFollow(e))return head+followPanel(o,e);const b=base(o),{THREE}=tools,pos=o.getWorldPosition(new THREE.Vector3()).toArray(),turn=e?.rotation||[0,0,0],fac=e?.scale||[1,1,1],uniform=Math.abs(fac[0]-fac[1])<1e-4&&Math.abs(fac[1]-fac[2])<1e-4;
    const num=(name,text,value,step,extra='')=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}" ${extra}></label>`;
    const studio=plan().find(r=>r.key===sel.key),hidden=e?.hide===true||!shown(o),moved=b?o.getWorldPosition(new THREE.Vector3()).distanceTo(b.world):0;
    return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4>${escape(propName(o.name))}</h4><p class="director-hint prop-name">${escape(o.name||'Unnamed')}${o.userData.sceneAssetKey?' · Studio item':''}</p>
      <div class="director-actions prop-modes">${Object.entries(MODES).map(([m,t])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} (${m==='translate'?'W':m==='rotate'?'E':'T'})">${t}</button>`).join('')}${meaningful(o.parent||o)?'<button data-action="pp-parent" title="Select what it sits on (Alt-click in the view)">Select what it sits on</button>':''}</div>
      ${followSelect(o,e)}
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-p'+k,'Position '+k+' (m)',r3(pos[i]*metresPerUnit()),.01)).join('')}</div>${e?.position?`<p class="director-hint">Moved ${r3(moved*metresPerUnit())} m from the film's place.</p>`:''}
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-r'+k,'Turn '+k+' (°)',r1(turn[i]),1)).join('')}</div>
      <label>Scale ×<input name="pp-s" type="number" min=".01" max="100" step=".05" value="${uniform?Number(fac[0].toFixed(3)):''}" placeholder="mixed"></label>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-s'+k,'Scale '+k+' ×',Number(fac[i].toFixed(3)),.05,'min=".01" max="100"')).join('')}</div>
      ${dropButtons()}
      ${timingHtml()}
      <label class="director-check"><input type="checkbox" name="pp-hide" ${e?.hide===true||(!shown(o)&&!e?.show&&!filmFade(sel.target||e,selSpan())?.keyed)?'checked':''}>Hide in this chapter</label>
      <div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'} title="This prop back to where the film puts it">Reset to the film</button></div>
      <p class="director-hint" data-studio-note>${studio?(studio.ok?'Studio: can be made permanent.':'Studio: '+escape(studio.why)):onDeskItself(o)?'Studio: '+escape(ON_DESK):'Studio: unchanged (edit the prop to make it permanent later).'}</p></div>`;
  }
  function followPanel(o,e){
    const {THREE}=tools,pos=o.getWorldPosition(new THREE.Vector3()).toArray(),num=(name,text,value,step)=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}"></label>`;
    return `<div class="movement-inspector prop-inspector prop-follows" data-reveal="prop"><h4>${escape(propName(o.name))}</h4><p class="director-hint prop-name">${escape(o.name||'Unnamed')} · travels with ${escape(FOLLOW_LABELS[e.follow].replace(/ \(.*\)$/,'').toLowerCase())}</p>
      <div class="director-actions prop-modes">${Object.entries(MODES).map(([m,t])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} (${m==='translate'?'W':m==='rotate'?'E':'T'})">${t}</button>`).join('')}</div>
      ${followSelect(o,e)}
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-p'+k,'Position '+k+' (m)',r3(pos[i]*metresPerUnit()),.01)).join('')}</div>
      <p class="director-hint">It keeps its place on that surface as the desk lifts and tilts. Move, turn and size it with the Gumball (W / E / R); the numbers move it in the room.</p>
      ${dropButtons()}
      ${timingHtml()}
      <label class="director-check"><input type="checkbox" name="pp-hide" ${e?.hide===true?'checked':''}>Hide in this chapter</label>
      <div class="director-actions"><button data-action="pp-reset" title="This prop back to where the film puts it">Reset to the film</button></div></div>`;
  }
  function addPanel(o,e){
    const {THREE}=tools,pos=o.getWorldPosition(new THREE.Vector3()).toArray(),fac=e.scale,uniform=Math.abs(fac[0]-fac[1])<1e-4&&Math.abs(fac[1]-fac[2])<1e-4,studio=plan().find(r=>r.key===sel.key);
    const num=(name,text,value,step,extra='')=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}" ${extra}></label>`;
    return `<div class="movement-inspector prop-inspector prop-added" data-reveal="prop"><h4>${escape(label(o))}</h4><p class="director-hint prop-name">+ Added in this chapter · ${escape(e.add.asset)} · ${onDesk(e.parent)?`on ${DESK_SURFACES[e.parent]} (rides lift and tilt)`:'in the room'}</p>
      <div class="director-actions prop-modes">${Object.entries(MODES).map(([m,t])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} (${m==='translate'?'W':m==='rotate'?'E':'T'})">${t}</button>`).join('')}</div>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-p'+k,'Position '+k+' (m)',r3(pos[i]*metresPerUnit()),.01)).join('')}</div>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-r'+k,'Turn '+k+' (°)',r1(e.rotation[i]),1)).join('')}</div>
      <label>Scale ×<input name="pp-s" type="number" min=".01" max="100" step=".05" value="${uniform?Number(fac[0].toFixed(3)):''}" placeholder="mixed"></label>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-s'+k,'Scale '+k+' ×',Number(fac[i].toFixed(3)),.05,'min=".01" max="100"')).join('')}</div>
      ${dropButtons()}
      ${timingHtml()}
      ${putButtons(e)}
      <div class="director-actions"><button data-action="pp-place" aria-pressed="${placing}" title="Then click a surface in the view: the desktop or one of the desk's shelves (it rides the desk), a table or the floor">Place on a surface…</button><button data-action="pp-remove" title="Take it out of this chapter (Delete): Undo brings it back">Remove from this chapter</button></div>
      <p class="director-hint" data-studio-note>${studio?(studio.ok?'Studio: can be added to the room for good (Make permanent in Studio…).':'Studio: '+escape(studio.why)):''}</p></div>`;
  }
  // An added prop: straight onto one of the desk's surfaces (its middle; then move it with the gizmo).
  const surfaces=()=>{const E=win()?.__filmEdits;return E?Object.keys(DESK_SURFACES).filter(s=>E.addParent(s)):[];};
  const putButtons=e=>{const list=surfaces();return list.length?`<div class="director-actions prop-put"><span class="director-hint">Put it on</span>${list.map(s=>`<button data-action="pp-put-${s}" aria-pressed="${e.parent===s}" title="Onto ${DESK_SURFACES[s]}: it rides the desk's lift and tilt">${s==='desk'?'Desktop':s==='shelf'?'Top shelf':s==='lower-shelf'?'Lower shelf':'Base shelf'}</button>`).join('')}</div>`:'';};
  function putOn(kind){
    const o=current(),e=sel&&editOfKey(sel.key);if(!o||!isAddEdit(e)||!DESK_SURFACES[kind])return;
    const {THREE}=tools,parent=win().__filmEdits.addParent(kind);if(!parent){status(`This desk has no ${DESK_SURFACES[kind].replace('the ','')} to put it on.`,true);return;}
    // Where it is now, if that is over the surface; else the surface's middle. It keeps the way it faces.
    parent.updateWorldMatrix(true,false);const local=parent.worldToLocal(o.getWorldPosition(new THREE.Vector3())),size=parent.userData.surfaceSize,k=parent.getWorldScale(new THREE.Vector3()).x||1;
    if(!size||Math.abs(local.x)>size.width/2||Math.abs(local.z)>size.depth/2)local.set(0,0,0);local.y=0;
    const q=parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion())),r=new THREE.Euler().setFromQuaternion(q);
    write(sel.key,cleanAddEdit({...e,parent:kind,position:local.toArray().map(v=>r3(v*k)),rotation:[0,r1(wrapDeg(r.y*180/Math.PI)),0]}),`Put ${label(o)} on ${DESK_SURFACES[kind]}: it rides the desk's lift and tilt. Move it with the gizmo.`);
  }
  const dropButtons=()=>`<div class="director-actions prop-drop"><button data-action="pp-drop" title="Move it straight down until it rests on the surface below (End)">Drop to surface</button><button data-action="pp-drop-flat" title="Level it (no tilt or roll), then drop it onto the surface below (Shift+End)">Drop flat</button><button data-action="pp-drop-align" title="Tilt it to the surface under it (a ramp, the tilted desktop), then drop it (Alt+End)">Align to surface</button></div>`;
  async function action(name,arg){
    if(name==='pp-add'){library.open();return;}
    await ensure();
    if(name==='pp-remove'){remove();return;}
    if(name==='pp-drop'||name==='pp-drop-flat'||name==='pp-drop-align'){await dropSelected(name==='pp-drop-flat'?'flat':name==='pp-drop-align'?'align':'drop');return;}
    if(name==='pp-place'){const o=current();if(!o||!isAddEdit(editOfKey(sel.key)))return;placing=!placing;rerender();status(placing?`Click a surface in the view to put ${label(o)} there (the desktop, a table, the floor). Click Place again to cancel.`:'Placing cancelled.');return;}
    if(name==='pp-pick'){select(arg);return;}
    if(name.startsWith('pp-put-')){putOn(name.slice(7));return;}
    if(name==='pp-lane'){if(performance.now()<barSuppress)return;laneClick(laneList[Number(arg)]);return;}
    if(name==='pp-t-from-now'){setTiming({from:r2(time())});return;}
    if(name==='pp-t-to-now'){setTiming({to:r2(time())});return;}
    if(name==='pp-t-all'){setTiming({from:-1,to:END,fadeIn:0,fadeOut:0});return;}
    if(name==='pp-t-fast'||name==='pp-t-medium'||name==='pp-t-slow'){const v={'pp-t-fast':.2,'pp-t-medium':.5,'pp-t-slow':1}[name];setTiming({fadeIn:v,fadeOut:v});return;}
    if(name==='pp-unsel'){setMembers(members().filter(m=>m.key!==arg));return;}
    if(name==='pp-clear'){deselect();onSelect();status('Selection cleared.');return;}
    if(name==='pp-reset-all'){resetAll();return;}
    if(name==='pp-permanent'){openPermanent();return;}
    if(name==='pp-reset'){reset();return;}
    if(name==='pp-parent'){const o=current(),p=o&&meaningful(o.parent);if(p)pick(p);return;}
    if(name.startsWith('pp-mode-')){setMode(name.slice(8));return;}
  }
  function setMode(m){if(!MODES[m])return;if(group()&&m==='scale'){status('Scale works on one item at a time: select one item, or move and turn the group.',true);return;}mode=m;rerender();status(`Gizmo: ${MODES[m].toLowerCase()}${sel?'':' (select a prop first)'}.`);}
  // ---- the timeline's Props lane: bars over the seconds each prop is on screen
  // The desk's own items are learned from the stage (they differ per desk in a sub-shot chapter) and kept for the
  // session, so every desk's bars are there once it has been on stage.
  const seen=new Map(),seenKey=desk=>`${shot()?.id||''}|${desk||''}`;
  try{for(const [k,v] of Object.entries(JSON.parse(sessionStorage.getItem('directorPropItems')||'{}')))if(Array.isArray(v))seen.set(k,v);}catch{}
  function learn(){
    if(!tools||!three()?.scene)return;const d=deskNow();if(versions().length&&!d)return;
    // An item hidden when the stage was installed but timed by the film (create at 0 s: the drafting kit, easel rail and
    // easel, held hidden by their visible keys / opacity until 7 or 17.4 s) is the desk's too; the copies under the
    // always-hidden accessory mount are not.
    const timedByFilm=i=>{for(let p=i.obj;p;p=p.parent)if(!p.visible&&/^Accessory mount:/.test(p.name||''))return false;const t=i.target||{};
      return !!(filmFadeKeys(film(),t.match)||filmVisibleKeys(film()?.accessories,`${t.match||''} ${String(t.path||'').split('>').pop()} ${t.label||''}`));};
    const list=items().filter(i=>i.desk&&!i.obj?.userData?.directorAdd&&(!i.hidden||editOfKey(i.key)||timedByFilm(i))).map(i=>({key:i.key,target:i.target,name:i.name,id:`${i.obj?.userData?.accessoryId||''} ${i.obj?.userData?.propId||''} ${i.obj?.name||''}`.trim()}));
    const k=seenKey(d?.preset),was=JSON.stringify(seen.get(k)||null);if(JSON.stringify(list)===was)return false;
    seen.set(k,list);try{sessionStorage.setItem('directorPropItems',JSON.stringify(Object.fromEntries(seen)));}catch{}
    return true;
  }
  const laneName=e=>isAddEdit(e)?(e.label||propName(e.add.asset)):propName(e.label||e.match.replace(/^\^|\$$/g,'').replace(/\\/g,''));
  let laneList=[],laneRows=1,barDrag=null,barSuppress=0,wanted=null;const ROW=17,MAX_ROWS=9;
  function laneItems(){
    const T=seconds()||1,vs=versions(),out=[],chapter={t0:0,lo:0,hi:T},all=edits();
    let tiltAt=null;
    try{const sh=shot(),m=sh?.motion?legacyMotionToClips(sh.motion,sh.seconds):null;if(m)tiltAt=t=>sampleClipMotion(m,t).tilt;}catch{}
    // A film item the desk puts away (easel and painter shelf under 50 deg of tilt): its bar ends where the stow hides it.
    const stowed=(row,span)=>{if(!tiltAt||!span.desk||row.e?.show)return null;
      const text=`${row.id||''} ${row.name||''} ${row.target?.match||''} ${row.target?.path||''}`.replace(/\\/g,'');
      try{return stowWindow(text,span.desk,tiltAt,span.lo,span.hi);}catch{return null;}};
    const push=(span,row)=>{const s=screenOf(row.e,row.target,span),nat=s.film?null:stowed(row,span),from=nat?nat.from:s.from,to=nat?nat.to:s.to;out.push({...row,id:row.key+'|'+(span.n||''),span,start:from,end:Math.max(from+.01,to),timed:s.timed||!!s.film,fadeIn:s.fadeIn,fadeOut:s.fadeOut,ease:s.ease,film:s.film||null,stowed:!!nat});};
    const spans=vs.length?vs.map(v=>({t0:v.start,lo:v.from,hi:Math.min(T,v.to),n:v.n,label:v.label,desk:v.preset})):[chapter];
    for(const span of spans){
      const rows=new Map(),known=seen.get(seenKey(span.desk));
      for(const k of known||[])rows.set(k.key,{key:k.key,target:k.target,name:k.name,id:k.id,e:editOfKey(k.key)});
      for(const e of all){if(vs.length&&e.desk!==span.desk)continue;const k=propKey(e);if(!rows.has(k))rows.set(k,{key:k,target:propTarget(e),name:laneName(e),e});}
      for(const r of rows.values())push(span,r);
      if(vs.length&&!known)out.push({id:'ghost|'+span.n,ghost:true,span,start:span.lo,end:span.hi,name:`Desk ${span.n} · ${span.label}: click to see its items`});
    }
    // Edits that hold for every desk of a sub-shot chapter (made before desks had props of their own): one bar each.
    if(vs.length)for(const e of all.filter(e=>!e.desk)){const k=propKey(e);if(!out.some(i=>i.key===k))push(chapter,{key:k,target:propTarget(e),name:laneName(e),e});}
    return out;
  }
  function lane(){
    laneList=laneItems();laneRows=1;const T=seconds()||1;
    if(!laneList.length)return '<span class="desk-lane-empty">Click a prop in the view to move, turn, scale, hide or time it · + Prop adds one from the library</span>';
    const layers=stackRows(laneList);laneRows=layers.count;
    return laneList.map((it,i)=>{
      const e=it.e,x=it.start/T*100,w=Math.max(.5,(it.end-it.start)/T*100),top=1+layers.row.get(it.id)*ROW;
      if(it.ghost)return `<button type="button" class="prop-bar ghost" data-action="pp-lane" data-index="${i}" style="left:${x}%;width:${w}%;top:${top}px;height:${ROW-2}px" title="Go to this desk: its items are listed here once it has been on stage">${escape(it.name)}</button>`;
      const hiddenBar=e?.hide===true,added=isAddEdit(e),fi=it.fadeIn>0?Math.min(100,it.fadeIn/(it.end-it.start)*100):0,fo=it.fadeOut>0?Math.min(100,it.fadeOut/(it.end-it.start)*100):0;
      const tip=`${it.name}${it.span.desk?` · Desk ${it.span.n} · ${it.span.label}`:''} · on screen ${timeText({from:it.start,to:it.end},it.span)}${e?' · '+describePropEdit(e,{mpu:metresPerUnit()}):' · as the film has it'}${hiddenBar?' · hidden: click, then untick Hide to bring it back':''}${it.stowed?` · the desk puts it away once its tilt crosses ${EASEL_ANGLE}°`:it.film?.keyed?' · the film shows and hides it itself':''} · click to select, drag an end to set when it appears or leaves${it.timed?', drag the middle to move it':''}`;
      // (the fade ramps: drawn on the bar, a small handle at the inner end of each drags its length; with no fade the
      // handle sits 12 px inside, off the bar's 8 px end grip: on the end it took the press, so dragging a bar's end without
      // a fade moved a fade of 0 instead and wrote nothing, director-stow-window-e2e's easel drag)
      const ramps=`<i class="prop-ramp in ${it.ease==='smooth'?'smooth':''}" style="width:${fi}%"></i><i class="prop-ramp out ${it.ease==='smooth'?'smooth':''}" style="width:${fo}%"></i><i class="prop-fade-h" data-fade="in" style="left:${fi?fi+'%':'calc(0% + 12px)'}" title="Drag: fade in ${r1(it.fadeIn)} s"></i><i class="prop-fade-h" data-fade="out" style="left:${fo?100-fo+'%':'calc(100% - 12px)'}" title="Drag: fade out ${r1(it.fadeOut)} s"></i>`;
      return `<button type="button" class="prop-bar ${e?'prop-chip':'film'} ${hiddenBar?'prop-hidden':''} ${added?'prop-added':''} ${it.timed?'timed':''} ${isSel(it.key)?'selected':''}" data-action="pp-lane" data-index="${i}" data-prop-key="${escape(it.key)}" style="left:${x}%;width:${w}%;top:${top}px;height:${ROW-2}px;--fade-in:${fi}%;--fade-out:${fo}%" title="${escape(tip)}">${ramps}${added?'<b aria-label="added">+</b>':''}${escape(it.name)}</button>`;}).join('');
  }
  const laneHeight=()=>Math.min(MAX_ROWS,Math.max(2,laneRows))*ROW+4;
  // A click on a bar: the playhead goes into its seconds when it is outside them (so its desk comes on stage), then
  // the prop is selected (as soon as the stage has it).
  function laneClick(it){
    if(!it)return;const t=time(),inside=t>=it.start-1e-3&&t<=it.end+1e-3;
    if(!inside||it.ghost){const to=Math.min(it.end-.05,it.start+(it.ghost?.2:.1));seek(Math.max(0,to));}
    if(it.ghost){status(`${it.name.split(':')[0]} is coming on stage: its items appear in the Props lane.`);return;}
    setMembers([{key:it.key,target:it.target,obj:tools?find(it.key,it.target):null}]);
    const o=current();wanted=o?null:{key:it.key,target:it.target,until:performance.now()+8000};status(o?`${label(o)} selected · W move · E rotate · R scale · drag its bar's ends to set when it shows.`:`${it.name} selected${it.span.desk&&it.span.desk!==deskNow()?.preset?`: going to Desk ${it.span.n} · ${it.span.label}`:''}.`);
    if(!tools)ensure().catch(error=>status(error.message,true));
  }
  // A bar's ends drag to set when the prop appears and leaves (within its desk's seconds, snapped to a tenth);
  // the middle of a timed bar moves it. Back over the whole stretch, the timing is cleared.
  document.addEventListener('pointerdown',ev=>{
    const bar=ev.target.closest?.('.prop-bar');if(!bar||bar.classList.contains('ghost')||ev.button!==0||!editing())return;
    const it=laneList[Number(bar.dataset.index)],T=seconds(),r=bar.getBoundingClientRect(),box=bar.parentElement.getBoundingClientRect();if(!it||!T||!box.width)return;
    const handle=ev.target.closest?.('.prop-fade-h'),grip=Math.min(8,r.width/3),edge=handle?'f'+handle.dataset.fade:ev.clientX-r.left<grip?'in':r.right-ev.clientX<grip?'out':'move';
    if(handle){ev.preventDefault();ev.stopPropagation();}
    barDrag={it,bar,edge,x:ev.clientX,width:box.width,T,from:[it.start,it.end],fades:[it.fadeIn,it.fadeOut],now:null};
  },true);
  document.addEventListener('pointermove',ev=>{
    const d=barDrag;if(!d||(!d.now&&Math.abs(ev.clientX-d.x)<3))return;
    const dt=(ev.clientX-d.x)/d.width*d.T,snap=v=>Math.round(v*10)/10,lo=Math.max(d.it.span.lo,d.it.film?.from??-Infinity),hi=Math.min(d.it.span.hi,d.it.film?.to??Infinity);let [a,b]=d.from;
    if(d.edge==='fin'||d.edge==='fout'){
      const len=b-a,k=d.edge==='fin'?0:1,v=Math.max(0,Math.min(len,Math.round((d.fades[k]+(k?-dt:dt))*20)/20));
      d.now=[a,b];d.fade=[k?d.fades[0]:v,k?v:d.fades[1]];d.bar.style.setProperty(k?'--fade-out':'--fade-in',v/len*100+'%');
      const ramp=d.bar.querySelector(`.prop-ramp.${k?'out':'in'}`);if(ramp)ramp.style.width=v/len*100+'%';const h=d.bar.querySelector(`.prop-fade-h[data-fade="${k?'out':'in'}"]`);if(h)h.style.left=(k?100-v/len*100:v/len*100)+'%';
      status(`${d.it.name}: fade ${k?'out':'in'} ${r2(v)} s${d.it.ease==='smooth'?' (smooth)':''}.`);return;
    }
    if(d.edge==='in')a=Math.max(lo,Math.min(b-.2,snap(a+dt)));
    else if(d.edge==='out')b=Math.min(hi,Math.max(a+.2,snap(b+dt)));
    else if(d.it.timed){const len=b-a;a=Math.max(lo,Math.min(hi-len,snap(a+dt)));b=a+len;}
    else return;
    d.now=[a,b];d.bar.style.left=a/d.T*100+'%';d.bar.style.width=Math.max(.5,(b-a)/d.T*100)+'%';
    status(`${d.it.name}: on screen ${r1(a)}–${r1(b)} s.`);
  },true);
  const endBar=()=>{
    const d=barDrag;barDrag=null;if(!d?.now)return;barSuppress=performance.now()+350;
    const [a,b]=d.now,it=d.it,fades=d.fade||d.fades;if(Math.abs(a-d.from[0])<1e-6&&Math.abs(b-d.from[1])<1e-6&&fades[0]===d.fades[0]&&fades[1]===d.fades[1]){rerender();return;}
    const len=b-a;writeShow(it,{from:a,to:b,fadeIn:Math.min(fades[0],len),fadeOut:Math.min(fades[1],len),ease:it.ease},it.span,it.name);
  };
  document.addEventListener('pointerup',endBar,true);document.addEventListener('pointercancel',()=>{if(barDrag?.now)rerender();barDrag=null;},true);
  // After film-fx (re)installs: objects may be new; folded-in props keep their Studio place on the stage.
  function applied(){
    found=null;itemsCache=null;pivotDirty=true;for(const m of members())if(m.obj&&!inScene(m.obj))m.obj=null;
    learn();
    if(followCheck)checkFollow().catch(error=>console.warn('[props] travels with check',error));
    // A bar clicked for a desk that was not on stage: its prop is picked up now that it is.
    if(wanted&&performance.now()<wanted.until&&sel?.key===wanted.key){const o=tools&&find(wanted.key,wanted.target);if(o){sel.obj=o;wanted=null;status(`${label(o)} selected · W move · E rotate · R scale · drag its bar's ends to set when it shows.`);}}else wanted=null;
    if(pending&&!edits().some(e=>pending.keys.has(propKey(e)))){
      // Added props: the chapter's copy is gone with its edit; Studio's own item stands in its place (as Studio loads it).
      for(const r of pending.rows.filter(r=>r.add)){const room=win()?.ErgoFlex?.workspaceRoom;room?.addAsset(r.add.propId,r.studioKey,r.add.position).then(obj=>{if(!obj)return;obj.position.copy(r.local.p);obj.quaternion.copy(r.local.q);obj.scale.copy(r.local.s);obj.updateMatrixWorld(true);bridge.stage()?.wake?.(300);}).catch(error=>console.warn('[props] Studio copy',error));}
      for(const r of pending.rows){const o=r.obj;if(r.add||!o||!inScene(o))continue;if(r.remove)o.removeFromParent();else{o.position.copy(r.local.p);o.quaternion.copy(r.local.q);o.scale.copy(r.local.s);o.updateMatrixWorld(true);}}
      pending=null;bridge.stage()?.wake?.(300);
    }
  }
  // P5 paste attributes (Ctrl+C / Ctrl+Alt+V on a prop): its turn and size onto another prop of the same kind (a room
  // prop's are changes from the film, an added prop's are its own)
  let attrClip=null;
  function copyAttrs(){if(!sel){status('Select a prop first: Ctrl+C copies its turn and size.');return false;}const e=editOfKey(sel.key),add=isAddEdit(e),o=current();
    attrClip={add,rotation:[...(e?.rotation||[0,0,0])],scale:[...(e?.scale||[1,1,1])],label:o?label(o):'the prop'};status(`Copied the turn and size of ${attrClip.label}: Ctrl+Alt+V pastes them onto another prop.`);return true;}
  function pasteAttrs(){
    if(!attrClip){status('Copy a prop\'s turn and size first (Ctrl+C on it).');return false;}if(!sel){status('Select the prop to paste onto.');return false;}
    const e=editOfKey(sel.key),add=isAddEdit(e),o=current(),name=o?label(o):'the prop';
    if(add!==attrClip.add){status(attrClip.add?'Those are an added prop\'s own turn and size: paste them onto another prop you added.':'Those are a room prop\'s changes from the film: paste them onto another room prop.',true);return false;}
    if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return false;}
    const next=add?cleanAddEdit({...e,rotation:[...attrClip.rotation],scale:[...attrClip.scale]}):{...sel.target,...(e||{}),rotation:[...attrClip.rotation],scale:[...attrClip.scale]};
    write(sel.key,next,`${name}: the turn and size of ${attrClip.label}. Undo puts it back.`);return true;
  }
  return {copyAttrs,pasteAttrs,panel,lane,laneHeight,action,changed,select,deselect,hide,reset,setMode,applied,editedCount,ensure,learn,boxPick,object:()=>{try{return current();}catch{return null;}},
    selected:()=>sel?.key||null,selectedKeys:()=>members().map(m=>m.key),selectKeys,items,hideItems:(keys,on,also)=>hideItems(keys.map(k=>{const i=items().find(x=>x.key===k);return i?{key:k,target:i.target,obj:i.obj}:{key:k};}),on,also),
    flashKey,setLocked:fn=>{lockedKeys=fn;},isHidden:key=>{const e=editOfKey(key);if(e)return e.hide===true;const i=items().find(x=>x.key===key);return !!i&&i.hidden;},selectedName:()=>sel?(current()?.name||sel.target.label):null,mode:()=>mode,
    addProp,dropSelected,dropObject,writeLive,openLibrary:()=>library.open(),library:()=>library,
    header:()=>group()?{name:`${members().length} selected`,detail:'moving, turning and hiding together'}:sel?{name:current()?label(current()):nice(sel.target.label),detail:(editOfKey(sel.key)?describePropEdit(editOfKey(sel.key),{mpu:metresPerUnit()}):'from the film')}:null};
}
