// Director pose mode: fine tuning of one person's posture, the way figure posers do it (Blender's pose mode, Daz, Poser).
// Double-click a person in the view (or "Fine-tune pose" in the People tab): the model gets its skeleton
// (room-people.mjs rig()) and dots appear on the joints.
//   blue dot      a joint: click it, then turn it with the rings (E) or the Bend / Twist / Side fields
//   orange dot    a hand or a foot: drag it with the arrows (W) and the whole arm or leg follows (two-bone IK); the
//                 hand or foot keeps facing the way it did. E turns the wrist or ankle itself.
// Fingers open and close a step at a time; one side can be copied to the other; a joint, a limb or the whole pose
// goes back to the posture as built. Every change is one undo step and lives in the chapter's cast as
// cast[i].pose = { '<bone>': [x, y, z, w] } (people-edits.mjs), so the live stage, Render still and the film show it.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r1=v=>Math.round(v*10)/10;
// bone, name, group, [the two bones a drag of this one bends]
export const JOINTS=[
  ['head','Head','Head and neck'],['neck_01','Neck','Head and neck'],
  ['spine_03','Chest','Torso'],['spine_02','Upper back','Torso'],['spine_01','Waist','Torso'],['pelvis','Hips (whole body)','Torso'],
  ['clavicle_l','Left collarbone','Left arm'],['upperarm_l','Left shoulder','Left arm'],['lowerarm_l','Left elbow','Left arm'],['hand_l','Left hand','Left arm',['upperarm_l','lowerarm_l']],
  ['clavicle_r','Right collarbone','Right arm'],['upperarm_r','Right shoulder','Right arm'],['lowerarm_r','Right elbow','Right arm'],['hand_r','Right hand','Right arm',['upperarm_r','lowerarm_r']],
  ['thigh_l','Left hip','Left leg'],['calf_l','Left knee','Left leg'],['foot_l','Left foot','Left leg',['thigh_l','calf_l']],['ball_l','Left toes','Left leg'],
  ['thigh_r','Right hip','Right leg'],['calf_r','Right knee','Right leg'],['foot_r','Right foot','Right leg',['thigh_r','calf_r']],['ball_r','Right toes','Right leg']];
const NO_DOT=new Set(['spine_02','ball_l','ball_r']),FINGERS=['thumb','index','middle','ring','pinky'];
const info=bone=>JOINTS.find(j=>j[0]===bone)||null;
const sideOf=bone=>/_l$/.test(bone)?'l':/_r$/.test(bone)?'r':null;
// The bones of an arm or a leg on one side (fingers with the arm).
const ARM=/^(clavicle|upperarm|lowerarm|hand|thumb_\d+|index_\d+|middle_\d+|ring_\d+|pinky_\d+)_[lr]$/,LEG=/^(thigh|calf|foot|ball)_[lr]$/;
const limbOf=bone=>ARM.test(bone)?ARM:LEG.test(bone)?LEG:null;

