import * as THREE from 'three';
import { ARTWORK_SURFACES, ARTWORK_MAX_IMAGE_CHARS, ARTWORK_MAX_TOTAL_CHARS, ARTWORK_MAX_LAYERS_PER_KIND,
    artworkLayers, artworkLayerKind, defaultArtworkLayer, validArtwork, cleanArtwork } from './artwork-config.mjs?v=all-panels-artwork-20261008';

const visible = obj => { for (let node = obj; node; node = node.parent) if (!node.visible) return false; return true; };
const imageCache = new Map();
const SAMPLE_ARTWORK = [
    { id:'humboldt-wordmark', name:'Cal Poly Humboldt wordmark', label:'Wordmark · white lettering', url:'./assets/artwork/cal-poly-humboldt-wordmark.png?v=transparent-white-20261008', type:'image/png', scale:65 },
    { id:'humboldt-wordmark-green', name:'Cal Poly Humboldt wordmark · green', label:'Wordmark · green lettering', url:'./assets/artwork/cal-poly-humboldt-wordmark-green.png', type:'image/png', scale:65 },
    { id:'humboldt-seal', name:'Cal Poly Humboldt seal', label:'University seal', url:'./assets/artwork/cal-poly-humboldt-seal.webp', type:'image/webp', scale:40 }
];
const sampleCache = new Map();
async function sampleImage(sample) {
    if (!sampleCache.has(sample.id)) sampleCache.set(sample.id, (async()=>{
        const response=await fetch(sample.url);
        if(!response.ok)throw new Error('The sample artwork could not be loaded. Please try again.');
        return rasterUpload(new File([await response.blob()],sample.name,{type:sample.type}));
    })().catch(error=>{sampleCache.delete(sample.id);throw error;}));
    return sampleCache.get(sample.id);
}

function artworkDraft(mode, value) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ergoflex-artwork', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('drafts');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result, transaction = db.transaction('drafts', mode), store = transaction.objectStore('drafts');
            const operation = mode === 'readonly' ? store.get('current') : store.put(value, 'current');
            transaction.oncomplete = () => { db.close(); resolve(operation.result); };
            transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
    });
}
function decodedImage(src) {
    if (!imageCache.has(src)) imageCache.set(src, new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('This image could not be decoded.'));
        image.src = src;
    }));
    return imageCache.get(src);
}

async function rasterUpload(file) {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Choose a PNG, JPG or WebP image. Transparent PNG or WebP works best for logos.');
    if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
    const url = URL.createObjectURL(file);
    try {
        const image = await decodedImage(url);
        let edge = Math.min(1536, Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        for (let attempt = 0; attempt < 5; attempt++) {
            const ratio = edge / Math.max(image.width, image.height);
            canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL('image/webp', .9);
            if (data.length <= ARTWORK_MAX_IMAGE_CHARS) return data;
            edge = Math.round(edge * .72);
        }
        throw new Error('This image is too detailed to save. Try a smaller image.');
    } finally { URL.revokeObjectURL(url); imageCache.delete(url); }
}

// UVs come from the neutral product frame, rather than the source GLB's UV
// islands. Every layer follows its parent through lift, tilt and glide. Actual
// triangles clip artwork at the desktop outline, holes and panel cut-outs.
function mappedGeometry(obj, frame, panel, outerSign = 1, facing) {
    const full = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    const p = full.getAttribute('position'), local = new THREE.Vector3(), points = [];
    for (let i = 0; i < p.count; i++) points.push(local.fromBufferAttribute(p, i).clone().applyMatrix4(frame));
    const bounds = new THREE.Box3().setFromPoints(points), span = bounds.getSize(new THREE.Vector3());
    const frontBack = facing === 'front' || facing === 'back';
    const width = panel ? span.x : span.z, height = panel || frontBack ? span.y : span.x;
    const uv = new Float32Array(p.count * 2), faceIndices = [], normal = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
        normal.crossVectors(a.subVectors(points[i + 1], points[i]), b.subVectors(points[i + 2], points[i])).normalize();
        const face = frontBack ? normal.x * (facing === 'front' ? 1 : -1) > .55 : panel ? normal.z * outerSign > .55 : normal.y > .55;
        if (face) faceIndices.push(i, i + 1, i + 2);
        for (let j = i; j < i + 3; j++) {
            const v = points[j];
            // A wrap continues onto the edges and reverse face. Broad faces use
            // the editor's coordinates; thin edges use the remaining dimension.
            let u = frontBack ? (facing === 'front' ? bounds.max.z - v.z : v.z - bounds.min.z) / width
                : panel ? (outerSign > 0 ? (v.x - bounds.min.x) : (bounds.max.x - v.x)) / width
                : (bounds.max.z - v.z) / width;
            let y = panel || frontBack ? (v.y - bounds.min.y) / height : (bounds.max.x - v.x) / height;
            if (frontBack && Math.abs(normal.x) < .55) {
                if (Math.abs(normal.y) > .55) y = (v.x - bounds.min.x) / height;
                else u = (v.x - bounds.min.x) / width;
            } else if (panel && Math.abs(normal.z) < .55) {
                if (Math.abs(normal.y) > .55) y = (v.z - bounds.min.z) / height;
                else u = (v.z - bounds.min.z) / width;
            } else if (!panel && !frontBack && Math.abs(normal.y) < .55) {
                if (Math.abs(normal.x) > .55) y = (v.y - bounds.min.y) / height;
                else u = (v.y - bounds.min.y) / width;
            }
            uv[j * 2] = u; uv[j * 2 + 1] = y;
        }
    }
    full.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const face = full.clone(); face.setIndex(faceIndices);
    return { full, face, width, height };
}

