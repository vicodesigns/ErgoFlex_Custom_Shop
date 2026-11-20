// Director People: the path of a walker or a wheelchair user (a cast entry's `walk` or `roll`), as the People tab's path
// handles edit it (people-path-gizmo.mjs draws them and takes the drags). Pure: no three.js, no DOM; every change
// returns a NEW entry and leaves the one it was given alone.
//   The format is the film's own (room-people.mjs): walk { path: [[x, z], ...] | to: [x, z], start, pace, step, then,
//   toes, turn }, roll { path | to, start, speed, ease, radius }; room millimetres on the floor. The path's first point is
//   where the person stands, the placement's `at`: they move together. A `to` (or `from`) walk becomes a `path` the first
//   time a point is moved, added or removed (path is the field the film already reads; nothing new is written).
//   What is drawn is what the person follows: a walker's hips go straight from point to point (walkPlan's along), a
//   chair goes round each corner on the arc rollPlan builds (the planner is handed in: room-people-motion.mjs rollPlan).
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const round=p=>[Math.round(p[0]),Math.round(p[1])];
const same=(a,b,tol=1)=>!!a&&!!b&&Math.hypot(a[0]-b[0],a[1]-b[1])<=tol;
const clone=v=>JSON.parse(JSON.stringify(v));
export const MIN_GAP=50;            // mm: two neighbouring points closer than this are one (a click on a handle never adds a point there)
export const LIMIT=100000;          // mm: as far as a placement may be (people-edits.mjs pair)

// 'walk' | 'roll' | null: what kind of path the entry has.
export const motionOf=e=>e?.walk&&typeof e.walk==='object'?'walk':e?.roll&&typeof e.roll==='object'?'roll':null;
// The path's points as the film reads them (room mm), or null: `path`, else [from or at, to].
export function pathOf(e){
  const kind=motionOf(e);if(!kind)return null;const m=e[kind];
  const pts=Array.isArray(m.path)?m.path:[m.from||e.at,m.to];
  return pts.length>1&&pts.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite))?pts.map(p=>[p[0],p[1]]):null;
}
// A new entry whose path is `points` (rounded to the millimetre, clamped to the room limit). The start goes with `at`
// when they were one spot.
export function withPath(e,points){
  const kind=motionOf(e);if(!kind)return e;
  const out=clone(e),m=out[kind],was=pathOf(e),pts=points.map(p=>(was||[]).some(q=>q[0]===p[0]&&q[1]===p[1])?[p[0],p[1]]:round([Math.max(-LIMIT,Math.min(LIMIT,p[0])),Math.max(-LIMIT,Math.min(LIMIT,p[1]))]));   // (a point the edit did not touch keeps its value exactly: the film's paths have tenths of a millimetre)
  if(Array.isArray(out.at)&&was&&same(out.at,was[0])&&!same(pts[0],was[0],0))out.at=[...pts[0]];
  m.path=pts;delete m.to;delete m.from;
  return out;
}
// Move point i to p.
export function movePoint(e,i,p){const pts=pathOf(e);if(!pts||!(i>=0&&i<pts.length)||!p?.every?.(finite))return e;pts[i]=[p[0],p[1]];return withPath(e,pts);}
// Add p as a new point after point `seg` (on the segment seg -> seg + 1; seg = last index appends past the end).
export function insertPoint(e,seg,p){
  const pts=pathOf(e);if(!pts||!(seg>=0&&seg<pts.length)||!p?.every?.(finite))return e;
  if(pts.some(q=>same(q,p,MIN_GAP-1)))return e;
  pts.splice(seg+1,0,[p[0],p[1]]);return withPath(e,pts);
}
// Remove point i. The start (where they stand: drag it, or move the person) and the last two points stay.
export function removePoint(e,i){
  const pts=pathOf(e);if(!pts||i<=0||i>=pts.length||pts.length<=2)return e;
  pts.splice(i,1);return withPath(e,pts);
}
export const canRemove=(e,i)=>{const pts=pathOf(e);return !!pts&&i>0&&i<pts.length&&pts.length>2;};
// The person (their placement) moved by [dx, dz]: `at` moves, and so does the path's start where it was the same spot.
export function moveStart(e,by){
  if(!Array.isArray(e?.at)||!by?.every?.(finite))return e;
  const out=clone(e),kind=motionOf(e),pts=pathOf(e);
  out.at=round([e.at[0]+by[0],e.at[1]+by[1]]);
  if(kind&&pts&&same(e.at,pts[0])){pts[0]=[...out.at];const m=out[kind];m.path=pts;delete m.to;delete m.from;}
  return out;
}
// Snap a floor point to a grid (mm).
export const snap=(p,grid=50)=>[Math.round(p[0]/grid)*grid,Math.round(p[1]/grid)*grid];

