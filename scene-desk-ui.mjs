import { mountDeskObjectUI } from './scene-desk-object-ui.mjs?v=library-humboldt-20261013';
export function mountSceneDeskUI(parent,manager){
    const panel=document.createElement('details');panel.className='scene-desk-panel';panel.open=false;
    panel.innerHTML=`<summary><span data-desk-title>Desks</span> <span data-desk-summary></span></summary>
        <div class="scene-desk-row"><label>Control desk <select data-desk-select aria-label="Desk controlled by movement panel"></select></label>
        <label>Desktop <select data-desk-size><option value="48x30">48″ Standard</option><option value="60x30">60″ Extended</option></select></label>
        <button type="button" data-desk-add>Add desk</button><button type="button" data-desk-delete>Delete desk</button>
        <button type="button" data-desk-left aria-label="Rotate selected desk left">↶ 15°</button><button type="button" data-desk-right aria-label="Rotate selected desk right">↷ 15°</button><button type="button" data-desk-save>Save desk setting</button><button type="button" data-desks-save>Save all desks</button></div>
        <p class="desk-object-note">Each desk keeps separate 48″ and 60″ setups, including finishes, accessories, objects and saved Grooves.</p>
        <details class="scene-desk-routines"><summary>Desk Grooves <span data-desk-setting></span></summary>
        <div class="scene-desk-row"><button type="button" data-desk-record>Record Groove</button><button type="button" data-desk-play>Play desk Groove</button>
        <button type="button" data-desks-play>Play group Grooves</button><button type="button" data-desks-stop>Stop</button>
        <span role="status" aria-live="polite" data-desk-status>Move the selected desk with the controls, then save or record.</span></div></details>`;
    parent.append(panel);
    const objects=mountDeskObjectUI(panel,manager);
    const q=s=>panel.querySelector(s);
    q('[data-desk-select]').onchange=e=>manager.select(e.target.value);
    q('[data-desk-size]').onchange=e=>manager.setSize(e.target.value);
    q('[data-desk-add]').onclick=()=>manager.add(q('[data-desk-size]').value);
    q('[data-desk-left]').onclick=()=>manager.rotate(-15);q('[data-desk-right]').onclick=()=>manager.rotate(15);
    q('[data-desk-delete]').onclick=()=>manager.remove();
    q('[data-desk-save]').onclick=()=>manager.saveSetting();q('[data-desks-save]').onclick=()=>manager.saveSetting(true);
    q('[data-desk-record]').onclick=()=>manager.recording?manager.stopRecording():manager.record();
    q('[data-desk-play]').onclick=()=>manager.play();q('[data-desks-play]').onclick=()=>manager.play(true);
    q('[data-desks-stop]').onclick=()=>{manager.stop();manager.ctx.halt();};
    return {panel,sync(){
        panel.hidden=!manager.key;objects.sync();
        const product=!!manager.active?.product;
        q('[data-desk-title]').textContent=product?'Desk objects':'Desks';
        panel.querySelector('.scene-desk-row').hidden=product;
        panel.querySelector('.scene-desk-routines').hidden=product;
        if(product)objects.panel.open=true;
        const select=q('[data-desk-select]'),ids=[...manager.records.keys()];
        const signature=ids.map(id=>id+':'+manager.records.get(id).state.name).join('|');
        if(select.dataset.signature!==signature){select.replaceChildren();for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=manager.records.get(id).state.name;select.add(option);}select.dataset.signature=signature;}
        select.value=manager.selected||'';select.disabled=!!manager.recording||!!manager.playing||!manager.active;
        if(manager.active)q('[data-desk-size]').value=manager.active.state.size;
        const busy=!!manager.recording||!!manager.playing;
        for(const selector of ['[data-desk-left]','[data-desk-right]','[data-desk-size]','[data-desk-delete]','[data-desk-save]','[data-desks-save]'])q(selector).disabled=busy||!manager.active;
        q('[data-desk-add]').disabled=busy||manager.records.size>=24;
        q('[data-desk-record]').disabled=!manager.active||!!manager.playing;
        q('[data-desk-record]').textContent=manager.recording?'Save recording':'Record Groove';
        const phase=manager.ctx.phase(),setting=manager.active?.state.phases[phase];
        q('[data-desk-play]').disabled=busy||!setting;
        q('[data-desks-play]').disabled=busy||![...manager.records.values()].some(r=>r.state.phases[phase]);
        q('[data-desks-stop]').disabled=!busy;
        q('[data-desk-summary]').textContent=manager.active?(product?'· Move, rotate, add or remove':'· '+manager.active.state.name+' · '+ids.length+' desks'):'· Add a desk to this room';
        q('[data-desk-setting]').textContent='· '+(manager.ctx.phaseLabel?.()||phase||'Current setting');
        q('[data-desk-status]').textContent=manager.recording?'Recording movement · up to 3 minutes':manager.playing?'Group Groove playing':setting?.recording.length?setting.recording.at(-1).t.toFixed(1)+' s recording saved for this setting':setting?'Position and lights saved for this setting':'Move the selected desk with the controls, then save or record.';
    }};
}