export function createPoseEditor({win,three,tools,stagePeople,entry,edit,status,rerender,personName,editing,saved=null}){
  let key=null,joint=null,gmode='rotate',h=null,rigging=false,drag=null,listening=false,orbit=true;
  const T=()=>tools().THREE;
  const rigOf=()=>h?.object.userData.personRig||null;
  const bone=name=>rigOf()?.bones.get(name)||null;
  const label=name=>info(name)?.[1]||name;
  const limb=()=>joint&&info(joint)?.[3]||null;
  const moving=()=>gmode==='translate'&&!!limb();
  function dispose(){
    if(!h)return;h.gizmo.detach();h.gizmo.removeFromParent();h.gizmo.dispose?.();h.group.removeFromParent();h.geo.dispose();for(const m of h.dots.values())m.material.dispose();h=null;
  }
  // ---- handles on the skeleton
  function build(o){
    const {THREE,TransformControls,t}=tools(),w=win();dispose();
    const group=new THREE.Group();group.name='Director pose tools';group.userData.directorTools=true;t.scene.add(group);
    const geo=new THREE.SphereGeometry(1,18,12),dots=new Map();
    for(const [name,,,ik] of JOINTS){
      if(NO_DOT.has(name)||!o.userData.personRig.bones.has(name))continue;
      const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:ik?0xffb44a:0x7fd7ff,depthTest:false,depthWrite:false,transparent:true,opacity:.95}));
      m.renderOrder=1000;m.userData.joint=name;m.userData.directorTools=true;group.add(m);dots.set(name,m);
    }
    const target=new THREE.Object3D();group.add(target);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;gizmo.setSize(.75);gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){orbit=t.controls.enabled;t.controls.enabled=false;startDrag();}else{t.controls.enabled=orbit;endDrag();}});
    gizmo.addEventListener('objectChange',()=>{if(moving())solve();status(`${moving()?'Moving':'Turning'} ${personName(entry(key))}'s ${label(joint).toLowerCase()}…`);});
    h={object:o,group,dots,target,gizmo,geo};listen();
  }
  function pickDot(ev){
    if(!h||!h.group.visible)return null;const {THREE,t}=tools(),dom=t.renderer.domElement,r=dom.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);
    // the nearest dot to the pointer among those under it (dots draw over the body, so depth does not decide)
    const hits=ray.intersectObjects([...h.dots.values()],false);if(!hits.length)return null;
    const p=new THREE.Vector3(),at=m=>{m.getWorldPosition(p).project(t.camera);return Math.hypot((p.x+1)/2*r.width-(ev.clientX-r.left),(1-p.y)/2*r.height-(ev.clientY-r.top));};
    return hits.map(x=>x.object).sort((a,b)=>at(a)-at(b))[0].userData.joint;
  }
  // A person under the pointer (their key), for the double-click that opens pose mode.
  function personAt(ev){
    const people=stagePeople(),t=three();if(!people||!t||!tools())return null;const {THREE}=tools(),dom=t.renderer.domElement,r=dom.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);
    const hit=ray.intersectObjects(people.people.filter(o=>o.visible),true)[0];if(!hit)return null;
    for(let p=hit.object;p;p=p.parent)if(p.userData?.person)return people.keyOf(p.userData.person);
    return null;
  }
  function listen(){
    if(listening)return;listening=true;const dom=tools().t.renderer.domElement;
    // A press on another joint's dot selects it, before the gizmo of the selected joint or the camera can take the press.
    dom.addEventListener('pointerdown',ev=>{if(!key||!h||ev.button!==0||h.gizmo.dragging)return;const j=pickDot(ev);if(!j||j===joint)return;ev.preventDefault();ev.stopImmediatePropagation();pick(j);},true);
  }
  // Called every frame by the People editor.
  function tick(){
    if(!key)return;
    const people=stagePeople(),o=people?.byKey?.(key);
    if(!o||!entry(key)){exit();return;}
    if(!o.userData.personRig){if(!rigging){rigging=true;people.rig(o).catch(()=>null).finally(()=>{rigging=false;});}if(h)h.group.visible=false;return;}
    if(!h||h.object!==o)build(o);
    const {THREE,t}=tools(),on=o.visible&&editing();h.group.visible=on;
    const p=new THREE.Vector3(),cam=t.camera.getWorldPosition(new THREE.Vector3()),k=Math.tan(THREE.MathUtils.degToRad(t.camera.fov||40)/2);
    for(const [name,m] of h.dots){
      bone(name).getWorldPosition(p);m.position.copy(p);
      const ik=!!info(name)[3],sel=name===joint;m.scale.setScalar(p.distanceTo(cam)*k*(ik?.02:.014)*(sel?1.35:1));
      m.material.color.setHex(sel?0xffffff:ik?0xffb44a:0x7fd7ff);
    }
    const g=h.gizmo,b=joint&&bone(joint);
    if(on&&b){
      const obj=moving()?h.target:b;
      if(moving()&&!g.dragging)b.getWorldPosition(h.target.position);
      if(g.object!==obj)g.attach(obj);
      g.setMode(moving()?'translate':'rotate');g.setSpace(moving()?'world':'local');g.visible=g.enabled=true;
    }else{if(g.object&&!g.dragging)g.detach();g.visible=g.enabled=false;}
  }
  // ---- two-bone IK: the limb's two bones turn so its end reaches the target; the bend stays in its plane
  function twoBone(a,b,pa,pb,pc,pt){
    const THREE=T(),Q=THREE.Quaternion,eps=1e-4,acos=x=>Math.acos(THREE.MathUtils.clamp(x,-1,1));
    const lab=pb.distanceTo(pa),lcb=pb.distanceTo(pc),lat=THREE.MathUtils.clamp(pt.distanceTo(pa),eps,lab+lcb-eps);
    const ac=pc.clone().sub(pa).normalize(),ab=pb.clone().sub(pa).normalize(),ba=pa.clone().sub(pb).normalize(),bc=pc.clone().sub(pb).normalize(),at=pt.clone().sub(pa).normalize();
    const acab0=acos(ac.dot(ab)),babc0=acos(ba.dot(bc)),acat0=acos(ac.dot(at));
    const acab1=acos((lcb*lcb-lab*lab-lat*lat)/(-2*lab*lat)),babc1=acos((lat*lat-lab*lab-lcb*lcb)/(-2*lab*lcb));
    const aw=a.getWorldQuaternion(new Q()),bw=b.getWorldQuaternion(new Q()),ai=aw.clone().invert(),bi=bw.clone().invert();
    let axis0=ac.clone().cross(ab);if(axis0.lengthSq()<1e-10)axis0=new THREE.Vector3(1,0,0).applyQuaternion(bw);axis0.normalize();   // a straight limb bends about the elbow's own axis
    const axis1=ac.clone().cross(at),turn=axis1.lengthSq()>1e-12;
    const r0=new Q().setFromAxisAngle(axis0.clone().applyQuaternion(ai),acab1-acab0),r1=new Q().setFromAxisAngle(axis0.clone().applyQuaternion(bi),babc1-babc0);
    if(turn)r0.multiply(new Q().setFromAxisAngle(axis1.normalize().applyQuaternion(ai),acat0));
    a.quaternion.multiply(r0).normalize();b.quaternion.multiply(r1).normalize();a.updateWorldMatrix(false,true);
  }
  function solve(){
    const THREE=T(),[an,bn]=limb(),a=bone(an),b=bone(bn),c=bone(joint);if(!a||!b||!c)return;
    const v=()=>new THREE.Vector3();h.object.updateWorldMatrix(true,true);
    twoBone(a,b,a.getWorldPosition(v()),b.getWorldPosition(v()),c.getWorldPosition(v()),h.target.getWorldPosition(v()));
    if(drag?.end)c.quaternion.copy(c.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(drag.end)).normalize();
    c.updateWorldMatrix(false,true);
  }
  function startDrag(){const b=bone(joint);drag={end:moving()&&b?b.getWorldQuaternion(new (T().Quaternion)()):null};}
  function endDrag(){drag=null;if(!key||!joint)return;commit(`${personName(entry(key))}: ${label(joint).toLowerCase()} adjusted.`);}
  // ---- the cut
  function read(){
    const rig=rigOf(),out={};if(!rig)return out;
    for(const [name,b] of rig.bones){const d=rig.rest.get(name).clone().invert().multiply(b.quaternion);if(Math.hypot(d.x,d.y,d.z)>1e-4)out[name]=[d.x,d.y,d.z,d.w];}
    return out;
  }
  function commit(text,undoKey=null){const pose=read();edit(key,x=>{if(Object.keys(pose).length)x.pose=pose;else delete x.pose;},text,{undoKey});}
  // The selected joint's turn from the built pose, as three angles (degrees): bend, twist (about the bone), side.
  function angles(name=joint){
    const rig=rigOf(),b=name&&bone(name);if(!b)return [0,0,0];const THREE=T();
    const d=rig.rest.get(name).clone().invert().multiply(b.quaternion),e=new THREE.Euler().setFromQuaternion(d,'XYZ');
    return [e.x,e.y,e.z].map(v=>r1(THREE.MathUtils.radToDeg(v)));
  }
  function setAngle(axis,deg){
    const rig=rigOf(),b=joint&&bone(joint);if(!b)return;const THREE=T(),a=angles();a[axis]=deg;
    b.quaternion.copy(rig.rest.get(joint)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.map(THREE.MathUtils.degToRad),'XYZ')));
    commit(`${personName(entry(key))}: ${label(joint).toLowerCase()} ${['bend','twist','side'][axis]} ${r1(deg)}°.`,'pose-'+key+joint+axis);
  }
  function reset(which){
    const rig=rigOf(),e=entry(key);if(!rig||!e)return;const name=personName(e);
    if(which==='all'){if(!e.pose){status(`${name} is in the posture as built.`);return;}for(const [n,b] of rig.bones)b.quaternion.copy(rig.rest.get(n));commit(`${name}: back to the posture as built. Undo brings your adjustments back.`);return;}
    if(!joint)return;const re=which==='limb'?limbOf(joint):null,side=sideOf(joint),group=info(joint)[2];
    const names=which==='joint'?[joint]:re?[...rig.bones.keys()].filter(n=>re.test(n)&&sideOf(n)===side):JOINTS.filter(j=>j[2]===group).map(j=>j[0]);
    for(const n of names)bone(n)?.quaternion.copy(rig.rest.get(n));
    commit(which==='joint'?`${name}: ${label(joint).toLowerCase()} back as built.`:`${name}: ${group.toLowerCase()} back as built.`);
  }
  // This side's arm or leg adjustments, mirrored onto the other side.
  function mirror(){
    const rig=rigOf(),re=joint&&limbOf(joint),side=sideOf(joint);if(!rig||!re||!side)return;const other=side==='l'?'r':'l';let n=0;
    for(const [name,b] of rig.bones){
      if(!re.test(name)||sideOf(name)!==side)continue;const twin=name.slice(0,-1)+other,tb=bone(twin);if(!tb)continue;
      const d=rig.rest.get(name).clone().invert().multiply(b.quaternion);d.set(d.x,-d.y,-d.z,d.w);tb.quaternion.copy(rig.rest.get(twin)).multiply(d);n++;
    }
    if(n)commit(`${personName(entry(key))}: ${info(joint)[2].toLowerCase()} adjustments copied to the ${other==='l'?'left':'right'} side.`);
  }
  // Fingers, per hand: a slider from open, through the hand as built (0), to a fist (100). Every joint bends toward the
  // palm about the axis across the finger; a fist is the same finger angles on anyone, whatever curl the posture has.
  const SHARE={1:38,2:46,3:30},FIST={1:88,2:104,3:72},OPEN={1:32,2:42,3:26},KF={thumb:.62,index:.95,middle:1,ring:1.03,pinky:1.06};
  const fingerBones=side=>FINGERS.flatMap(f=>[1,2,3].map(j=>[f,j,`${f}_0${j}_${side}`])).filter(([,,n])=>bone(n));
  // How much of the last joint's bend can be measured: only where the fingertip has a bone of its own.
  const tipShare=side=>bone(`middle_03_${side}`)?.children.some(x=>x.isBone)?.5:0;
  // The bend at the middle finger's second joint (degrees), now and in the posture as built.
  function bend(side,rest=false){
    const rig=rigOf(),THREE=T(),names=[1,2,3].map(j=>`middle_0${j}_${side}`);if(!rig||names.some(n=>!bone(n)))return 0;
    const keep=rest?fingerBones(side).map(([,,n])=>[n,bone(n).quaternion.clone()]):null;
    if(rest)for(const [n] of keep)bone(n).quaternion.copy(rig.rest.get(n));
    h.object.updateWorldMatrix(true,true);
    const [a,b,c]=names.map(n=>bone(n).getWorldPosition(new THREE.Vector3())),tip=bone(names[2]).children.find(x=>x.isBone),d=tip?tip.getWorldPosition(new THREE.Vector3()):c.clone().add(c.clone().sub(b));
    const angle=THREE.MathUtils.radToDeg(b.clone().sub(a).angleTo(c.clone().sub(b)))+THREE.MathUtils.radToDeg(c.clone().sub(b).angleTo(d.clone().sub(c)))*tipShare(side);
    if(rest){for(const [n,q] of keep)bone(n).quaternion.copy(q);h.object.updateWorldMatrix(true,true);}
    return angle;
  }
  // Where the slider stands for that hand (-100 open … 0 as built … 100 fist).
  function gripValue(side){
    if(!rigOf()||!bone('hand_'+side))return 0;
    const w=tipShare(side),rest=bend(side,true),now=bend(side),full=Math.max(8,FIST[2]+FIST[3]*w-rest),open=Math.max(8,Math.min(rest+6,OPEN[2]+OPEN[3]*w));
    return Math.round(Math.max(-100,Math.min(100,now>=rest?(now-rest)/full*100:(now-rest)/open*100))/5)*5;
  }
  function setGrip(side,value){
    const rig=rigOf();if(!rig||!bone('hand_'+side))return;const THREE=T(),V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),pos=n=>bone(n).getWorldPosition(V());
    const v=Math.max(-100,Math.min(100,value))/100,restCurl=Math.max(0,bend(side,true))/(SHARE[2]+SHARE[3]*tipShare(side));     // the curl the posture already has (pose_lib's amount)
    for(const [,,n] of fingerBones(side))bone(n).quaternion.copy(rig.rest.get(n));
    h.object.updateWorldMatrix(true,true);
    const along=pos('middle_01_'+side).sub(pos('hand_'+side)),across=pos('pinky_01_'+side).sub(pos('index_01_'+side)),n=(side==='l'?across.clone().cross(along):along.clone().cross(across)).normalize();
    // one hinge axis per finger, from the finger as built (across the finger, in the palm's plane): every joint of that
    // finger turns about it. (Taking it from each joint's own direction flips it once the finger has curled past the palm.)
    const dir=name=>{const b=bone(name),child=b.children.find(c=>c.isBone);return (child?child.getWorldPosition(V()).sub(pos(name)):pos(name).sub(b.parent.getWorldPosition(V()))).normalize();};
    const axes=Object.fromEntries(FINGERS.filter(f=>bone(`${f}_01_${side}`)).map(f=>[f,dir(`${f}_01_${side}`).cross(n)]));
    const turnWorld=(b,axis,degrees)=>{b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(Q().setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees)).multiply(b.getWorldQuaternion(Q())))).normalize();b.updateWorldMatrix(false,true);};
    for(const [f,j,name] of fingerBones(side)){
      if(f==='thumb')continue;
      const b=bone(name),k=KF[f],degrees=v>=0?v*Math.max(0,FIST[j]-restCurl*SHARE[j])*k:v*Math.min(OPEN[j],restCurl*SHARE[j]+6)*k,axis=axes[f];if(Math.abs(degrees)<.01||!axis||axis.lengthSq()<1e-10)continue;
      const turn=Q().setFromAxisAngle(axis.clone().normalize(),THREE.MathUtils.degToRad(degrees));
      b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(turn.multiply(b.getWorldQuaternion(Q())))).normalize();b.updateWorldMatrix(false,true);
    }
    // The thumb closes last, onto the fingers it wraps: its first bone swings until the thumb points at the outside of the
    // curled middle finger, then its two joints bend the rest of the way (each within what a thumb does).
    const thumb=[1,2,3].map(j=>bone(`thumb_0${j}_${side}`));
    if(v>0&&thumb.every(Boolean)&&bone('middle_02_'+side)){
      const tip=()=>{const c=thumb[2].children.find(x=>x.isBone);return c?c.getWorldPosition(V()):pos(thumb[2].name).add(pos(thumb[2].name).sub(pos(thumb[1].name)));};
      const target=pos('middle_02_'+side).add(n.clone().multiplyScalar(along.length()*.16));
      for(const [b,most] of [[thumb[0],58],[thumb[1],26],[thumb[2],34]]){
        const head=pos(b.name),now=tip().sub(head),want=target.clone().sub(head),axis=now.clone().cross(want);if(axis.lengthSq()<1e-14)continue;
        turnWorld(b,axis.normalize(),Math.min(THREE.MathUtils.radToDeg(now.angleTo(want)),most)*v);
      }
    }
    commit(`${personName(entry(key))}: ${side==='l'?'left':'right'} hand ${v>.95?'in a fist':v>0?'closed '+Math.round(v*100)+' %':v<0?'opened':'as built'}.`,'pose-grip-'+key+side);
  }
  // ---- mode
  function pick(name){if(!info(name))return;joint=name;gmode=info(name)[3]?'translate':'rotate';status(`${label(name)}: ${info(name)[3]?'drag the arrows to move the whole limb (W), or turn the joint itself (E).':'turn it with the rings, or type Bend / Twist / Side.'}`);rerender();}
  function enter(k){
    const e=entry(k);if(!e)return;key=k;joint=null;gmode='rotate';
    status(`Pose mode: ${personName(e)}. Click a dot on the body: blue turns a joint, orange (hands, feet) moves the whole limb. Esc or Done leaves.`);rerender();
  }
  function exit(){if(!key)return;key=null;joint=null;drag=null;dispose();rerender();}
  function setMode(m){if(!key)return false;if(m==='translate'&&!limb()){status('Only hands and feet move (the limb follows). Other joints turn: E.');return true;}if(m==='translate'||m==='rotate'){gmode=m;rerender();}return true;}
  // ---- the People tab while posing
  const num=(labelText,name,value)=>`<label>${labelText}<input type="number" name="${name}" value="${value}" step="2" min="-180" max="180"><small>°</small></label>`;
  function panel(head){
    const e=entry(key),ready=!!rigOf(),groups=[...new Set(JOINTS.map(j=>j[2]))],a=angles(),side=joint&&sideOf(joint),adjusted=Object.keys(e?.pose||{}).length;
    return `<section class="people-selected people-pose" data-reveal="person">${head}
      <div class="people-pose-bar"><strong>Pose mode</strong><span>${adjusted?`${adjusted} joint${adjusted===1?'':'s'} adjusted`:'as built'}</span><button type="button" class="primary" data-action="pe-pose-done">Done</button></div>
      ${ready?'':'<p class="director-hint people-busy">Loading the skeleton…</p>'}
      <p class="director-hint">Click a dot on the body. <b class="pose-fk">Blue</b> dots turn a joint. <b class="pose-ik">Orange</b> dots (hands, feet) drag the whole arm or leg. Undo steps back one adjustment.</p>
      <h4>Joint</h4>
      <select name="pe-joint" aria-label="Joint"><option value="">Choose a joint…</option>${groups.map(g=>`<optgroup label="${escape(g)}">${JOINTS.filter(j=>j[2]===g).map(j=>`<option value="${j[0]}" ${j[0]===joint?'selected':''}>${escape(j[1])}${e?.pose?.[j[0]]?' •':''}</option>`).join('')}</optgroup>`).join('')}</select>
      ${joint?`${limb()?`<div class="director-actions people-modes"><button type="button" data-action="pe-pose-move" aria-pressed="${gmode==='translate'}" title="Drag the hand or foot; the limb follows (W)">Move limb</button><button type="button" data-action="pe-pose-turn" aria-pressed="${gmode==='rotate'}" title="Turn the wrist or ankle itself (E)">Turn joint</button></div>`:''}
      <div class="director-row people-fields pose-angles">${num('Bend','pe-rx',a[0])}${num('Twist','pe-ry',a[1])}${num('Side','pe-rz',a[2])}</div>
      <div class="director-actions"><button type="button" data-action="pe-pose-reset-joint" title="This joint back to the posture as built (Delete)">Reset joint</button><button type="button" data-action="pe-pose-reset-limb">Reset ${escape(info(joint)[2].toLowerCase())}</button>${side&&limbOf(joint)?`<button type="button" data-action="pe-pose-mirror" title="Copy this side's adjustments to the other side, mirrored">Copy to the ${side==='l'?'right':'left'} side</button>`:''}</div>`:''}
      <h4>Fingers</h4>
      <div class="pose-grip">${['l','r'].map(sd=>`<label>${sd==='l'?'Left hand':'Right hand'}<input type="range" name="pe-grip-${sd}" min="-100" max="100" step="5" value="${ready?gripValue(sd):0}" ${ready?'':'disabled'} aria-label="${sd==='l'?'Left':'Right'} hand: open to fist"></label>`).join('')}<small>open</small><small>as built</small><small>fist</small></div>
      <h4>Save this pose</h4>
      <div class="pose-save"><input type="text" name="pe-pose-name" maxlength="44" placeholder="Name, for example: Leaning in" autocomplete="off" spellcheck="false" aria-label="Name for the saved pose"><button type="button" data-action="pe-pose-save" ${adjusted?'':'disabled'} title="Keeps this pose under that name; it never replaces another saved pose">Save pose</button></div>
      ${saved?saved(e):''}
      <div class="director-actions people-end"><button type="button" data-action="pe-pose-reset" ${adjusted?'':'disabled'}>Reset the whole pose</button></div>
    </section>`;
  }
  function action(name,index){
    if(name==='pe-pose-done'){exit();status('Pose kept. Double-click the person to adjust it again.');return true;}
    if(!key)return false;
    if(name==='pe-pose-move'){setMode('translate');return true;}
    if(name==='pe-pose-turn'){setMode('rotate');return true;}
    if(name==='pe-pose-reset'){reset('all');return true;}
    if(name==='pe-pose-reset-joint'){reset('joint');return true;}
    if(name==='pe-pose-reset-limb'){reset('limb');return true;}
    if(name==='pe-pose-mirror'){mirror();return true;}
    return false;
  }
  function changed(el){
    if(!key)return false;
    if(el.name==='pe-joint'){if(el.value)pick(el.value);else{joint=null;rerender();}return true;}
    if(el.name==='pe-grip-l'||el.name==='pe-grip-r'){setGrip(el.name.slice(-1),Number(el.value)||0);return true;}
    if(el.name==='pe-pose-name')return true;      // read when Save pose is pressed
    const axis=['pe-rx','pe-ry','pe-rz'].indexOf(el.name);
    if(axis>=0){const v=Number(el.value);if(el.value.trim()===''||!Number.isFinite(v))throw Error('Type a number of degrees.');setAngle(axis,Math.max(-180,Math.min(180,v)));return true;}
    return false;
  }
  return {enter,exit,tick,panel,action,changed,setMode,personAt,active:()=>key,joint:()=>joint,jointLabel:()=>joint?label(joint):'',resetJoint:()=>reset('joint'),ready:()=>!!rigOf()};
}
