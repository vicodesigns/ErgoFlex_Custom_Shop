import { DESK_SURFACES } from './scene-desk-objects.mjs?v=rhino-gumball-mirror-20261123';

const MM_PER_IN = 25.4;
const r2 = v => Math.round(v * 100) / 100;

export function mountDeskObjectUI(parent,manager){
    const editor=manager.objects,panel=document.createElement('details');panel.className='scene-desk-object-panel';
    const surfaces=Object.entries(DESK_SURFACES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    panel.innerHTML=`<summary>Objects on this desk</summary>
        <div class="scene-desk-row"><label><input type="checkbox" data-object-edit> Edit desk objects</label><span data-object-count></span><button type="button" data-object-hide>Hide tools to see the desk</button></div>
        <p class="desk-object-note">Turn on editing to click and drag an object, or double-click it to open the Rhino Gumball (click any arrow, ring, or scale cube to type exact inches / ° / −1 to flip). Press Delete to remove, or Ctrl+Z / Cmd+Z to undo.</p>
        <div class="scene-desk-row"><label>Object <select data-object-select aria-label="Selected desk object"></select></label><button type="button" data-object-remove>Remove object</button></div>
        <fieldset class="desk-object-fields"><legend>Edit selected object</legend><label>Desk part <select data-object-role>${surfaces}</select></label>
        <label>Left / right (in)<input type="number" step="0.1" min="-196" max="196" data-object-x></label>
        <label>Back / front (in)<input type="number" step="0.1" min="-196" max="196" data-object-z></label>
        <label>Height above part (in)<input type="number" step="0.1" min="0" max="196" data-object-y></label>
        <label>Turn (°)<input type="number" step="0.1" data-object-rotation></label>
        <label>Tilt (°)<input type="number" step="0.1" data-object-tilt></label>
        <label>Roll (°)<input type="number" step="0.1" data-object-roll></label>
        <label>Size (%)<input type="number" step="5" min="-500" max="500" data-object-scale></label>
        <div class="scene-desk-row" role="group" aria-label="Mirror or flip selected object"><span>Mirror / Flip</span><button type="button" data-object-flip="x" title="Invert left ↔ right (×−1)">Flip X</button><button type="button" data-object-flip="y" title="Invert up ↔ down (×−1)">Flip Y</button><button type="button" data-object-flip="z" title="Invert front ↔ back (×−1)">Flip Z</button></div></fieldset>
        <details class="desk-object-library"><summary>Add from the object library</summary>
        <div class="scene-desk-row"><label>Place on <select data-object-target>${surfaces}</select></label>
        <label>Find an object <input type="search" data-object-search placeholder="Laptop, book, plant…"></label>
        <label>Category <select data-object-category><option value="recommended">Desk sized objects</option><option value="ergoflex">ErgoFlex Collection</option><option value="all">All categories</option></select></label></div>
        <span data-object-library-status role="status" aria-live="polite">Loading object library…</span>
        <div class="desk-object-library-grid" data-object-library></div></details>`;
    parent.append(panel);const q=s=>panel.querySelector(s),select=q('[data-object-select]');
    q('[data-object-edit]').onchange=e=>editor.setEditing(e.target.checked);
    q('[data-object-hide]').onclick=()=>{parent.open=false;};
    select.onchange=e=>{editor.select(e.target.value);editor.setEditing(true);};
    q('[data-object-remove]').onclick=()=>editor.remove();
    for(const field of ['role','x','y','z','rotation','tilt','roll','scale'])q(`[data-object-${field}]`).onchange=e=>{
        if(field==='role'){editor.change({role:e.target.value});return;}
        const num=Number(e.target.value);if(!Number.isFinite(num))return;
        editor.change({[field]:['x','y','z'].includes(field)?num*MM_PER_IN:num});
    };
    for(const btn of panel.querySelectorAll('[data-object-flip]'))btn.onclick=()=>editor.change({flip:btn.dataset.objectFlip});
    q('[data-object-target]').onchange=e=>editor.role=e.target.value;
    let entries=[],renderSignature='';
    const library=()=>{
        const query=q('[data-object-search]').value.trim().toLowerCase(),category=q('[data-object-category]').value;
        const filtered=entries.filter(e=>(category==='all'||category==='ergoflex'&&e.collection==='ErgoFlex Collection'||category==='recommended'&&(e.category==='desk'||Math.max(...e.size)<750)||e.category===category)&&(!query||`${e.name} ${e.id} ${e.category}`.toLowerCase().includes(query)));
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
        const item=editor.current;q('[data-object-y]').min=item?.obj.userData.accessoryId?-196:0;q('[data-object-remove]').textContent=item?.obj.userData.accessoryId?'Remove accessory':'Remove object';
        if(item){
            const o=item.obj,values={role:item.saved.role,x:o.position.x/MM_PER_IN,y:o.position.y/MM_PER_IN,z:o.position.z/MM_PER_IN,rotation:o.rotation.y*180/Math.PI,tilt:o.rotation.x*180/Math.PI,roll:o.rotation.z*180/Math.PI,scale:Math.abs(o.scale.x/item.baseScale.x)*100};
            for(const [field,v] of Object.entries(values)){const input=q(`[data-object-${field}]`);if(document.activeElement!==input)input.value=typeof v==='number'?r2(v):v;}
            for(const btn of panel.querySelectorAll('[data-object-flip]'))btn.setAttribute('aria-pressed',String(o.scale[btn.dataset.objectFlip]<0));
        }else{
            for(const btn of panel.querySelectorAll('[data-object-flip]'))btn.setAttribute('aria-pressed','false');
        }
        q('[data-object-target]').value=editor.role;if(editor.loading)q('[data-object-library-status]').textContent='Adding object…';else if(entries.length)q('[data-object-library-status]').textContent=q('[data-object-library]').children.length+' objects · click one to add';
    }};
}
