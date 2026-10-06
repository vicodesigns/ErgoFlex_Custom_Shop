import { DJOverlay } from './led-dj-overlay.mjs?v=desktop-bands-back-20261005';
import { AutoDJ, DJ_SETTINGS_KEY, normalizeDJSettings } from './led-auto-dj.mjs?v=room-led-interaction-20261006';
import { MUSIC_EFFECTS, MusicSampler, analyseMusic } from './led-showcase-effects.mjs?v=desktop-bands-back-20261005';
import { LED_STRIPS } from './led-strip-map.mjs';
import { CustomLookSampler, tintCustomMusic, normalizeCustomPalette } from './led-custom-presets.mjs?v=desktop-bands-back-20261005';

export class LedMusicMode{
    constructor(counts){
        this.counts=counts;this.frame=counts.map(count=>new Uint8Array(count*4));this.sampler=new MusicSampler();
        this.audio=document.createElement('audio');this.audio.preload='metadata';this.audio.loop=true;
        this.audio.src='./assets/led/music/neon-flight-demo.mp3';this.audio.volume=1;
        this.fx=28;this.active=false;this.soundOn=false;this.volume=.5;this.sensitivity=1;this.error='';this.ui=[];this.sourceName='Original demo soundtrack';this.token=0;
        this.captureRequest=0;this.capturePending=false;this.capturePaused=true;this.captureElapsed=0;
        let saved;try{saved=JSON.parse(localStorage.getItem(DJ_SETTINGS_KEY)||'null');}catch{}
        this.dj=new AutoDJ(saved||{});this.djOverlay=new DJOverlay();this.djUI=[];
        this.lookSampler=new CustomLookSampler(counts);this.paletteOverride=null;
        this.metrics={bands:new Float32Array(8),raw:new Float32Array(8),volume:0,energy:0,bassAverage:0,lastBeat:-1000,beat:false,bassBeat:false};
        this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
        this.onReduced=()=>{if(this.reduced.matches)this.pause();};this.reduced.addEventListener('change',this.onReduced);
        this.audio.addEventListener('ended',()=>{this.active=false;this.stopDJ();this.syncUI();});
        this.audio.addEventListener('error',()=>{if(this.liveAudio)return;this.error='This audio could not play. Choose another file or use the demo.';this.stop();});
        this.audio.addEventListener('loadedmetadata',()=>this.syncUI());
    }
    async ensureAudio(){
        if(!this.context){
            const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('Audio analysis is unavailable in this browser.');
            this.context=new Context();this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=0;
            this.source=this.context.createMediaElementSource(this.audio);this.gain=this.context.createGain();this.gain.gain.value=0;
            this.source.connect(this.analyser);this.analyser.connect(this.gain);this.gain.connect(this.context.destination);
            this.frequency=new Float32Array(this.analyser.frequencyBinCount);this.time=new Float32Array(this.analyser.fftSize);
        }
        await this.context.resume();this.setSound(this.soundOn);
    }
    get liveAudio(){return !!this.captureStream;}
    get computerAudio(){return this.liveAudio&&this.captureKind==='computer';}
    get microphoneAudio(){return this.liveAudio&&this.captureKind==='microphone';}
    get canShareAudio(){return window.isSecureContext&&typeof navigator.mediaDevices?.getDisplayMedia==='function'&&!/Electron|ChatGPT|Codex/i.test(navigator.userAgent);}
    get canUseMicrophone(){return window.isSecureContext&&typeof navigator.mediaDevices?.getUserMedia==='function';}
    get paused(){return this.liveAudio?this.capturePaused:this.audio.paused;}
    get playbackTime(){return this.liveAudio?this.captureElapsed+(this.capturePaused?0:(performance.now()-this.captureStartedAt)/1000):this.audio.currentTime;}
    setSound(value){this.soundOn=!!value;if(this.gain)this.gain.gain.setValueAtTime(!this.liveAudio&&this.soundOn?this.volume:0,this.context.currentTime);this.syncUI();}
    setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));this.setSound(this.soundOn);}
    async start(){
        const token=++this.token;this.error='';
        try{await this.ensureAudio();if(token!==this.token)return false;this.beforeStart?.();this.active=true;this.lastTime=performance.now()/1000;
            this.sampler.reset();this.lookSampler.music.reset();this.metrics.bassAverage=0;this.metrics.bands.fill(0);
            if(!this.reduced.matches){if(this.liveAudio){if(this.capturePaused)this.captureStartedAt=performance.now();this.capturePaused=false;}else await this.audio.play();}
            if(token!==this.token){this.audio.pause();return false;}this.syncUI();return true;
        }catch(error){if(token===this.token){this.error=error.message||'Tap Play to start audio.';this.active=false;this.audio.pause();this.syncUI();}return false;}
    }
    pause(){if(this.liveAudio&&!this.capturePaused){this.captureElapsed=this.playbackTime;this.capturePaused=true;}this.audio.pause();this.syncUI();}
    releaseCapture(){
        if(!this.captureStream)return;
        const stream=this.captureStream;this.captureStream=null;this.captureKind=null;
        for(const track of stream.getTracks()){track.removeEventListener('ended',this.captureEnded);track.stop();}
        this.captureSource?.disconnect();this.captureSource=null;this.captureEnded=null;
        this.source?.connect(this.analyser);this.capturePaused=true;this.captureElapsed=0;
    }
    stop(invalidateCapture=true){if(invalidateCapture){this.captureRequest++;this.capturePending=false;this.capturePendingKind=null;}this.stopDJ();this.token++;this.active=false;this.audio.pause();this.audio.currentTime=0;this.releaseCapture();this.frame.forEach(row=>row.fill(0));this.sampler.reset();this.setSound(this.soundOn);}
    async useComputerAudio(){
        if(this.capturePending)return false;
        if(/Electron|ChatGPT|Codex/i.test(navigator.userAgent)){this.error='Open this viewer in desktop Chrome for audio sharing. Open Spotify’s web player in another Chrome tab, then share that tab with Share tab audio enabled.';this.syncUI();return false;}
        if(!this.canShareAudio){this.error='Computer audio sharing is unavailable here. Use microphone for music playing nearby, choose a song file, or use the demo soundtrack.';this.syncUI();return false;}
        return this.useLiveAudio('computer',()=>navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',frameRate:1},audio:{suppressLocalAudioPlayback:false},systemAudio:'include',windowAudio:'system',selfBrowserSurface:'exclude',surfaceSwitching:'include'}));
    }
    async useMicrophone(){
        if(this.capturePending)return false;
        if(!this.canUseMicrophone){this.error='Microphone access is unavailable here. Open the HTTPS viewer in your browser, choose a song file, or use the demo soundtrack.';this.syncUI();return false;}
        return this.useLiveAudio('microphone',()=>navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}}));
    }
    async useLiveAudio(kind,requestStream){
        const microphone=kind==='microphone';
        const request=++this.captureRequest;this.capturePending=true;this.capturePendingKind=kind;this.error='';this.syncUI();let stream;
        try{
            // Request only from the explicit source button; preserve its click gesture.
            stream=await requestStream();
            if(request!==this.captureRequest){stream.getTracks().forEach(track=>track.stop());return false;}
            const tracks=stream.getAudioTracks().filter(track=>track.readyState==='live');
            if(!tracks.length)throw new Error(microphone?'The microphone supplied no audio. Choose a song file or use the demo soundtrack.':'No audio was shared. Choose a browser tab and enable Share audio. Whole-computer audio is available only on some browsers and operating systems.');
            await this.ensureAudio();
            if(request!==this.captureRequest){stream.getTracks().forEach(track=>track.stop());return false;}
            const liveTracks=stream.getAudioTracks().filter(track=>track.readyState==='live');
            if(!liveTracks.length)throw new Error('Audio sharing ended before it could start. Try sharing again.');
            const captureSource=this.context.createMediaStreamSource(new MediaStream(liveTracks));
            this.stop(false);this.source.disconnect();this.captureStream=stream;this.captureKind=kind;this.captureSource=captureSource;
            // No video consumer or speaker playback: only the audio analyser receives data.
            stream.getVideoTracks().forEach(track=>track.enabled=false);
            captureSource.connect(this.analyser);this.captureStartedAt=performance.now();this.captureElapsed=0;this.capturePaused=this.reduced.matches;
            this.captureEnded=()=>{if(this.captureStream===stream){this.stop();this.error=microphone?'Microphone listening ended. Tap Use microphone to start again.':'Audio sharing ended. Choose Use computer audio to share again.';this.syncUI();}};
            stream.getTracks().forEach(track=>track.addEventListener('ended',this.captureEnded));
            this.beforeStart?.();this.active=true;this.lastTime=performance.now()/1000;this.metrics.bassAverage=0;this.metrics.bands.fill(0);this.error='';this.setSound(this.soundOn);return true;
        }catch(error){
            stream?.getTracks().forEach(track=>track.stop());
            if(request===this.captureRequest){if(stream&&this.captureStream===stream)this.stop(false);this.error=error.name==='NotAllowedError'?(microphone?'Microphone permission was not granted. Allow it in browser site settings, or open the viewer in its own tab. You can also choose a song file or the demo.':'Audio sharing was cancelled or not allowed. You can try again or use a music file.'):error.message||(microphone?'Microphone listening could not start.':'Audio sharing could not start.');this.syncUI();}return false;
        }finally{if(request===this.captureRequest){this.capturePending=false;this.capturePendingKind=null;this.syncUI();}}
    }
    useFile(file){
        if(!file||file.size>100*1024*1024||!file.type.startsWith('audio/')){this.error='Choose an audio file smaller than 100 MB.';this.syncUI();return false;}
        this.stop();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=URL.createObjectURL(file);
        this.audio.src=this.objectUrl;this.sourceName=file.name;this.error='';this.syncUI();return true;
    }
    useDemo(){this.stop();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=null;this.audio.src='./assets/led/music/neon-flight-demo.mp3';this.sourceName='Original demo soundtrack';this.error='';this.syncUI();}
    setEffect(value){this.stopDJ();if(!MUSIC_EFFECTS.some(effect=>effect.fx===Number(value)))return false;document.dispatchEvent(new Event('ergoflex-music-effect-selected'));this.fx=Number(value);this.sampler.reset();if(this.active&&this.paused)this.sampler.sample(this.frame,this.fx,this.metrics,this.playbackTime,0,this.reduced.matches);this.syncUI();return true;}
    setLibrary(looks,palettes){this.dj.setLibrary(looks,palettes);for(const root of this.djUI)root.renderLibrary?.();}
    applyPalette(palette){this.paletteOverride=normalizeCustomPalette(palette);if(this.dj.enabled)this.dj.currentPalette=this.paletteOverride;}
    renderRecipe(seconds,delta,reduced,render=null){
        const look=render?render.look:(this.dj.enabled&&this.dj.reason==='phrase'?this.dj.currentLook:null);
        if(look){const key=`${this.dj.revision}:${this.dj.switchedAt}:${this.dj.reason}`;if(this.lastRecipe!==key){this.lookSampler.music.reset();this.lastRecipe=key;}this.lookSampler.sample(this.frame,look,seconds,render?.metrics||this.metrics,reduced,delta);this.frame.forEach(row=>{for(let i=0;i<row.length;i++)row[i]=Math.round(row[i]*look.bri/255);});}
        const palette=this.dj.enabled?this.dj.currentPalette:this.paletteOverride;
        if(palette)tintCustomMusic(this.frame,{on:true,strips:this.frame.map((row,id)=>({id,on:true,bri:255,pal:0,rev:false,palette}))});
    }
    sample(frame){
        if(!this.active)return false;
        if(this.reduced.matches){
            this.metrics.volume=.35;
            this.sampler.sample(this.frame,this.fx,this.metrics,0,0,true);
            this.renderRecipe(0,0,true);
        }else if(!this.paused){
            const now=performance.now()/1000,dt=Math.min(.05,Math.max(.001,now-(this.lastTime||now)));this.lastTime=now;
            analyseMusic(this.analyser,this.frequency,this.time,this.metrics,this.sensitivity,dt);
            const next=this.dj.tick(this.playbackTime,this.metrics);
            if(next!==null&&next!==this.fx){this.fx=next;this.sampler.reset();this.syncUI();}
            const render=this.djOverlay.prepare(this.dj,this.metrics,this.playbackTime,dt);
            this.stripEffects=this.dj.enabled?render.configs.map(strip=>strip.fx):Array(this.frame.length).fill(this.fx);
            const effects=this.stripEffects.map(fx=>MUSIC_EFFECTS.some(e=>e.fx===fx)?fx:28);
            this.sampler.sample(this.frame,effects,render.metrics,this.playbackTime,dt,false,render.configs);
            this.renderRecipe(this.playbackTime,dt,false,render);
            this.djOverlay.paint(this.frame,this.dj,render.metrics,this.playbackTime);
            if(this.dj.enabled&&this.djUIKey!==this.djOverlay.key){this.djUIKey=this.djOverlay.key;this.syncUI();}
            if(this.dj.enabled&&this.dj.settings.comfort==='reduced'){this.frame.forEach((row,strip)=>{if([31,40].includes(this.stripEffects[strip]))for(let i=0;i<row.length;i++)row[i]=Math.round(row[i]*.65);});}
        }
        frame.forEach((row,index)=>row.set(this.frame[index]));return true;
    }
    stopDJ(){if(!this.dj.enabled)return;this.dj.stop();this.djOverlay.reset();this.lastRecipe=null;if(this.manualFx!==undefined)this.fx=this.manualFx;this.manualFx=undefined;this.syncDJUI();}
    async startDJ(settings=this.dj.settings){
        if(!this.dj.configure(settings)){this.stopDJ();this.error='Choose at least one effect allowed by your flash comfort setting.';this.syncUI();return false;}
        if(!this.dj.enabled)this.manualFx=this.fx;
        this.dj.start(this.playbackTime);this.fx=this.dj.fx;
        const success=await this.start();if(!success)this.stopDJ();this.syncUI();return success;
    }
    syncDJUI(){for(const root of this.djUI){
        root.querySelector('[data-dj-start]').textContent=this.dj.enabled?(this.paused?'Resume Auto DJ':'Pause Auto DJ'):'Start Auto DJ';
        root.querySelector('[data-dj-status]').textContent=this.error||(!this.dj.enabled?'Pick a program, then start your music.':`${this.dj.settings.program} · ${this.dj.currentLook?.name||MUSIC_EFFECTS.find(e=>e.fx===this.fx)?.label||'Music'}${this.dj.currentPalette?' · '+this.dj.currentPalette.name:''} · ${this.paused?'paused':this.dj.reason}`);
        root.querySelector('[data-dj-strip-mix]').textContent=this.dj.enabled?(this.djOverlay.effects||this.dj.stripEffects(this.frame.length)).map((fx,index)=>`${LED_STRIPS[index]?.name||'Strip '+(index+1)}: ${MUSIC_EFFECTS.find(e=>e.fx===fx)?.label||'Saved effect '+fx}`).join(' · '):'';
    }}
    mountDJControls(container){
        if(!container||container.childElementCount)return;
        container.innerHTML='<p class="ledcc-intro">You are the DJ. Choose a program or rate your own effect rotation.</p><label>DJ program <select data-dj-program><option value="chill">Chill</option><option value="party">Party</option><option value="rave">Rave</option><option value="custom">My rotation</option></select></label><fieldset><legend>Flash comfort</legend><div class="ledcc-segments" data-dj-comfort></div><p>Reduced plays flash-heavy effects less often. Minimal leaves them out.</p></fieldset><div class="ledcc-dj-grid" data-dj-weights></div><div class="ledcc-actions"><button type="button" data-dj-save>Save DJ settings</button><button type="button" data-dj-start>Start Auto DJ</button><button type="button" data-dj-stop>Stop Auto DJ</button></div><p data-dj-status role="status"></p>';
        const config=normalizeDJSettings(this.dj.settings);let comfort=config.comfort;
        const mix=document.createElement('label');mix.innerHTML='Mix Across Shelves <input type="checkbox" data-dj-mix>';container.querySelector('[data-dj-program]').closest('label').after(mix);
        const mixInput=mix.querySelector('input');mixInput.checked=config.mixStrips;
        const stripMix=document.createElement('p');stripMix.dataset.djStripMix='';stripMix.className='ledcc-strip-mix';container.querySelector('[data-dj-status]').after(stripMix);
        const program=container.querySelector('[data-dj-program]');program.value=config.program;
        const weights={...config.weights};
        const lookWeights={...config.lookWeights},paletteWeights={...config.paletteWeights};
        for(const value of ['standard','reduced','minimal']){
            const button=document.createElement('button');button.type='button';button.textContent=value[0].toUpperCase()+value.slice(1);button.dataset.djComfort=value;button.setAttribute('aria-pressed',String(value===comfort));
            button.onclick=()=>{comfort=value;container.querySelectorAll('[data-dj-comfort] button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));apply();};container.querySelector('div[data-dj-comfort]').append(button);
        }
        for(const effect of MUSIC_EFFECTS){const card=document.createElement('div');card.className='ledcc-dj-card';const title=document.createElement('span');title.textContent=effect.fx===31?'Strobe':effect.label;card.append(title);
            const select=document.createElement('select');select.dataset.djWeight=effect.fx;select.setAttribute('aria-label',`${effect.label} frequency`);
            ['Off','Rare','Sometimes','Often','Favorite'].forEach((label,i)=>select.add(new Option(label,String(i))));select.value=weights[effect.fx];select.className='sr-only';
            const ratings=document.createElement('div');ratings.className='ledcc-rating';ratings.setAttribute('role','group');ratings.setAttribute('aria-label',`${effect.label} frequency`);
            ['Off','Rare','Sometimes','Often','Favorite'].forEach((label,index)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(index===Number(select.value)));button.onclick=()=>{select.value=index;select.dispatchEvent(new Event('change',{bubbles:true}));};ratings.append(button);});
            select.onchange=()=>{ratings.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===Number(select.value))));weights[effect.fx]=Number(select.value);program.value='custom';apply();};card.append(select,ratings);container.querySelector('[data-dj-weights]').append(card);
        }
        const library=document.createElement('section');library.innerHTML='<h3>My looks in the mix</h3><p>Only music-enabled looks enter the DJ rotation. Minimal excludes looks containing Strobe or Drop. Remix options are temporary.</p><div class="ledcc-dj-grid" data-dj-looks></div><h3>My palettes in the mix</h3><p>Palette ratings add colour sections to the rotation while keeping the effects. Off preserves original colours.</p><div class="ledcc-dj-grid" data-dj-palettes></div>';container.querySelector('[data-dj-weights]').after(library);
        container.renderLibrary=()=>{for(const [rows,values,kind,defaultWeight] of [[this.dj.looks,lookWeights,'looks',2],[this.dj.palettes,paletteWeights,'palettes',0]]){
            const host=container.querySelector(`[data-dj-${kind}]`);host.replaceChildren();for(const row of rows){const card=document.createElement('div');card.className='ledcc-dj-card';const title=document.createElement('span');title.textContent=row.name;const select=document.createElement('select');select.dataset[kind==='looks'?'djLookWeight':'djPaletteWeight']=row.name;select.setAttribute('aria-label',`${row.name} ${kind==='looks'?'look':'palette'} frequency`);['Off','Rare','Sometimes','Often','Favorite'].forEach((label,index)=>select.add(new Option(label,index)));select.value=values[row.name]??defaultWeight;select.onchange=()=>{values[row.name]=Number(select.value);apply();};card.append(title,select);host.append(card);}
        }};
        const extras=document.createElement('fieldset');extras.className='ledcc-dj-extras';extras.innerHTML='<legend>DJ extras</legend>';library.after(extras);
        const toggles=[
            ['beatAlign','Switch on the beat','Land changes on the next steady beat. Without a steady tempo, switch immediately. Drops and quiet passages react instantly.'],
            ['remixPresets','Remix My Presets','Play your saved colours on other enabled music effects. Saved presets stay intact.'],
            ['remixSliders','Remix Sliders','Vary each effect’s speed and its own reach, tail or scale between looks.'],
            ['remixPhysics','Remix Physics','Vary attack, decay and beat punch without changing your music sensitivity.'],
            ['burstsOn','Color Bursts','Add short, localized colour accents on beats. Reduced and Minimal comfort suppress bursts.'],
            ['randomizeOn','Beat Randomize','Change temporary strip direction and mirroring on beats. Reduced and Minimal suppress this.'],
            ['remixBursts','Remix Bursts','Vary burst width, cadence and colours. This never turns Color Bursts on.']
        ];
        const inputs={};for(const [key,title,description] of toggles){const label=document.createElement('label');label.className='ledcc-dj-extra';const text=document.createElement('span');const heading=document.createElement('strong');heading.textContent=title;const help=document.createElement('small');help.textContent=description;text.append(heading,help);const input=document.createElement('input');input.type='checkbox';input.dataset.djOption=key;input.checked=config[key];label.append(text,input);extras.append(label);inputs[key]=input;}
        const dynamics=document.createElement('fieldset');dynamics.innerHTML='<legend>Color Dynamics</legend><p>Gentle colour drifts, beat-stepped hues and frequency colours. Wide reaches further.</p><div class="ledcc-segments"></div>';extras.append(dynamics);let dynamicsMode=config.dynamicsMode;
        for(const value of ['off','story','wide']){const button=document.createElement('button');button.type='button';button.dataset.djDynamics=value;button.textContent=value[0].toUpperCase()+value.slice(1);button.setAttribute('aria-pressed',String(value===dynamicsMode));button.onclick=()=>{dynamicsMode=value;dynamics.querySelectorAll('button').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));apply();};dynamics.querySelector('div').append(button);}
        const enableExtras=document.createElement('button');enableExtras.type='button';enableExtras.dataset.djEnableExtras='';enableExtras.textContent='Enable all DJ extras';
        enableExtras.onclick=()=>{Object.values(inputs).forEach(input=>input.checked=true);dynamicsMode='wide';this.sensitivity=1;dynamics.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.djDynamics==='wide')));apply();};extras.prepend(enableExtras);
        const settings=()=>({program:program.value,comfort,weights,lookWeights,paletteWeights,mixStrips:mixInput.checked,dynamicsMode,...Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.checked]))});
        const apply=()=>{const custom=program.value==='custom';container.querySelector('[data-dj-weights]').hidden=!custom;
            if(this.dj.enabled){this.dj.configure(settings());if(!this.dj.pool.length){this.stopDJ();this.error='Choose at least one effect allowed by your flash comfort setting.';}else this.fx=this.dj.fx;}this.syncUI();};
        program.onchange=apply;mixInput.onchange=apply;Object.values(inputs).forEach(input=>input.onchange=apply);
        container.querySelector('[data-dj-save]').onclick=()=>{const config=normalizeDJSettings(settings()),check=new AutoDJ(config);check.setLibrary(this.dj.looks,this.dj.palettes);if(!check.pool.length){this.error='Choose at least one effect or look allowed by your flash comfort setting.';this.syncUI();return;}try{localStorage.setItem(DJ_SETTINGS_KEY,JSON.stringify(config));this.dj.configure(config);this.error='';this.syncUI();container.querySelector('[data-dj-status]').textContent='DJ settings saved on this device.';}catch{container.querySelector('[data-dj-status]').textContent='Storage is unavailable; settings work for this session.';}};
        container.querySelector('[data-dj-start]').onclick=()=>{if(this.dj.enabled){if(this.paused)this.start();else this.pause();}else this.startDJ(settings());};
        container.querySelector('[data-dj-stop]').onclick=()=>{this.stopDJ();this.syncUI();};this.djUI.push(container);container.renderLibrary();apply();
    }
    syncUI(transportOnly=false){this.syncDJUI();
        for(const root of this.ui){
            if(!transportOnly)root.querySelector('[data-music-effect]').value=String(this.fx);
            root.querySelector('[data-music-play]').textContent=this.liveAudio?(this.paused?'Resume lights':'Pause lights'):!this.active?'Start Music Mode':this.paused?'Play':'Pause';
            const share=root.querySelector('[data-music-share]'),mic=root.querySelector('[data-music-microphone]');
            share.textContent=this.capturePendingKind==='computer'?'Choose audio in browser…':this.computerAudio?'Stop sharing':'Use computer audio';
            share.hidden=!this.canShareAudio&&!this.computerAudio;share.disabled=this.capturePending;
            mic.textContent=this.capturePendingKind==='microphone'?'Allow microphone…':this.microphoneAudio?'Stop microphone':'Use microphone';
            mic.disabled=this.capturePending||(!this.canUseMicrophone&&!this.microphoneAudio);
            root.querySelector('[data-music-desktop-help]').hidden=!this.canShareAudio;
            root.querySelector('[data-music-mobile-help]').hidden=this.canShareAudio;
            root.querySelector('[data-music-stop]').textContent=this.microphoneAudio?'Stop microphone':this.computerAudio?'Stop sharing':'Stop';
            for(const selector of ['[data-music-sound]','[data-music-volume]','[data-music-seek]','[data-music-repeat]'])root.querySelector(selector).closest('label').hidden=this.liveAudio;
            if(!transportOnly)root.querySelector('[data-music-sound]').checked=this.soundOn;
            root.querySelector('[data-music-sensitivity]').value=String(this.sensitivity);
            root.querySelector('[data-music-sensitivity-value]').textContent=Math.round(this.sensitivity*100)+'%';
            if(!transportOnly)root.querySelector('[data-music-volume]').value=String(this.volume);
            const seek=root.querySelector('[data-music-seek]');seek.max=Number.isFinite(this.audio.duration)?String(this.audio.duration):'12';if(document.activeElement!==seek)seek.value=String(this.audio.currentTime||0);seek.disabled=!this.active||this.liveAudio;
            root.querySelector('[data-music-status]').textContent=this.error||(this.liveAudio?`${this.microphoneAudio?'Microphone':'Computer audio'} · ${this.reduced.matches?'reduced-motion static preview':this.paused?'lights paused':'listening'} · ${this.microphoneAudio?'play music nearby':'play audio in your shared source'}`:`${this.sourceName} · ${!this.active?'off':this.reduced.matches?'reduced-motion static preview':this.paused?'paused':'playing'}${this.soundOn?'':' · muted'}`);
        }
    }
    mountControls(container,beforeStart){
        if(!container||container.querySelector('.led-music-playback'))return;this.beforeStart=beforeStart;
        const details=document.createElement('details');details.className='led-playback led-music-playback';
        details.innerHTML='<summary>Music Mode · all music effects</summary><div class="led-playback-controls"><label>Music effect <select data-music-effect></select></label><button type="button" data-music-share>Use computer audio</button><div class="led-music-share-help"><strong>Using Spotify?</strong><ol><li>Open this viewer in desktop Chrome.</li><li>Play <a href="https://open.spotify.com/" target="_blank" rel="noopener noreferrer">Spotify’s web player</a> in another tab in the same Chrome browser. Choose “This web browser” as Spotify’s playback device.</li><li>Click Use computer audio → Chrome Tab → Spotify. Enable Share tab audio, then click Share.</li></ol><p>The desktop Spotify app needs system-audio sharing. If your picker offers no audio for a window or screen, use the web player. Audio stays on this device.</p></div><label>Your song <input data-music-file type="file" accept="audio/*"></label><button type="button" data-music-demo>Use demo soundtrack</button><div><button type="button" data-music-play>Start Music Mode</button><button type="button" data-music-stop>Stop</button></div><label><input type="checkbox" data-music-sound> Hear music</label><label>Music volume <input data-music-volume type="range" min="0" max="1" step="0.05" value="0.5"></label><label>Sensitivity <output data-music-sensitivity-value>100%</output> <input data-music-sensitivity type="range" min="0.5" max="3" step="0.1" value="1"></label><label>Song position <input data-music-seek type="range" min="0" max="12" step="0.05" value="0" disabled></label><label><input data-music-repeat type="checkbox" checked> Repeat</label><p data-music-status role="status"></p><p>Your song stays on this device.</p></div>';
        details.querySelector('.led-music-share-help').dataset.musicDesktopHelp='';
        const mobileHelp=document.createElement('div');mobileHelp.className='led-music-share-help';mobileHelp.dataset.musicMobileHelp='';
        mobileHelp.innerHTML='<strong>Music on your phone</strong><p>This browser cannot share audio from another app. Use microphone for music playing nearby, choose Your song, or use the demo soundtrack.</p>';
        details.querySelector('.led-music-share-help').after(mobileHelp);
        const mic=document.createElement('button');mic.type='button';mic.dataset.musicMicrophone='';mic.textContent='Use microphone';
        details.querySelector('[data-music-share]').after(mic);
        const micHelp=document.createElement('div');micHelp.className='led-music-share-help';
        micHelp.innerHTML='<p>Microphone listens to sound around you with your permission. Audio is analysed on this device, without recording, uploading or speaker playback.</p>';
        if(window.self!==window.top){const p=document.createElement('p'),link=document.createElement('a');p.append('If microphone access is blocked, ');link.href=window.location.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='open the viewer in its own tab';p.append(link,'.');micHelp.append(p);}
        mobileHelp.after(micHelp);
        const select=details.querySelector('[data-music-effect]');MUSIC_EFFECTS.forEach(effect=>select.add(new Option(effect.label,String(effect.fx))));
        container.append(details);this.ui.push(details);
        const on=(selector,event,callback)=>details.querySelector(selector).addEventListener(event,callback);
        on('[data-music-effect]','change',event=>this.setEffect(event.target.value));
        on('[data-music-file]','change',event=>this.useFile(event.target.files[0]));
        on('[data-music-demo]','click',()=>this.useDemo());
        on('[data-music-share]','click',()=>{if(this.computerAudio)this.stop();else this.useComputerAudio();});
        on('[data-music-microphone]','click',()=>{if(this.microphoneAudio)this.stop();else this.useMicrophone();});
        on('[data-music-play]','click',async()=>{if(this.active&&!this.paused)this.pause();else await this.start();});
        on('[data-music-stop]','click',()=>this.stop());
        on('[data-music-sound]','change',event=>this.setSound(event.target.checked));
        on('[data-music-volume]','input',event=>this.setVolume(event.target.value));
        on('[data-music-sensitivity]','input',event=>{this.sensitivity=Number(event.target.value);this.syncUI(true);});
        on('[data-music-seek]','input',event=>{this.audio.currentTime=Number(event.target.value);this.sampler.reset();this.frame.forEach(row=>row.fill(0));this.metrics.bassAverage=0;this.syncUI();});
        on('[data-music-repeat]','change',event=>{this.audio.loop=event.target.checked;});
        this.syncUI();
    }
    dispose(){this.stop();this.reduced.removeEventListener('change',this.onReduced);if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.source?.disconnect();this.analyser?.disconnect();this.gain?.disconnect();this.context?.close().catch(()=>{});this.audio.removeAttribute('src');this.audio.load();}
}
