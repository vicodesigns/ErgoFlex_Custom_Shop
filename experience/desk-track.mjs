// Chapter-local Groove lanes. Time is normalized so chapter resizing retimes all lanes.
// Yaw is deliberately unwrapped: 0 -> 360 is a full turn, not the shortest arc.
export const DESK_LANES=['lift','tilt','wheels'];
export const DESK_EASINGS=['smooth','linear','hold'];
export const POSE_FIELDS={lift:['height'],tilt:['tilt'],wheels:['x','z','yaw']};
const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export function cleanPose(v={}){
  return {height:number(v.height,28,52.5,30),tilt:number(v.tilt,-5,65,0),x:number(v.x,-240,240,0),z:number(v.z,-240,240,0),yaw:number(v.yaw,-3600,3600,0)};
}
export function cleanDeskTracks(value){
  const tracks={};
  for(const lane of DESK_LANES){
    const seen=new Set();
    tracks[lane]=(Array.isArray(value?.[lane])?value[lane]:[]).slice(0,512).flatMap(k=>{
      if(!k||!k.pose||!POSE_FIELDS[lane].every(f=>Number.isFinite(Number(k.pose[f]))))return [];
      let id=typeof k.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(k.id)?k.id:crypto.randomUUID();if(seen.has(id))id=crypto.randomUUID();seen.add(id);
      const pose=cleanPose(k.pose);
      return [{id,time:number(k.time,0,1,0),label:typeof k.label==='string'?k.label.trim().slice(0,60):'Desk pose',easing:DESK_EASINGS.includes(k.easing)?k.easing:'smooth',pose:Object.fromEntries(POSE_FIELDS[lane].map(f=>[f,pose[f]]))}];
    }).sort((a,b)=>a.time-b.time).filter((k,i,a)=>i===a.length-1||a[i+1].time-k.time>.00001);
  }
  return tracks;
}
export function tracksFromPoses(from,to){
  return cleanDeskTracks(Object.fromEntries(DESK_LANES.map(lane=>[lane,[{id:lane+'-start',time:0,label:'Start pose',pose:from},{id:lane+'-end',time:1,label:'End pose',pose:to}]])));
}
export function sampleDeskTracks(tracks,time,fallback={}){
  const result=cleanPose(fallback),t=Math.max(0,Math.min(1,time));
  for(const lane of DESK_LANES){
    const keys=tracks?.[lane];if(!keys?.length)continue;
    let a=keys[0],b=a,u=0;
    if(t>=keys.at(-1).time)a=b=keys.at(-1);
    else if(t>a.time){const i=keys.findIndex(k=>k.time>t);a=keys[i-1];b=keys[i];const p=(t-a.time)/(b.time-a.time);u=a.easing==='hold'?0:a.easing==='linear'?p:p*p*(3-2*p);}
    for(const f of POSE_FIELDS[lane])result[f]=a.pose[f]+(b.pose[f]-a.pose[f])*u;
  }
  return result;
}
export function moveDeskKey(keys,id,time){
  const t=number(time,0,1,0);if(keys.some(k=>k.id!==id&&Math.abs(k.time-t)<.001))throw Error('There is already a pose on this lane at that time.');
  return keys.map(k=>k.id===id?{...k,time:t}:k).sort((a,b)=>a.time-b.time);
}
export function putDeskKey(keys,time,pose,{label='Desk pose',easing='smooth'}={}){
  const existing=keys.find(k=>Math.abs(k.time-time)<.001);
  if(!existing&&keys.length>=512)throw Error('This lane already has 512 poses. Delete a pose before adding another.');
  const key={id:existing?.id||crypto.randomUUID(),time,pose:{...pose},label:existing?.label||label,easing:existing?.easing||easing};
  return [...keys.filter(k=>k.id!==key.id),key].sort((a,b)=>a.time-b.time);
}
// Insert a timed move and carry its offset through later poses, so a completed
// turn or lift holds its new position instead of drifting back to an old endpoint.
export function buildDeskMove(tracks,start,end,target,lanes,{label='Desk move',easing='smooth'}={}){
  const result=structuredClone(tracks),a=sampleDeskTracks(tracks,start),oldEnd=sampleDeskTracks(tracks,end);
  for(const lane of lanes){
    const fields=POSE_FIELDS[lane];
    for(const k of result[lane])if(k.time>end+.001){const p=cleanPose({...k.pose,...Object.fromEntries(fields.map(f=>[f,k.pose[f]+target[f]-oldEnd[f]]))});for(const f of fields)k.pose[f]=p[f];}
    let keys=result[lane].filter(k=>k.time<start-.001||k.time>end+.001);
    keys=putDeskKey(keys,start,Object.fromEntries(fields.map(f=>[f,a[f]])),{label:'Start '+label,easing});keys.find(k=>Math.abs(k.time-start)<.001).easing=easing;
    result[lane]=putDeskKey(keys,end,Object.fromEntries(fields.map(f=>[f,target[f]])),{label});
  }
  return result;
}
// Compress straight recorded segments while keeping the corners of a performed
// movement. Tolerances are in inches/degrees; authored poses are never simplified.
export function simplifyDeskLane(keys,lane){
  if(keys.length<3)return keys;
  const tolerances={height:.03,tilt:.12,x:.08,z:.08,yaw:.2},fields=POSE_FIELDS[lane],keep=new Set([0,keys.length-1]);
  function split(a,b){let worst=1,index=-1;for(let i=a+1;i<b;i++){const u=(keys[i].time-keys[a].time)/(keys[b].time-keys[a].time||1);let error=0;for(const f of fields)error=Math.max(error,Math.abs(keys[i].pose[f]-(keys[a].pose[f]+(keys[b].pose[f]-keys[a].pose[f])*u))/tolerances[f]);if(error>worst){worst=error;index=i;}}if(index>=0){keep.add(index);split(a,index);split(index,b);}}
  split(0,keys.length-1);return keys.filter((_,i)=>keep.has(i));
}