export function paintArtworkLayer(context, image, layer, width, height) {
    if (!image || !layer || !layer.enabled) return;
    context.save(); context.globalAlpha = layer.opacity / 100;
    context.translate(width * layer.x / 100, height * layer.y / 100);
    context.rotate(layer.rotation * Math.PI / 180);
    const baseWidth = layer.repeat === 'cover' ? Math.max(width, height * image.width / image.height) : width;
    const w = baseWidth * layer.scale / 100, h = w * image.height / image.width;
    if (layer.repeat === 'single' || layer.repeat === 'cover') context.drawImage(image, -w / 2, -h / 2, w, h);
    else {
        const gap = layer.spacing / 100, sx = w * (1 + gap), sy = h * (1 + gap);
        // Rotated and translated patterns still fill the full rectangular sheet.
        const reach = Math.hypot(width, height) * 3;
        const nx = Math.ceil(reach / sx), ny = Math.ceil(reach / sy);
        // A narrow image repeated at minimum scale can imply millions of tiles.
        // CanvasPattern performs the repetition in the browser instead of a loop.
        const tile = document.createElement('canvas');
        const ratio = Math.min(1, 1536 / Math.max(sx, sy));
        tile.width = Math.max(1, Math.round(sx * ratio)); tile.height = Math.max(1, Math.round(sy * ratio * (layer.repeat === 'offset' ? 2 : 1)));
        const t = tile.getContext('2d');
        t.drawImage(image, 0, 0, w * ratio, h * ratio);
        if (layer.repeat === 'offset') {
            t.drawImage(image, sx * ratio / 2, sy * ratio, w * ratio, h * ratio);
            t.drawImage(image, -sx * ratio / 2, sy * ratio, w * ratio, h * ratio);
        }
        const pattern = context.createPattern(tile, 'repeat');
        if (pattern) {
            pattern.setTransform(new DOMMatrix().scale(1 / ratio).translate(-w * ratio / 2, -h * ratio / 2));
            context.fillStyle = pattern; context.fillRect(-nx * sx, -ny * sy, nx * sx * 2, ny * sy * 2);
        }
    }
    context.restore();
}

