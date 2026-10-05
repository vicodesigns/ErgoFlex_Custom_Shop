import { AutoDJ, DJ_SETTINGS_KEY, normalizeDJSettings } from './led-auto-dj.mjs?v=app-dj-20261005';
import { BurstOverlay, BuildDropDetector, BURST_RECIPES, BURST_DEFAULTS, normalizeBurst } from './led-music-bursts.mjs';
import { MUSIC_EFFECTS, MusicSampler, analyseMusic } from './led-showcase-effects.mjs';

export class LedMusicMode{
    constructor(counts){
        this.counts=counts;this.frame=counts.map(count=>new Uint8Array(count*4));this.sampler=new MusicSampler();
        this.audio=document.createElement('audio');this.audio.preload='metadata';this.audio.loop=true;
        this.audio.src='./assets/led/music/neon-flight-demo.mp3';this.audio.volume=1;
        this.fx=28;this.active=false;this.soundOn=false;this.volume=.5;this.sensitivity=1;this.error='';this.ui=[];this.sourceName='Original demo soundtrack';this.token=0;
        let saved;try{saved=JSON.parse(localStorage.getItem(DJ_SETTINGS_KEY)||'null');}catch{}
        this.dj=new AutoDJ(saved||{});this.djUI=[];this.burst=new BurstOverlay();this.burstManual={...BURST_DEFAULTS};this.burstFlags=new BuildDropDetector();
        this.metrics={bands:new Float32Array(8),raw:new Float32Array(8),volume:0,energy:0,bassAverage:0,lastBeat:-1000,beat:false,bassBeat:false};
        this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
        this.onReduced=()=>{if(this.reduced.matches)this.pause();};this.reduced.addEventListener('change',this.onReduced);
        this.audio.addEventListener('ended',()=>{this.active=false;this.stopDJ();this.syncUI();});
        this.audio.addEventListener('error',()=>{this.error='This audio could not play. Choose another file or use the demo.';this.stop();});
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
    setSound(value){this.soundOn=!!value;if(this.gain)this.gain.gain.setValueAtTime(this.soundOn?this.volume:0,this.context.currentTime);this.syncUI();}
    setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));this.setSound(this.soundOn);}
    async start(){
        const token=++this.token;this.error='';
        try{await this.ensureAudio();if(token!==this.token)return false;this.beforeStart?.();this.active=true;this.lastTime=performance.now()/1000;
            this.sampler.reset();this.metrics.bassAverage=0;this.metrics.bands.fill(0);
            if(!this.reduced.matches)await this.audio.play();
            if(token!==this.token){this.audio.pause();return false;}this.syncUI();return true;
        }catch(error){if(token===this.token){this.error=error.message||'Tap Play to start audio.';this.active=false;this.audio.pause();this.syncUI();}return false;}
    }
    pause(){this.audio.pause();this.syncUI();}
    stop(){this.stopDJ();this.token++;this.active=false;this.audio.pause();this.audio.currentTime=0;this.frame.forEach(row=>row.fill(0));this.sampler.reset();this.burst.reset();this.burstFlags.reset();this.syncUI();}
    useFile(file){
        if(!file||file.size>100*1024*1024||!file.type.startsWith('audio/')){this.error='Choose an audio file smaller than 100 MB.';this.syncUI();return false;}
        this.stop();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=URL.createObjectURL(file);
        this.audio.src=this.objectUrl;this.sourceName=file.name;this.error='';this.syncUI();return true;
    }
    useDemo(){this.stop();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=null;this.audio.src='./assets/led/music/neon-flight-demo.mp3';this.sourceName='Original demo soundtrack';this.error='';this.syncUI();}
    setEffect(value){this.stopDJ();if(!MUSIC_EFFECTS.some(effect=>effect.fx===Number(value)))return false;this.fx=Number(value);this.sampler.reset();if(this.active&&this.audio.paused)this.sampler.sample(this.frame,this.fx,this.metrics,this.audio.currentTime,0,this.reduced.matches);this.syncUI();return true;}
    sample(frame){
        if(!this.active)return false;
        if(this.reduced.matches){
            this.metrics.volume=.35;
            this.sampler.sample(this.frame,this.fx,this.metrics,0,0,true);
        }else if(!this.audio.paused){
            const now=performance.now()/1000,dt=Math.min(.05,Math.max(.001,now-(this.lastTime||now)));this.lastTime=now;
            analyseMusic(this.analyser,this.frequency,this.time,this.metrics,this.sensitivity,dt);
            const next=this.dj.tick(this.audio.currentTime,this.metrics);
            if(next!==null&&next!==this.fx){this.fx=next;this.sampler.reset();this.syncUI();}
            this.sampler.sample(this.frame,this.fx,this.metrics,this.audio.currentTime,dt,this.reduced.matches);
            if(this.dj.enabled&&this.dj.settings.comfort==='reduced'&&(this.fx===31||this.fx===40)){for(const row of this.frame)for(let i=0;i<row.length;i++)row[i]=Math.round(row[i]*.65);}
            this.applyBursts(now,dt);
        }
        frame.forEach((row,index)=>row.set(this.frame[index]));return true;
    }
    // Color Bursts overlay (desk EffectEngine mirror). Manual tunables, or the Auto DJ's per-phrase recipe.
    burstConfig(){
        if(this.dj.enabled&&this.dj.settings.bursts)return {...BURST_RECIPES[this.dj.burstRecipe],enable:true};
        return this.burstManual;
    }
    applyBursts(now,dt){
        const config=normalizeBurst(this.burstConfig()),comfort=this.dj.enabled&&this.dj.settings.comfort!=='standard';
        if(this.dj.enabled&&this.dj.settings.comfort==='minimal')config.depth=Math.min(config.depth,128);
        this.burst.configure(config);
        const t=now*1000,flags={...this.burstFlags.update(t,dt,this.metrics),comfort};
        this.burst.update(t,dt,this.metrics,flags);this.burst.apply(this.frame);
    }
    setBurst(patch){this.burstManual=normalizeBurst({...this.burstManual,...patch});this.burst.configure(this.burstManual);this.syncUI();}
    stopDJ(){if(!this.dj.enabled)return;this.dj.stop();if(this.manualFx!==undefined)this.fx=this.manualFx;this.manualFx=undefined;this.syncDJUI();}
    async startDJ(settings=this.dj.settings){
        if(!this.dj.configure(settings)){this.stopDJ();this.error='Choose at least one effect allowed by your flash comfort setting.';this.syncUI();return false;}
        if(!this.dj.enabled)this.manualFx=this.fx;
        this.dj.start(this.audio.currentTime);this.fx=this.dj.fx;
        const success=await this.start();if(!success)this.stopDJ();this.syncUI();return success;
    }
    syncDJUI(){for(const root of this.djUI){
        root.querySelector('[data-dj-start]').textContent=this.dj.enabled?(this.audio.paused?'Resume Auto DJ':'Pause Auto DJ'):'Start Auto DJ';
        root.querySelector('[data-dj-status]').textContent=this.error||(!this.dj.enabled?'Pick a program, then start your music.':`${this.dj.settings.program} · ${MUSIC_EFFECTS.find(e=>e.fx===this.fx)?.label||'Music'} · ${this.audio.paused?'paused':this.dj.reason}`);
    }}
    mountDJControls(container){
        if(!container||container.childElementCount)return;
        container.innerHTML='<p class="ledcc-intro">You are the DJ. Choose a program or rate your own effect rotation.</p><label class="ledcc-burst-toggle"><input type="checkbox" data-dj-bursts> Color Bursts (rotates burst recipes each phrase)</label><label>DJ program <select data-dj-program><option value="chill">Chill</option><option value="party">Party</option><option value="rave">Rave</option><option value="custom">My rotation</option></select></label><fieldset><legend>Flash comfort</legend><div class="ledcc-segments" data-dj-comfort></div><p>Reduced plays flash-heavy effects less often. Minimal leaves them out.</p></fieldset><label data-dj-custom>Change after <select data-dj-bars><option value="4">4 bars</option><option value="8">8 bars</option><option value="16">16 bars</option></select> · falls back to 30 seconds without a beat</label><div class="ledcc-dj-grid" data-dj-weights></div><div class="ledcc-actions"><button type="button" data-dj-save>Save DJ settings</button><button type="button" data-dj-start>Start Auto DJ</button><button type="button" data-dj-stop>Stop Auto DJ</button></div><p data-dj-status role="status"></p>';
        const config=normalizeDJSettings(this.dj.settings);let comfort=config.comfort;
        const program=container.querySelector('[data-dj-program]'),bars=container.querySelector('[data-dj-bars]');program.value=config.program;bars.value=config.bars;
        const weights={...config.weights};
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
        const burstsBox=container.querySelector('[data-dj-bursts]');burstsBox.checked=config.bursts;burstsBox.onchange=()=>apply();
        const settings=()=>({program:program.value,comfort,bars:Number(bars.value),weights,bursts:burstsBox.checked});
        const apply=()=>{const custom=program.value==='custom';container.querySelector('[data-dj-custom]').hidden=!custom;container.querySelector('[data-dj-weights]').hidden=!custom;
            if(this.dj.enabled){this.dj.configure(settings());if(!this.dj.pool.length){this.stopDJ();this.error='Choose at least one effect allowed by your flash comfort setting.';}else this.fx=this.dj.fx;}this.syncUI();};
        program.onchange=apply;bars.onchange=apply;
        container.querySelector('[data-dj-save]').onclick=()=>{const config=normalizeDJSettings(settings());if(!new AutoDJ(config).pool.length){this.error='Choose at least one effect allowed by your flash comfort setting.';this.syncUI();return;}try{localStorage.setItem(DJ_SETTINGS_KEY,JSON.stringify(config));this.dj.configure(config);this.error='';this.syncUI();container.querySelector('[data-dj-status]').textContent='DJ settings saved on this device.';}catch{container.querySelector('[data-dj-status]').textContent='Storage is unavailable; settings work for this session.';}};
        container.querySelector('[data-dj-start]').onclick=()=>{if(this.dj.enabled){if(this.audio.paused)this.start();else this.pause();}else this.startDJ(settings());};
        container.querySelector('[data-dj-stop]').onclick=()=>{this.stopDJ();this.syncUI();};this.djUI.push(container);apply();
    }
    syncUI(transportOnly=false){this.syncDJUI();
        for(const root of this.ui){
            if(!transportOnly)root.querySelector('[data-music-effect]').value=String(this.fx);
            root.querySelector('[data-music-play]').textContent=!this.active?'Start Music Mode':this.audio.paused?'Play':'Pause';
            if(!transportOnly)root.querySelector('[data-music-sound]').checked=this.soundOn;
            if(!transportOnly)root.querySelector('[data-music-volume]').value=String(this.volume);
            const seek=root.querySelector('[data-music-seek]');seek.max=Number.isFinite(this.audio.duration)?String(this.audio.duration):'12';if(document.activeElement!==seek)seek.value=String(this.audio.currentTime||0);seek.disabled=!this.active;
            root.querySelector('[data-music-status]').textContent=this.error||`${this.sourceName} · ${!this.active?'off':this.reduced.matches?'reduced-motion static preview':this.audio.paused?'paused':'playing'}${this.soundOn?'':' · muted'}`;
        }
    }
    mountControls(container,beforeStart){
        if(!container||container.querySelector('.led-music-playback'))return;this.beforeStart=beforeStart;
        const details=document.createElement('details');details.className='led-playback led-music-playback';
        details.innerHTML='<summary>Music Mode · all music effects</summary><div class="led-playback-controls"><label>Music effect <select data-music-effect></select></label><label>Your song <input data-music-file type="file" accept="audio/*"></label><button type="button" data-music-demo>Use demo soundtrack</button><div><button type="button" data-music-play>Start Music Mode</button><button type="button" data-music-stop>Stop</button></div><label><input type="checkbox" data-music-sound> Hear music</label><label>Music volume <input data-music-volume type="range" min="0" max="1" step="0.05" value="0.5"></label><label>Sensitivity <input data-music-sensitivity type="range" min="0.5" max="3" step="0.1" value="1"></label><label>Song position <input data-music-seek type="range" min="0" max="12" step="0.05" value="0" disabled></label><label><input data-music-repeat type="checkbox" checked> Repeat</label><p data-music-status role="status"></p><p>Your song stays on this device.</p></div>';
        const select=details.querySelector('[data-music-effect]');MUSIC_EFFECTS.forEach(effect=>select.add(new Option(effect.label,String(effect.fx))));
        const bursts=document.createElement('div');bursts.className='led-burst-controls';
        bursts.innerHTML='<label><input type="checkbox" data-burst="enable"> Color Bursts</label>'+[['rate','Rate (0 = beats only)'],['spectrum','Color spread'],['zone','Zone (bottom / top)'],['depth','Depth (subtle / full wash)'],['tail','Tail (snappy / glow)'],['section','Calm sections (0 = off)']].map(([key,label])=>`<label>${label} <input type="range" min="0" max="255" step="1" data-burst="${key}"></label>`).join('')+'<label><input type="checkbox" data-burst="dropAware"> Drop-aware (hold back in builds, full hit on drops)</label>';
        details.querySelector('.led-playback-controls').append(bursts);
        bursts.querySelectorAll('[data-burst]').forEach(input=>{const key=input.dataset.burst,check=input.type==='checkbox';
            check?input.checked=!!this.burstManual[key]:input.value=String(this.burstManual[key]);
            input.addEventListener('input',()=>this.setBurst({[key]:check?input.checked:Number(input.value)}));});
        container.append(details);this.ui.push(details);
        const on=(selector,event,callback)=>details.querySelector(selector).addEventListener(event,callback);
        on('[data-music-effect]','change',event=>this.setEffect(event.target.value));
        on('[data-music-file]','change',event=>this.useFile(event.target.files[0]));
        on('[data-music-demo]','click',()=>this.useDemo());
        on('[data-music-play]','click',async()=>{if(this.active&&!this.audio.paused)this.pause();else await this.start();});
        on('[data-music-stop]','click',()=>this.stop());
        on('[data-music-sound]','change',event=>this.setSound(event.target.checked));
        on('[data-music-volume]','input',event=>this.setVolume(event.target.value));
        on('[data-music-sensitivity]','input',event=>{this.sensitivity=Number(event.target.value);});
        on('[data-music-seek]','input',event=>{this.audio.currentTime=Number(event.target.value);this.sampler.reset();this.frame.forEach(row=>row.fill(0));this.metrics.bassAverage=0;this.syncUI();});
        on('[data-music-repeat]','change',event=>{this.audio.loop=event.target.checked;});
        this.syncUI();
    }
    dispose(){this.stop();this.reduced.removeEventListener('change',this.onReduced);if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.source?.disconnect();this.analyser?.disconnect();this.gain?.disconnect();this.context?.close().catch(()=>{});this.audio.removeAttribute('src');this.audio.load();}
}
