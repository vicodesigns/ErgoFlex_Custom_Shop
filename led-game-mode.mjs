import * as THREE from 'three';

import { validateGameManifest, sampleGameBank } from './led-game-frames.mjs';
import { sampleScreenColours } from './led-screen-sampler.mjs';

export class LedGameMode {
    constructor(counts) {
        this.counts=counts;this.manifest=null;this.bank=null;this.active=false;this.mode='normal';this.content='colours';this.maxBrightness=1;
        this.source='demo';this.captureStream=null;this.capturePending=false;this.captureRequest=0;this.captureMuted=false;
        this.liveFrame=counts.map(n=>new Uint8Array(n*4));this.targetFrame=counts.map(n=>new Uint8Array(n*4));this.sampleAt=0;this.hasLiveFrame=false;
        this.canvas=document.createElement('canvas');this.canvas.width=160;this.canvas.height=90;this.context=this.canvas.getContext('2d',{willReadFrequently:true});
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
        if(this.source==='demo')this.video.src=new URL(this.manifest.video,this.base).href;
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
        this.stop();this.source='demo';this.video.src=new URL('./assets/led/game/neon-flight.mp4',location.href).href;
        this.video.setAttribute('aria-label','Neon Flight lighting preview');
        this.error='';this.active=true;this.syncUI();
        if(!await this.selectVariant())return false;
        if(this.reduced.matches){this.video.currentTime=2;this.video.pause();}
        else try{await this.video.play();}catch{this.error='Tap Play to start the clip.';}
        this.syncUI();return true;
    }
    stop(reset=true) {
        this.token++;this.abort?.abort();this.captureRequest++;this.capturePending=false;this.active=false;this.video.pause();
        this.releaseCapture();if(reset&&this.source==='demo')this.video.currentTime=0;
        this.restoreMonitor();this.syncUI();
    }
    sample(frame){if(!this.active)return false;
        if(this.source==='screen'){if(!this.sampleLive(frame))return false;}
        else {if(!this.bank||!this.manifest)return false;sampleGameBank(frame,this.bank,this.manifest,this.video.currentTime,true);}if(this.maxBrightness<1)for(const row of frame)for(let i=0;i<row.length;i++)row[i]=Math.round(row[i]*this.maxBrightness);return true;}
    get canShareScreen(){return window.isSecureContext&&typeof navigator.mediaDevices?.getDisplayMedia==='function'&&!/Electron|ChatGPT|Codex/i.test(navigator.userAgent);}
    releaseCapture(){
        const stream=this.captureStream;this.captureStream=null;this.captureMuted=false;
        for(const track of stream?.getTracks()||[])track.stop();
        this.audioSource?.disconnect();this.audioSource=null;this.analyser=null;
        const context=this.audioContext;this.audioContext=null;if(context)void context.close().catch(()=>{});
        if(this.video.srcObject){this.video.srcObject=null;this.video.load();}
        this.context?.clearRect(0,0,160,90);
        this.hasLiveFrame=false;this.sampleAt=0;
        this.liveFrame.forEach(row=>row.fill(0));this.targetFrame.forEach(row=>row.fill(0));
    }
    async shareScreen(startLights=()=>{}){
        if(this.capturePending)return false;
        if(!this.canShareScreen){this.error='Open this viewer in desktop Chrome or Edge to share a tab, window or screen. On a phone, use Music → Use microphone or the demo.';this.syncUI();return false;}
        const request=++this.captureRequest;this.capturePending=true;this.error='';this.syncUI();let stream;
        try{
            // Invoke the picker in the click handler before awaiting anything.
            stream=await navigator.mediaDevices.getDisplayMedia({
                video:{frameRate:{ideal:15,max:20},width:{ideal:1280},height:{ideal:720}},
                audio:{suppressLocalAudioPlayback:false},systemAudio:'include',windowAudio:'system',
                selfBrowserSurface:'exclude',surfaceSwitching:'include',monitorTypeSurfaces:'include'
            });
            if(request!==this.captureRequest){stream.getTracks().forEach(t=>t.stop());return false;}
            const track=stream.getVideoTracks().find(t=>t.readyState==='live');
            if(!track)throw new Error('The selected source has no video. Choose another tab, window or display.');
            this.stop();const accepted=this.captureRequest;this.source='screen';this.captureStream=stream;this.bank=null;
            this.video.removeAttribute('src');this.video.srcObject=stream;this.video.muted=true;
            this.video.setAttribute('aria-label','Live shared screen preview');
            track.addEventListener('ended',()=>{if(this.captureStream===stream){this.stop();this.error='Sharing ended. Choose Share tab or screen to reconnect.';this.syncUI();}},{once:true});
            this.captureMuted=track.muted;
            for(const event of ['mute','unmute'])track.addEventListener(event,()=>{if(this.captureStream===stream){this.captureMuted=track.muted;this.syncUI();}});
            const audio=stream.getAudioTracks().filter(t=>t.readyState==='live');
            if(audio.length){
                try{
                    const Audio=window.AudioContext||window.webkitAudioContext;this.audioContext=new Audio();
                    this.analyser=this.audioContext.createAnalyser();this.analyser.fftSize=1024;
                    this.audioData=new Float32Array(this.analyser.fftSize);
                    this.audioSource=this.audioContext.createMediaStreamSource(new MediaStream(audio));this.audioSource.connect(this.analyser);
                    await this.audioContext.resume();
                }catch{this.audioSource?.disconnect();this.analyser=null;this.audioSource=null;}
            }
            if(accepted!==this.captureRequest)return false;
            await this.video.play();if(accepted!==this.captureRequest)return false;
            if(track.readyState!=='live')throw new Error('Sharing ended before the preview started.');
            startLights();this.active=true;this.sampleAt=0;this.syncUI();return true;
        }catch(e){
            stream?.getTracks().forEach(t=>t.stop());
            if(request===this.captureRequest||this.captureStream===stream){
                if(this.captureStream===stream)this.stop();
                this.error=['NotAllowedError','AbortError'].includes(e.name)?'Sharing cancelled. Choose Share tab or screen when ready.':e.name==='NotReadableError'?'The browser could not access that screen. Try sharing a Chrome tab.':e.message||'Screen sharing could not start.';this.syncUI();
            }
            return false;
        }finally{if(request===this.captureRequest||this.captureStream===stream){this.capturePending=false;this.syncUI();}}
    }
    sampleLive(frame){
        if(!this.captureStream)return false;
        const now=performance.now();
        // Hold the sampled picture and light frame together on Pause/reduced motion.
        if(!this.captureMuted&&this.video.readyState>=2&&(!this.hasLiveFrame||(!this.video.paused&&!this.reduced.matches&&now-this.sampleAt>=80))){
            try{
                this.context.drawImage(this.video,0,0,160,90);
                let audio=null;
                if(this.content==='music'&&this.analyser&&this.captureStream.getAudioTracks().some(t=>t.readyState==='live')){
                    this.analyser.getFloatTimeDomainData(this.audioData);audio=Math.sqrt(this.audioData.reduce((sum,v)=>sum+v*v,0)/this.audioData.length);
                }
                sampleScreenColours(this.targetFrame,this.context.getImageData(0,0,160,90),{mode:this.mode,audio});
                const blend=this.hasLiveFrame?1-Math.exp(-Math.min(250,now-this.sampleAt)/150):1;
                this.liveFrame.forEach((row,j)=>row.forEach((v,i)=>{row[i]=Math.round(v+(this.targetFrame[j][i]-v)*blend);}));
                this.sampleAt=now;this.hasLiveFrame=true;
                if(this.reduced.matches)this.video.pause();
            }catch{this.stop();this.error='The shared picture could not be read. Choose a different tab or screen.';this.syncUI();return false;}
        }
        if(!this.hasLiveFrame)return false;
        frame.forEach((row,i)=>row.set(this.liveFrame[i]));return true;
    }
    restoreMonitor(){this.monitor?.removeFromParent();this.mount=null;for(const [obj,entry]of this.hiddenObjects)obj.visible=entry.visible&&!entry.item?.saved.removed;this.hiddenObjects.clear();}
    syncMonitor(accessories,deskObjects=[]) {
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
        const screen=this.monitor.getObjectByName('Game Mode synchronized screen');
        const aspect=this.video.videoWidth/this.video.videoHeight||16/9;
        screen.scale.set(Math.min(1,aspect/(16/9)),Math.min(1,(16/9)/aspect),1);
        // Hide decorative monitors while this temporary screen occupies their
        // shelf. The user's accessory selection and saved configuration stay intact.
        const existing=[...[...(mount.dress?.children||[]),...(accessories.items?.values()||[])].map(obj=>({obj})),...deskObjects];
        for(const item of existing){const obj=item.obj;
            if((/monitor/i.test(obj.name)||obj.getObjectByName('monitor-panel'))&&!this.hiddenObjects.has(obj)){this.hiddenObjects.set(obj,{visible:obj.visible,item:item.saved?item:null});obj.visible=false;}
        }
    }
    syncUI(status='') {
        const audioLive=!!this.analyser&&this.captureStream?.getAudioTracks().some(t=>t.readyState==='live');
        const message=this.error || (this.capturePending?'Choose a tab, window or screen in the browser…':status) || (this.source==='screen'&&this.active ? this.captureMuted?'Shared source unavailable · last picture held':!this.hasLiveFrame?'Waiting for shared picture…':(this.video.paused||this.reduced.matches?'Held screen preview':'Live screen')+' · browser lighting approximation'+(this.content==='music'?(audioLive?' · shared audio reactive':' · no shared audio, colours only'):' · colours only') : '') || (this.active ? !this.bank ? 'Preparing synchronized lighting…' : this.reduced.matches ? 'Static preview · reduced motion' : this.video.paused ? 'Paused · video and LEDs held together' : 'Game Mode · '+this.mode+' · '+(this.content==='music'?'colours + music':'colours') : 'Game Mode off');
        if(message!==this.lastStatus){for(const root of this.ui)root.querySelector('[data-game-status]').textContent=message;this.lastStatus=message;}
        for(const root of this.ui){
            root.querySelector('[data-game-preset]').value=this.mode;root.querySelector('[data-game-content]').value=this.content;
            root.querySelector('[data-game-share]').disabled=this.capturePending;
            root.querySelector('[data-game-share]').textContent=this.capturePending?'Choose source…':this.captureStream?'Change shared source':'Share tab or screen';
            root.querySelector('[data-game-demo]').hidden=this.source!=='screen';
            for(const selector of ['[data-game-repeat]','[data-game-audio]','[data-game-volume]','[data-game-seek]'])root.querySelector(selector).closest('label').hidden=this.source==='screen';
            root.querySelector('[data-game-play]').disabled=this.capturePending;
            root.querySelector('[data-game-play]').textContent=this.active ? this.video.paused?'Play':'Pause' : this.source==='screen'?'Reconnect screen':'Start Game Mode';
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
            <div class="led-effects-controls"><button type="button" data-game-share>Share tab or screen</button><button type="button" data-game-demo hidden>Use demo clip</button></div>

            <div class="led-effects-controls"><label>Game preset <select data-game-preset><option value="calm">Calm</option><option value="normal" selected>Normal</option><option value="intense">Intense</option><option value="full">Full</option></select></label>
            <label>Content <select data-game-content><option value="colours">Colours</option><option value="music">Colours + music</option></select></label>
            <button type="button" data-game-play>Start Game Mode</button><button type="button" data-game-stop>Stop</button></div>
            <label><input type="checkbox" data-game-repeat checked> Repeat</label>
            <label><input type="checkbox" data-game-audio> Hear demo music</label>
            <label>Music level <input type="range" data-game-volume min="0" max="1" step="0.05" value="0.3"></label>
            <label>Clip position <input type="range" data-game-seek min="0" max="12" step="0.05" value="0" disabled></label>
            <div data-game-screen></div><details data-game-help><summary>Screen sharing setup</summary><p>Keep the viewer on one display and share the tab, game window or other display. Enable Share audio in the browser picker for sound-reactive colours. The shared picture appears on the desk monitor. Live lighting is a browser approximation; the capture stays in this viewer and is not recorded or uploaded.</p><p>For audio-only effects, open Music → Live → Use computer audio. Screen sharing requires a supported desktop browser; on phones use the microphone, a file or the demo.</p></details><p role="status" data-game-status></p></div>`;
        container.append(details);this.ui.push(details);details.querySelector('[data-game-screen]').append(this.video);
        const on=(selector,event,fn)=>details.querySelector(selector).addEventListener(event,fn);
        on('[data-led-motion]','change',e=>{setMotionEnabled(e.target.checked);for(const root of this.ui)root.querySelector('[data-led-motion]').checked=motionEnabled();});
        on('[data-led-sounds]','change',e=>{sounds.setEnabled(e.target.checked);for(const root of this.ui)root.querySelector('[data-led-sounds]').checked=sounds.enabled;});
        on('[data-movement-volume]','input',e=>{sounds.setVolume(e.target.value);for(const root of this.ui)root.querySelector('[data-movement-volume]').value=sounds.volume;});
        on('[data-game-share]','click',()=>this.shareScreen(startLights));
        on('[data-game-demo]','click',async()=>{startLights();await this.start();});
        on('[data-game-play]','click',async()=>{if(!this.active&&this.source==='screen'){await this.shareScreen(startLights);return;}if(!this.active){startLights();await this.start();}else if(!this.video.paused)this.video.pause();else if(!this.reduced.matches)try{await this.video.play();}catch{this.error='Playback could not start.';}this.syncUI();});
        on('[data-game-stop]','click',()=>this.stop());
        on('[data-game-preset]','change',async e=>{this.mode=e.target.value;this.content=['intense','full'].includes(this.mode)?'music':'colours';this.syncUI();if(this.active&&this.source==='demo')await this.selectVariant();});
        on('[data-game-content]','change',async e=>{this.content=e.target.value;this.syncUI();if(this.active&&this.source==='demo')await this.selectVariant();});
        on('[data-game-repeat]','change',e=>{this.video.loop=e.target.checked;for(const root of this.ui)root.querySelector('[data-game-repeat]').checked=this.video.loop;});
        on('[data-game-audio]','change',e=>{this.soundOn=e.target.checked;this.video.muted=this.source==='screen'||this.content!=='music'||!this.soundOn;for(const root of this.ui)root.querySelector('[data-game-audio]').checked=this.soundOn;});
        on('[data-game-volume]','input',e=>{this.video.volume=Number(e.target.value);for(const root of this.ui)root.querySelector('[data-game-volume]').value=this.video.volume;});
        on('[data-game-seek]','input',e=>{this.video.currentTime=Number(e.target.value);this.syncUI();});
        this.lastStatus='';this.syncUI();
    }
    dispose(){this.stop();this.video.removeAttribute('src');this.video.load();this.texture.dispose();this.bank=null;
        const materials=new Set();this.monitor?.traverse(obj=>{obj.geometry?.dispose();if(obj.material)materials.add(obj.material);});
        for(const material of materials)material.dispose();}
}
