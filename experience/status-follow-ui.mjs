// HTML for "status lights follow the moves" (experience/status-follow.mjs holds the rules). Pure string builders so node
// can test them; director.mjs owns the state and the handlers (data-action / name ids below).
//   Move inspector (Groove tab):  [Status light] switch + Fade in / Fade out         names: follow-toggle follow-fadein follow-fade
//   Lighting tab, Desk status:    Follow moves | Manual | Off, the count, Link all   data-action: follow-mode follow-link-all
//   A light's inspector:          follows <move> (read-only timing) + Unlink         data-action: follow-unlink, follow-goto; name follow-link-clip
// Every control is a real button / checkbox / select, so the phone layout's 44 px touch rule (director-phone.css, pointer: coarse) covers it.
import {lightName,followLane} from './status-follow.mjs';
import {lightKindColor,LIGHT_KINDS,WHEEL_MODES} from './film-lighting.mjs';
import {clipSummary} from './desk-clips.mjs';

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Number(Number(v).toFixed(2));
const option=(v,label,current,disabled=false)=>`<option value="${escape(v)}" ${String(v)===String(current)?'selected':''} ${disabled?'disabled':''}>${escape(label)}</option>`;
export const span=(at,dur)=>`${r2(at)}–${r2(at+dur)} s`;
export const colourName=kind=>(LIGHT_KINDS.find(k=>k[0]===kind)?.[1]||kind).split(' · ')[1]||'';
const stateText=e=>`${lightName(e)}${e.kind==='wheels'?'':colourName(e.kind)?' · '+colourName(e.kind):''}`;

// ---- the move inspector's switch
// state: {clip, on, entry, derived, statusOff}
export function clipFollowHtml({clip,on,entry,derived,statusOff}){
  const lane=followLane(clip);
  if(!lane)return `<div class="follow-light" data-follow-light><p class="director-hint">${clip.kind==='hold'?'A hold has no status light.':'A saved wheel path has no automatic status light: add one by hand in Lighting if you want it.'}</p></div>`;
  const shown=on?entry:derived,sub=shown?`${stateText(shown)} · ${span(shown.at,shown.dur)}`:'';
  if(statusOff)return `<div class="follow-light off" data-follow-light><label class="director-check follow-toggle"><input type="checkbox" disabled><span><b>Status light</b><small>Status lights are off for this chapter</small></span></label><div class="director-actions"><button data-action="follow-mode" data-section="follow">Turn status lights on</button></div></div>`;
  return `<div class="follow-light ${on?'on':''}" data-follow-light style="--lane:${lightKindColor(shown?.kind||'off')}">
    <label class="director-check follow-toggle" title="${on?'The desk strip shows this move\'s light for exactly as long as the move runs. Switch off to remove it.':'Add a status light that runs exactly as long as this move and follows it when you move, resize or retime it.'}"><input type="checkbox" name="follow-toggle" data-clip="${escape(clip.id)}" ${on?'checked':''}><span><b>Status light</b><small>${on?escape(sub)+' · follows this move':sub?'Off · would be '+escape(sub):'Off'}</small></span></label>
    ${on?`<div class="director-grid follow-fades"><label title="How long the white takes to give way to the light">Fade in (seconds)<input name="follow-fadein" type="number" min="0" max="10" step=".05" value="${entry.fadeIn??0}"></label><label title="How long the strip takes to go back to the white">Fade out (seconds)<input name="follow-fade" type="number" min="0" max="10" step=".05" value="${entry.fade??1}"></label></div>
    <p class="director-hint">Start, length and colour come from this move: change its time, speed, distance or direction and the light follows. Lighting → Desk status can unlink it.</p>`:''}</div>`;
}

