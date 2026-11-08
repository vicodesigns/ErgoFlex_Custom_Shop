// Director multi-select helpers (the stage logic lives in scene-prop-editor.mjs, which owns the gizmo and the edits).
// Click = select one · Shift+click = add · Ctrl/Cmd+click = add or remove · click empty = clear · Esc = clear.
// The selection holds room props and desk items alike (all are prop edits: prop-edits.mjs), and they move, turn, hide
// and reset together, each writing its own ordinary edit, one undo step per move.
export const pickMode=ev=>ev.ctrlKey||ev.metaKey?'toggle':ev.shiftKey?'add':'replace';
// A turn of `radians` about the vertical axis through `centre` (THREE.Vector3), as a world-matrix delta.
export function groupCentreDelta(THREE,centre,radians){
  return new THREE.Matrix4().makeTranslation(centre.x,centre.y,centre.z).multiply(new THREE.Matrix4().makeRotationY(radians)).multiply(new THREE.Matrix4().makeTranslation(-centre.x,-centre.y,-centre.z));
}
// The Props tab while several things are selected: the list, relative move / turn fields (inches, degrees), hide, reset.
export function groupPanelHtml({members,mode,escape,edited}){
  const n=members.length,allHidden=members.every(m=>m.hidden),num=(name,text,step)=>`<label>${text}<input name="${name}" type="number" step="${step}" value="0"></label>`;
  return `<div class="movement-inspector prop-inspector prop-group" data-reveal="prop"><h4>${n} selected</h4>
    <p class="director-hint">They move, turn and hide together. Shift+click adds, Ctrl+click adds or removes, click empty space or Esc clears.</p>
    <ul class="prop-group-list">${members.map(m=>`<li class="${m.missing?'missing':''}"><span title="${escape(m.name)}">${escape(m.name)}</span><small>${m.desk?'desk item':'room prop'}${m.hidden?' · hidden':''}${m.blocked?' · can\'t be saved':''}${m.missing?' · not in the room':''}</small><button data-action="pp-unsel" data-section="${escape(m.key)}" aria-label="Remove ${escape(m.name)} from the selection" title="Remove from the selection">×</button></li>`).join('')}</ul>
    <div class="director-actions prop-modes">${[['translate','Move','W'],['rotate','Rotate','E']].map(([m,t,k])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} the whole group (${k})">${t}</button>`).join('')}</div>
    <p class="director-hint">Or type a move from where they are now:</p>
    <div class="director-grid three-up">${num('pp-gmx','Right (x″)',1)}${num('pp-gmy','Up (y″)',1)}${num('pp-gmz','Toward you (z″)',1)}</div>
    <div class="director-grid three-up">${num('pp-gry','Turn about the centre (°)',5)}</div>
    <label class="director-check"><input type="checkbox" name="pp-hide" ${allHidden?'checked':''}>Hide all in this chapter</label>
    <div class="director-actions"><button data-action="ly-new" title="Name these as a layer in the Layers tab">New layer from selection…</button><button data-action="pp-reset" ${edited?'':'disabled'} title="Every selected prop back to where the film puts it">Reset selected to the film</button><button data-action="pp-clear">Clear selection</button></div></div>`;
}
