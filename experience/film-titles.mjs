// Film titles (the chapter title cards burned into the intro by tools/experience/finish-intro.py) in the Director.
// Source: <hq>/titles-src.json titles[] {chapter, rel_in, rel_out, eyebrow, title, detail, scrim?, shadow?, director_timing?},
// times chapter-relative (= the chapter render's own clock, the Director playhead). Everything here mirrors
// finish-intro.py's ASS overlay on the 1920 x 1080 grid, so the Director preview and the film agree.
//
// Shadow ("the soft dark shape behind the copy"): by default one box per line, fitted to the line's text
// (finish-intro: BorderStyle 3 boxes, Outline = padding, 31% black, \blur18; Vico's HQ20 "F"). A custom shadow
// replaces them with paths drawn as ASS vector drawings, same darkness and softness:
//   shadow: {blur?: ASS \blur, opacity?: 0..1, paths?: [{line?: 'eyebrow'|'title'|'detail', points: [{x, y, in?: [dx, dy], out?: [dx, dy], smooth?: true}]}]}
// Point coordinates are film pixels (1920 x 1080 grid) relative to the title anchor (ANCHOR: the headline's left
// edge and baseline position), handles relative to their point. A path keeps the timing of the line it came from.

export const FILM_W=1920,FILM_H=1080,X0=128,ANCHOR=[128,912];
// libass sizes a font by its full (winAscent + winDescent) height: Poppins 1135 + 627 units per 1000 em.
export const FONT_REAL=1762/1000,ASC=1135/1762,DESC=627/1762;
export const LINES=[
  {key:'eyebrow',label:'Eyebrow',family:'Poppins SemiBold',weight:600,size:28,spacing:6,border:16,y:812,delay:0,rise:10,color:'#1388ec',shadow:1.2,shadowAlpha:1-0xB4/255},
  {key:'title',label:'Headline',family:'Poppins SemiBold',weight:600,size:86,spacing:-.6,border:26,y:912,delay:140,rise:14,color:'#ffffff',shadow:2,shadowAlpha:1-0xA0/255},
  {key:'detail',label:'Supporting text',family:'Poppins',weight:400,size:40,spacing:.2,border:20,y:970,delay:380,rise:10,color:'#d6dee6',shadow:1.5,shadowAlpha:1-0xA0/255}];
export const BOX_BLUR=18,BOX_OPACITY=1-0xB0/255;          // finish-intro BOX_A 'B0' (31% black), BOX_BLUR 18
export const FADE_IN=.65,FADE_OUT=.42,RISE_TIME=.9,TEXT_BLUR=5,TEXT_BLUR_TIME=.7;
export const BLUR_SIGMA=2/Math.sqrt(Math.log(256));        // libass: Gaussian sigma = \blur x 0.849 (measured on its output)
export const LEAD=1.5,TAIL=.8,MIN_ON=3.5;                   // titles-after-cut.py
const r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const num=(v,lo,hi,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;};
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
const lineOf=key=>LINES.find(l=>l.key===key);

// ---- film source ---------------------------------------------------------------------------------------------
// The chapter's titles from titles-src.json, in film order, with ids "<chapter>-<n>" (n: place within the chapter).
export function chapterTitles(src,chapter){
  return (src?.titles||[]).filter(t=>t?.chapter===chapter).map((t,n)=>cleanTitle({...t,id:`${chapter}-${n}`,timed:!!t.director_timing}));
}
// When the transition into the chapter has finished, and the film rule's earliest entry (LEAD s later).
export function cutRule(edl,chapter){
  const ch=edl?.chapters,i=ch?.findIndex(c=>c.id===chapter)??-1;if(!ch||i<0)return null;
  const X=Number(edl.dissolve)||0,tr=(edl.transitions||ch.slice(1).map(()=>X)).map(v=>Array.isArray(v)?v:[v,0]);
  const out={};
  if(i>0){const [d,s]=tr[i-1];out.cutDone=r3(X/2+(Number(s)||0)+Math.min(X,Number(d))/2);out.earliest=r3(out.cutDone+LEAD);}
  if(i<ch.length-1){const [d,s]=tr[i],n=ch[i+1];out.nextCut=r3(n.start-ch[i].start+X/2+(Number(s)||0)-Math.min(X,Number(d))/2);out.latest=r3(out.nextCut-TAIL);}
  return Object.keys(out).length?out:null;
}
// Plain-language timing notes for a title (the Director's gentle warnings; nothing is moved).
export function timingNotes(t,rule){
  const notes=[];if(!rule)return notes;
  if(rule.earliest!==undefined&&t.rel_in<rule.earliest-1e-6)notes.push(`Comes in ${r2(rule.earliest-t.rel_in)} s before the 1.5 s-after-cut mark (${r2(rule.earliest)} s).`);
  if(rule.latest!==undefined&&t.rel_out>rule.latest+1e-6)notes.push(`Stays ${r2(t.rel_out-rule.latest)} s past the 0.8 s-before-next-cut mark (${r2(rule.latest)} s).`);
  if(t.rel_out-t.rel_in<MIN_ON-1e-6)notes.push(`On screen ${r2(t.rel_out-t.rel_in)} s, under the usual ${MIN_ON} s.`);
  return notes;
}