export class SurfaceArtwork {
    constructor({ host, getConfig, onChange, notify, focus, getFinishColor, onSampleLook }) {
        this.getConfig = getConfig; this.onChange = onChange; this.notify = notify; this.focus = focus; this.getFinishColor = getFinishColor; this.onSampleLook = onSampleLook;
        this.state = cleanArtwork(getConfig().artwork); this.surface = 'desktop'; this.kind = 'logo'; this.bindings = new Map(); this.revision = 0;
        this.uploadTokens = new Map(); this.uploadGeneration = 0; this.selectedLayer = 'logo'; this.picking = false; this.bound = false;
        this.editRevision = 0;
        this.root = document.createElement('details'); this.root.id = 'premium-artwork'; this.root.className = 'premium-artwork';
        this.root.innerHTML = `<summary><span>Premium artwork & wraps</span><span class="artwork-badge">Bespoke</span></summary>
            <div class="artwork-body"><p class="studio-note">Make it yours with a graphic, a texture, or both. Premium customization is priced on request.</p>
            <section class="artwork-samples" aria-label="Sample artwork"><h4>Cal Poly Humboldt samples</h4>
            <p class="studio-note">Click a sample to add another image to your selected surface. Combine the seal and wordmark, or start with the complete forest & gold desk.</p>
            <div class="artwork-sample-grid">${SAMPLE_ARTWORK.map(sample=>`<button type="button" data-art-sample="${sample.id}"><img src="${sample.url}" alt=""><span>${sample.label}</span></button>`).join('')}</div>
            <button type="button" data-art-sample-look>Apply Humboldt desk</button>
            <p class="studio-note">Transparent desktop wordmark + seals on both side panels. Each stays editable.</p></section>
            <label>Desk surface<select data-art-surface>${[...new Set(ARTWORK_SURFACES.map(s => s.group || 'Desktop & shelves'))].map(group => `<optgroup label="${group}">${ARTWORK_SURFACES.filter(s => (s.group || 'Desktop & shelves') === group).map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</optgroup>`).join('')}</select></label>
            <div class="artwork-actions"><button type="button" data-art-pick aria-pressed="false">Pick in 3D</button><button type="button" data-art-focus>View surface</button></div>
            <div class="artwork-tabs" role="group" aria-label="Artwork layer"><button type="button" data-art-layer="logo" aria-pressed="true">Graphic / logo</button><button type="button" data-art-layer="texture" aria-pressed="false">Texture</button></div>
            <label>Edit image<select data-art-image aria-label="Image to edit"></select></label>
            <div class="artwork-actions"><button type="button" data-art-remove>Remove selected image</button></div>
            <label class="artwork-upload">Add <span data-art-kind>graphics</span><input data-art-upload type="file" accept="image/png,image/jpeg,image/webp" multiple></label>
            <p class="studio-note">Add up to 8 graphics and 8 textures per surface. Choose an image above to move, scale, rotate or remove it separately.</p>
            <label class="artwork-upload" data-art-replace-label>Replace selected image<input data-art-replace type="file" accept="image/png,image/jpeg,image/webp"></label>
            <p class="studio-note">PNG, JPG or WebP · up to 12 MB. Transparent PNG or WebP keeps the finish visible around your logo.</p>
            <p data-art-file class="artwork-file"></p>
            <div class="artwork-preview"><canvas data-art-preview aria-label="Artwork placement preview. Drag to position the selected layer." role="img"></canvas></div>
            <p class="studio-note">Drag the preview to position the selected layer. The 3D desk updates as you edit.</p>
            <fieldset data-art-settings><legend>Selected layer</legend>
            <label class="check-label"><input type="checkbox" data-art-field="enabled"> Show layer</label>
            <label>Application<select data-art-field="coverage"><option value="decal">Removable, reusable decal</option><option value="wrap">Full surface wrap</option></select></label>
            <label>Layout<select data-art-field="repeat"><option value="single">Single image</option><option value="grid">Repeating pattern</option><option value="offset">Offset row pattern</option><option value="cover">Fill surface</option></select></label>
            ${[['scale','Scale',5,300,1],['x','Horizontal position',-100,200,1],['y','Vertical position',-100,200,1],['rotation','Rotation',-180,180,1],['spacing','Pattern spacing',0,150,1],['opacity','Opacity',0,100,1]].map(([key,label,min,max,step]) => `<label class="artwork-slider">${label}<output data-art-output="${key}"></output><input type="range" data-art-field="${key}" min="${min}" max="${max}" step="${step}"></label>`).join('')}
            <div class="artwork-actions"><button type="button" data-art-center>Center layer</button><button type="button" data-art-reset>Reset placement</button></div></fieldset>
            <div class="artwork-actions"><button type="button" data-art-export>Download artwork</button><label class="artwork-import">Import artwork<input data-art-import type="file" accept="application/json,.json"></label></div>
            <p class="studio-note" data-art-status role="status">Artwork saves in this browser. Download a copy to keep or share it.</p>
            <p class="studio-note">Wraps cover the selected part, including its edges. Decals cover its outward face. This is a placement preview; print fit and reusable decal materials are confirmed with your quote.</p></div>`;
        host.append(this.root); this.mount(); this.syncUI(); this.refresh();
    }
    layer() { return this.state.surfaces[this.surface]?.[this.selectedLayer]; }
    addImages(surface, kind, items) {
        const candidate = cleanArtwork(this.state), target = candidate.surfaces[surface] ||= {};
        let selected;
        for (const item of items) {
            const slot = Array.from({ length: ARTWORK_MAX_LAYERS_PER_KIND }, (_, i) => i ? `${kind}-${i + 1}` : kind).find(key => !target[key]);
            if (!slot) throw new Error(`Each surface supports up to ${ARTWORK_MAX_LAYERS_PER_KIND} ${kind === 'logo' ? 'graphics' : 'textures'}. Remove an image to add another.`);
            target[slot] = { ...defaultArtworkLayer(kind), ...item };
            selected = slot;
        }
        if (!validArtwork(candidate)) throw new Error(`Artwork storage is full. Remove an unused image or use smaller images (about ${Math.round(ARTWORK_MAX_TOTAL_CHARS / 1e6)} MB total).`);
        this.state = candidate;
        if (this.surface === surface && this.kind === kind) this.selectedLayer = selected;
        this.commit();
    }
    mount() {
        const q = s => this.root.querySelector(s);
        this.root.querySelectorAll('[data-art-sample]').forEach(button=>button.onclick=()=>this.applySample(button.dataset.artSample));
        q('[data-art-sample-look]').onclick=()=>this.applyHumboldtSamples();
        q('[data-art-surface]').onchange = e => { this.surface = e.target.value; this.syncUI(); this.refresh(); };
        q('[data-art-image]').onchange = e => { this.selectedLayer = e.target.value; this.syncUI(); this.refresh(); };
        this.root.querySelectorAll('[data-art-layer]').forEach(button => button.onclick = () => { this.kind = button.dataset.artLayer; this.syncUI(); this.refresh(); });
        q('[data-art-pick]').onclick = () => { this.picking = !this.picking; this.syncUI(); if (this.picking) this.notify('Click a desktop, shelf, panel, crossbar, leg or foot in the 3D preview.'); };
        q('[data-art-focus]').onclick = () => { const target = this.bindings.get(this.surface); if (target) this.focus(target.obj); };
        q('[data-art-upload]').onchange = async e => {
            const files = [...e.target.files], surface = this.surface, kind = this.kind, generation = this.uploadGeneration;
            if (!files.length) return;
            e.target.value = ''; this.status('Preparing images…');
            try {
                if (artworkLayers(this.state.surfaces[surface], kind).length + files.length > ARTWORK_MAX_LAYERS_PER_KIND)
                    throw new Error('Choose fewer images. Each surface supports up to 8 graphics and 8 textures.');
                const items = [];
                for (const file of files) items.push({ image: await rasterUpload(file), name: file.name.slice(0, 160) });
                if (generation !== this.uploadGeneration) return;
                this.addImages(surface, kind, items);
            } catch (error) { this.status(error.message); this.notify(error.message); }
        };
        q('[data-art-replace]').onchange = async e => {
            const file = e.target.files[0], surface = this.surface, key = this.selectedLayer, generation = this.uploadGeneration, token = Symbol();
            e.target.value = ''; if (!file || !this.layer()) return;
            this.uploadTokens.set(surface + key, token); this.status('Preparing replacement image…');
            try {
                const image = await rasterUpload(file);
                if (generation !== this.uploadGeneration || this.uploadTokens.get(surface + key) !== token) return;
                const candidate = cleanArtwork(this.state), layer = candidate.surfaces[surface]?.[key];
                if (!layer) return;
                Object.assign(layer, { image, name: file.name.slice(0, 160) });
                if (!validArtwork(candidate)) throw new Error('Artwork storage is full. Use a smaller image.');
                this.state = candidate; this.commit();
            } catch (error) { this.status(error.message); this.notify(error.message); }
        };
        this.root.querySelectorAll('[data-art-field]').forEach(input => input.oninput = () => {
            const layer = this.layer(); if (!layer) return;
            const key = input.dataset.artField;
            layer[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
            if (key === 'repeat' && layer.repeat === 'cover') layer.scale = 100;
            this.commit();
        });
        q('[data-art-center]').onclick = () => { if (this.layer()) { this.layer().x = this.layer().y = 50; this.commit(); } };
        q('[data-art-reset]').onclick = () => {
            const layer = this.layer(); if (!layer) return;
            Object.assign(layer, defaultArtworkLayer(this.kind), { image: layer.image, name: layer.name, enabled: layer.enabled, coverage: layer.coverage }); this.commit();
        };
        q('[data-art-remove]').onclick = () => {
            const surface = this.state.surfaces[this.surface], layer = this.layer(); if (!surface || !layer) return;
            this.uploadTokens.delete(this.surface + this.selectedLayer);
            delete surface[this.selectedLayer]; if (!Object.keys(surface).length) delete this.state.surfaces[this.surface]; this.commit();
            this.notify(`${layer.name || 'Selected image'} removed.`);
        };
        q('[data-art-export]').onclick = () => {
            const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'ergoflex-artwork', artwork: this.state }, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = 'ErgoFlex-artwork.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        q('[data-art-import]').onchange = async e => {
            const file = e.target.files[0]; e.target.value = ''; if (!file) return;
            try {
                if (file.size > 4 * 1024 * 1024) throw new Error('This artwork file is too large.');
                const data = JSON.parse(await file.text());
                if (data.format !== 'ergoflex-artwork' || !validArtwork(data.artwork)) throw new Error('Choose an ErgoFlex artwork JSON file.');
                await Promise.all(Object.values(data.artwork.surfaces).flatMap(surface =>
                    Object.values(surface).map(layer => decodedImage(layer.image))));
                this.setState(data.artwork); this.commit(); this.notify('Artwork imported onto its saved desk surfaces.');
            } catch (error) { this.notify(error.message); }
        };
        const canvas = q('[data-art-preview]'); let drag;
        canvas.onpointerdown = e => {
            if (!this.layer() || e.button !== 0) return;
            const rect = canvas.getBoundingClientRect(); drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, startX: this.layer().x, startY: this.layer().y, rect };
            canvas.setPointerCapture(e.pointerId); e.preventDefault();
        };
        canvas.onpointermove = e => {
            if (!drag || e.pointerId !== drag.pointer || !this.layer()) return;
            this.layer().x = Math.max(-100, Math.min(200, drag.startX + (e.clientX - drag.x) / drag.rect.width * 100));
            this.layer().y = Math.max(-100, Math.min(200, drag.startY + (e.clientY - drag.y) / drag.rect.height * 100)); this.commit();
        };
        canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
    }
    async applySample(id) {
        const sample=SAMPLE_ARTWORK.find(s=>s.id===id);if(!sample)return false;
        const surface=this.surface,kind=this.kind,generation=this.uploadGeneration;
        this.status('Loading sample artwork…');
        try {
            const image=await sampleImage(sample);
            if(generation!==this.uploadGeneration)return false;
            this.addImages(surface,kind,[{image,name:sample.name,scale:sample.scale}]);
            this.notify(`${sample.name} added. Drag the preview or use the sliders to place it.`);return true;
        } catch(error){this.status(error.message);this.notify(error.message);return false;}
    }
    async applyHumboldtSamples() {
        const revision=this.editRevision;
        this.status('Preparing the Humboldt sample desk…');
        try {
            const wordmarkSample=SAMPLE_ARTWORK.find(s=>s.id==='humboldt-wordmark');
            const sealSample=SAMPLE_ARTWORK.find(s=>s.id==='humboldt-seal');
            const [wordmark,seal]=await Promise.all([wordmarkSample,sealSample].map(sampleImage));
            if(revision!==this.editRevision)return false;
            const candidate=cleanArtwork(this.state),layer=(image,name,scale,x=50,y=50)=>({...defaultArtworkLayer('logo'),image,name,scale,x,y});
            (candidate.surfaces.desktop||={}).logo=layer(wordmark,wordmarkSample.name,65,50,62);
            for(const id of ['left-panel','right-panel'])(candidate.surfaces[id]||={}).logo=layer(seal,sealSample.name,42,50,50);
            if(!validArtwork(candidate))throw new Error('Artwork storage is full. Remove an unused layer before adding the sample desk.');
            this.uploadGeneration++;this.uploadTokens.clear();this.onSampleLook?.();this.state=candidate;this.surface='desktop';this.kind='logo';this.selectedLayer='logo';this.root.open=true;this.commit();
            this.notify('Humboldt desk applied: forest green, gold trim, desktop wordmark and seals on both side panels.');return true;
        }catch(error){this.status(error.message);this.notify(error.message);return false;}
    }
    setState(value) {
        this.editRevision++;
        this.uploadGeneration++;this.uploadTokens.clear(); this.state = cleanArtwork(value); this.syncUI(); this.refresh(); this.persist();
    }
    async restoreDraft() {
        const revision = this.editRevision;
        try {
            const artwork = await artworkDraft('readonly');
            if (revision !== this.editRevision || !validArtwork(artwork)) return;
            this.setState(artwork); this.onChange(cleanArtwork(this.state));
        } catch { this.status('Automatic artwork restore is unavailable. Import a downloaded artwork file to restore it.'); }
    }
    status(text) { this.root.querySelector('[data-art-status]').textContent = text; }
    persist() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(async () => {
            const revision = this.editRevision;
            try {
                await artworkDraft('readwrite', cleanArtwork(this.state));
                if (revision === this.editRevision) this.status('Artwork saved in this browser. Save build also includes your artwork.');
            } catch { this.status('Browser artwork storage is unavailable or full. Download artwork to keep your changes.'); }
        }, 350);
    }
    commit() {
        this.editRevision++;
        this.onChange(cleanArtwork(this.state)); this.syncUI(); this.refresh(); this.status('Saving artwork…'); this.persist();
    }
    syncUI() {
        const q = s => this.root.querySelector(s), layers = artworkLayers(this.state.surfaces[this.surface], this.kind);
        if (!layers.some(([key]) => key === this.selectedLayer)) this.selectedLayer = layers[0]?.[0] || this.kind;
        const layer = this.layer(), select = q('[data-art-image]');
        select.replaceChildren(...(layers.length ? layers.map(([key, value], i) => new Option(`${i + 1}. ${value.name || 'Untitled image'}${value.enabled ? '' : ' (hidden)'}`, key)) : [new Option('No images yet — add one below', this.kind)]));
        select.value = this.selectedLayer; select.disabled = !layers.length;
        q('[data-art-remove]').disabled = !layer;
        q('[data-art-replace-label]').hidden = !layer;
        q('[data-art-surface]').value = this.surface;
        q('[data-art-pick]').setAttribute('aria-pressed', String(this.picking));
        q('[data-art-pick]').textContent = this.picking ? 'Cancel surface pick' : 'Pick in 3D';
        q('[data-art-kind]').textContent = this.kind === 'logo' ? 'graphics' : 'textures';
        q('[data-art-file]').textContent = layer?.name || `No ${this.kind === 'logo' ? 'graphic' : 'texture'} on this surface yet.`;
        q('[data-art-settings]').disabled = !layer;
        this.root.querySelectorAll('[data-art-layer]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.artLayer === this.kind)));
        this.root.querySelectorAll('[data-art-field]').forEach(input => {
            const value = (layer || defaultArtworkLayer(this.kind))[input.dataset.artField];
            if (input.type === 'checkbox') input.checked = value; else input.value = value;
            const output = q(`[data-art-output="${input.dataset.artField}"]`);
            if (output) output.textContent = `${Math.round(value)}${input.dataset.artField === 'rotation' ? '°' : '%'}`;
        });
        q('[data-art-field="spacing"]').closest('label').hidden = !['grid', 'offset'].includes(layer?.repeat);
    }
    bind(targets) {
        this.unbind(); this.bound = true;
        for (const { id, obj, frame, panel, outerSign, facing } of targets) {
            const mapped = mappedGeometry(obj, frame, panel, outerSign, facing);
            this.bindings.set(id, { obj, ...mapped, layers: new Map() });
        }
        this.refresh();
    }
    unbind() {
        this.revision++; this.bound = false;
        for (const binding of this.bindings.values()) {
            for (const { mesh, material, texture } of binding.layers.values()) { mesh.removeFromParent(); material.dispose(); texture.dispose(); }
            binding.full.dispose(); binding.face.dispose();
        }
        this.bindings.clear();
    }
    handlePick(event, camera, canvas, objects) {
        if (!this.picking) return false;
        const rect = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
        const hit = ray.intersectObjects(objects.filter(visible), false)[0];
        const target = [...this.bindings.entries()].find(([, b]) => b.obj === hit?.object);
        if (target) { this.surface = target[0]; this.picking = false; this.root.open = true; this.syncUI(); this.refresh(); this.notify(`${ARTWORK_SURFACES.find(s => s.id === this.surface).label} selected for artwork.`); }
        else this.notify('Select a printable desktop, shelf, panel, crossbar, leg or foot. You can also use the Desk surface menu.');
        return true;
    }
    async refresh() {
        const revision = ++this.revision;
        // Drop decoded assets no longer in the recipe; GPU textures are owned by bindings.
        const sources = new Set(Object.values(this.state.surfaces).flatMap(s => Object.values(s).map(l => l.image)));
        for (const key of imageCache.keys()) if (!sources.has(key) && key.startsWith('data:')) imageCache.delete(key);
        try {
            const images = new Map(await Promise.all([...sources].map(async src => [src, await decodedImage(src)])));
            if (revision !== this.revision) return;
            for (const [id, binding] of this.bindings) {
                const w = Math.max(128, Math.round(1024 * Math.min(1, binding.width / binding.height)));
                const h = Math.max(128, Math.round(1024 * Math.min(1, binding.height / binding.width)));
                const layers = artworkLayers(this.state.surfaces[id]);
                for (const [key, entry] of binding.layers) {
                    if (layers.some(([layerKey]) => layerKey === key)) continue;
                    entry.mesh.removeFromParent(); entry.material.dispose(); entry.texture.dispose(); binding.layers.delete(key);
                }
                for (const [rank, [key, layer]] of layers.entries()) {
                    const kind = artworkLayerKind(key), previous = binding.layers.get(key);
                    if (!layer?.enabled) { if (previous) previous.mesh.visible = false; continue; }
                    const signature = JSON.stringify(layer);
                    if (previous) {
                        previous.material.polygonOffsetFactor = -2 - rank;
                        previous.mesh.renderOrder = .1 + rank * .01;
                    }
                    if (previous?.signature === signature) { previous.mesh.visible = true; continue; }
                    let entry = previous;
                    if (!entry) {
                        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
                        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
                        texture.anisotropy = 4;
                        const material = new THREE.MeshPhysicalMaterial({ map: texture, color: 0xffffff, roughness: .44,
                            metalness: 0, clearcoat: .18, transparent: true, depthWrite: false, side: THREE.DoubleSide,
                            polygonOffset: true, polygonOffsetFactor: -2 - rank, polygonOffsetUnits: -2 });
                        const mesh = new THREE.Mesh(binding.face, material); mesh.name = `Artwork ${id} ${key}`;
                        mesh.receiveShadow = true;
                        mesh.userData.surfaceArtwork = true; mesh.raycast = () => {}; mesh.renderOrder = .1 + rank * .01;
                        binding.obj.add(mesh); entry = { mesh, material, texture, canvas }; binding.layers.set(key, entry);
                    }
                    const context = entry.canvas.getContext('2d'); context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
                    paintArtworkLayer(context, images.get(layer.image), layer, entry.canvas.width, entry.canvas.height);
                    entry.mesh.geometry = layer.coverage === 'wrap' ? binding.full : binding.face; entry.mesh.visible = true;
                    entry.texture.needsUpdate = true;
                    entry.signature = signature;
                }
            }
            this.paintPreview(images);
        } catch (error) { this.status(error.message); }
    }
    paintPreview(images) {
        const canvas = this.root.querySelector('[data-art-preview]'), binding = this.bindings.get(this.surface);
        const aspect = binding ? binding.width / binding.height : this.surface.includes('panel') ? 1.8 : 1.6;
        canvas.width = Math.round(720 * Math.min(1, aspect)); canvas.height = Math.round(720 * Math.min(1, 1 / aspect));
        const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
        c.fillStyle = this.getFinishColor(this.surface); c.fillRect(0, 0, w, h);
        for (const [, layer] of artworkLayers(this.state.surfaces[this.surface])) paintArtworkLayer(c, images.get(layer.image), layer, w, h);
        if (binding) {
            const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
            const m = mask.getContext('2d'), uv = binding.face.getAttribute('uv'), index = binding.face.index;
            m.fillStyle = '#fff'; m.beginPath();
            for (let i = 0; i < index.count; i += 3) {
                for (let j = 0; j < 3; j++) { const k = index.getX(i + j), x = uv.getX(k) * w, y = (1 - uv.getY(k)) * h; if (!j) m.moveTo(x, y); else m.lineTo(x, y); } m.closePath();
            }
            m.fill(); c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over';
        }
    }
}
