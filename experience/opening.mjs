import {cleanClipMotion} from './desk-clips.mjs';

// Eight seconds of independent, editable movements, with a short hero hold.
export function makeOpeningShot(previous){
  const clip=(id,lane,kind,start,duration,params)=>({id:'intro-'+id,lane,kind,start,duration,easing:'smooth',...params});
  return {...previous,room:'product',kind:'glide',preset:'gaming',layout:undefined,mode:undefined,camera:undefined,
    seconds:8,transition:.35,title:'Meet your digital twin.',detail:'Roll in. Rise up. Make it yours.',
    motion:cleanClipMotion({initial:{height:28,tilt:0,x:0,z:0,yaw:0},clips:[
      clip('roll-in','wheels','travel',.2,1.2,{value:12,direction:'forward',label:'Roll into the light'}),
      clip('strafe','wheels','travel',1.4,.7,{value:6,direction:'right',label:'Omni-wheel strafe'}),
      clip('turn','wheels','rotate',2.2,1.2,{value:45,direction:'right',label:'Showcase turn · 45°'}),
      clip('face-front','wheels','rotate',5.7,1.4,{value:45,direction:'left',label:'Hero landing · 45° back'}),
      clip('rise','lift','lift',1.4,3.3,{target:45.5,label:'Rise to standing'}),
      clip('full-lift','lift','lift',5.5,1.7,{target:52.5,label:'Full 52.5″ lift'}),
      clip('tilt','tilt','tilt',4.5,.7,{target:8,label:'Ergonomic tilt · 8°'}),
      clip('level','tilt','tilt',6.7,.7,{target:0,label:'Level for the hero shot'})
    ]},8)};
}

export const OPENING_VIEWS=[
  {time:0,label:'Wheel wake-up',angle:.65,height:.14,focus:.12,distance:.55},
  {time:1.35/8,label:'Glide reveal',angle:1.1,height:.32,focus:.45,distance:.98},
  {time:3.6/8,label:'Rise & turn',angle:.85,height:.45,focus:.5,distance:1.12},
  {time:5.4/8,label:'Ergonomic detail',angle:.4,height:.65,focus:.65,distance:.72},
  {time:7.3/8,label:'Hero landing',angle:.65,height:.45,focus:.5,distance:1.16},
  {time:1,label:'Hold & handoff',angle:.65,height:.45,focus:.5,distance:1.16}
];