// ---- picking on the floor
// Where a ray meets the floor plane y = level (origin and dir in the room's frame, mm): [x, z], or null (parallel, behind).
export function rayFloor(origin,dir,level=0){
  if(!(Math.abs(dir[1])>1e-9))return null;const t=(level-origin[1])/dir[1];if(!(t>0))return null;
  return [origin[0]+dir[0]*t,origin[2]+dir[2]*t];
}
// The nearest point of segment a-b to p: { at: [x, z], t: 0..1, d: mm }.
export function nearestOnSegment(a,b,p){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,t=l2>0?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l2)):0,at=[a[0]+dx*t,a[1]+dz*t];
  return {at,t,d:Math.hypot(p[0]-at[0],p[1]-at[1])};
}
// What a floor point p is on: a point (handle) within `pointTol` mm, else a segment within `lineTol` mm (of the control
// polygon or of the drawn line, `drawn`, whichever is nearer: a click on a rounded corner adds a point to the segment it
// rounds), else null. { kind: 'point', index } | { kind: 'segment', index (the point it follows), at, t } | null.
export function hitTest(points,p,{pointTol=150,lineTol=120,drawn=null}={}){
  if(!points||!p)return null;
  let best=null;for(let i=0;i<points.length;i++){const d=Math.hypot(points[i][0]-p[0],points[i][1]-p[1]);if(d<=pointTol&&(!best||d<best.d))best={kind:'point',index:i,d};}
  if(best)return {kind:'point',index:best.index};
  let seg=null;
  for(let i=0;i<points.length-1;i++){const n=nearestOnSegment(points[i],points[i+1],p);if(n.d<=lineTol&&(!seg||n.d<seg.d))seg={kind:'segment',index:i,at:n.at,t:n.t,d:n.d};}
  if(drawn&&drawn.length>1){
    for(let k=0;k<drawn.length-1;k++){const n=nearestOnSegment(drawn[k],drawn[k+1],p);if(n.d<=lineTol&&(!seg||n.d<seg.d)){const i=segmentOf(points,n.at);seg={kind:'segment',index:i,at:p.slice(),t:null,d:n.d};}}
  }
  return seg?{kind:'segment',index:seg.index,at:round(seg.at),t:seg.t}:null;
}
// The control segment nearest a point (which segment a spot on the drawn, rounded line belongs to).
export function segmentOf(points,p){let best=0,d=Infinity;for(let i=0;i<points.length-1;i++){const n=nearestOnSegment(points[i],points[i+1],p);if(n.d<d){d=n.d;best=i;}}return best;}

