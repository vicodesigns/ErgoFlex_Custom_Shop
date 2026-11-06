// Browser copy of tools/experience/camera-spline.mjs (the film's camera bake): a few story keys
// (cameraPlan) become one continuous move of dense linear keys. A centripetal Catmull-Rom spline
// passes through every key at its "at" time; speed along it is a monotone cubic of distance over
// time (Fritsch–Carlson). "hold" rests at a key, "cut" hard-cuts to it; easeIn / easeOut (default
// true) start / end the chapter's moves from rest. Keep this in step with the CLI.
const vec=k=>[...k.position,...k.target,k.fov??35];
const mirror=(x,y)=>x.map((v,n)=>2*v-y[n]);
function catmull(p0,p1,p2,p3,u){
  const d=(a,b)=>Math.max(1e-4,Math.sqrt(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])+Math.hypot(a[3]-b[3],a[4]-b[4],a[5]-b[5])*.5));
  const t0=0,t1=t0+d(p0,p1),t2=t1+d(p1,p2),t3=t2+d(p2,p3),t=t1+(t2-t1)*u;
  const L=(a,b,ta,tb)=>a.map((v,i)=>tb===ta?v:v*(tb-t)/(tb-ta)+b[i]*(t-ta)/(tb-ta));
  const A1=L(p0,p1,t0,t1),A2=L(p1,p2,t1,t2),A3=L(p2,p3,t2,t3),B1=L(A1,A2,t0,t2),B2=L(A2,A3,t1,t3);
  return L(B1,B2,t1,t2);
}
function segmentAt(move,i,u){
  const P=j=>vec(move[Math.max(0,Math.min(move.length-1,j))]);
  const p0=i===0?mirror(P(0),P(1)):P(i-1),p3=i+2>=move.length?mirror(P(i+1),P(i)):P(i+2);
  return catmull(p0,P(i),P(i+1),p3,u);
}
const metric=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])+.5*Math.hypot(a[3]-b[3],a[4]-b[4],a[5]-b[5]);
function timedMove(move,easeIn,easeOut){
  const M=240,table=[];let L=0,prev=segmentAt(move,0,0);const knotsL=[0];
  for(let i=0;i<move.length-1;i++){for(let m=1;m<=M;m++){const u=m/M,p=segmentAt(move,i,u);L+=metric(prev,p);prev=p;table.push({i,u,L});}knotsL.push(L);}
  const t=move.map(k=>k.at),n=t.length,h=[],d=[];
  for(let i=0;i<n-1;i++){h.push(Math.max(1e-6,t[i+1]-t[i]));d.push((knotsL[i+1]-knotsL[i])/h.at(-1));}
  const m=new Array(n).fill(0);
  for(let i=1;i<n-1;i++)m[i]=d[i-1]>0&&d[i]>0?(h[i-1]+h[i])*3/((2*h[i]+h[i-1])/d[i-1]+(h[i]+2*h[i-1])/d[i]):0;
  const end=(h0,h1,d0,d1)=>{if(d1===undefined)return d0;let v=((2*h0+h1)*d0-h0*d1)/(h0+h1);if(v<0||d0<=0)v=0;else if(v>3*d0)v=3*d0;return v;};
  m[0]=easeIn?0:end(h[0],h[1],d[0],d[1]);m[n-1]=easeOut?0:end(h[n-2],h[n-3],d[n-2],d[n-3]);
  const distanceAt=time=>{
    let i=t.findIndex((x,j)=>j<n-1&&time<=t[j+1]);if(i<0)i=n-2;
    const s=Math.max(0,Math.min(1,(time-t[i])/h[i])),s2=s*s,s3=s2*s;
    return (2*s3-3*s2+1)*knotsL[i]+(s3-2*s2+s)*h[i]*m[i]+(-2*s3+3*s2)*knotsL[i+1]+(s3-s2)*h[i]*m[i+1];
  };
  return time=>{
    if(L<1e-6){const i=Math.max(0,t.findIndex((x,j)=>j<n-1&&time<=t[j+1]));return segmentAt(move,i,Math.max(0,Math.min(1,(time-t[i])/h[i])));}
    const want=Math.max(0,Math.min(L,distanceAt(time)));let lo=0,hi=table.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(table[mid].L<want)lo=mid+1;else hi=mid;}
    const b=table[lo],a=lo>0?table[lo-1]:{i:0,u:0,L:0},f=b.L>a.L?(want-a.L)/(b.L-a.L):0;
    return segmentAt(move,b.i,(a.i===b.i?a.u:0)+((a.i===b.i?b.u-a.u:b.u))*f);
  };
}
export function bakeCameraPlan(plan,T){
  const budget=plan.samples||Math.ceil(T*15),keys=[...plan.keys].sort((a,b)=>a.at-b.at);
  for(const k of keys)if(!(k.at>=-1e-6&&k.at<=T+1e-6))throw Error(`Camera key at ${k.at}s lies outside the ${T}s chapter.`);
  const moves=[];let current=[keys[0]];
  for(let i=1;i<keys.length;i++){
    const k=keys[i],prev=keys[i-1];
    if(k.cut||prev.hold){if(current.length)moves.push(current);current=prev.hold&&!k.cut?[{...prev,at:prev.at+prev.hold,hold:0},k]:[k];}else current.push(k);
  }
  moves.push(current);
  const out=[],toView=v=>({position:v.slice(0,3),target:v.slice(3,6),fov:v[6],aspect:16/9}),span=moves.reduce((n,m)=>n+Math.max(.1,m.at(-1).at-m[0].at),0);
  for(const [mi,move] of moves.entries()){
    const start=move[0].at,len=move.at(-1).at-start,n=move.length===1?1:Math.max(3,Math.round((budget-moves.length*2)*Math.max(.1,len)/span));
    const sample=move.length>1?timedMove(move,mi===0?plan.easeIn!==false:true,mi===moves.length-1?plan.easeOut!==false:true):null;
    for(let j=0;j<n;j++){const s=n===1?0:j/(n-1),v=n===1?vec(move[0]):sample(start+s*len);out.push({id:`spline-${mi}-${j}`,time:(start+s*len)/T,label:j===0?(move[0].label||'Move '+(mi+1)):j===n-1?(move.at(-1).label||'Land'):'·',easing:'linear',view:toView(v)});}
    if(moves[mi+1]?.[0].cut)out.at(-1).easing='hold';
  }
  const keysOut=out.sort((a,b)=>a.time-b.time).filter((k,i,a)=>i===a.length-1||a[i+1].time-k.time>1e-5);
  if(keysOut.at(-1).time<1)keysOut.push({...keysOut.at(-1),id:'spline-tail',time:1,label:'Hold & handoff'});
  return keysOut;
}
