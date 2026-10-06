import * as THREE from 'three';

// Uses the existing desk and renderer: changes to the rigs and LED shaders stay
// live in AR, without exporting a second model or allocating a second GPU scene.
export class ARWorkspace {
    constructor(ctx) {
        this.ctx = ctx;
        this.active = false;
        this.status = 'idle';
        this.error = null;
        this.hitMatrix = new THREE.Matrix4();
        this.hitReady = false;
        this.placed = false;
    }
    createOverlay() {
        this.overlay = document.createElement('section');
        this.overlay.id = 'ef-ar-overlay';
        this.overlay.innerHTML = `
          <div class="ef-ar-bar" role="banner"><span role="status" data-ar-status>Starting camera…</span><button data-ar-exit>Exit AR</button></div>
          <div class="ef-ar-panel">
            <div class="ef-ar-layout-tools">
              <button data-ar-drag aria-label="Move controls. Drag or use arrow keys.">⠿ Move controls</button>
              <button data-ar-smaller aria-label="Smaller controls">−</button><button data-ar-larger aria-label="Larger controls">+</button>
              <button data-ar-reset>Reset</button>
            </div>
            <div class="ef-ar-placement"><button data-ar-place disabled>Place desk here</button><button data-ar-enlarge>Enlarge controls</button></div>
            <div class="ef-ar-app" aria-label="ErgoFlex app controls in AR"></div>
            <details class="ef-ar-size-settings"><summary>Desk size · <span data-ar-width-label></span></summary>
              <div class="ef-ar-size-controls"><label>Measured desktop width <input data-ar-width type="number" min="24" max="96" step="0.1" inputmode="decimal"> in</label>
                <button data-ar-size-apply>Apply</button><button data-ar-size-reset>Reset size</button></div>
              <p>Measure across the widest outside edges, including trim. The whole desk scales together.</p>
            </details>
            <details class="ef-ar-led-settings"><summary>LED brightness & color</summary><div class="ef-ar-led-controls"></div></details>
            <button data-ar-resize aria-label="Resize controls. Drag or use arrow keys.">◢</button>
          </div>`;
        document.body.append(this.overlay);
        const find = selector => this.overlay.querySelector(selector);
        this.ui = {status:find('[data-ar-status]'),place:find('[data-ar-place]'),enlarge:find('[data-ar-enlarge]')};
        const size = this.ctx.sizeReference?.();
        find('.ef-ar-size-settings').hidden = !size?.widthUnits;
        const syncSize = () => {
            const reference = this.ctx.sizeReference?.();
            if (!reference) return;
            find('[data-ar-width]').value = reference.widthInches.toFixed(1);
            find('[data-ar-width-label]').textContent = `${reference.widthInches.toFixed(1)}″ wide`;
        };
        const applyWidth = width => {
            if (!this.ctx.setWidth?.(width)) {
                find('[data-ar-width]').setCustomValidity('Enter a width between 24 and 96 inches.');
                find('[data-ar-width]').reportValidity();
                return;
            }
            if (this.content) {
                const meters = this.ctx.metersPerUnit();
                this.content.scale.setScalar(meters);
                this.content.position.copy(this.contentOrigin).multiplyScalar(meters);
                this.scene.updateMatrixWorld(true);
            }
            syncSize();
        };
        syncSize();
        find('[data-ar-width]').oninput = () => find('[data-ar-width]').setCustomValidity('');
        find('[data-ar-size-apply]').onclick = () => applyWidth(find('[data-ar-width]').value);
        find('[data-ar-size-reset]').onclick = () => applyWidth(this.ctx.sizeReference().nominalWidth);
        find('[data-ar-width]').onkeydown = event => {if(event.key==='Enter'){event.preventDefault();applyWidth(event.target.value);}};
        this.remote = this.ctx.remote();
        if (!this.remote) throw new Error('The ErgoFlex app controls have not loaded yet.');
        this.savedControls = [this.remote, ...this.ctx.ledControls()].filter(Boolean).map(element => ({
            element, parent:element.parentElement, next:element.nextSibling,
            style:element.getAttribute('style'), mode:element.dataset.mode,
            sized:element.dataset.sized, shape:element.dataset.shape
        }));
        find('.ef-ar-app').append(this.remote);
        this.remote.dataset.mode = 'docked';
        this.remote.dataset.sized = 'true';
        this.remote.dataset.shape = 'landscape';
        this.remote.style.setProperty('--remote-unit','3.9px');
        this.remote.style.setProperty('--remote-scale','1');
        if (this.remote.classList.contains('collapsed')) this.remote.querySelector('#motion-dock-toggle')?.click();
        for (const element of this.ctx.ledControls()) if (element) find('.ef-ar-led-controls').append(element);
        find('.ef-ar-led-settings').hidden = !find('.ef-ar-led-controls').children.length;
        this.expanded = false;
        const panel = find('.ef-ar-panel');
        const layoutKey = 'ergoflex.arControlsLayoutV1';
        let remembered;
        try {
            const value = JSON.parse(localStorage.getItem(layoutKey));
            if (value && [value.width,value.x,value.y].every(Number.isFinite)) remembered = value;
        } catch {}
        let floating = false, gesture = null;
        const bounds = () => {
            const style = getComputedStyle(this.overlay);
            const left = parseFloat(style.paddingLeft) || 8;
            const top = find('.ef-ar-bar').getBoundingClientRect().bottom + 8;
            return {left,top,right:this.overlay.clientWidth-(parseFloat(style.paddingRight)||8),
                bottom:this.overlay.clientHeight-(parseFloat(style.paddingBottom)||0)-8};
        };
        const clamp = (value,min,max) => Math.max(min,Math.min(value,Math.max(min,max)));
        const position = (x,y) => {
            const b = bounds();
            panel.style.left = `${clamp(x,b.left,b.right-panel.offsetWidth)}px`;
            panel.style.top = `${clamp(y,b.top,b.bottom-panel.offsetHeight)}px`;
        };
        const saveLayout = () => {
            if (!floating) return;
            const b = bounds(), r = panel.getBoundingClientRect();
            remembered = {width:r.width,x:clamp((r.left-b.left)/Math.max(1,b.right-b.left-r.width),0,1),
                y:clamp((r.top-b.top)/Math.max(1,b.bottom-b.top-r.height),0,1)};
            try {localStorage.setItem(layoutKey,JSON.stringify(remembered));} catch {}
        };
        this.fitControls = () => {
            const wide = this.overlay.clientWidth >= 600;
            this.overlay.dataset.floating = String(wide);
            const b = bounds();
            if (wide) {
                const width = clamp(remembered?.width ?? Math.min(500,this.overlay.clientWidth*.72),300,b.right-b.left);
                panel.style.width = `${width}px`;
                panel.style.maxHeight = `${Math.max(100,b.bottom-b.top)}px`;
            } else {
                panel.style.width = panel.style.maxHeight = panel.style.left = panel.style.top = '';
                gesture = null;
            }
            const slot = find('.ef-ar-app');
            const width = slot.clientWidth;
            const collapsed = this.remote.classList.contains('collapsed');
            const height = collapsed ? this.remote.querySelector('.remote-header').offsetHeight : 390;
            const scale = !wide && this.expanded ? 1 : Math.min(1,width/760,this.overlay.clientHeight*.48/height);
            this.remote.style.setProperty('--ar-app-scale',String(scale));
            slot.style.height = `${Math.min(height*scale,this.overlay.clientHeight*.5)}px`;
            slot.style.overflow = !wide && this.expanded ? 'auto' : 'hidden';
            if (wide || !this.expanded) slot.scrollLeft = slot.scrollTop = 0;
            this.ui.enlarge.textContent = this.expanded ? 'Fit controls' : 'Enlarge controls';
            if (wide) {
                if (!floating || !gesture) {
                    position(b.left+(b.right-b.left-panel.offsetWidth)*(remembered?.x ?? 1),
                        b.top+(b.bottom-b.top-panel.offsetHeight)*(remembered?.y ?? 1));
                } else position(parseFloat(panel.style.left),parseFloat(panel.style.top));
            }
            floating = wide;
        };
        this.fitControls();
        window.addEventListener('resize',this.fitControls);
        this.remoteObserver = new MutationObserver(this.fitControls);
        this.remoteObserver.observe(this.remote,{attributes:true,attributeFilter:['class']});
        this.ui.enlarge.onclick = () => {this.expanded=!this.expanded;this.fitControls();};
        const changeWidth = width => {
            if (!floating) return;
            saveLayout();
            remembered.width = width;
            this.fitControls();
            saveLayout();
        };
        find('[data-ar-smaller]').onclick = () => changeWidth(panel.offsetWidth-40);
        find('[data-ar-larger]').onclick = () => changeWidth(panel.offsetWidth+40);
        find('[data-ar-reset]').onclick = () => {
            remembered = null;
            try {localStorage.removeItem(layoutKey);} catch {}
            this.fitControls();
        };
        for (const [selector,resize] of [['[data-ar-drag]',false],['[data-ar-resize]',true]]) {
            const handle = find(selector);
            handle.addEventListener('pointerdown',event => {
                if (!floating || event.button!==0) return;
                event.preventDefault();
                const rect = panel.getBoundingClientRect();
                gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width,resize};
                handle.setPointerCapture(event.pointerId);
            });
            handle.addEventListener('pointermove',event => {
                if (!gesture || gesture.id!==event.pointerId) return;
                if (resize) {
                    // Uniformly scale the real app, including the compass hit areas.
                    const b = bounds();
                    remembered = {width:clamp(gesture.width+event.clientX-gesture.x,300,b.right-b.left),x:0,y:0};
                    this.fitControls();
                    position(gesture.left,gesture.top);
                } else position(gesture.left+event.clientX-gesture.x,gesture.top+event.clientY-gesture.y);
            });
            const finish = event => {
                if (!gesture || gesture.id!==event.pointerId) return;
                saveLayout();gesture = null;
            };
            handle.addEventListener('pointerup',finish);
            handle.addEventListener('pointercancel',finish);
            handle.addEventListener('lostpointercapture',finish);
            handle.addEventListener('keydown',event => {
                const steps = {ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};
                const step = steps[event.key];
                if (!floating || !step) return;
                event.preventDefault();
                if (resize) changeWidth(panel.offsetWidth+step[0]+step[1]);
                else {position(parseFloat(panel.style.left)+step[0],parseFloat(panel.style.top)+step[1]);saveLayout();}
            });
        }
        this.panelObserver = new ResizeObserver(() => {
            if (floating) position(parseFloat(panel.style.left),parseFloat(panel.style.top));
        });
        this.panelObserver.observe(panel);
        // Preserve all the app's existing pointer handlers, including the compass.
        // Touches on it must not also select the floor in the XR scene.
        this.overlay.addEventListener('beforexrselect', event => {
            if (event.target.closest('button,input,select,summary,.ef-ar-panel')) event.preventDefault();
        });
        find('[data-ar-exit]').onclick = () => this.session?.end();
        this.ui.place.onclick = () => this.place();
    }
    // Called directly by a button click; requestSession must run before any await.
    async start() {
        if (this.status === 'starting' || this.active) return;
        this.status = 'starting';
        this.error = null;
        try {
            this.createOverlay();
            this.session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures:['hit-test', 'dom-overlay'],
                domOverlay:{root:this.overlay}
            });
            const {renderer, camera, controls, model, scene} = this.ctx;
            this.ctx.halt();
            this.saved = {camera:camera.clone(),controls:controls.enabled,shadows:renderer.shadowMap.enabled,
                objects:[model, ...this.ctx.accessories()].map(object => ({object,parent:object.parent,index:object.parent.children.indexOf(object)}))};
            this.scene = new THREE.Scene();
            this.scene.environment = scene.environment;
            this.scene.environmentIntensity = scene.environmentIntensity;
            for (const light of this.ctx.lights()) {
                const clone = light.clone();
                clone.castShadow = false;
                this.scene.add(clone);
            }
            this.root = new THREE.Group();
            this.root.visible = false;
            this.scene.add(this.root);
            const content = new THREE.Group();
            this.content = content;
            const meters = this.ctx.metersPerUnit();
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            content.scale.setScalar(meters);
            this.contentOrigin = new THREE.Vector3(-center.x,0,-center.z);
            content.position.copy(this.contentOrigin).multiplyScalar(meters);
            content.add(model);
            this.root.add(content);
            // Accessory update() writes anchor.matrixWorld, already in meters.
            this.ctx.accessories().forEach(group => this.scene.add(group));
            this.reticle = new THREE.Mesh(new THREE.RingGeometry(.11,.14,32).rotateX(-Math.PI/2),
                new THREE.MeshBasicMaterial({color:0x80ffd8,side:THREE.DoubleSide}));
            this.reticle.matrixAutoUpdate = false;
            this.reticle.visible = false;
            this.scene.add(this.reticle);
            this.scene.updateMatrixWorld(true);
            camera.near = .05; camera.far = 20; camera.updateProjectionMatrix();
            controls.enabled = false;
            renderer.shadowMap.enabled = false;
            renderer.xr.enabled = true;
            renderer.xr.setReferenceSpaceType('local');
            renderer.xr.setFramebufferScaleFactor(.75);
            this.onEnd = () => this.restore();
            renderer.xr.addEventListener('sessionend',this.onEnd);
            const session = this.session;
            this.active = true;
            await renderer.xr.setSession(session);
            if (this.session !== session) return;
            const viewerSpace = await session.requestReferenceSpace('viewer');
            if (this.session !== session) return;
            this.hitSource = await session.requestHitTestSource({space:viewerSpace});
            if (this.session !== session) {this.hitSource?.cancel();this.hitSource=null;return;}
            this.status = 'scanning';
            this.ui.status.textContent = 'Move your phone to find the floor, then tap Place desk here.';
        } catch (error) {
            if (this.status === 'idle') return;
            this.error = `${error.name || 'Error'}: ${error.message || error}`;
            console.error('[ErgoFlex] Live AR failed:',this.error);
            const session = this.session;
            try { await session?.end(); } catch {}
            this.restore();
            this.status = 'failed';
            throw error;
        }
    }
    update(frame) {
        if (!this.active || !frame || !this.hitSource) return;
        const hit = frame.getHitTestResults(this.hitSource)[0];
        const pose = hit?.getPose(this.ctx.renderer.xr.getReferenceSpace());
        this.hitReady = false;
        if (pose) {
            this.hitMatrix.fromArray(pose.transform.matrix);
            // Ignore walls: the desk must remain upright on a horizontal surface.
            this.hitReady = this.hitMatrix.elements[5] > .85;
        }
        this.reticle.visible = this.hitReady && !this.placed;
        if (this.hitReady) this.reticle.matrix.copy(this.hitMatrix);
        this.ui.place.disabled = !this.hitReady;

    }
    place() {
        if (!this.active || !this.hitReady) return;
        this.root.position.setFromMatrixPosition(this.hitMatrix);
        this.root.visible = true;
        this.placed = true;
        this.reticle.visible = false;
        this.status = 'placed';
        this.ui.status.textContent = 'Desk placed at full size. Adjust the controls below.';
        this.ui.place.textContent = 'Move desk here';
    }
    restore() {
        document.dispatchEvent(new Event('ergoflex-ar-ended'));
        try {this.hitSource?.cancel();} catch {}
        this.hitSource = null;
        const {renderer,camera,controls} = this.ctx;
        if (this.onEnd) renderer.xr.removeEventListener('sessionend',this.onEnd);
        this.onEnd = null;
        if (this.saved) {
            for (const {object,parent,index} of this.saved.objects) {
                parent.add(object);
                parent.children.splice(parent.children.indexOf(object),1);
                parent.children.splice(Math.min(index,parent.children.length),0,object);
            }
            camera.copy(this.saved.camera);
            controls.enabled = this.saved.controls;
            renderer.shadowMap.enabled = this.saved.shadows;
            this.saved = null;
        }
        this.reticle?.geometry.dispose();
        this.reticle?.material.dispose();
        this.reticle = null;
        this.scene = null;
        this.content = this.contentOrigin = null;
        this.session = null;
        this.active = false;
        this.placed = this.hitReady = false;
        this.ctx.halt();
        if (this.fitControls) window.removeEventListener('resize',this.fitControls);
        this.remoteObserver?.disconnect();
        this.panelObserver?.disconnect();
        for (const saved of [...(this.savedControls || [])].reverse()) {
            const {element,parent,next,style} = saved;
            parent.insertBefore(element,next?.parentElement===parent ? next : null);
            if (style===null) element.removeAttribute('style'); else element.setAttribute('style',style);
            for (const key of ['mode','sized','shape']) {
                if (saved[key]===undefined) delete element.dataset[key]; else element.dataset[key]=saved[key];
            }
        }
        this.savedControls = null;
        this.overlay?.remove();
        this.ui = null;
        this.status = 'idle';
        this.ctx.resize();
        window.dispatchEvent(new Event('resize'));
    }
}
