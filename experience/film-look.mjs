// Film look over the live view: when the playhead rests (350 ms, nothing dragging or playing), render a still
// with the real film setup and crossfade it over the 16:9 frame. Any orbit, scrub, edit or play hides it at
// once; the next rest renders again. Modes: live | film | split (a draggable wipe: live left, film right).
// Also: thirds / title-safe guides (G). The overlay sits in the same .film-box as the stage frame.
// 18 Nov 2026: the three modes looked the same to Vico. The first film still takes seconds (the still renderer boots),
// nothing said so, and a rest that came while something was busy (a Render still, a load) was dropped for good. Now the
// badge says what the film side is doing (rendering… n s / waits for …), a busy rest is retried until the view rests,
// Film look ⇄ Split keeps the film still it already has, and Split labels its two sides.
const MODES=['live','film','split'],LABEL={live:'Live',film:'Film look',split:'Split'};
export function createFilmLook({render,resting,busy=null,status=()=>{},onStill=null}){
  let mode='live',guides=false,timer=0,tick=0,generation=0,shownFor=null,wipe=.5,dragging=false;
  // what the film side is doing: idle (live) | waiting (for the view to rest) | rendering | shown | error
  let state='idle',since=0,why='',lastError='',pokes=0,renders=0,lastMs=0;
  const box=document.createElement('div');box.className='film-box film-look';box.setAttribute('aria-hidden','true');
  box.innerHTML='<img alt="" draggable="false"><div class="film-guides"></div><span class="film-live-tag">LIVE</span><span class="film-look-badge"></span><span class="film-wipe" title="Drag to move the wipe"></span>';
  const tools=document.createElement('div');tools.className='film-box film-tools';
  tools.innerHTML=`<div class="film-tools-row">${onStill?'<button data-action="render-still" class="render-still" title="Render the frame at the playhead with the film look: status lights, screens, quality (Shift+R)">Render still</button>':''}<button data-film-guides aria-pressed="false" title="Thirds and title-safe guides (G)">Guides</button><button data-film-mode title="Live / Film look / Split (V)">Live</button></div>`;
  document.body.append(box,tools);
  const img=box.querySelector('img'),badge=box.querySelector('.film-look-badge'),handle=box.querySelector('.film-wipe');
  function sync(){
    document.body.classList.toggle('film-look-split',mode==='split');box.classList.toggle('guides',guides);
    box.dataset.mode=mode;box.dataset.state=state;
    tools.querySelector('[data-film-mode]').textContent=LABEL[mode];tools.querySelector('[data-film-mode]').setAttribute('aria-pressed',String(mode!=='live'));
    tools.querySelector('[data-film-guides]').setAttribute('aria-pressed',String(guides));
    img.style.clipPath=mode==='split'?`inset(0 0 0 ${wipe*100}%)`:'none';handle.style.left=wipe*100+'%';
    box.style.setProperty('--wipe',wipe*100+'%');
  }
  // The badge: the shown still's ("FILM LOOK · 2.40 s · 1.3 s"), else what the film side is waiting on.
  function setState(next,text=''){
    state=next;box.dataset.state=state;clearInterval(tick);
    box.classList.toggle('pending',next==='waiting'||next==='rendering'||next==='error');
    if(next==='rendering'){const draw=()=>{badge.textContent=`FILM LOOK · rendering… ${((performance.now()-since)/1000).toFixed(0)} s`;};draw();tick=setInterval(draw,500);}
    else if(next==='waiting')badge.textContent='FILM LOOK · waits for '+(text||'the view to rest');
    else if(next==='error')badge.textContent='FILM LOOK · failed: '+text;
    else if(next==='shown')badge.textContent=text;
  }
  function hide(){box.classList.remove('shown');shownFor=null;}
  function stop(){generation++;clearTimeout(timer);hide();setState('idle');}
  // Something changed: drop the film frame now, render again once the view rests.
  function poke(){
    pokes++;generation++;clearTimeout(timer);hide();if(mode==='live'){setState('idle');return;}
    const token=generation;setState('waiting');timer=setTimeout(()=>attempt(token),350);
  }
  async function attempt(token){
    if(token!==generation)return;
    // not resting (playing, a Render still, a drag, the chapter loading): try again shortly instead of giving up
    if(!resting()){why=busy?.()||'';setState('waiting',why);timer=setTimeout(()=>attempt(token),300);return;}
    since=performance.now();setState('rendering');
    try{
      const {url,label}=await render();if(token!==generation||!url)return;
      lastMs=performance.now()-since;renders++;img.src=url;
      await img.decode?.().catch(()=>{});if(token!==generation)return;
      shownFor=token;box.classList.add('shown');setState('shown',`FILM LOOK · ${label} · ${(lastMs/1000).toFixed(1)} s`);
    }catch(error){if(token!==generation)return;lastError=error.message;setState('error',error.message);status('Film look: '+error.message,true);}
  }
  function setMode(next){
    const was=mode;mode=next;sync();
    if(next==='live')stop();
    // Film look ⇄ Split: the same film still, only the wipe changes (it is kept, or still on its way)
    else if(was==='live'||state==='idle'||state==='error')poke();
    status(mode==='live'?'Live view: the fast preview.':mode==='film'?'Film look: the frame as the film renders it (film quality, grade, ambient occlusion). It renders whenever the view rests.':'Split: live left, film right. Drag the wipe.');
  }
  const next=()=>MODES[(MODES.indexOf(mode)+1)%MODES.length];
  tools.addEventListener('click',e=>{if(e.target.closest('[data-action=render-still]'))onStill?.();if(e.target.closest('[data-film-mode]'))setMode(next());if(e.target.closest('[data-film-guides]')){guides=!guides;sync();}});
  handle.addEventListener('pointerdown',e=>{dragging=true;handle.setPointerCapture(e.pointerId);e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(!dragging)return;const r=box.getBoundingClientRect();wipe=Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width));sync();});
  handle.addEventListener('pointerup',()=>{dragging=false;});
  sync();
  const api={poke,hide,setMode,cycle:()=>setMode(next()),toggleGuides(){guides=!guides;sync();},mode:()=>mode,shown:()=>shownFor!==null,
    // for the browser tests: what the film side is doing and why
    debug:()=>({mode,state,why,lastError,pokes,renders,lastMs:Math.round(lastMs),wipe}),
    visible(on){box.hidden=tools.hidden=!on;if(!on)stop();else if(mode!=='live')poke();}};
  box.filmLook=api.debug;   // (document.querySelector('.film-look').filmLook(): the browser tests' view of it)
  return api;
}
