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
