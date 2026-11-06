// Film look over the live view: when the playhead rests (350 ms, nothing dragging or playing), render a still
// with the real film setup and crossfade it over the 16:9 frame. Any orbit, scrub, edit or play hides it at
// once; the next rest renders again. Modes: live | film | split (a draggable wipe: live left, film right).
// Also: thirds / title-safe guides (G). The overlay sits in the same .film-box as the stage frame.
const MODES=['live','film','split'],LABEL={live:'Live',film:'Film look',split:'Split'};
export function createFilmLook({render,resting,status=()=>{}}){
  let mode='live',guides=false,timer=0,generation=0,shownFor=null,wipe=.5,dragging=false;
  const box=document.createElement('div');box.className='film-box film-look';box.setAttribute('aria-hidden','true');
  box.innerHTML='<img alt="" draggable="false"><div class="film-guides"></div><span class="film-look-badge"></span><span class="film-wipe" title="Drag to move the wipe"></span>';
  const tools=document.createElement('div');tools.className='film-box film-tools';
  tools.innerHTML='<button data-film-mode title="Live / Film look / Split (F)">Live</button><button data-film-guides aria-pressed="false" title="Thirds and title-safe guides (G)">Guides</button>';
  document.body.append(box,tools);
  const img=box.querySelector('img'),badge=box.querySelector('.film-look-badge'),handle=box.querySelector('.film-wipe');
  function sync(){
    document.body.classList.toggle('film-look-split',mode==='split');box.classList.toggle('guides',guides);
    tools.querySelector('[data-film-mode]').textContent=LABEL[mode];tools.querySelector('[data-film-mode]').setAttribute('aria-pressed',String(mode!=='live'));
    tools.querySelector('[data-film-guides]').setAttribute('aria-pressed',String(guides));
    img.style.clipPath=mode==='split'?`inset(0 0 0 ${wipe*100}%)`:'none';handle.style.left=wipe*100+'%';
  }
  function hide(){box.classList.remove('shown');shownFor=null;}
  // Something changed: drop the film frame now, render again once the view rests.
  function poke(){
    generation++;clearTimeout(timer);hide();if(mode==='live')return;
    const token=generation;timer=setTimeout(async()=>{
      if(token!==generation||!resting())return;const started=performance.now();
      try{const {url,label}=await render();if(token!==generation||!url)return;img.src=url;badge.textContent=`FILM LOOK · ${label} · ${((performance.now()-started)/1000).toFixed(1)} s`;shownFor=token;box.classList.add('shown');}
      catch(error){if(token===generation)status('Film look: '+error.message,true);}
    },350);
  }
  function setMode(next){mode=next;sync();poke();status(mode==='live'?'Live view.':mode==='film'?'Film look: pause anywhere to see the real render.':'Split: live left, film right. Drag the wipe.');}
  tools.addEventListener('click',e=>{if(e.target.closest('[data-film-mode]'))setMode(MODES[(MODES.indexOf(mode)+1)%MODES.length]);if(e.target.closest('[data-film-guides]')){guides=!guides;sync();}});
  handle.addEventListener('pointerdown',e=>{dragging=true;handle.setPointerCapture(e.pointerId);e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(!dragging)return;const r=box.getBoundingClientRect();wipe=Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width));sync();});
  handle.addEventListener('pointerup',()=>{dragging=false;});
  sync();
  return {poke,hide,setMode,cycle:()=>setMode(MODES[(MODES.indexOf(mode)+1)%MODES.length]),toggleGuides(){guides=!guides;sync();},mode:()=>mode,shown:()=>shownFor!==null,
    visible(on){box.hidden=tools.hidden=!on;if(!on)hide();}};
}
