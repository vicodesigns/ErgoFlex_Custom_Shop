// The People track's PROGRAMMED diamonds (S31 M4): what a chapter's `people` already makes happen, derived for the
// Director's timeline (one row per person: the placements of one character share a row). Pure; no three.js.
//   in / out      a placement comes in (its `when` window starts after 0) or goes out (ends before the chapter does)
//   change        a posture change: one placement of the character ends where the next begins (same second)
//   walk-start, walk-point (each waypoint), walk-end (arrival)        walk { path | to, start, pace }
//   roll-start, roll-point, roll-end                                  roll { path | to, start, speed, ease, radius }
//   act, act-end  an action (a screen pull, a tap): act { at, dur }
// Dragging a diamond retimes it (retimeDiamond). What is linked:
//   in / out      that edge of the placement's window; change: the end of the one AND the start of the next (they stay
//                 one cut, no gap, no overlap); a walk or roll that starts as that placement comes in starts with it
//                 (its own start diamond is then the change's: "posture change, starts rolling")
//   walk-start / roll-start   walk.start / roll.start: the whole walk or roll moves with it (its waypoints and arrival)
//   walk-end / roll-end / a waypoint   the pace (walk) or speed (roll) so that point is reached at the new second; the
//                 start stays (a waypoint before the start cannot be dragged before it)
//   act / act-end act.at (the action moves, its length kept) / act.dur
// Nothing else follows: a placement that takes over at the arrival keeps its own window (drag its change diamond).
import {poseAt,setPoseKey,removePoseKey,cleanPoseKeys,KEY_SNAP} from '../people-pose-keys.mjs';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const r3=v=>Math.round(v*1000)/1000;
export const characterOf=e=>String(e?.id||'').replace(/^people-/,'').split('-')[0]||e?.key||'person';
// The walk's or roll's points in metres: its path, or from where it stands to `to`.
function pathOf(e,m){
  const raw=m.path||[m.from||e.at,m.to];if(!Array.isArray(raw)||raw.length<2)return null;
  const p=raw.map(q=>Array.isArray(q)&&finite(q[0])&&finite(q[1])?[q[0]/1000,q[1]/1000]:null);return p.every(Boolean)?p:null;
}
const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
// Distances along the path where it passes each point (a roll's corners are rounded: room-people-motion.mjs rollPlan;
// the point's distance is the middle of its arc).
function along(P,R=0){
  const s=[0];let total=0;
  for(let i=1;i<P.length;i++){
    let l=dist(P[i-1],P[i]);
    total+=l;s.push(total);
  }
  if(!R)return {length:total,at:s};
  // corner savings (rollPlan: tangent length min(R tan(turn/2), l1/2, l2/2), arc r * turn)
  let cut=0;const at=[0];
  for(let i=1;i<P.length;i++){
    const before=cut;
    if(i<P.length-1){
      const a=P[i-1],c=P[i],b=P[i+1],l1=dist(a,c),l2=dist(c,b);
      if(l1>1e-9&&l2>1e-9){
        const d1=[(c[0]-a[0])/l1,(c[1]-a[1])/l1],d2=[(b[0]-c[0])/l2,(b[1]-c[1])/l2],turn=Math.acos(Math.max(-1,Math.min(1,d1[0]*d2[0]+d1[1]*d2[1])));
        if(turn>=1e-4&&turn<=Math.PI-1e-3){const tl=Math.min(R*Math.tan(turn/2),l1/2,l2/2),r=tl/Math.tan(turn/2);cut+=2*tl-r*turn;at.push(s[i]-before-(tl-r*turn/2));continue;}
      }
    }
    at.push(s[i]-before);
  }
  at[at.length-1]=total-cut;return {length:total-cut,at};
}
// rollPlan's clock: up over `ease` seconds, steady, down over `ease` (a short path never reaches `speed`).
export function rollClock(length,speed=.8,ease=1.2){
  ease=Math.max(.05,ease);const v=Math.min(speed,length/ease),seconds=length/v+ease,ramp=u=>u*u*u-u*u*u*u/2;
  const travel=t=>{t=Math.min(seconds,Math.max(0,t));if(t<ease)return v*ease*ramp(t/ease);if(t>seconds-ease)return length-v*ease*ramp((seconds-t)/ease);return v*ease/2+v*(t-ease);};
  const timeAt=s=>{let lo=0,hi=seconds;for(let i=0;i<50;i++){const m=(lo+hi)/2;if(travel(m)<s)lo=m;else hi=m;}return (lo+hi)/2;};
  return {seconds,travel,timeAt,v};
}
// A walk's clock (room-people-motion.mjs walkPlan): strides of about 0.64 leg (0.56 m for a grown-up), two more steps to
// stand at the end, `pace` steps a second; the travel is close to even in time. `seconds(key)` may give the live
// stage's exact length.
export const WALK_STEP=.56;
export function walkClock(length,pace=1.8,step=WALK_STEP){const steps=Math.max(1,Math.round(length/step))+2;return {seconds:steps/pace,steps};}
function motionTimes(e,kind,opts){
  const m=e[kind];if(!m||typeof m!=='object')return null;const P=pathOf(e,m);if(!P)return null;const start=finite(m.start)?m.start:0;
  if(kind==='roll'){
    const g=along(P,finite(m.radius)?m.radius/1000:.45),clock=rollClock(g.length,finite(m.speed)?m.speed:.8,finite(m.ease)?m.ease:1.2);
    return {start,points:g.at.map(s=>start+clock.timeAt(s)),end:start+clock.seconds};
  }
  const g=along(P),exact=opts.walkSeconds?.(e.key),secs=finite(exact)&&exact>0?exact:walkClock(g.length,finite(m.pace)?m.pace:1.8).seconds;
  return {start,points:g.at.map(s=>start+(g.length>0?s/g.length:0)*secs),end:start+secs};
}
// [{row, key, kind, t, index?, label}] sorted by row then time. rows: [{row, label, keys}] in cast order.
export function programmedDiamonds(people,seconds,opts={}){
  const cast=(people?.cast||[]).filter(e=>e&&typeof e==='object'&&e.hide!==true),when=people?.when||{},T=finite(seconds)?seconds:Infinity,out=[],rows=[];
  for(const e of cast){const row=characterOf(e);let r=rows.find(x=>x.row===row);if(!r)rows.push(r={row,label:row[0].toUpperCase()+row.slice(1),keys:[]});r.keys.push(e.key||e.id);}
  const spanOf=e=>(Array.isArray(when[e.key||e.id])?when[e.key||e.id]:null);
  const push=(e,kind,t,label,extra={})=>{if(finite(t)&&t>=-1e-6&&t<=T+1e-6)out.push({row:characterOf(e),key:e.key||e.id,kind,t:r3(t),label,...extra});};
  for(const e of cast){
    const spans=spanOf(e)||[],row=characterOf(e),mates=cast.filter(x=>x!==e&&characterOf(x)===row);
    spans.forEach(([t0,t1],i)=>{
      const from=mates.find(x=>(spanOf(x)||[]).some(s=>Math.abs(s[1]-t0)<1e-3));
      if(t0>1e-6&&!from)push(e,'in',t0,'comes in',{span:i});
      const to=mates.find(x=>(spanOf(x)||[]).some(s=>Math.abs(s[0]-t1)<1e-3));
      if(to&&t1<T-1e-6)push(e,'change',t1,'posture change',{span:i,next:to.key||to.id});
      else if(t1<T-1e-6)push(e,'out',t1,'goes out',{span:i});
    });
    for(const kind of ['walk','roll']){
      const m=motionTimes(e,kind,opts);if(!m)continue;
      // (a walk or roll that starts as its placement takes over is that change's diamond: dragging it moves both)
      const merged=out.find(d=>(d.kind==='change'&&d.next===(e.key||e.id)||d.kind==='in'&&d.key===(e.key||e.id))&&Math.abs(d.t-m.start)<1e-3);
      if(merged)merged.label+=kind==='walk'?', starts walking':', starts rolling';
      else push(e,kind+'-start',m.start,kind==='walk'?'starts walking':'starts rolling');
      m.points.slice(1,-1).forEach((t,i)=>push(e,kind+'-point',t,'waypoint '+(i+2),{index:i+1}));
      push(e,kind+'-end',m.end,'arrives',{index:m.points.length-1});
    }
    if(e.act&&finite(e.act.at)){push(e,'act',e.act.at,'action');if(finite(e.act.dur)&&e.act.dur>0)push(e,'act-end',e.act.at+e.act.dur,'action ends');}
  }
  const order=new Map(rows.map((r,i)=>[r.row,i]));out.sort((a,b)=>order.get(a.row)-order.get(b.row)||a.t-b.t);
  return {rows,diamonds:out};
}
// The people object with that diamond moved to second t (a new object; the input is not changed). Returns null when
// the move is not possible (an arrival before its start).
export function retimeDiamond(people,d,t,seconds=Infinity,opts={}){
  const p=structuredClone(people),e=p.cast.find(x=>(x.key||x.id)===d.key);if(!e)return null;
  t=r3(Math.max(0,Math.min(finite(seconds)?seconds:t,t)));
  const spans=k=>p.when?.[k];
  if(d.kind==='in'||d.kind==='out'||d.kind==='change'){
    const s=spans(d.key)?.[d.span];if(!s)return null;
    // the placement that comes in here: a walk or roll that started as it came in starts with it at the new second
    const follow=x=>{for(const kind of ['walk','roll']){const m=x?.[kind];if(m&&finite(m.start)&&Math.abs(m.start-(d.kind==='in'?s[0]:s[1]))<1e-3)m.start=t;}};
    if(d.kind==='in'){if(t>=s[1]-.05)return null;follow(e);s[0]=t;return p;}
    if(t<=s[0]+.05)return null;
    if(d.kind==='change'){const n=spans(d.next)?.find(x=>Math.abs(x[0]-s[1])<1e-3);if(!n||t>=n[1]-.05)return null;follow(p.cast.find(x=>(x.key||x.id)===d.next));n[0]=t;}
    s[1]=t;return p;
  }
  if(d.kind==='act'){e.act.at=t;return p;}
  if(d.kind==='act-end'){if(t<=e.act.at+.05)return null;e.act.dur=r3(t-e.act.at);return p;}
  const kind=d.kind.startsWith('walk')?'walk':'roll',m=e[kind];if(!m)return null;
  if(d.kind.endsWith('-start')){m.start=t;return p;}
  // a waypoint or the arrival: the pace / speed that reaches it at t
  const was=motionTimes(e,kind,opts),start=finite(m.start)?m.start:0,old=d.kind.endsWith('-end')?was.end:was.points[d.index];
  if(!was||t<=start+.2||old<=start+1e-6)return null;
  const k=(old-start)/(t-start);   // > 1: faster
  if(kind==='walk'){m.pace=Math.round(Math.max(.4,Math.min(4,(finite(m.pace)?m.pace:1.8)*k))*100)/100;return p;}
  // a roll's time is not proportional to its speed (the ease is fixed): search the speed
  const P=pathOf(e,m),g=along(P,finite(m.radius)?m.radius/1000:.45),ease=finite(m.ease)?m.ease:1.2,s=d.kind.endsWith('-end')?g.length:g.at[d.index];
  let lo=.05,hi=4;for(let i=0;i<50;i++){const v=(lo+hi)/2,c=rollClock(g.length,v,ease);if(start+c.timeAt(s)>t)lo=v;else hi=v;}
  m.speed=Math.round((lo+hi)/2*100)/100;return p;
}

