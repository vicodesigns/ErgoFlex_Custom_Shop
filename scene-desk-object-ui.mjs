import { DESK_SURFACES } from './scene-desk-objects.mjs';

export function mountDeskObjectUI(parent,manager){
    const editor=manager.objects,panel=document.createElement('details');panel.className='scene-desk-object-panel';
    const surfaces=Object.entries(DESK_SURFACES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    panel.innerHTML=`<summary>Objects on this desk</summary>
        <div class="scene-desk-row"><label><input type="checkbox" data-object-edit> Edit desk objects</label><span data-object-count></span><button type="button" data-object-hide>Hide tools to see the desk</button></div>
        <p class="desk-object-note">Turn on editing to click an object and drag it along its desk surface. Changes save in this browser; use Undo or Redo to reverse them.</p>
        <div class="scene-desk-row"><label>Object <select data-object-select aria-label="Selected desk object"></select></label><button type="button" data-object-remove>Remove object</button></div>
        <fieldset class="desk-object-fields"><legend>Edit selected object</legend><label>Desk part <select data-object-role>${surfaces}</select></label>
        <label>Left / right (mm)<input type="number" step="10" min="-5000" max="5000" data-object-x></label>
        <label>Back / front (mm)<input type="number" step="10" min="-5000" max="5000" data-object-z></label>
        <label>Height above part (mm)<input type="number" step="5" min="0" max="5000" data-object-y></label>
        <label>Rotation (°)<input type="number" step="15" data-object-rotation></label>
        <label>Size (%)<input type="number" step="5" min="1" max="500" data-object-scale></label></fieldset>
        <details class="desk-object-library"><summary>Add from the object library</summary>
        <div class="scene-desk-row"><label>Place on <select data-object-target>${surfaces}</select></label>
        <label>Find an object <input type="search" data-object-search placeholder="Laptop, book, plant…"></label>
        <label>Category <select data-object-category><option value="recommended">Desk sized objects</option><option value="all">All categories</option></select></label></div>
        <span data-object-library-status role="status" aria-live="polite">Loading object library…</span>
        <div class="desk-object-library-grid" data-object-library></div></details>`;
    parent.append(panel);const q=s=>panel.querySelector(s),select=q('[data-object-select]');
    q('[data-object-edit]').onchange=e=>editor.setEditing(e.target.checked);
    q('[data-object-hide]').onclick=()=>{parent.open=false;};
    select.onchange=e=>{editor.select(e.target.value);editor.setEditing(true);};
    q('[data-object-remove]').onclick=()=>editor.remove();
    for(const field of ['role','x','y','z','rotation','scale'])q(`[data-object-${field}]`).onchange=e=>editor.change({[field]:field==='role'?e.target.value:Number(e.target.value)});
    q('[data-object-target]').onchange=e=>editor.role=e.target.value;
    let entries=[],renderSignature='';
    const library=()=>{
        const query=q('[data-object-search]').value.trim().toLowerCase(),category=q('[data-object-category]').value;
        const filtered=entries.filter(e=>(category==='all'||category==='recommended'&&Math.max(...e.size)<750||e.category===category)&&(!query||`${e.name} ${e.id} ${e.category}`.toLowerCase().includes(query)));
        const signature=filtered.map(e=>e.id).join('|');if(signature===renderSignature)return;renderSignature=signature;
        const grid=q('[data-object-library]');grid.replaceChildren();
        for(const entry of filtered){const b=document.createElement('button');b.type='button';b.className='desk-object-card';b.title='Add '+entry.name+' to the selected desk part';
            const img=document.createElement('img');img.src='./assets/props/thumbs/'+entry.id+'.png';img.loading='lazy';img.alt='';
            const label=document.createElement('span');label.textContent=entry.name;b.append(img,label);b.onclick=()=>editor.add(entry.id,q('[data-object-target]').value);grid.append(b);}
        q('[data-object-library-status]').textContent=filtered.length+' objects · click one to add';
    };
    q('[data-object-search]').oninput=library;q('[data-object-category]').onchange=library;
    manager.ctx.loadPropIndex().then(index=>{entries=[...index.props].sort((a,b)=>a.name.localeCompare(b.name));for(const category of [...new Set(entries.map(e=>e.category))].sort()){const option=document.createElement('option');option.value=category;option.textContent=category;q('[data-object-category]').add(option);}library();}).catch(()=>q('[data-object-library-status]').textContent='Object library unavailable. Reload to retry.');
    return{panel,sync(){
        const r=manager.active,busy=!!manager.recording||!!manager.playing||editor.loading;
        const items=[...(r?.objects?.values()||[])].filter(i=>i.obj.visible&&!i.saved.removed);
        const signature=(r?.id||'')+':'+items.map(i=>i.id+':'+i.saved.role+':'+i.saved.label).join('|');
        if(select.dataset.signature!==signature){select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choose an object…';select.add(empty);for(const item of items){const o=document.createElement('option');o.value=item.id;o.textContent=item.saved.label+' · '+DESK_SURFACES[item.saved.role];select.add(o);}select.dataset.signature=signature;}
        select.value=editor.selected||'';select.disabled=busy||!r;q('[data-object-edit]').checked=editor.editing;q('[data-object-edit]').disabled=busy||!r;
        q('[data-object-count]').textContent=items.length+' objects in this setting';q('[data-object-remove]').disabled=busy||!editor.current;
        q('fieldset').disabled=busy||!editor.current;
        for(const s of ['[data-object-target]','[data-object-search]','[data-object-category]'])q(s).disabled=busy||!r;
        for(const b of panel.querySelectorAll('.desk-object-card'))b.disabled=busy||!r;
        const item=editor.current;if(item){const o=item.obj,values={role:item.saved.role,x:o.position.x,y:o.position.y,z:o.position.z,rotation:o.rotation.y*180/Math.PI,scale:o.scale.x/item.baseScale.x*100};for(const [field,v] of Object.entries(values)){const input=q(`[data-object-${field}]`);if(document.activeElement!==input)input.value=typeof v==='number'?Math.round(v*100)/100:v;}}
        q('[data-object-target]').value=editor.role;if(editor.loading)q('[data-object-library-status]').textContent='Adding object…';else if(entries.length)q('[data-object-library-status]').textContent=q('[data-object-library]').children.length+' objects · click one to add';
    }};
}
