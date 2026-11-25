// The film's end card in the Director (Nov 24 2026, Vico: "I'm trying to edit the logo and the 'Let's build yours'
// title, and I don't see it anywhere in the timeline"). Not a title card: titles-src.json keeps it apart from
// "titles", as "logo" (the ErgoFlex wordmark, a graphic burned into the textless master) and "cta" (the line under it,
// burned with the titles' ASS), both drawn by tools/experience/finish-intro.py. Everything here mirrors that script on
// the 1920 x 1080 grid:
//   logo {chapter, rel_in, x?, y?, scale?, edited?}: the wordmark's centre (default 960, 0.73 H = 788.4) and its width
//     as a multiple of the film's 22 % of the frame width (scale 1); it fades in over 1.4 s from rel_in and out with the
//     film's last 1.4 s fade.
//   cta {chapter, rel_in, rel_out (null = to the film's end), text, fade_in, size, font, spacing, gap?, x?, edited?}:
//     with 'gap', its line top sits gap px under the wordmark's box, centred on x (default the wordmark's centre);
//     \fad(fade_in, 1400), rising 10 px over 1.1 s.
// The Director's edits ride in the hero shot as shot.endCard = {logo?, cta?} (only the parts he changed), the export
// carries them, build-round8-director.py --import writes them into titles-src.json with edited: true, and
// tools/experience/drafts/polish1124-hero3/apply.py then leaves an edited CTA alone.
export const LOGO_W=.22,LOGO_Y=.73,LOGO_ASPECT=304/1400,FILM_FADE=1.4,LOGO_FADE=1.4,CTA_RISE=10,CTA_RISE_MS=1100;
export const CTA_FONTS=[['Poppins','Poppins Regular',400],['Poppins Medium','Poppins Medium',500],['Poppins SemiBold','Poppins SemiBold',600],['Poppins Bold','Poppins Bold',700]];
export const LOGO_DEFAULT={x:960,y:1080*LOGO_Y,scale:1};
export const CTA_DEFAULT={fade_in:.9,size:46,font:'Poppins Medium',spacing:1.5};
const num=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):undefined;
const r3=v=>Math.round(v*1000)/1000;
// The end card of a chapter, from titles-src.json (null when the chapter has none: only the hero has it).
export function endCardOf(src,chapter){
  const L=src?.logo,C=src?.cta;if(!L||!C||L.chapter!==chapter)return null;
  return {logo:{rel_in:Number(L.rel_in),...pick(L,['x','y','scale'])},cta:{rel_in:Number(C.rel_in),rel_out:C.rel_out??null,text:String(C.text??''),...pick(C,['fade_in','size','font','spacing','gap','x'])}};
}
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined&&o[k]!==null).map(k=>[k,o[k]]));
// The Director's end card on top of the film's: the parts he changed (shot.endCard) replace the film's.
export function mergedEndCard(film,edit){if(!film)return null;return {logo:{...film.logo,...(edit?.logo||{})},cta:{...film.cta,...(edit?.cta||{})}};}
// Resolved values (defaults filled in) for drawing: finish-intro.py's geometry.
export function logoBox(logo,aspect=LOGO_ASPECT){
  const s=logo.scale??1,w=1920*LOGO_W*s,h=w*aspect,x=logo.x??LOGO_DEFAULT.x,y=logo.y??LOGO_DEFAULT.y;
  return {x,y,w,h,x0:x-w/2,y0:y-h/2,x1:x+w/2,y1:y+h/2};
}
export function ctaLayout(card,aspect=LOGO_ASPECT){
  const c=card.cta,b=logoBox(card.logo,aspect);
  return {x:c.x??b.x,top:b.y1+Number(c.gap??0),size:c.size??CTA_DEFAULT.size,font:c.font??CTA_DEFAULT.font,spacing:c.spacing??CTA_DEFAULT.spacing,fade_in:c.fade_in??CTA_DEFAULT.fade_in,
    weight:(CTA_FONTS.find(f=>f[0]===(c.font??CTA_DEFAULT.font))||CTA_FONTS[1])[2]};
}
// Chapter-relative spans on the lane: the wordmark to the chapter's end, the CTA to rel_out or the end.
export function spans(card,seconds){return {logo:[card.logo.rel_in,seconds],cta:[card.cta.rel_in,card.cta.rel_out??seconds]};}
// The film's last fade, chapter-relative (edl.total - 1.4 - the chapter's start), when the chapter ends the film.
export function filmFadeAt(edl,chapter){
  const ch=edl?.chapters,c=ch?.find(x=>x.id===chapter);if(!c||ch.at(-1)!==c||!Number.isFinite(Number(edl.total)))return null;
  return r3(Number(edl.total)-FILM_FADE-Number(c.start));
}
// shot.endCard as the cut keeps it (cuts.mjs: load, draft, export): only known fields, clamped.
export function cleanEndCard(v,seconds=90){
  if(!v||typeof v!=='object')return undefined;const out={};
  if(v.logo&&typeof v.logo==='object'){const L={};
    const a=num(v.logo.rel_in,0,seconds);if(a!==undefined)L.rel_in=r3(a);
    for(const [k,lo,hi] of [['x',-4000,4000],['y',-4000,4000],['scale',.1,5]]){const x=num(v.logo[k],lo,hi);if(x!==undefined)L[k]=Math.round(x*1000)/1000;}
    if(Object.keys(L).length)out.logo=L;}
  if(v.cta&&typeof v.cta==='object'){const C={};const c=v.cta;
    const a=num(c.rel_in,0,seconds);if(a!==undefined)C.rel_in=r3(a);
    if(c.rel_out===null)C.rel_out=null;else{const b=num(c.rel_out,0,seconds);if(b!==undefined)C.rel_out=r3(b);}
    if(typeof c.text==='string')C.text=c.text.replace(/\s*\n\s*/g,' ').slice(0,120);
    for(const [k,lo,hi] of [['fade_in',0,5],['size',8,300],['spacing',-10,40],['gap',-1000,1000],['x',-4000,4000]]){const x=num(c[k],lo,hi);if(x!==undefined)C[k]=Math.round(x*1000)/1000;}
    if(CTA_FONTS.some(f=>f[0]===c.font))C.font=c.font;
    if(C.rel_in!==undefined&&typeof C.rel_out==='number'&&C.rel_out<C.rel_in+.5)C.rel_out=Math.min(seconds,r3(C.rel_in+.5));
    if(Object.keys(C).length)out.cta=C;}
  return Object.keys(out).length?out:undefined;
}
// Opacity / rise at chapter time t, as the burn has them (the logo's fade-in, the CTA's \fad and \move).
export function logoAlpha(card,t,seconds,fadeAt){
  const a=card.logo.rel_in;if(t<a)return 0;let v=Math.min(1,(t-a)/LOGO_FADE);
  if(fadeAt!==null&&fadeAt!==undefined&&t>fadeAt)v*=Math.max(0,1-(t-fadeAt)/FILM_FADE);return v;
}
export function ctaState(card,t,seconds,fadeAt){
  const c=card.cta,L=ctaLayout(card),a=c.rel_in,b=c.rel_out??seconds;if(t<a||t>=b)return {on:false,alpha:0,dy:0};
  const ms=(t-a)*1000,dur=(b-a)*1000,out=c.rel_out==null?1400:Math.min(1400,dur/2),fin=L.fade_in*1000;
  let alpha=fin>0?Math.min(1,ms/fin):1;if(dur-ms<out)alpha=Math.min(alpha,(dur-ms)/out);
  if(c.rel_out==null&&fadeAt!=null&&t>fadeAt)alpha=Math.min(alpha,Math.max(0,1-(t-fadeAt)/FILM_FADE));
  return {on:true,alpha:Math.max(0,alpha),dy:CTA_RISE*Math.max(0,1-ms/CTA_RISE_MS)};
}