// ---- what is drawn: the route the person follows (mm)
// planner: { rollPlan } (room-people-motion.mjs). A walk's hips go straight between the points; a roll's corners are
// the planner's arcs, sampled every `every` mm.
export function drawnLine(e,planner={},every=20){
  const pts=pathOf(e);if(!pts)return null;
  if(motionOf(e)==='walk'||typeof planner.rollPlan!=='function')return pts;
  const plan=planner.rollPlan(pts.map(p=>[p[0]/1000,p[1]/1000]),rollOptions(e.roll)),out=[],n=Math.max(1,Math.ceil(plan.length*1000/every));
  for(let i=0;i<=n;i++){const a=plan.along(plan.length*i/n);out.push([a.x*1000,a.z*1000]);}
  return out;
}
// rollPlan's options from the entry (room-people.mjs rollOptions: radius in mm there, metres here).
export const rollOptions=r=>({speed:r?.speed,ease:r?.ease,radius:finite(r?.radius)?r.radius/1000:undefined});
// The length of the drawn route (mm), and for a roll its seconds (the planner's; a walk's need the rig: the stage's plan).
export function routeInfo(e,planner={}){
  const line=drawnLine(e,planner);if(!line)return null;let length=0;for(let i=1;i<line.length;i++)length+=Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);
  const out={length,points:pathOf(e).length};
  if(motionOf(e)==='roll'&&typeof planner.rollPlan==='function'){const plan=planner.rollPlan(pathOf(e).map(p=>[p[0]/1000,p[1]/1000]),rollOptions(e.roll));out.seconds=plan.seconds;out.tight=plan.tight||[];}
  return out;
}

// ---- the inspector's fields: existing fields only, in the film's units
// name -> { kind, label, unit, step, min, max, int?, clear? (empty deletes it: the film's default) }
export const FIELDS={
  walk:{
    start:{label:'Start',unit:'s',step:.1,min:0,max:600,title:'The chapter second they set off (they stand at the start until then)'},
    pace:{label:'Pace',unit:'steps/s',step:.05,min:.5,max:4,clear:true,title:'Steps a second (the film\'s default 1.8; brisk 2.2 to 2.4)'},
    step:{label:'Stride',unit:'mm',step:10,min:200,max:1000,int:true,clear:true,title:'Length of a step (empty: from the leg length)'},
    turn:{label:'Faces at the end',unit:'°',step:1,min:-360,max:360,clear:true,title:'The way they face when they arrive, in the room\'s turn (as a person\'s Turn): empty, the next placement\'s, else along the last leg'}
  },
  roll:{
    start:{label:'Start',unit:'s',step:.1,min:0,max:600,title:'The chapter second the chair sets off'},
    speed:{label:'Speed',unit:'m/s',step:.05,min:.1,max:3,clear:true,title:'Cruising speed (the film\'s default 0.8 m/s)'},
    radius:{label:'Corner radius',unit:'mm',step:10,min:0,max:3000,int:true,clear:true,title:'How round the corners are (default 450 mm; shorter legs turn tighter)'},
    ease:{label:'Ease',unit:'s',step:.1,min:.05,max:5,clear:true,title:'Seconds to set off and to come to rest (default 1.2 s)'}
  }
};
// ---- the way a walker faces at the end (room-people.mjs walkEnd: walk.turn, else the `then` placement's turn when it
// stands where the path ends, else along the last leg). Degrees in the room's turn, as a person's `turn`: 0 faces +z
// (room mm), 90 faces +x; -180..180.
export const wrapTurn=d=>{const v=((d+180)%360+360)%360-180;return Math.round((v===-180?180:v)*10)/10;};
// The turn that faces from `from` toward `to` (room mm), or null when they are the same spot.
export function facingToward(from,to){const dx=to[0]-from[0],dz=to[1]-from[1];return Math.hypot(dx,dz)<1?null:wrapTurn(Math.atan2(dx,dz)*180/Math.PI);}
// The way a walker faces as they arrive: {turn, from: 'set' | 'then' | 'path'}.
export function endFacing(e,cast=[]){
  const pts=pathOf(e);if(motionOf(e)!=='walk'||!pts)return null;const w=e.walk,end=pts[pts.length-1];
  if(finite(w.turn))return {turn:wrapTurn(w.turn),from:'set'};
  const next=w.then&&cast.find(c=>c.id===w.then&&Array.isArray(c.at)&&finite(c.turn)&&Math.hypot(c.at[0]-end[0],c.at[1]-end[1])<60);
  if(next)return {turn:wrapTurn(next.turn),from:'then'};
  for(let i=pts.length-2;i>=0;i--){const t=facingToward(pts[i],end);if(t!==null)return {turn:t,from:'path'};}
  return {turn:wrapTurn(e.turn||0),from:'path'};
}
export const TOES=[['bend','Toes bend (natural)'],['stiff','Stiff (the foot pitches whole)']];
export const SWINGS=[['','Normal'],['path','Follow the path (tight turns)']];
// A new entry with motion field `name` set to `value` (a string from an input: '' clears where the field may be
// cleared). Throws with a message for a value that cannot be.
export function setField(e,name,value){
  const kind=motionOf(e);if(!kind)return e;const out=clone(e),m=out[kind];
  if(name==='then'){if(kind!=='walk')return e;if(!value)delete m.then;else if(/^people-[a-z0-9][a-z0-9._-]{0,90}$/i.test(value))m.then=value;else throw Error('Not a posture of this library.');return out;}
  if(name==='swing'){if(kind!=='walk')return e;if(value==='path')m.swing='path';else delete m.swing;return out;}
  if(name==='toes'){if(kind!=='walk')return e;const want=value==='stiff'?'stiff':'bend';if(want===(e.walk.toes==='stiff'?'stiff':'bend'))return e;m.toes=want;return out;}   // (written only when the choice differs from what the entry resolves to)
  const f=FIELDS[kind][name];if(!f)return e;
  const text=String(value??'').trim();
  if(text===''){if(f.clear){delete m[name];return out;}throw Error('Type a number.');}
  let v=Number(text);if(!finite(v))throw Error('Type a number.');
  v=Math.min(f.max,Math.max(f.min,v));m[name]=f.int?Math.round(v):Math.round(v*1000)/1000;
  return out;
}

