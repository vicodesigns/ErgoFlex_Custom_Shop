import * as THREE from 'three';

import { validateGameManifest, sampleGameBank } from './led-game-frames.mjs?v=explore-3d-20261006';

export class LedGameMode {
    constructor(counts) {
        this.counts=counts;this.manifest=null;this.bank=null;this.active=false;this.mode='normal';this.content='colours';this.maxBrightness=1;
        this.error='';this.token=0;this.abort=null;this.ui=[];this.lastStatus='';this.mount=null;this.hiddenObjects=new Map();
        this.video=document.createElement('video');this.video.playsInline=true;this.video.muted=true;this.video.volume=.3;
        this.video.loop=true;this.video.preload='metadata';this.video.setAttribute('aria-label','Neon Flight lighting preview');
        this.video.addEventListener('ended',()=>this.stop(false));
        this.video.addEventListener('error',()=>{this.error='The demo clip could not load. Stop and try again.';this.stop(false);});
        this.texture=new THREE.VideoTexture(this.video);this.texture.colorSpace=THREE.SRGBColorSpace;
        this.texture.generateMipmaps=false;this.texture.minFilter=THREE.LinearFilter;
        this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
        this.reduced.addEventListener('change',()=>{if(this.reduced.matches)this.video.pause();this.syncUI();});
    }
    async load() {
        if(this.manifest)return;
        const url=new URL('./assets/led/game/manifest.json',location.href);
        const response=await fetch(url);if(!response.ok)throw new Error('The lighting clip is unavailable.');
        this.manifest=validateGameManifest(await response.json(),this.counts);this.base=new URL('.',url);
        this.video.src=new URL(this.manifest.video,this.base).href;
    }
    async selectVariant() {
        this.abort?.abort();this.abort=new AbortController();const token=++this.token;this.bank=null;
        try {
            await this.load();if(token!==this.token)return false;
            const response=await fetch(new URL(this.manifest.banks[this.mode+':'+this.content],this.base),{signal:this.abort.signal});
            if(!response.ok)throw new Error('The lighting frames are unavailable.');
            const expected=this.manifest.frames*this.counts.reduce((a,b)=>a+b,0)*4;
            const size=Number(response.headers.get('content-length'));
            if(size && size!==expected)throw new Error('The lighting clip has an invalid frame size.');
            const data=new Uint8Array(await response.arrayBuffer());
            if(data.length!==expected)throw new Error('The lighting clip is incomplete.');
            if(token!==this.token)return false;
            this.bank=data;this.error='';this.video.muted=this.content!=='music'||!this.soundOn;this.syncUI();return true;
        } catch(e){if(token===this.token && e.name!=='AbortError'){this.error=e.message;this.active=false;this.video.pause();this.restoreMonitor();this.syncUI();}return false;}
    }
    async start() {
        this.error='';this.active=true;this.syncUI();
        if(!await this.selectVariant())return false;
        if(this.reduced.matches){this.video.currentTime=2;this.video.pause();}
        else try{await this.video.play();}catch{this.error='Tap Play to start the clip.';}
        this.syncUI();return true;
    }
    stop(reset=true) {
        this.token++;this.abort?.abort();this.active=false;this.video.pause();if(reset)this.video.currentTime=0;
        this.restoreMonitor();this.syncUI();
    }
    sample(frame){if(!this.active||!this.bank||!this.manifest)return false;sampleGameBank(frame,this.bank,this.manifest,this.video.currentTime,true);if(this.maxBrightness<1)for(const row of frame)for(let i=0;i<row.length;i++)row[i]=Math.round(row[i]*this.maxBrightness);return true;}
    restoreMonitor(){this.monitor?.removeFromParent();this.mount=null;for(const [obj,visible]of this.hiddenObjects)obj.visible=visible;this.hiddenObjects.clear();}
    syncMonitor(accessories) {
        if(!this.active)return;
        const mount=accessories?.mounts.get('shelf');if(!mount?.group)return;
        if(!this.monitor){
            const group=new THREE.Group();group.name='Game Mode preview monitor';group.userData.transientGameScreen=true;
            const body=new THREE.Mesh(new THREE.BoxGeometry(620,354,28),new THREE.MeshStandardMaterial({color:'#17232f',roughness:.65}));body.position.set(0,278,-18);group.add(body);
            const mat=new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false});mat.userData.sharedTextures=true;
            const screen=new THREE.Mesh(new THREE.PlaneGeometry(596,335.25),mat);screen.position.set(0,278,-2.5);screen.name='Game Mode synchronized screen';group.add(screen);
            const stand=new THREE.Mesh(new THREE.BoxGeometry(160,88,28),body.material);stand.position.set(0,58,-32);group.add(stand);
            this.monitor=group;
        }
        if(this.mount!==mount.group){this.restoreMonitor();this.mount=mount.group;mount.group.add(this.monitor);}
        // Hide decorative monitors while this temporary screen occupies their
        // shelf. The user's accessory selection and saved configuration stay intact.
        const existing=[...(mount.dress?.children||[]),...(accessories.items?.values()||[])];
        for(const obj of existing)if((/monitor/i.test(obj.name)||obj.getObjectByName('monitor-panel'))&&!this.hiddenObjects.has(obj)){this.hiddenObjects.set(obj,obj.visible);obj.visible=false;}
    }
    syncUI(status='') {
        const message=this.error || status || (this.active ? !this.bank ? 'Preparing synchronized lighting…' : this.reduced.matches ? 'Static preview · reduced motion' : this.video.paused ? 'Paused · video and LEDs held together' : 'Game Mode · '+this.mode+' · '+(this.content==='music'?'colours + music':'colours') : 'Game Mode off');
        if(message!==this.lastStatus){for(const root of this.ui)root.querySelector('[data-game-status]').textContent=message;this.lastStatus=message;}
        for(const root of this.ui){
            root.querySelector('[data-game-preset]').value=this.mode;root.querySelector('[data-game-content]').value=this.content;
            root.querySelector('[data-game-play]').textContent=this.active ? this.video.paused?'Play':'Pause' : 'Start Game Mode';
            root.querySelector('[data-game-seek]').value=this.video.currentTime||0;
            root.querySelector('[data-game-seek]').max=this.manifest?.duration||12;
            root.querySelector('[data-game-seek]').disabled=!this.active||!this.bank;
        }
    }
    mountControls(container,{motionEnabled, setMotionEnabled, sounds, startLights}) {
        if(!container||container.childElementCount)return;
        const details=document.createElement('details');details.className='led-playback';
        details.innerHTML=`<summary>Game Mode & movement</summary><div class="led-playback-controls">
            <label><input type="checkbox" data-led-motion checked> Movement indicators</label>
            <label><input type="checkbox" data-led-sounds> Movement sounds</label>
            <label>Sound level <input type="range" data-movement-volume min="0" max="1" step="0.05" value="0.3"></label>
            <div class="led-effects-controls"><label>Game preset <select data-game-preset><option value="calm">Calm</option><option value="normal" selected>Normal</option><option value="intense">Intense</option><option value="full">Full</option></select></label>
            <label>Content <select data-game-content><option value="colours">Colours</option><option value="music">Colours + music</option></select></label>
            <button type="button" data-game-play>Start Game Mode</button><button type="button" data-game-stop>Stop</button></div>
            <label><input type="checkbox" data-game-repeat checked> Repeat</label>
            <label><input type="checkbox" data-game-audio> Hear demo music</label>
            <label>Music level <input type="range" data-game-volume min="0" max="1" step="0.05" value="0.3"></label>
            <label>Clip position <input type="range" data-game-seek min="0" max="12" step="0.05" value="0" disabled></label>
            <div data-game-screen></div><p role="status" data-game-status></p></div>`;
        container.append(details);this.ui.push(details);details.querySelector('[data-game-screen]').append(this.video);
        const on=(selector,event,fn)=>details.querySelector(selector).addEventListener(event,fn);
        on('[data-led-motion]','change',e=>{setMotionEnabled(e.target.checked);for(const root of this.ui)root.querySelector('[data-led-motion]').checked=motionEnabled();});
        on('[data-led-sounds]','change',e=>{sounds.setEnabled(e.target.checked);for(const root of this.ui)root.querySelector('[data-led-sounds]').checked=sounds.enabled;});
        on('[data-movement-volume]','input',e=>{sounds.setVolume(e.target.value);for(const root of this.ui)root.querySelector('[data-movement-volume]').value=sounds.volume;});
        on('[data-game-play]','click',async()=>{if(!this.active){startLights();await this.start();}else if(!this.video.paused)this.video.pause();else if(!this.reduced.matches)try{await this.video.play();}catch{this.error='Playback could not start.';}this.syncUI();});
        on('[data-game-stop]','click',()=>this.stop());
        on('[data-game-preset]','change',async e=>{this.mode=e.target.value;this.content=['intense','full'].includes(this.mode)?'music':'colours';this.syncUI();if(this.active)await this.selectVariant();});
        on('[data-game-content]','change',async e=>{this.content=e.target.value;this.syncUI();if(this.active)await this.selectVariant();});
        on('[data-game-repeat]','change',e=>{this.video.loop=e.target.checked;for(const root of this.ui)root.querySelector('[data-game-repeat]').checked=this.video.loop;});
        on('[data-game-audio]','change',e=>{this.soundOn=e.target.checked;this.video.muted=this.content!=='music'||!this.soundOn;for(const root of this.ui)root.querySelector('[data-game-audio]').checked=this.soundOn;});
        on('[data-game-volume]','input',e=>{this.video.volume=Number(e.target.value);for(const root of this.ui)root.querySelector('[data-game-volume]').value=this.video.volume;});
        on('[data-game-seek]','input',e=>{this.video.currentTime=Number(e.target.value);this.syncUI();});
        this.lastStatus='';this.syncUI();
    }
    dispose(){this.stop();this.video.removeAttribute('src');this.video.load();this.texture.dispose();this.bank=null;
        const materials=new Set();this.monitor?.traverse(obj=>{obj.geometry?.dispose();if(obj.material)materials.add(obj.material);});
        for(const material of materials)material.dispose();}
}