// ---- cleaning (cut JSON / imports) ---------------------------------------------------------------------------
function cleanPoint(p){
  const c=v=>num(v,-4000,4000,0),out={x:r2(c(p?.x)),y:r2(c(p?.y))};
  for(const k of ['in','out'])if(Array.isArray(p?.[k])&&p[k].length===2&&(Number(p[k][0])||Number(p[k][1])))out[k]=[r2(c(p[k][0])),r2(c(p[k][1]))];
  if(p?.smooth&&(out.in||out.out))out.smooth=true;
  return out;
}
export function cleanShadow(v){
  if(!v||typeof v!=='object')return null;const out={};
  if(v.blur!==undefined&&Number.isFinite(Number(v.blur)))out.blur=r2(num(v.blur,0,80,BOX_BLUR));
  if(v.opacity!==undefined&&Number.isFinite(Number(v.opacity)))out.opacity=r3(num(v.opacity,0,1,BOX_OPACITY));
  if(Array.isArray(v.paths)){
    const paths=v.paths.slice(0,12).filter(p=>Array.isArray(p?.points)&&p.points.length>=3).map(p=>({...(lineOf(p.line)?{line:p.line}:{}),points:p.points.slice(0,96).map(cleanPoint)}));
    if(paths.length)out.paths=paths;
  }
  return Object.keys(out).length?out:null;
}
export function cleanTitle(t,seconds=90){
  const a=num(t?.rel_in,0,seconds,0),b=num(t?.rel_out,0,seconds,Math.min(seconds,a+5));
  const out={id:typeof t?.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(t.id)?t.id:'title',rel_in:r3(Math.min(a,b-.2)),rel_out:r3(Math.max(b,a+.2)),
    eyebrow:text(t?.eyebrow,60),title:text(t?.title,140),detail:text(t?.detail,260)};
  if(t?.timed)out.timed=true;
  const s=cleanShadow(t?.shadow);if(s)out.shadow=s;
  return out;
}
export function cleanFilmTitles(list,seconds=90){
  if(!Array.isArray(list))return undefined;const seen=new Set();
  return list.slice(0,8).map(t=>cleanTitle(t,seconds)).filter(t=>!seen.has(t.id)&&seen.add(t.id)).sort((a,b)=>a.rel_in-b.rel_in);
}

// ---- layout (film pixels) ------------------------------------------------------------------------------------
// measure(line, text) -> the line's advance width in film pixels as libass sets it (the Director measures with
// the same Poppins files). Fitted box: from the text's left edge - padding to its advance + padding; from the
// baseline - ascender - padding to the baseline + descender + padding (bottom = the line's y + padding).
export function fittedBox(line,width){
  const L=lineOf(line)||line,[ax,ay]=ANCHOR;
  return {x0:X0-L.border-ax,x1:X0+width+L.border-ax,y0:L.y-L.size-L.border-ay,y1:L.y+L.border-ay};
}
const rect=({x0,y0,x1,y1})=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}].map(p=>({x:r2(p.x),y:r2(p.y)}));
export function fittedPaths(title,measure){
  return LINES.filter(L=>title[L.key]).map(L=>({line:L.key,points:rect(fittedBox(L,measure(L,title[L.key])))}));
}
export function shadowOf(title,measure){
  const s=title.shadow||{};
  return {blur:s.blur??BOX_BLUR,opacity:s.opacity??BOX_OPACITY,custom:!!s.paths,paths:s.paths?structuredClone(s.paths):fittedPaths(title,measure)};
}
// The text block's own extents (left/right/top/bottom) relative to the anchor.
export function textBounds(title,measure){
  const lines=LINES.filter(L=>title[L.key]);if(!lines.length)return null;const [ax,ay]=ANCHOR;
  return {x0:X0-ax,x1:Math.max(...lines.map(L=>X0+measure(L,title[L.key])))-ax,y0:Math.min(...lines.map(L=>L.y-L.size))-ay,y1:Math.max(...lines.map(L=>L.y))-ay};
}

