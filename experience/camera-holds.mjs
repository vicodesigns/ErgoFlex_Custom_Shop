import {sampleClipMotion,sampledMotionToClips} from './desk-clips.mjs';
export function addCameraHolds(shot,keys,motion,hold=4){
  if(!keys.length||!Number.isFinite(hold)||hold<3||hold>5)throw Error('Choose a camera hold between 3 and 5 seconds.');
  const pauses=keys.filter((k,i)=>i===0||JSON.stringify(k.view)!==JSON.stringify(keys[i-1].view)).map(k=>({at:k.time*shot.seconds,seconds:hold,id:k.id}));
  const seconds=shot.seconds+pauses.length*hold;
  if(seconds>90)throw Error('These holds would exceed the 90-second chapter limit.');
  if(keys.length+pauses.length>64)throw Error('There is not enough room for the settling camera views.');
  const before=t=>pauses.filter(p=>p.at<t-1e-7).reduce((n,p)=>n+p.seconds,0);
  const at=t=>pauses.filter(p=>Math.abs(p.at-t)<1e-7).reduce((n,p)=>n+p.seconds,0);
  const camera=keys.flatMap(k=>{
    const t=k.time*shot.seconds,arrival={...structuredClone(k),time:(t+before(t))/seconds};
    if(!pauses.some(p=>p.id===k.id))return [arrival];
    return [{...arrival,easing:'hold'}, {...structuredClone(k),id:crypto.randomUUID(),time:(t+before(t)+hold)/seconds,label:'Settle · '+k.label}];
  });
  const times=[...new Set([0,shot.seconds,...keys.map(k=>k.time*shot.seconds),...motion.clips.flatMap(c=>[c.start,c.start+c.duration]),...Array.from({length:241},(_,i)=>i*shot.seconds/240)])].sort((a,b)=>a-b);
  const tracks={lift:[],tilt:[],wheels:[]};
  for(const t of times){
    const pose=sampleClipMotion(motion,t),arrival=(t+before(t))/seconds,departure=(t+before(t)+at(t))/seconds;
    for(const lane of Object.keys(tracks)){
      tracks[lane].push({time:arrival,easing:'linear',pose});
      if(departure>arrival)tracks[lane].push({time:departure,easing:'linear',pose});
    }
  }
  return {...structuredClone(shot),seconds,camera:{keys:camera},motion:sampledMotionToClips(tracks,seconds),};
}