// ---- S33 (A2): the People KEYFRAME SHEET (After Effects twirl-down / Blender dope sheet) ---------------------------
// The same data as above and as the pose keys (people-pose-keys.mjs), drawn as an animation package draws it: one row
// per character (collapsed: a small diamond wherever any of its properties has a key, a thin bar while on screen);
// twirled open: property rows
//   screen    'On screen': a bar per placement (its posture); keys at its edges: in / out / change (retimeDiamond links)
//   path      'Path': set off, each waypoint, arrival (a set-off merged with a placement edge is that edge's key)
//   actions   'Actions': a bar per action (act.at .. + dur); keys act / act-end
//   pose      'Pose': the pose keys (cast[i].poseKeys); twirled again, a row per keyed joint ('joint' keys)
// Every key has a stable id: kind|entry|n  (n: the span, the point index; pose keys: the time, joint keys: time|bone).
// Only pose keys have an interpolation (their ease); the time keys of the programmed motion have none.
export const SHEET_PROPS=[['screen','On screen'],['path','Path'],['actions','Actions'],['pose','Pose']];
const motionOf=(e,kind)=>{const m=e?.[kind];return m&&typeof m==='object'?m:null;};
export function sheet(people,seconds,opts={}){
  const T=finite(seconds)?seconds:0,{rows,diamonds}=programmedDiamonds(people,T,opts),cast=(people?.cast||[]).filter(e=>e&&typeof e==='object');
  const when=people?.when||{},byKey=k=>cast.find(e=>(e.key||e.id)===k),order=opts.jointOrder||[];
  const rank=b=>{const i=order.indexOf(b);return i<0?order.length:i;};
  return rows.map(r=>{
    const mine=diamonds.filter(d=>d.row===r.row),screen=[],path=[],actions=[],pose=[],joints=new Map(),bars=[],actBars=[];
    for(const d of mine){
      const edge=d.kind==='in'||d.kind==='out'||d.kind==='change';
      const k={id:`${d.kind}|${d.key}|${edge?d.span:d.index??0}`,row:r.row,entry:d.key,kind:d.kind,t:d.t,label:d.label,d};
      if(edge){k.prop='screen';screen.push(k);}
      else if(d.kind==='act'||d.kind==='act-end'){k.prop='actions';actions.push(k);}
      else{k.prop='path';path.push(k);}
    }
    for(const key of r.keys){
      const e=byKey(key);if(!e)continue;
      const spans=Array.isArray(when[key])?when[key]:null;
      (spans||[[0,T]]).forEach(([a,b],i)=>{const t0=Math.max(0,a),t1=Math.min(finite(b)?b:T,T);if(t1>t0)bars.push({entry:key,span:spans?i:null,t0:r3(t0),t1:r3(t1),label:opts.label?.(e)||e.id});});
      // a set-off that is a placement edge's key (programmedDiamonds merged it): shown on the Path row too, as that edge
      for(const kind of ['walk','roll']){
        const m=motionOf(e,kind);if(!m||path.some(k=>k.entry===key&&k.kind===kind+'-start'))continue;
        const start=finite(m.start)?m.start:0,merged=mine.find(d=>(d.kind==='change'&&d.next===key||d.kind==='in'&&d.key===key)&&Math.abs(d.t-start)<1e-3);
        if(merged)path.push({id:`${kind}-start|${key}|0`,row:r.row,entry:key,kind:kind+'-start',t:merged.t,label:merged.label,d:merged,prop:'path',linked:true});
      }
      if(e.act&&finite(e.act.at))actBars.push({entry:key,t0:e.act.at,t1:e.act.at+(finite(e.act.dur)&&e.act.dur>0?e.act.dur:0)});
      for(const pk of Array.isArray(e.poseKeys)?e.poseKeys:[]){
        if(!finite(pk.t))continue;const bones=Object.keys(pk.pose||{}),ease=pk.ease||'smooth';
        pose.push({id:`pose|${key}|${pk.t}`,row:r.row,entry:key,kind:'pose',prop:'pose',t:pk.t,ease,bones,label:`pose key (${bones.length} joint${bones.length===1?'':'s'})`});
        for(const b of bones){if(!joints.has(b))joints.set(b,[]);joints.get(b).push({id:`pose|${key}|${pk.t}|${b}`,row:r.row,entry:key,kind:'joint',prop:'joint',bone:b,t:pk.t,ease,label:b});}
      }
    }
    const byT=(a,b)=>a.t-b.t;for(const l of [screen,path,actions,pose])l.sort(byT);
    const summary=[...new Set([...screen,...path,...actions,...pose].map(k=>k.t))].sort((a,b)=>a-b);
    return {row:r.row,label:r.label,entries:r.keys,summary,bars,actBars,
      props:{screen,path,actions,pose},joints:[...joints.entries()].sort((a,b)=>rank(a[0])-rank(b[0])||a[0].localeCompare(b[0])).map(([bone,keys])=>({bone,keys:keys.sort(byT)}))};
  });
}
// Every key of the sheet by id (joint keys included).
export function sheetKeys(rows){
  const out=new Map();
  for(const r of rows){for(const l of Object.values(r.props))for(const k of l)out.set(k.id,k);for(const j of r.joints)for(const k of j.keys)out.set(k.id,k);}
  return out;
}
// Selection: a click replaces it; Shift+click (toggle) adds the key or takes it out; a marquee replaces it or (add) joins it.
export function pick(selection,ids,{add=false,toggle=false}={}){
  const out=new Set(add||toggle?selection:[]);
  for(const id of ids){if(toggle&&selection.has(id)&&ids.length===1)out.delete(id);else out.add(id);}
  return out;
}
// The key time before / after t among `times` (dir -1 / +1), or undefined.
export function neighborTime(times,t,dir){
  const s=[...new Set(times)].sort((a,b)=>a-b);
  return dir<0?s.reverse().find(x=>x<t-1e-3):s.find(x=>x>t+1e-3);
}
const entryOf=(p,key)=>p.cast.find(x=>(x.key||x.id)===key);
const poseKind=k=>k.kind==='pose'||k.kind==='joint';
const nearKey=(l,t)=>(l||[]).find(k=>Math.abs(k.t-t)<KEY_SNAP-1e-9);
const putKeys=(e,n)=>{if(n.poseKeys)e.poseKeys=n.poseKeys;else delete e.poseKeys;};
// Pose keys of one entry moved by dt together: the whole keys (with their ease) and single joints of keys; what lands
// on a key that stays merges into it (the moved joints win). false when a key would leave 0..T.
function shiftPose(e,items,dt,T){
  const keys=(e.poseKeys||[]).map(k=>({...k,pose:{...k.pose}})),moved=[];
  const whole=new Set(items.filter(i=>!i.bone).map(i=>i.t));
  for(const i of items){
    const at=nearKey(keys,i.t);if(!at)continue;const to=r3(i.t+dt);if(to<0||to>T+1e-6)return false;
    if(!i.bone){moved.push({t:to,pose:at.pose,ease:at.ease,whole:true});keys.splice(keys.indexOf(at),1);}
    else if(!whole.has(i.t)&&at.pose[i.bone]){moved.push({t:to,pose:{[i.bone]:at.pose[i.bone]},ease:at.ease});delete at.pose[i.bone];if(!Object.keys(at.pose).length)keys.splice(keys.indexOf(at),1);}
  }
  for(const m of moved){
    const there=nearKey(keys,m.t);
    if(there){Object.assign(there.pose,m.pose);if(m.whole){if(m.ease)there.ease=m.ease;else delete there.ease;}}
    else keys.push({t:m.t,pose:{...m.pose},...(m.ease?{ease:m.ease}:{})});
  }
  const clean=cleanPoseKeys(keys);if(clean)e.poseKeys=clean;else delete e.poseKeys;return true;
}
const ORDER={in:0,out:0,change:0,'walk-start':1,'roll-start':1,act:1,'walk-point':2,'roll-point':2,'walk-end':2,'roll-end':2,'act-end':2};
// Moves the keys by dt seconds together (one edit): {people, ids: old id -> new id} or {error}. The placement edges go
// first (the later ones first when moving later), then what moves a whole motion or action (its set-off, act.at), then
// the waypoints / arrivals / action ends that are not already where they should be (a set-off moved with its walk
// carries them). Nothing is changed when one of them cannot move (the people given are never changed).
export function shiftKeys(people,keys,dt,seconds,opts={}){
  const T=finite(seconds)?seconds:Infinity;let p=structuredClone(people);const ids=new Map();
  if(!keys.length||!finite(dt))return {people:p,ids};
  const timed=keys.filter(k=>!poseKind(k)).sort((a,b)=>ORDER[a.kind]-ORDER[b.kind]||(ORDER[a.kind]===0?(dt>0?b.t-a.t:a.t-b.t):a.t-b.t));
  const done=new Set();
  for(const k of timed){
    const sig=k.d.kind+'|'+k.d.key+'|'+(k.d.span??k.d.index??0);if(done.has(sig))continue;done.add(sig);
    const want=r3(k.t+dt);if(want<-1e-6||want>T+1e-6)return {error:`${k.entry}: ${k.label} would leave the chapter.`};
    if(ORDER[k.kind]===2){
      const now=programmedDiamonds(p,T,opts).diamonds.find(d=>d.key===k.d.key&&d.kind===k.d.kind&&(d.index??0)===(k.d.index??0));
      if(now&&Math.abs(now.t-want)<.02)continue;
    }
    const next=retimeDiamond(p,k.d,want,T,opts);
    if(!next)return {error:`${k.entry}: ${k.label} cannot go to ${want.toFixed(2)} s (${k.kind.endsWith('-end')||k.kind.endsWith('-point')?'it cannot arrive before it sets off':'that would leave no time in that window'}).`};
    p=next;
  }
  const byEntry=new Map();for(const k of keys.filter(poseKind)){if(!byEntry.has(k.entry))byEntry.set(k.entry,[]);byEntry.get(k.entry).push(k);}
  for(const [key,list] of byEntry){
    const e=entryOf(p,key);if(!e)return {error:`${key} is not in the cast.`};
    if(!shiftPose(e,list.map(k=>({t:k.t,bone:k.kind==='joint'?k.bone:null})),dt,T))return {error:'A pose key would leave the chapter.'};
    for(const k of list){const t=(nearKey(e.poseKeys,r3(k.t+dt))?.t)??r3(k.t+dt);ids.set(k.id,k.kind==='joint'?`pose|${key}|${t}|${k.bone}`:`pose|${key}|${t}`);}
  }
  return {people:p,ids};
}
// Deletes what can be deleted: pose keys (whole, or one joint of a key) and the waypoints between set-off and arrival
// (path points). The rest is the programmed motion's own timing: it is moved, not deleted (`skipped` lists them).
export function deleteKeys(people,keys){
  const p=structuredClone(people);let removed=0;const skipped=[],points=new Map();
  for(const k of keys){
    if(poseKind(k)){const e=entryOf(p,k.entry);if(!e)continue;const before=JSON.stringify(e.poseKeys||null);putKeys(e,removePoseKey(e,k.t,k.kind==='joint'?k.bone:null));if(JSON.stringify(e.poseKeys||null)!==before)removed++;continue;}
    if(k.kind==='walk-point'||k.kind==='roll-point'){const m=motionOf(entryOf(p,k.entry),k.kind.split('-')[0]);if(Array.isArray(m?.path)){const id=k.entry+'|'+k.kind;if(!points.has(id))points.set(id,{m,idx:[]});points.get(id).idx.push(k.d.index);continue;}}
    skipped.push(k);
  }
  for(const {m,idx} of points.values())for(const i of [...new Set(idx)].sort((a,b)=>b-a))if(i>0&&i<m.path.length-1&&m.path.length>2){m.path.splice(i,1);removed++;}
  return {people:p,removed,skipped};
}
// Copy: the pose keys of the selection, relative to the earliest. Paste: at t, onto the same people (or `to`: one
// entry that takes them all, the person selected now).
export function copyKeys(people,keys){
  const pk=keys.filter(poseKind),t0=Math.min(...pk.map(k=>k.t)),items=[];
  for(const k of pk){
    const at=nearKey(entryOf(people,k.entry)?.poseKeys,k.t);if(!at)continue;
    if(k.kind==='joint'&&pk.some(x=>x.kind==='pose'&&x.entry===k.entry&&x.t===k.t))continue;   // (its whole key is copied)
    const pose=k.kind==='joint'?(at.pose[k.bone]?{[k.bone]:at.pose[k.bone]}:null):at.pose;if(!pose)continue;
    items.push({entry:k.entry,dt:r3(k.t-t0),pose:structuredClone(pose),...(k.kind==='pose'&&at.ease?{ease:at.ease}:{}),whole:k.kind==='pose'});
  }
  return {items,skipped:keys.length-pk.length};
}
export function pasteKeys(people,clip,t,seconds,{to=null}={}){
  const p=structuredClone(people),ids=[],T=finite(seconds)?seconds:Infinity;
  for(const it of clip?.items||[]){
    const key=to||it.entry,e=entryOf(p,key),at=r3(t+it.dt);if(!e||at<0||at>T+1e-6)continue;
    putKeys(e,setPoseKey(e,at,it.pose,undefined,it.whole?{ease:it.ease??'smooth'}:{}));
    const kt=nearKey(e.poseKeys,at)?.t??at;
    if(it.whole)ids.push(`pose|${key}|${kt}`);else for(const b of Object.keys(it.pose))ids.push(`pose|${key}|${kt}|${b}`);
  }
  return {people:p,ids:[...new Set(ids)]};
}
// Interpolation, as After Effects draws it: the key's shape. Only pose keys have one (the ease of the stretch that
// leaves the key; a joint key: the key it is part of).
export const EASE_SHAPES={linear:'diamond',smooth:'circle',hold:'square'};
export const NO_EASE='Set off, waypoints, arrivals, edges and actions keep the motion\'s own pace: only pose keys have an interpolation.';
export function setEase(people,keys,ease){
  const p=structuredClone(people);let n=0;
  for(const k of keys.filter(poseKind)){const at=nearKey(entryOf(p,k.entry)?.poseKeys,k.t);if(!at)continue;if(ease==='smooth')delete at.ease;else at.ease=ease;n++;}
  return {people:p,n};
}
// The placement of the character on screen at t (its entry key), else its first.
export function entryAt(people,entries,t){
  const when=people?.when||{};
  return entries.find(k=>{const s=when[k];return !Array.isArray(s)||s.some(([a,b])=>t>=a-1e-6&&t<b+1e-6);})||entries[0]||null;
}
// The ◆ of a property row at the playhead: removes the key there, else adds one. Pose: the keyed joints (or that one
// joint) as they are at t. Path: a waypoint where the person is at t, on the stretch they are on (the walk keeps its
// length; a point on a straight stretch is not rounded), or the waypoint there is taken out. {people, did, id} or
// {error}.
export function toggleKeyAt(people,row,prop,t,seconds,{bone=null,entry=null,...opts}={}){
  const p=structuredClone(people);t=r3(t);
  if(prop==='pose'||prop==='joint'){
    const key=entry||entryAt(p,row.entries,t),e=entryOf(p,key);if(!e)return {error:'Nobody to key here.'};
    const at=nearKey(e.poseKeys,t);
    if(at&&(!bone||at.pose[bone])){putKeys(e,removePoseKey(e,at.t,bone));return {people:p,did:'removed',id:bone?`pose|${key}|${at.t}|${bone}`:`pose|${key}|${at.t}`};}
    const bones=bone?[bone]:[...new Set((e.poseKeys||[]).flatMap(k=>Object.keys(k.pose)))];
    if(!bones.length)return {error:'Nothing keyed yet for them: pose them first (double-click the person, Auto-key on).'};
    const now=poseAt(e,t)||{},map=Object.fromEntries(bones.map(b=>[b,now[b]||[0,0,0,1]]));
    putKeys(e,setPoseKey(e,t,map));const kt=nearKey(e.poseKeys,t)?.t??t;
    return {people:p,did:'added',id:bone?`pose|${key}|${kt}|${bone}`:`pose|${key}|${kt}`};
  }
  if(prop==='path'){
    const here=row.props.path.find(k=>k.kind.endsWith('-point')&&Math.abs(k.t-t)<.05);
    if(here){const r=deleteKeys(p,[here]);return r.removed?{people:r.people,did:'removed',id:here.id}:{error:'That waypoint cannot be taken out.'};}
    for(const key of row.entries){
      const e=entryOf(p,key);
      for(const kind of ['walk','roll']){
        const m=motionOf(e,kind),mt=m&&motionTimes(e,kind,opts);if(!mt||!Array.isArray(m.path)||t<=mt.start+.05||t>=mt.end-.05)continue;
        const P=pathOf(e,m),g=kind==='roll'?along(P,finite(m.radius)?m.radius/1000:.45):along(P);
        // the distance travelled at t (a roll: its clock; a walk: even in time), then the stretch it is on
        const s=kind==='roll'?rollClock(g.length,finite(m.speed)?m.speed:.8,finite(m.ease)?m.ease:1.2).travel(t-mt.start):(t-mt.start)/(mt.end-mt.start)*g.length;
        let i=0;while(i<g.at.length-2&&g.at[i+1]<s)i++;
        const f=Math.max(0,Math.min(1,(s-g.at[i])/((g.at[i+1]-g.at[i])||1))),q=[Math.round((P[i][0]+(P[i+1][0]-P[i][0])*f)*1000),Math.round((P[i][1]+(P[i+1][1]-P[i][1])*f)*1000)];
        m.path.splice(i+1,0,q);return {people:p,did:'added',id:`${kind}-point|${key}|${i+1}`};
      }
    }
    return {error:'They are not walking or rolling at the playhead: a waypoint goes on a path while they travel it.'};
  }
  return {error:prop==='screen'?'A placement\'s in and out come with the placement: drag its edges (or add a person in the People tab).':'An action\'s keys come with the action: drag its bar or its end.'};
}
// A waypoint's place (mm): the path's point, or (a walk / roll written with `to`) its end, or its `from`.
export function waypointOf(people,k){
  const m=motionOf(entryOf(people,k.entry),k.kind.split('-')[0]);if(!m)return null;
  if(Array.isArray(m.path))return m.path[k.d.index??0]||null;
  if(k.kind.endsWith('-end'))return Array.isArray(m.to)?m.to:null;
  return Array.isArray(m.from)?m.from:null;
}
export function setWaypoint(people,k,x,z){
  const p=structuredClone(people),m=motionOf(entryOf(p,k.entry),k.kind.split('-')[0]);if(!m||!finite(x)||!finite(z))return null;
  const q=[Math.round(x),Math.round(z)];
  if(Array.isArray(m.path)){const i=k.d.index??0;if(!m.path[i])return null;m.path[i]=q;return p;}
  if(k.kind.endsWith('-end')&&Array.isArray(m.to)){m.to=q;return p;}
  if(!k.kind.endsWith('-end')&&Array.isArray(m.from)){m.from=q;return p;}
  return null;
}
// A turn (quaternion [x, y, z, w]) as Bend / Twist / Side degrees (three.js Euler 'XYZ', as pose mode shows a joint),
// and back.
const deg=r=>Math.round(r*180/Math.PI*10)/10+0;
export function turnAngles(q){
  const [x,y,z,w]=q||[0,0,0,1],m11=1-2*(y*y+z*z),m12=2*(x*y-w*z),m13=2*(x*z+w*y),m22=1-2*(x*x+z*z),m23=2*(y*z-w*x),m32=2*(y*z+w*x),m33=1-2*(x*x+y*y);
  const ry=Math.asin(Math.max(-1,Math.min(1,m13)));
  return Math.abs(m13)<.9999999?[deg(Math.atan2(-m23,m33)),deg(ry),deg(Math.atan2(-m12,m11))]:[deg(Math.atan2(m32,m22)),deg(ry),0];
}
export function anglesTurn([a,b,c]){
  const h=v=>v*Math.PI/360,c1=Math.cos(h(a)),s1=Math.sin(h(a)),c2=Math.cos(h(b)),s2=Math.sin(h(b)),c3=Math.cos(h(c)),s3=Math.sin(h(c));
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
}
// A joint's turn in a pose key, from Bend / Twist / Side.
export function setJointAngles(people,k,bone,angles){
  const p=structuredClone(people),e=entryOf(p,k.entry);if(!e||!angles.every(finite))return null;
  putKeys(e,setPoseKey(e,k.t,bone,anglesTurn(angles)));return p;
}
