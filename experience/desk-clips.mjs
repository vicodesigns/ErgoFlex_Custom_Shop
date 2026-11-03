import {cleanPose,cleanDeskTracks,tracksFromPoses,sampleDeskTracks,POSE_FIELDS,DESK_LANES} from './desk-track.mjs';
export const CLIP_KINDS=['lift','tilt','rotate','travel','hold','pose'];
export const CLIP_DIRECTIONS={lift:['up','down'],tilt:['up','down'],rotate:['right','left'],travel:['forward','backward','left','right']};
const finite=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const copy=v=>structuredClone(v);
export const clipEnd=c=>c.start+c.duration;
export function cleanClip(v={}){
  if(!DESK_LANES.includes(v.lane)||!CLIP_KINDS.includes(v.kind))throw Error('Choose a Lift, Tilt or Wheels movement.');
  if((v.kind==='lift'&&v.lane!=='lift')||(v.kind==='tilt'&&v.lane!=='tilt')||(['rotate','travel'].includes(v.kind)&&v.lane!=='wheels'))throw Error('This movement belongs on a different lane.');
  const c={id:typeof v.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v.id)?v.id:crypto.randomUUID(),lane:v.lane,kind:v.kind,start:finite(v.start,0,90,0),duration:finite(v.duration,.001,90,2),easing:['linear','smooth','hold'].includes(v.easing)?v.easing:'linear',label:typeof v.label==='string'?v.label.trim().slice(0,60):''};
  if(v.kind==='lift')c.target=finite(v.target,28,52.5,43.5);
  if(v.kind==='tilt')c.target=finite(v.target,-5,65,25);
  if(v.kind==='rotate'||v.kind==='travel'){c.value=finite(v.value,0,v.kind==='rotate'?3600:240,v.kind==='rotate'?360:12);c.direction=CLIP_DIRECTIONS[v.kind].includes(v.direction)?v.direction:CLIP_DIRECTIONS[v.kind][0];}
  if(v.kind==='pose'){const p=cleanPose(v.target);c.target=Object.fromEntries(POSE_FIELDS[v.lane].map(f=>[f,p[f]]));}
  // Keep a movement's acceleration and combined travel/turn inside its block.
  if(['pose','lift','tilt'].includes(c.kind)&&Array.isArray(v.path)){
    const path=v.path.slice(0,257).flatMap(k=>{
      if(!Number.isFinite(k?.time)||!POSE_FIELDS[c.lane].every(f=>Number.isFinite(k.pose?.[f])))return [];
      const p=cleanPose(k.pose);return [{time:finite(k.time,0,1,0),pose:Object.fromEntries(POSE_FIELDS[c.lane].map(f=>[f,p[f]]))}];
    }).sort((a,b)=>a.time-b.time).filter((k,i,a)=>i===a.length-1||a[i+1].time-k.time>.000001);
    if(path.length>=2&&path[0].time===0&&path.at(-1).time===1)c.path=path;
  }
  return c;
}
export function validateClipSchedule(clips,seconds){
  for(const c of clips){if(c.start<0||c.duration<=0||clipEnd(c)>seconds+.00001)throw Error(`This movement must fit inside the ${seconds}-second chapter.`);}
  for(const lane of DESK_LANES){const list=clips.filter(c=>c.lane===lane).sort((a,b)=>a.start-b.start);for(let i=1;i<list.length;i++)if(list[i].start<clipEnd(list[i-1])-.00001)throw Error(`Two ${lane==='wheels'?'Wheels':lane==='lift'?'Lift':'Tilt'} movements cannot overlap. Move one to an open time; different lanes can play together.`);}
}
export function cleanClipMotion(value,seconds){
  if(!Array.isArray(value?.clips)||value.clips.length>1536)throw Error('A chapter can contain up to 1536 movement clips.');
  const seen=new Set(),clips=value.clips.map(v=>{const c=cleanClip(v);if(seen.has(c.id))c.id=crypto.randomUUID();seen.add(c.id);return c;}).sort((a,b)=>a.start-b.start||a.lane.localeCompare(b.lane));
  validateClipSchedule(clips,seconds);return {version:2,initial:cleanPose(value.initial),clips};
}
export function clipTarget(c,from){
  const p={...from};
  if(c.kind==='lift')p.height=c.target;
  if(c.kind==='tilt')p.tilt=c.target;
  if(c.kind==='rotate')p.yaw+=(c.direction==='left'?-1:1)*c.value;
  if(c.kind==='travel'){
    const angle=p.yaw*Math.PI/180,side=['left','right'].includes(c.direction),sign=['left','backward'].includes(c.direction)?-1:1;
    p.x+=sign*c.value*(side?Math.cos(angle):Math.sin(angle));p.z+=sign*c.value*(side?-Math.sin(angle):Math.cos(angle));
  }
  if(c.kind==='pose')Object.assign(p,c.target);
  return cleanPose(p);
}
// Deterministic evaluation: gaps hold, lanes run independently, and yaw is never
// shortened. Clips use seconds rather than camera keyframe fractions.
export function sampleClipMotion(motion,seconds){
  const pose=cleanPose(motion.initial),t=Math.max(0,Number(seconds)||0);
  for(const lane of DESK_LANES){
    for(const c of motion.clips.filter(c=>c.lane===lane).sort((a,b)=>a.start-b.start)){
      if(t<c.start)break;
      const target=clipTarget(c,pose),fraction=Math.max(0,Math.min(1,(t-c.start)/c.duration)),u=fraction===1?1:c.easing==='hold'?0:c.easing==='smooth'?fraction*fraction*(3-2*fraction):fraction;
      if(c.path){
        const path=c.path,first=path[0],last=path.at(-1),i=path.findIndex(k=>k.time>=u),b=path[i<0?path.length-1:i],a=path[Math.max(0,i-1)],v=(u-a.time)/(b.time-a.time||1);
        for(const f of POSE_FIELDS[lane]){
          const offset=a.pose[f]+(b.pose[f]-a.pose[f])*v-first.pose[f];
          pose[f]+=offset+u*(target[f]-pose[f]-(last.pose[f]-first.pose[f]));
        }
      }else for(const f of POSE_FIELDS[lane])pose[f]+= (target[f]-pose[f])*u;
      if(fraction<1)break;
    }
  }
  return pose;
}
export function legacyMotionToClips(motion,seconds){
  if(Array.isArray(motion?.clips)){
    const clean=cleanClipMotion(motion,seconds),clips=clean.clips.flatMap(c=>{
      // Earlier builds exposed the whole built-in wheel performance as one
      // card. Split that card too, preserving any end-position edits.
      if(c.id!=='builtin-wheels'||c.kind!=='pose'||!c.path)return [c];
      const initial=sampleClipMotion(clean,c.start),single={initial,clips:[{...c,start:0,duration:1}]};
      const tracks={wheels:c.path.map(k=>({time:k.time,pose:sampleClipMotion(single,k.time)}))};
      const split=sampledMotionToClips(tracks,c.duration,{label:c.label||'Original wheel movement'}).clips;
      return split.length>1?split.map(part=>({...part,start:part.start+c.start})):[c];
    });
    return cleanClipMotion({...clean,clips},seconds);
  }
  const tracks=cleanDeskTracks(motion?.tracks||tracksFromPoses(motion?.from,motion?.to)),initial=sampleDeskTracks(tracks,0),clips=[];
  for(const lane of DESK_LANES){const keys=tracks[lane];for(let i=0;i<keys.length-1;i++){
    const a=keys[i],b=keys[i+1];if(!POSE_FIELDS[lane].some(f=>Math.abs(a.pose[f]-b.pose[f])>.00001))continue;
    const base={lane,kind:'pose',start:a.time*seconds,duration:(b.time-a.time)*seconds,easing:a.easing,target:b.pose,label:b.label==='End pose'?'':b.label};
    if(lane==='lift'||lane==='tilt'){base.kind=lane;base.target=b.pose[lane==='lift'?'height':'tilt'];}
    else if(Math.abs(a.pose.x-b.pose.x)<.00001&&Math.abs(a.pose.z-b.pose.z)<.00001){base.kind='rotate';base.value=Math.abs(b.pose.yaw-a.pose.yaw);base.direction=b.pose.yaw>=a.pose.yaw?'right':'left';delete base.target;}
    clips.push(cleanClip(base));
  }}
  return cleanClipMotion({initial,clips},seconds);
}
export function motionForShot(shot,initial={height:30}){
  return shot.motion?legacyMotionToClips(shot.motion,shot.seconds):{version:2,initial:cleanPose(initial),clips:[]};
}
export function sampledMotionToClips(value,seconds,{label='Original wheel movement'}={}){
  const tracks=cleanDeskTracks(value),initial=sampleDeskTracks(tracks,0),clips=[];
  for(const lane of DESK_LANES){
    const keys=tracks[lane],sections=movementSections(keys,lane);
    for(const [index,section] of sections.entries()){
      const a=keys[section.first],b=keys[section.last],span=b.time-a.time;
      const path=keys.slice(section.first,section.last+1).map(k=>({time:(k.time-a.time)/span,pose:k.pose}));
      const direction=section.sign>0?({x:'right',z:'forward',yaw:'right',height:'up',tilt:'up'})[section.axis]:({x:'left',z:'backward',yaw:'left',height:'down',tilt:'down'})[section.axis];
      const name=lane==='wheels'?(section.axis==='yaw'?'Turn ':'Move ')+direction:lane==='lift'?'Lift '+direction:'Tilt '+direction;
      clips.push(cleanClip({id:'builtin-'+lane+'-'+index,lane,kind:lane==='wheels'?'pose':lane,start:a.time*seconds,duration:span*seconds,easing:'linear',label:label==='Original wheel movement'?name:lane==='wheels'?label+' · '+name:name,target:lane==='wheels'?b.pose:b.pose[lane==='lift'?'height':'tilt'],path}));
    }
  }
  return cleanClipMotion({initial,clips},seconds);
}
function movementSections(keys,lane){
  const fields=POSE_FIELDS[lane],variation=Object.fromEntries(fields.map(f=>[f,keys.slice(1).reduce((n,k,i)=>n+Math.abs(k.pose[f]-keys[i].pose[f]),0)]));
  // Heading changes can accompany a forward/backward move. Split at the
  // travel reversal, without turning each sampled heading into a new card.
  const primary=lane==='wheels'?(Math.max(variation.x,variation.z)>.001?(variation.x>variation.z?'x':'z'):'yaw'):fields[0];
  const sections=[];let current=null;
  for(let i=1;i<keys.length;i++){
    const delta=f=>keys[i].pose[f]-keys[i-1].pose[f];
    let axis=primary;
    if(Math.abs(delta(axis))<=.000001)axis=fields.find(f=>Math.abs(delta(f))>.000001);
    const sign=axis?Math.sign(delta(axis)):0;
    if(!sign){current=null;continue;}
    if(!current||current.axis!==axis||current.sign!==sign){current={first:i-1,last:i,axis,sign};sections.push(current);}else current.last=i;
  }
  return sections;
}
export function putClip(motion,value,seconds){
  const c=cleanClip(value),clips=[...motion.clips.filter(v=>v.id!==c.id),c];validateClipSchedule(clips,seconds);return cleanClipMotion({...motion,clips},seconds);
}
export function findClipSpace(clips,lane,duration,preferred,seconds){
  const list=clips.filter(c=>c.lane===lane).sort((a,b)=>a.start-b.start),gaps=[];let start=0;
  for(const c of list){if(c.start-start>=duration-.00001)gaps.push([start,c.start-duration]);start=clipEnd(c);}if(seconds-start>=duration-.00001)gaps.push([start,seconds-duration]);
  const after=gaps.find(([a,b])=>b>=preferred-.00001);if(after)return Math.max(after[0],Math.min(preferred,after[1]));return gaps[0]?.[0]??null;
}
export function findClipInsertion(clips,lane,preferred,seconds,duration=3){
  const start=findClipSpace(clips,lane,Math.min(duration,seconds),preferred,seconds);
  if(start!==null)return {start,duration:Math.min(duration,seconds)};
  const list=clips.filter(c=>c.lane===lane).sort((a,b)=>a.start-b.start),gaps=[];let cursor=0;
  for(const c of list){if(c.start-cursor>=.05)gaps.push([cursor,c.start]);cursor=clipEnd(c);}if(seconds-cursor>=.05)gaps.push([cursor,seconds]);
  const gap=gaps.find(([a,b])=>b>preferred)||gaps[0];if(!gap)return null;
  return {start:gap[0],duration:Math.min(duration,gap[1]-gap[0])};
}
export function clipDistance(motion,c){
  const p=sampleClipMotion(motion,c.start),q=clipTarget(c,p);
  if(c.path){
    const fields=c.lane==='wheels'?(clipSpeedUnit(c)==='inches'?['x','z']:['yaw']):POSE_FIELDS[c.lane],first=c.path[0].pose,last=c.path.at(-1).pose;
    const points=c.path.map(k=>fields.map(f=>p[f]+k.pose[f]-first[f]+k.time*(q[f]-p[f]-last[f]+first[f])));
    return points.slice(1).reduce((n,v,i)=>n+Math.hypot(...v.map((x,j)=>x-points[i][j])),0);
  }
  return c.kind==='lift'?Math.abs(q.height-p.height):c.kind==='tilt'?Math.abs(q.tilt-p.tilt):c.kind==='rotate'||c.kind==='travel'?c.value:c.kind==='pose'?Math.hypot(...POSE_FIELDS[c.lane].map(f=>q[f]-p[f])):0;
}
export function clipSpeedUnit(c){
  if(c.kind==='pose'&&c.lane==='wheels'){
    if(!c.path)return 'path units';
    const p=c.path[0].pose;
    return Math.hypot(c.target.x-p.x,c.target.z-p.z)>.00001||c.path.some(k=>Math.hypot(k.pose.x-p.x,k.pose.z-p.z)>.00001)?'inches':'degrees';
  }
  return c.kind==='rotate'||c.lane==='tilt'?'degrees':'inches';
}
export function clipSpeedPresets(c){
  const medium=c.lane==='lift'?4:c.lane==='tilt'?15:clipSpeedUnit(c)==='degrees'?90:12;
  return {slow:medium/2,medium,fast:medium*2};
}
export function clipSpeedSetting(motion,c){
  const speed=clipDistance(motion,c)/c.duration;
  return Object.entries(clipSpeedPresets(c)).find(([,rate])=>Math.abs(speed-rate)<.005)?.[0]||'custom';
}
export function retimeClipBySpeed(motion,c,speed,seconds){
  if(!Number.isFinite(speed)||speed<=0)throw Error('Speed must be greater than zero.');
  const distance=clipDistance(motion,c);if(distance<.0001)throw Error('Set a target or distance before setting speed.');
  const duration=distance/speed;
  const next=motion.clips.filter(other=>other.lane===c.lane&&other.id!==c.id&&other.start>=c.start).sort((a,b)=>a.start-b.start)[0];
  const available=Math.max(0,Math.min(seconds,next?.start??seconds)-c.start);
  if(duration>available+.00001)throw Error(`This speed needs ${Number(duration.toFixed(3))}s, but only ${Number(available.toFixed(3))}s is open here. Choose a faster speed, reduce the movement amount, or make more room on the timeline.`);
  return {...c,duration};
}
export function clipSummary(c){
  if(c.label)return c.label;
  if(c.kind==='lift')return `Lift to ${c.target}″`;
  if(c.kind==='tilt')return `Tilt to ${c.target}°`;
  if(c.kind==='rotate')return `Turn ${c.direction} ${c.value}°`;
  if(c.kind==='travel')return `Move ${c.direction} ${c.value}″`;
  if(c.kind==='hold')return 'Hold';
  return c.lane==='lift'?`Lift to ${Number(c.target.height.toFixed(2))}″`:c.lane==='tilt'?`Tilt to ${Number(c.target.tilt.toFixed(2))}°`:'Saved wheel movement';
}
export function duplicateClip(motion,id,seconds){
  const c=motion.clips.find(c=>c.id===id);if(!c)return motion;
  const start=findClipSpace(motion.clips,c.lane,c.duration,clipEnd(c),seconds);if(start===null)throw Error('There is no open space on this lane for another movement of this length.');return putClip(motion,{...copy(c),id:crypto.randomUUID(),start},seconds);
}