// ---- continuity: one character, several placements handing over at a spot
// In a film chapter one character is several placements: Noah talks at P, walks P -> Q (noah-steps), then pulls, taps
// and watches at Q, each in a `when` window that starts as the one before ends. A spot that moves must take the
// placements that meet there with it, or the character jumps at the hand-over.
export const characterOf=id=>String(id||'').replace(/^people-/,'').split('-')[0];
// The two ends of a placement: where it starts (at, or its path's first point) and where it ends (its path's last
// point, or at for someone who stays).
export function endsOf(e){const pts=pathOf(e);return {start:pts?pts[0]:Array.isArray(e?.at)?e.at:null,end:pts?pts[pts.length-1]:Array.isArray(e?.at)?e.at:null};}
const spansOf=(when,key)=>Array.isArray(when?.[key])&&when[key].length?when[key]:[[0,Infinity]];
// Two placements' seconds meet: one starts as the other ends (within `tol` s), or they overlap.
export function touches(when,a,b,tol=.1){return spansOf(when,a).some(([a0,a1])=>spansOf(when,b).some(([b0,b1])=>a0<=b1+tol&&b0<=a1+tol));}
// Every other placement of the same character that met `key` (and so on down the chain, through the seconds) at the
// spot `from` follows it to `to`: its `at` / path start or its path end, whichever was there (within `tol` mm).
// cast: the cast as it is (the entry `key` may already be moved: its own spot is not touched here); when: the chapter's.
// Returns { cast: a new cast array (followers replaced by new entries), followed: [{ key, id, ends: ['start'|'end'] }] }.
export function linkedMove(cast,when,key,from,to,{tol=1}={}){
  const me=cast.find(e=>e.key===key);if(!me||!from||!to||same(from,to,0))return {cast,followed:[]};
  const who=characterOf(me.id),out=cast.slice(),seen=new Set([key]),queue=[key],followed=[];
  while(queue.length){
    const k=queue.shift();
    for(let i=0;i<out.length;i++){
      const x=out[i];if(seen.has(x.key)||characterOf(x.id)!==who||!touches(when,k,x.key))continue;
      const ends=endsOf(cast.find(c=>c.key===x.key)),hit=[];
      if(ends.start&&same(ends.start,from,tol))hit.push('start');if(ends.end&&same(ends.end,from,tol)&&(pathOf(x)||!hit.length))hit.push('end');
      if(!hit.length)continue;
      let n=x;const pts=pathOf(x);
      if(pts){const p=pts.map(q=>[...q]);if(hit.includes('start'))p[0]=[...to];if(hit.includes('end'))p[p.length-1]=[...to];n=withPath(x,p);if(hit.includes('start')&&Array.isArray(n.at)&&same(n.at,from,tol))n={...n,at:round(to)};}
      else n={...clone(x),at:round(to)};
      out[i]=n;seen.add(x.key);queue.push(x.key);followed.push({key:x.key,id:x.id,ends:pts?hit:['start','end']});
    }
  }
  return {cast:out,followed};
}

