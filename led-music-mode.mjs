import { MUSIC_EFFECTS, MusicSampler, analyseMusic } from './led-showcase-effects.mjs';

export class LedMusicMode{
    constructor(counts){
        this.counts=counts;this.frame=counts.map(count=>new Uint8Array(count*4));this.sampler=new MusicSampler();
        this.audio=document.createElement('audio');this.audio.preload='metadata';this.audio.loop=true;
        this.audio.src='./assets/led/music/neon-flight-demo.mp3';this.audio.volume=1;
        this.fx=28;this.active=false;this.soundOn=false;this.volume=.5;this.sensitivity=1;this.error='';this.ui=[];this.sourceName='Original demo soundtrack';this.token=0;
        this.metrics={bands:new Float32Array(8),raw:new Float32Array(8),volume:0,energy:0,bassAverage:0,lastBeat:-1000,beat:false,bassBeat:false};
        this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
        this.onReduced=()=>{if(this.reduced.matches)this.pause();};this.reduced.addEventListener('change',this.onReduced);
        this.audio.addEventListener('ended',()=>{this.active=false;this.syncUI();});
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
    stop(){this.token++;this.active=false;this.audio.pause();this.audio.currentTime=0;this.frame.forEach(row=>row.fill(0));this.sampler.reset();this.syncUI();}
    useFile(file){
        if(!file||file.size>100*1024*1024||!file.type.startsWith('audio/')){this.error='Choose an audio file smaller than 100 MB.';this.syncUI();return false;}
        this.stop();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=URL.createObjectURL(file);
        this.audio.src=this.objectUrl;this.sourceName=file.name;this.error='';this.syncUI();return true;
    }
    useDemo(){this.stop();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=null;this.audio.src='./assets/led/music/neon-flight-demo.mp3';this.sourceName='Original demo soundtrack';this.error='';this.syncUI();}
    setEffect(value){if(!MUSIC_EFFECTS.some(effect=>effect.fx===Number(value)))return false;this.fx=Number(value);this.sampler.reset();if(this.active&&this.audio.paused)this.sampler.sample(this.frame,this.fx,this.metrics,this.audio.currentTime,0,this.reduced.matches);this.syncUI();return true;}
    sample(frame){
        if(!this.active)return false;
        if(this.reduced.matches){
            this.metrics.volume=.35;
            this.sampler.sample(this.frame,this.fx,this.metrics,0,0,true);
        }else if(!this.audio.paused){
            const now=performance.now()/1000,dt=Math.min(.05,Math.max(.001,now-(this.lastTime||now)));this.lastTime=now;
            analyseMusic(this.analyser,this.frequency,this.time,this.metrics,this.sensitivity,dt);
            this.sampler.sample(this.frame,this.fx,this.metrics,this.audio.currentTime,dt,this.reduced.matches);
        }
        frame.forEach((row,index)=>row.set(this.frame[index]));return true;
    }
    syncUI(){
        for(const root of this.ui){
            root.querySelector('[data-music-effect]').value=String(this.fx);
            root.querySelector('[data-music-play]').textContent=!this.active?'Start Music Mode':this.audio.paused?'Play':'Pause';
            root.querySelector('[data-music-sound]').checked=this.soundOn;
            root.querySelector('[data-music-volume]').value=String(this.volume);
            const seek=root.querySelector('[data-music-seek]');seek.max=Number.isFinite(this.audio.duration)?String(this.audio.duration):'12';seek.value=String(this.audio.currentTime||0);seek.disabled=!this.active;
            root.querySelector('[data-music-status]').textContent=this.error||`${this.sourceName} · ${!this.active?'off':this.reduced.matches?'reduced-motion static preview':this.audio.paused?'paused':'playing'}${this.soundOn?'':' · muted'}`;
        }
    }
    mountControls(container,beforeStart){
        if(!container||container.querySelector('.led-music-playback'))return;this.beforeStart=beforeStart;
        const details=document.createElement('details');details.className='led-playback led-music-playback';
        details.innerHTML='<summary>Music Mode · all music effects</summary><div class="led-playback-controls"><label>Music effect <select data-music-effect></select></label><label>Your song <input data-music-file type="file" accept="audio/*"></label><button type="button" data-music-demo>Use demo soundtrack</button><div><button type="button" data-music-play>Start Music Mode</button><button type="button" data-music-stop>Stop</button></div><label><input type="checkbox" data-music-sound> Hear music</label><label>Music volume <input data-music-volume type="range" min="0" max="1" step="0.05" value="0.5"></label><label>Sensitivity <input data-music-sensitivity type="range" min="0.5" max="3" step="0.1" value="1"></label><label>Song position <input data-music-seek type="range" min="0" max="12" step="0.05" value="0" disabled></label><label><input data-music-repeat type="checkbox" checked> Repeat</label><p data-music-status role="status"></p><p>Browser previews of all ten music effects; not byte-identical firmware output. Your song stays on this device. Strobe uses a softened preview.</p></div>';
        const select=details.querySelector('[data-music-effect]');MUSIC_EFFECTS.forEach(effect=>select.add(new Option(effect.label,String(effect.fx))));
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
