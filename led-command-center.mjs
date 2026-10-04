// One app sheet, reused in the normal viewer and WebXR DOM overlay.
export class LedCommandCenter {
    constructor(api, controls) {
        this.api=api;this.returnFocus=null;
        const root=this.root=document.createElement('div');root.id='led-command-center';root.hidden=true;
        root.innerHTML=`<section class="ledcc-sheet" role="region" aria-labelledby="ledcc-title" tabindex="-1">
            <div class="ledcc-grip" aria-hidden="true"></div><header class="ledcc-header"><button type="button" data-ledcc-close aria-label="Close LED Command Center">×</button><h2 id="ledcc-title" class="sr-only">LED Command Center</h2><nav class="ledcc-segments" aria-label="LED Command Center"><button type="button" data-ledcc-tab="light" aria-pressed="true">Light</button><button type="button" data-ledcc-tab="music" aria-pressed="false">Music</button><button type="button" data-ledcc-tab="automate" aria-pressed="false">Automate</button></nav><button type="button" data-ledcc-tab="game" aria-pressed="false" aria-label="Game Mode" title="Game Mode"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M7 6h10c2 0 3 2 4 6l1 5c.4 2-2 3-3 1l-2-3H7l-2 3c-1 2-3.4 1-3-1l1-5c1-4 2-6 4-6zm-1 3v2H4v2h2v2h2v-2h2v-2H8V9H6zm10 2a1 1 0 100 2 1 1 0 000-2zm3 2a1 1 0 100 2 1 1 0 000-2z"/></svg></button></header>
            <div class="ledcc-scroll"><section class="ledcc-card ledcc-desk"><div class="ledcc-desk-heading"><span class="ledcc-bulb">☼</span><div><h3>Desk lights</h3><p>Explore your desk’s lighting</p></div><span class="ledcc-badge">3D preview</span></div><div class="ledcc-master"></div><div class="ledcc-now"><span data-ledcc-now>On the desk now: Solid</span><div class="ledcc-strips" role="img" aria-label="Eight desk LED strips">${Array.from({length:8},()=>'<i></i>').join('')}</div></div></section>
            <section data-ledcc-page="light"><nav class="ledcc-subnav" aria-label="Light controls"><button type="button" data-ledcc-light="moods" aria-pressed="true">☼ Moods</button><button type="button" data-ledcc-light="paint" aria-pressed="false">✎ Paint</button><button type="button" data-ledcc-light="effects" aria-pressed="false">✧ Effects</button></nav><section class="ledcc-card" data-ledcc-light-page="moods"><h3>Choose a mood</h3><div class="ledcc-moods"></div></section><section class="ledcc-card" data-ledcc-light-page="paint" hidden><h3>Your colour</h3><div class="ledcc-paint"></div></section><section class="ledcc-card" data-ledcc-light-page="effects" hidden><h3>Animated effects</h3><div class="ledcc-effects"></div></section></section>
            <section data-ledcc-page="music" hidden><nav class="ledcc-subnav" aria-label="Music controls"><button type="button" data-ledcc-music="live" aria-pressed="true">♫ Live</button><button type="button" data-ledcc-music="dj" aria-pressed="false">◎ Auto DJ</button></nav><div class="ledcc-music demo-led-playback"></div><section class="ledcc-card" data-ledcc-music-page="dj" hidden><div class="ledcc-dj"></div></section></section>
            <section data-ledcc-page="game" hidden><h3 class="ledcc-page-title">Game Mode</h3><div class="ledcc-game demo-led-playback"></div></section>
            <section data-ledcc-page="automate" hidden><h3 class="ledcc-page-title">Movement & sound</h3><section class="ledcc-card ledcc-automate"><p>Movement cues take priority, then your lighting resumes.</p></section></section>
            <div class="ledcc-diagnostics"></div></div></section>`;
        document.body.append(root);
        root.querySelector('[data-ledcc-close]').onclick=()=>this.close();
        root.addEventListener('click',event=>{if(event.target===root)this.close();});
        root.querySelectorAll('[data-ledcc-tab]').forEach(button=>button.onclick=()=>this.select('tab',button.dataset.ledccTab));
        root.querySelectorAll('[data-ledcc-light]').forEach(button=>button.onclick=()=>this.select('light',button.dataset.ledccLight));
        root.querySelectorAll('[data-ledcc-music]').forEach(button=>button.onclick=()=>this.select('music',button.dataset.ledccMusic));
        root.addEventListener('keydown',event=>{
            if(event.key==='Escape'){event.stopPropagation();this.close();}
        });
        document.addEventListener('ergoflex-ar-ended',()=>this.close());
        this.fit=()=>this.fitToApp();
        window.addEventListener('resize',this.fit);window.addEventListener('scroll',this.fit,true);
        this.mount(controls);this.select('tab','light');this.select('music','live');
    }
    mount(controls){
        const api=this.api,root=this.root;
        if(!controls){
            const power=document.createElement('button');power.type='button';power.dataset.ledToggle='';power.onclick=()=>api.setLedsEnabled(!api.ledsEnabled);
            const glow=document.createElement('label');glow.className='demo-led-glow';glow.innerHTML='Brightness <input type="range" data-led-glow aria-label="LED brightness" min="0" max="100"><output data-led-brightness-value></output>';
            glow.querySelector('input').oninput=e=>api.setLedGlow(Number(e.target.value)*api.ledFullBrightness/100);
            const colors=document.createElement('div');colors.className='demo-led-color-stack';colors.innerHTML='<div class="led-palette" role="group" aria-label="Quick LED colors"></div><label>LED color <input data-led-color type="color" aria-label="LED color"></label>';
            api.mountLedPalette(colors.querySelector('.led-palette'));colors.querySelector('input').oninput=e=>api.setLedColor(e.target.value);
            const effects=document.createElement('div'),playback=document.createElement('div'),mapping=document.createElement('div');
            api.mountLedEffects(effects);api.mountLedPlayback(playback);api.mountLedDiagnostic(mapping);controls={power,glow,colors,effects,playback,mapping};
        }
        root.querySelector('.ledcc-master').append(controls.power,controls.glow);
        root.querySelector('.ledcc-paint').append(controls.colors);
        root.querySelector('.ledcc-effects').append(controls.effects);
        const music=controls.playback.querySelector('.led-music-playback'),game=controls.playback.querySelector('.led-playback:not(.led-music-playback)');
        if(music){root.querySelector('.ledcc-music').append(music);music.open=true;}
        if(game){root.querySelector('.ledcc-game').append(game);game.open=true;}
        if(game){
            for(const [attr,labels] of [['data-game-preset',['Calm','Normal','Intense','Full']],['data-game-content',['Colours only','Colours + music']]]){
                const select=game.querySelector(`[${attr}]`),group=document.createElement('div');group.className='ledcc-segments';group.setAttribute('role','group');group.setAttribute('aria-label',attr==='data-game-preset'?'Game intensity':'Game content');
                [...select.options].forEach((option,index)=>{const button=document.createElement('button');button.type='button';button.textContent=labels[index];button.dataset.ledccChoice=attr;button.dataset.value=option.value;button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);});
                const label=select.closest('label');label.hidden=true;label.after(group);
            }
            const cap=document.createElement('label');cap.innerHTML='Game max brightness <input data-game-cap type="range" min="0" max="100" value="100" aria-label="Game Mode max brightness"><output data-game-cap-value>100%</output>';
            cap.querySelector('input').oninput=event=>{api.ledGameMode.maxBrightness=Number(event.target.value)/100;cap.querySelector('output').textContent=event.target.value+'%';};game.querySelector('.led-playback-controls').append(cap);
        }
        // Keep original handlers/root ownership intact when projecting automation controls.
        for(const attr of ['data-led-motion','data-led-sounds','data-movement-volume']){
            const source=game?.querySelector(`[${attr}]`);if(!source)continue;
            const label=source.closest('label'),copy=label.cloneNode(true),input=copy.querySelector('input');input.removeAttribute(attr);input.dataset.ledccMirror=attr;
            input.addEventListener(input.type==='range'?'input':'change',()=>{source.value=input.value;source.checked=input.checked;source.dispatchEvent(new Event(input.type==='range'?'input':'change',{bubbles:true}));});
            label.hidden=true;root.querySelector('.ledcc-automate').append(copy);
        }
        if(controls.mapping)root.querySelector('.ledcc-diagnostics').append(controls.mapping);
        controls.playback.remove();
        api.ledMusicMode.mountDJControls(root.querySelector('.ledcc-dj'));
        const moods=[['Daytime','#ffffff'],['Warm evening','#fff1d6'],['Amber glow','#ffb347'],['Ocean','#40eaff'],['Forest','#42d89c'],['Violet','#a66bff'],['Blue hour','#497bff'],['Red room','#f10404']];
        for(const [name,color] of moods){const button=document.createElement('button');button.type='button';button.className='ledcc-mood';button.innerHTML=`<span>${name}</span><i style="background:${color}"></i>`;button.onclick=()=>{api.ledGameMode.stop();api.ledMusicMode.stop();api.setLedEffect({mode:'solid',period:8});api.setLedColor(color);api.setLedsEnabled(true);this.sync();};root.querySelector('.ledcc-moods').append(button);}
        this.sync();
    }
    select(kind,value){
        const root=this.root;
        if(kind==='tab'){root.querySelectorAll('[data-ledcc-page]').forEach(page=>page.hidden=page.dataset.ledccPage!==value);root.querySelectorAll('[data-ledcc-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ledccTab===value)));}
        else {root.dataset[kind]=value;if(kind==='music'){const dj=root.querySelector('[data-ledcc-music-page="dj"]');root.querySelector('.ledcc-music').before(dj);}
            root.querySelectorAll(`[data-ledcc-${kind}-page]`).forEach(page=>page.hidden=page.getAttribute(`data-ledcc-${kind}-page`)!==value);root.querySelectorAll(`[data-ledcc-${kind}]`).forEach(button=>button.setAttribute('aria-pressed',String(button.getAttribute(`data-ledcc-${kind}`)===value)));}
    }
    open(){
        const overlay=document.getElementById('ef-ar-overlay');(overlay||document.body).append(this.root);
        this.returnFocus=document.activeElement;this.root.hidden=false;this.fitToApp();this.root.querySelector('.ledcc-sheet').focus({preventScroll:true});
        document.querySelector('.hub-led')?.setAttribute('aria-expanded','true');this.sync();
        clearInterval(this.timer);this.timer=setInterval(()=>this.sync(),150);
    }
    fitToApp(){
        if(this.root.hidden)return;
        const dock=document.getElementById('motion-dock'),box=dock?.getBoundingClientRect();if(!box)return;
        // Cover the controller footprint, keeping the model and camera view clear.
        const slot=dock.closest('#demo-remote'),area=slot?.getBoundingClientRect()||box;
        const width=Math.min(area.width,innerWidth),height=Math.max(120,area.height);
        this.root.style.left=Math.max(0,Math.min(area.left,innerWidth-width))+'px';
        this.root.style.top=area.top+'px';this.root.style.width=width+'px';this.root.style.height=height+'px';
        this.root.dataset.compact=String(width<700||height<260);
    }
    close(){this.root.hidden=true;clearInterval(this.timer);document.body.append(this.root);document.querySelector('.hub-led')?.setAttribute('aria-expanded','false');this.returnFocus?.isConnected&&this.returnFocus.focus({preventScroll:true});}
    sync(){
        const root=this.root,api=this.api;
        // AR's floating controller can move or resize while this sheet is open.
        this.fitToApp();
        const power=root.querySelector('[data-led-toggle]');power.textContent=api.ledsEnabled?'LEDs on':'LEDs off';power.setAttribute('aria-pressed',String(api.ledsEnabled));
        const percent=Math.round(api.ledGlow/api.ledFullBrightness*100),glow=root.querySelector('[data-led-glow]');glow.value=percent;root.querySelector('[data-led-brightness-value]').textContent=percent+'%';
        root.querySelector('[data-led-color]').value=api.ledColor;
        api.ledMusicMode.syncDJUI();api.ledGameMode.syncUI();
        const seek=root.querySelector('[data-music-seek]');if(document.activeElement!==seek)seek.value=api.ledMusicMode.audio.currentTime||0;
        const source=api.ledMotionState.source;
        root.querySelector('[data-ledcc-now]').textContent='On the desk now: '+(!api.ledsEnabled?'Off':source==='music'?(api.ledMusicMode.dj.enabled?'Auto DJ · ':'Music · ')+root.querySelector('[data-music-effect] option:checked').textContent:source==='game'?'Game Mode':source==='movement'?'Movement cue':source==='completion'?'Movement complete':api.ledEffect.mode.replaceAll('-',' '));
        root.querySelectorAll('.ledcc-strips i').forEach((swatch,index)=>{const row=api.ledPreviewFrame?.[index];let r=0,g=0,b=0;if(row&&['game','music','movement','completion','diagnostic','effect'].includes(source)){for(let i=0;i<row.length;i+=4){r+=row[i]+row[i+3];g+=row[i+1]+row[i+3];b+=row[i+2]+row[i+3];}const count=row.length/4;r/=count;g/=count;b/=count;swatch.style.background=`rgb(${r} ${g} ${b})`;}else swatch.style.background=api.ledColor;swatch.style.opacity=api.ledsEnabled?'1':'.15';});
        root.querySelectorAll('[data-ledcc-choice]').forEach(button=>button.setAttribute('aria-pressed',String(root.querySelector(`[${button.dataset.ledccChoice}]`).value===button.dataset.value)));
        root.querySelectorAll('[data-ledcc-mirror]').forEach(input=>{const source=root.querySelector(`[${input.dataset.ledccMirror}]`);input.checked=source.checked;input.value=source.value;});
    }
}
