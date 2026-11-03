// Minimal seekable VP8 WebM writer. Frames arrive from WebCodecs with exact timestamps.
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const bytes=n=>{const a=[];do{a.unshift(n%256);n=Math.floor(n/256);}while(n);return Uint8Array.from(a);};
const size=n=>{let width=1;while(n>=2**(7*width)-1)width++;const a=new Uint8Array(width);for(let i=width-1;i>=0;i--){a[i]=n%256;n=Math.floor(n/256);}a[0]|=1<<(8-width);return a;};
const element=(id,data)=>join([bytes(id),size(data.length),data]);
const uint=(id,n,width)=>{const data=width?new Uint8Array(width):bytes(n);if(width){for(let i=width-1;i>=0;i--){data[i]=n%256;n=Math.floor(n/256);}}return element(id,data);};
const str=(id,s)=>element(id,new TextEncoder().encode(s));
const master=(id,parts)=>element(id,join(parts));
const float=(id,n)=>{const data=new Uint8Array(8);new DataView(data.buffer).setFloat64(0,n);return element(id,data);};
export function muxWebM(frames,{width,height,fps=30,duration}){
  if(!frames.length||!frames[0].key)throw Error('The bake did not produce a starting video keyframe.');
  frames=[...frames].sort((a,b)=>a.timestamp-b.timestamp);
  const header=master(0x1a45dfa3,[uint(0x4286,1),uint(0x42f7,1),uint(0x42f2,4),uint(0x42f3,8),str(0x4282,'webm'),uint(0x4287,4),uint(0x4285,2)]);
  const info=master(0x1549a966,[uint(0x2ad7b1,1000000),str(0x4d80,'ErgoFlex Bake'),str(0x5741,'ErgoFlex Bake'),float(0x4489,duration*1000)]);
  const tracks=master(0x1654ae6b,[master(0xae,[uint(0xd7,1),uint(0x73c5,1),uint(0x83,1),uint(0x9c,0),str(0x86,'V_VP8'),uint(0x23e383,Math.round(1e9/fps)),master(0xe0,[uint(0xb0,width),uint(0xba,height)])])]);
  const groups=[];for(const frame of frames){const ms=Math.round(frame.timestamp/1000);let group=groups.at(-1);if(!group||(frame.key&&ms-group.time>=1000)||ms-group.time>30000){group={time:ms,frames:[]};groups.push(group);}group.frames.push(frame);}
  const clusters=groups.map(group=>master(0x1f43b675,[uint(0xe7,group.time),...group.frames.map(frame=>{const payload=new Uint8Array(frame.data.length+4),relative=Math.round(frame.timestamp/1000)-group.time;payload[0]=0x81;new DataView(payload.buffer).setInt16(1,relative);payload[3]=frame.key?0x80:0;payload.set(frame.data,4);return element(0xa3,payload);})]));
  const seek=position=>master(0x114d9b74,[master(0x4dbb,[element(0x53ab,bytes(0x1c53bb6b)),uint(0x53ac,position,8)])]);
  const prefixSize=seek(0).length+info.length+tracks.length;let offset=prefixSize;
  const cues=master(0x1c53bb6b,groups.map((group,i)=>{const position=offset;offset+=clusters[i].length;return master(0xbb,[uint(0xb3,group.time),master(0xb7,[uint(0xf7,1),uint(0xf1,position)])]);}));
  const segment=master(0x18538067,[seek(offset),info,tracks,...clusters,cues]);
  return new Blob([header,segment],{type:'video/webm'});
}
