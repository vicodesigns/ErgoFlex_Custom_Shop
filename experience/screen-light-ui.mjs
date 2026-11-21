// The Lighting tab's "Screen light" controls (21 Nov 2026, Vico on the media chapters: "the colours on the reflections are
// a bit bright and washed out"). The field and its meaning are experience/screen-light.mjs (docs/screen-reflection/
// CONTRACT.md): shot.sceneGlobals.screenLight = {gain, saturation, contrast, tint, keepHue}, only values that differ from
// today's. Shown only for a chapter whose film shot has ledMode 'media' (ch 9 music, ch 10 media): elsewhere it does nothing.
//   own   the Director's shot.sceneGlobals.screenLight: undefined = not touched (the film's value counts), {} = today's
//   film  the film shot's sceneGlobals.screenLight (the chapter's data defaults: ch 9 gain .55 sat 1.5, ch 10 gain .6 sat 1.4 keep hue)
// Fields: scl-<key> (range in %, colour, checkbox) and scln-<key> (the % number beside a range). Pure: node tests run it.
import {FIELDS,KEYS,cleanScreenLight,lightFor,isToday} from './screen-light.mjs?v=screen-light-20261121';
export {FIELDS,KEYS};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const isMedia=(film,shot)=>(film?.ledMode??shot?.ledMode)==='media';
// What the sliders show and where it comes from: 'director' (edited here), 'film' (the chapter's data), 'today' (neither).
export function screenLightNow(own,film){
  if(isObj(own))return {values:lightFor(own),from:'director'};
  if(isObj(film)&&!isToday(film))return {values:lightFor(film),from:'film'};
  return {values:lightFor(null),from:'today'};
}
const pct=v=>Math.round(v*100);
// The values after one field changed (el: {name, type, value, checked}); throws with a sentence for a bad number.
export function screenLightChange(values,el){
  const m=/^scln?-(\w+)$/.exec(el?.name||''),k=m?.[1],f=k&&FIELDS[k];if(!f)return null;
  const next={...values};
  if(f.bool)next[k]=!!el.checked;
  else if(f.color){if(!/^#[0-9a-f]{6}$/i.test(el.value||''))throw Error('Pick a colour for the tint.');next[k]=el.value.toLowerCase();}
  else{
    const n=Number(el.value);if(String(el.value).trim()===''||!Number.isFinite(n))throw Error(`Type a number for ${f.label.toLowerCase()}.`);
    const v=f.pct?n/100:n;if(v<f.min-1e-9||v>f.max+1e-9)throw Error(`${f.label} runs from ${f.pct?pct(f.min)+' %':f.min} to ${f.pct?pct(f.max)+' %':f.max}.`);
    next[k]=Math.round(v*1000)/1000;
  }
  return next;
}
// The field to write: only what differs from today ({} = today's, which the importer turns into "no field").
export const screenLightField=values=>cleanScreenLight(values)||{};
// "Lighting now" row text.
export function screenLightSummary(v){
  const parts=[`${pct(v.gain)} %`,`sat ${pct(v.saturation)} %`];if(v.contrast!==1)parts.push(`contrast ${pct(v.contrast)} %`);if(v.tint!=='#ffffff')parts.push('tint '+v.tint);if(v.keepHue)parts.push('keeps colours');
  return parts.join(' · ');
}
const FROM={director:'Edited here; Export cut sends it to the film.',film:'The chapter\'s own values (from the film) until you change them.',today:'As the film has always had it (100 %).'};
export function screenLightHTML({values,from},{filmValues=null}={}){
  const rows=KEYS.map(k=>{const f=FIELDS[k],v=values[k],tip=f.tip?` title="${esc(f.tip)}"`:'';
    if(f.bool)return `<label class="director-check"${tip}><input type="checkbox" name="scl-${k}" ${v?'checked':''}>${esc(f.label)}</label>`;
    if(f.color)return `<label${tip}>${esc(f.label)} <output data-screen-light-out="${k}">${v==='#ffffff'?'none':esc(v)}</output><input type="color" name="scl-${k}" value="${esc(v)}"></label>`;
    const lo=f.pct?pct(f.min):f.min,hi=f.pct?pct(f.max):f.max,step=f.pct?1:f.step,shown=f.pct?pct(v):v;
    return `<label${tip}>${esc(f.label)} <output data-screen-light-out="${k}">${shown}${f.pct?' %':''}</output><span class="global-slider"><input type="range" name="scl-${k}" min="${lo}" max="${hi}" step="${step}" value="${shown}"><input type="number" name="scln-${k}" min="${lo}" max="${hi}" step="${step}" value="${shown}"></span></label>`;}).join('');
  const film=filmValues&&!isToday(filmValues);
  return `<div class="screen-light" data-screen-light data-from="${from}"><h4 title="The colour the screens throw onto the desk, floor and walls in this chapter (the desk's LEDs follow the picture)">Screen light on the room</h4>
    <p class="director-hint">${FROM[from]}</p>${rows}
    <div class="director-actions">${from==='director'&&film?'<button type="button" data-action="screen-light-film" title="Back to this chapter\'s own values from the film">↺ Chapter\'s values</button>':''}<button type="button" data-action="screen-light-reset" ${isToday(values)?'disabled':''} title="Back to the light as the film has always had it: 100 %, no tint">100 % (as before)</button></div></div>`;
}