// ---- arrival against the hand-over
// When the walk / roll ends (start + seconds: the planner's, or the stage's plan for a walk), and the second it has to:
// this placement's `when` end, or the start of the next placement of the character that takes over at the path's end.
// { arrive, deadline, late (s, > 0: cut mid-stride), next: key | null, by: 'window' | 'next' } or null.
export function arrival(e,seconds,cast,when){
  const kind=motionOf(e);if(!kind||!Number.isFinite(seconds))return null;
  const arrive=(e[kind].start||0)+seconds,mine=spansOf(when,e.key),end=Math.max(...mine.map(s=>s[1])),begin=Math.min(...mine.map(s=>s[0]));
  let deadline=end,by='window',next=null,nextAt=Infinity;const spot=endsOf(e).end;
  for(const x of cast||[]){
    if(x.key===e.key||characterOf(x.id)!==characterOf(e.id)||!spot||!endsOf(x).start||!same(endsOf(x).start,spot,1))continue;
    const t0=Math.min(...spansOf(when,x.key).map(s=>s[0]).filter(t=>t>begin+1e-6));if(!Number.isFinite(t0))continue;
    if(!next||t0<nextAt){next=x.key;nextAt=t0;}
  }
  if(nextAt<deadline-1e-6){deadline=nextAt;by='next';}
  if(!Number.isFinite(deadline))return {arrive,deadline:null,late:0,next,by,begin};
  return {arrive,deadline,late:Math.max(0,arrive-deadline),next,by,begin};
}
// The two one-click fixes for a late arrival (new entries; null where it cannot be done):
//   faster: a walk's pace (seconds go as 1 / pace) or a roll's speed (seconds = length / speed + ease), to arrive at the
//   deadline (clamped to the field's range: it may still be late); earlier: start sooner, not before this placement's
//   `when` start.
export function fixFaster(e,a,{seconds,length=null}={}){
  const kind=motionOf(e);if(!kind||!a?.late)return null;const m=e[kind],room=a.deadline-(m.start||0);if(!(room>0))return null;
  if(kind==='walk'){const pace=(m.pace||1.8)*seconds/room;return setField(e,'pace',String(Math.ceil(Math.min(FIELDS.walk.pace.max,pace)*100)/100));}
  const ease=Math.max(.05,m.ease??1.2);if(!(length>0)||room<=ease+.05)return null;
  return setField(e,'speed',String(Math.ceil(Math.min(FIELDS.roll.speed.max,(length/1000)/(room-ease))*100)/100));
}
export function fixEarlier(e,a,{seconds}={}){
  const kind=motionOf(e);if(!kind||!a?.late)return null;const start=Math.max(a.begin||0,a.deadline-seconds);
  if(start>=(e[kind].start||0)-1e-6)return null;return setField(e,'start',String(Math.floor(start*100)/100));
}