// ---- Lighting tab, Desk status: the chapter control
export const FOLLOW_MODES=[['follow','Follow moves','Each move you switch a status light on for gets one that runs exactly as long as the move.'],['manual','Manual','Lights keep the times you set; nothing follows the moves.'],['off','Off','No status light in this chapter (the desk shows only its white).']];
export function followModeHtml({mode,counts,statusEdited}){
  const buttons=FOLLOW_MODES.map(([id,label,tip])=>`<button type="button" role="radio" aria-checked="${id===mode}" aria-pressed="${id===mode}" data-action="follow-mode" data-section="${id}" title="${escape(tip)}">${label}</button>`).join('');
  const line=mode==='off'?'No status light plays in this chapter. Your lights stay here and come back with Follow moves or Manual.'
    :mode==='manual'?'Lights keep the times you set. Switch a move\'s Status light on (Groove tab) or choose Follow moves to have them follow.'
    :`${counts.moves} move${counts.moves===1?'':'s'} can have a light · ${counts.linked} follow${counts.linked===1?'s':''} a move${counts.manual?` · ${counts.manual} set by hand`:''}. Switch a move\'s Status light on in Groove (or on its block).`;
  const found=counts.found?`<button data-action="follow-link-all" title="These lights already start and end with a move. Linking them makes them follow it; nothing moves now.">Link all matching (${counts.found})</button>`:'';
  return `<div class="follow-mode" role="radiogroup" aria-label="Status lights">${buttons}</div><p class="director-hint" data-follow-line>${escape(line)}${statusEdited===false?' From the film shot; your first edit keeps a copy in this cut.':' Export cut sends them to the film.'}</p>${found?`<div class="director-actions">${found}</div>`:''}`;
}

// ---- one light's inspector
// e the entry, link {clip, via} | null, clips the chapter's moves that could carry it (lane-compatible: [{id,label,start,duration,busy}])
export function statusInspectorHtml({e,link,seconds,clips,statusOff}){
  const kinds=LIGHT_KINDS.map(([id,label])=>option(id,label,e.kind)).join('');
  const fades=`<div class="director-grid"><label title="How long the white takes to give way to the state">Fade in (seconds)<input name="light-fadein" type="number" min="0" max="10" step=".05" value="${e.fadeIn??0}"></label><label title="How long the strip takes to go back to the white">Fade out (seconds)<input name="light-fade" type="number" min="0" max="10" step=".05" value="${e.fade??1}"></label></div>`;
  const head=`<h4 style="--lane:${lightKindColor(e.kind)}">${link?'<i class="follow-chain" role="img" aria-label="Linked to a move">🔗</i> ':''}Status light</h4>`;
  if(link){
    return `<div class="movement-inspector light-inspector linked" data-follow-linked="${escape(link.clip.id)}">${head}
      <p class="follow-timing"><b>Follows ${escape(clipSummary(link.clip))}</b><br>${escape(stateText(e))} · ${span(e.at,e.dur)} (${r2(e.dur)} s)${link.via==='timing'?'<br><small>Found by its timing: it follows this move from your next change to it.</small>':''}</p>
      ${fades}
      <div class="director-actions"><button data-action="follow-goto" title="Select the move this light follows">Go to the move</button><button data-action="follow-unlink" title="Keep this light but set its state and times by hand">Unlink to edit by hand</button><button data-action="light-delete">Delete status light</button></div></div>`;
  }
  const move=MOVE_LANES[e.kind];
  const picker=move&&!statusOff?`<label title="The light takes the move's start, length and state now, and follows it from then on">Linked to a move<select name="follow-link-clip"><option value="">Set by hand</option>${clips.map(c=>option(c.id,`${c.label} · ${span(c.start,c.duration)}${c.busy?' (has a light)':''}`,'',c.busy)).join('')}</select></label>`:'';
  return `<div class="movement-inspector light-inspector" data-follow-linked="">${head}
      <label>State<select name="light-kind">${kinds}</select></label>
      ${e.kind==='wheels'?`<label>Drive mode<select name="light-mode">${WHEEL_MODES.map((label,i)=>option(String(i+1),`${i+1} · ${label}`,String(e.mode??3))).join('')}</select></label>`:''}
      <div class="director-grid"><label>Start (seconds)<input name="light-at" type="number" min="0" max="${seconds}" step=".05" value="${r2(e.at)}"></label><label>Duration (seconds)<input name="light-dur" type="number" min=".05" max="${seconds}" step=".05" value="${r2(e.dur)}"></label></div>
      ${fades}${picker}
      <div class="director-actions"><button data-action="light-delete">Delete status light</button></div></div>`;
}
const MOVE_LANES={'lift-up':'lift','lift-down':'lift','tilt-retract':'tilt','tilt-extend':'tilt',wheels:'wheels'};
export const moveLane=kind=>MOVE_LANES[kind]||null;