// ---- timing (finish-intro: \fad(650,420), \move rise over 900 ms, text \blur5 -> 0 over 700 ms) --------------
export function lineState(title,delayMs,riseBy,t){
  const start=title.rel_in+delayMs/1000,end=title.rel_out;
  if(t<start-1e-9||t>=end)return {on:false,alpha:0,dy:0,blur:0};
  const k=Math.min(1,(t-start)/FADE_IN),o=Math.min(1,(end-t)/FADE_OUT);
  return {on:true,alpha:Math.max(0,Math.min(k,o)),dy:riseBy*(1-Math.min(1,(t-start)/RISE_TIME)),blur:TEXT_BLUR*(1-Math.min(1,(t-start)/TEXT_BLUR_TIME))};
}
export const pathTiming=p=>{const L=lineOf(p.line);return L?[L.delay,L.rise]:[0,10];};
// A time when the whole title is fully in (for previews and stills of a selected title).
export const restTime=t=>Math.min(t.rel_out-FADE_OUT-.05,t.rel_in+Math.max(...LINES.map(L=>L.delay))/1000+Math.max(FADE_IN,RISE_TIME)+.15);

// ---- paths -----------------------------------------------------------------------------------------------------
const add=(p,h)=>h?[p.x+h[0],p.y+h[1]]:[p.x,p.y];
// Segments as [p0, c1, c2, p1] (a straight edge has its controls on its ends).
export function segments(path){
  const P=path.points;return P.map((p,i)=>{const q=P[(i+1)%P.length];return {i,line:!p.out&&!q.in,pts:[[p.x,p.y],add(p,p.out),add(q,q.in),[q.x,q.y]]};});
}
const fmt=v=>String(r2(v));
export function svgPath(path,[ox,oy]=ANCHOR){
  const P=path.points;if(!P.length)return '';const xy=([x,y])=>`${fmt(x+ox)} ${fmt(y+oy)}`;
  return `M ${xy([P[0].x,P[0].y])} `+segments(path).map(s=>s.line?`L ${xy(s.pts[3])}`:`C ${xy(s.pts[1])} ${xy(s.pts[2])} ${xy(s.pts[3])}`).join(' ')+' Z';
}
// ASS vector drawing (\p1), absolute film coordinates: m / l / b (cubic), closed implicitly.
export function assDrawing(path,[ox,oy]=ANCHOR){
  const P=path.points;if(!P.length)return '';const xy=([x,y])=>`${fmt(x+ox)} ${fmt(y+oy)}`;
  return `m ${xy([P[0].x,P[0].y])} `+segments(path).map(s=>s.line?`l ${xy(s.pts[3])}`:`b ${xy(s.pts[1])} ${xy(s.pts[2])} ${xy(s.pts[3])}`).join(' ');
}
const bez=([a,b,c,d],t)=>{const u=1-t;return [0,1].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]);};
export function sample(path,n=24){return segments(path).flatMap(s=>s.line?[s.pts[0]]:Array.from({length:n},(_,i)=>bez(s.pts,i/n)));}
export function bounds(paths){
  const pts=paths.flatMap(p=>sample(p));if(!pts.length)return null;
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};
}
// Nearest place on the outline to (x, y): {seg, t, d, at}.
export function nearestOnPath(path,x,y){
  let best=null;
  for(const s of segments(path)){
    const at=t=>s.line?[s.pts[0][0]+(s.pts[3][0]-s.pts[0][0])*t,s.pts[0][1]+(s.pts[3][1]-s.pts[0][1])*t]:bez(s.pts,t);
    let bt=0,bd=Infinity;for(let i=0;i<=40;i++){const p=at(i/40),d=Math.hypot(p[0]-x,p[1]-y);if(d<bd){bd=d;bt=i/40;}}
    for(let step=1/80;step>1e-4;step/=2)for(const t of [bt-step,bt+step]){if(t<0||t>1)continue;const p=at(t),d=Math.hypot(p[0]-x,p[1]-y);if(d<bd){bd=d;bt=t;}}
    if(!best||bd<best.d)best={seg:s.i,t:bt,d:bd,at:at(bt)};
  }
  return best;
}
// Add a point on segment `seg` at `t` without changing the outline (de Casteljau split for curves).
export function insertPoint(path,seg,t){
  const P=path.points.map(p=>structuredClone(p)),i=seg,j=(i+1)%P.length,s=segments({points:P})[i];
  t=Math.max(.02,Math.min(.98,t));
  if(s.line){const [a,,,d]=s.pts;P.splice(i+1,0,{x:r2(a[0]+(d[0]-a[0])*t),y:r2(a[1]+(d[1]-a[1])*t)});return {path:{...path,points:P},index:i+1};}
  const [a,b,c,d]=s.pts,l=(u,v)=>[u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t],ab=l(a,b),bc=l(b,c),cd=l(c,d),abc=l(ab,bc),bcd=l(bc,cd),m=l(abc,bcd);
  const rel=(q,o)=>[r2(q[0]-o[0]),r2(q[1]-o[1])],np={x:r2(m[0]),y:r2(m[1]),in:rel(abc,m),out:rel(bcd,m),smooth:true};
  P[i].out=rel(ab,a);P[j].in=rel(cd,d);
  P.splice(i+1,0,np);return {path:{...path,points:P.map(cleanPoint)},index:i+1};
}
export function deletePoint(path,index){
  if(path.points.length<=3)throw Error('A shadow shape needs at least 3 points.');
  return {...path,points:path.points.filter((_,i)=>i!==index)};
}
// Sharp <-> smooth (smooth: handles along the neighbours' direction, a third of the way to each).
export function toggleSmooth(path,index){
  const P=path.points.map(p=>structuredClone(p)),p=P[index];
  if(p.in||p.out){delete p.in;delete p.out;delete p.smooth;return {...path,points:P};}
  const a=P[(index-1+P.length)%P.length],b=P[(index+1)%P.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const la=Math.hypot(p.x-a.x,p.y-a.y)/3,lb=Math.hypot(b.x-p.x,b.y-p.y)/3;
  p.in=[r2(-dx/len*la),r2(-dy/len*la)];p.out=[r2(dx/len*lb),r2(dy/len*lb)];p.smooth=true;return {...path,points:P};
}
// Drag a handle; a smooth point turns its other handle to stay opposite (its own length kept) unless broken (Alt).
export function moveHandle(path,index,which,[hx,hy],breakIt=false){
  const P=path.points.map(p=>structuredClone(p)),p=P[index],other=which==='in'?'out':'in';
  p[which]=[r2(hx),r2(hy)];
  if(breakIt)delete p.smooth;
  else if(p.smooth&&p[other]){const l=Math.hypot(...p[other]),m=Math.hypot(hx,hy)||1;p[other]=[r2(-hx/m*l),r2(-hy/m*l)];}
  return {...path,points:P};
}
export function movePoint(path,index,x,y){const P=path.points.map(p=>structuredClone(p));P[index].x=r2(x);P[index].y=r2(y);return {...path,points:P};}
// Scale / move paths: x' = ox + (x - ox) * sx + dx (handles scale too).
export function transformPaths(paths,{ox=0,oy=0,sx=1,sy=1,dx=0,dy=0}){
  return paths.map(p=>({...p,points:p.points.map(q=>{const o={x:r2(ox+(q.x-ox)*sx+dx),y:r2(oy+(q.y-oy)*sy+dy)};if(q.in)o.in=[r2(q.in[0]*sx),r2(q.in[1]*sy)];if(q.out)o.out=[r2(q.out[0]*sx),r2(q.out[1]*sy)];if(q.smooth)o.smooth=true;return o;})}));
}
export const pointCount=paths=>paths.reduce((n,p)=>n+p.points.length,0);
// The title as the film's titles-src entry (for the Director export and the import).
export function srcEntry(chapter,t){
  const e={chapter,rel_in:t.rel_in,rel_out:t.rel_out,eyebrow:t.eyebrow,title:t.title,detail:t.detail};
  if(t.shadow)e.shadow=structuredClone(t.shadow);if(t.timed)e.director_timing=true;return e;
}
