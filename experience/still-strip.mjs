// Render still results inside the 16:9 frame (not a modal): the latest still over the view, a strip of the
// last 12 to flip through, pin one and compare it with the live view (hold \) or with a second still
// (Shift-click: A/B side by side). R renders, Esc closes, ←/→ step, each thumbnail downloads.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStillStrip(){
  const history=[];let pinned=0,compare=null,peeking=false,progressTimer=0;
  const view=document.createElement('div');view.id='film-still';view.className='film-box still-view';view.hidden=true;view.setAttribute('aria-label','Rendered stills');
  view.innerHTML='<div class="still-stage" data-still-stage></div><div class="still-strip" data-still-strip></div><button class="still-close" data-still-close title="Close the still view (Esc); the stills stay in the strip">×</button>';
  const opener=document.createElement('div');opener.className='film-box still-opener';opener.innerHTML='<button data-still-open hidden title="Show the rendered stills">Stills</button>';
  document.body.append(view,opener);
  Object.defineProperty(view,'open',{get:()=>!view.hidden});
  const stage=view.querySelector('[data-still-stage]'),strip=view.querySelector('[data-still-strip]'),openBtn=opener.querySelector('[data-still-open]');
  const clock=d=>d.toTimeString().slice(0,5);
  function show(on){view.hidden=!on;view.toggleAttribute('open',on);openBtn.hidden=on||!history.length;openBtn.textContent=`Stills (${history.length})`;}
  function drawStrip(){
    strip.innerHTML=history.map((h,i)=>`<figure class="still-thumb ${i===pinned?'pinned':''} ${i===compare?'compare':''}" data-still-index="${i}" title="${escape(h.label)} · ${escape(h.detail)} · click to show, Shift-click to compare"><img src="${h.url}" alt=""><figcaption>${escape(h.label)}<span>${escape(h.detail)}</span></figcaption><a class="still-dl" href="${h.url}" download="${escape(h.name)}" title="Download ${escape(h.name)}" data-still-keep>⤓</a></figure>`).join('');
  }
  function draw(){
    const a=history[pinned];if(!a){show(false);return;}const b=compare!==null?history[compare]:null;
    stage.innerHTML=b?`<div class="still-ab"><figure><img src="${a.url}" alt="Still A"><figcaption>A · ${escape(a.label)}</figcaption></figure><figure><img src="${b.url}" alt="Still B"><figcaption>B · ${escape(b.label)}</figcaption></figure></div>`
      :`<img class="still-main" src="${a.url}" alt="Rendered still at ${escape(a.label)}"><div class="still-caption"><span>${escape(a.label)} · ${escape(a.detail)} · ${escape(a.note||'')}</span><a data-still-keep class="primary" href="${a.url}" download="${escape(a.name)}">Download JPG</a></div>`;
    drawStrip();
  }
  view.addEventListener('click',e=>{
    if(e.target.closest('[data-still-keep]'))return;
    if(e.target.closest('[data-still-close]')){show(false);return;}
    const thumb=e.target.closest('[data-still-index]');if(thumb){const i=Number(thumb.dataset.stillIndex);if(e.shiftKey&&i!==pinned)compare=compare===i?null:i;else{pinned=i;compare=null;}draw();return;}
  });
  openBtn.addEventListener('click',()=>{if(history.length){draw();show(true);}});
  return {
    get open(){return !view.hidden;},
    busy(title,detail,{expected=0}={}){
      clearInterval(progressTimer);const started=performance.now();
      stage.innerHTML=`<div class="still-busy"><span class="director-kicker">RENDER STILL</span><p data-still-progress role="status">${escape(title)}</p>${expected?'<div class="still-bar"><i></i></div>':''}<p class="director-hint">${escape(detail)}</p></div>`;
      if(expected){const bar=stage.querySelector('.still-bar i');progressTimer=setInterval(()=>{const f=Math.min(.97,(performance.now()-started)/expected);if(bar)bar.style.width=f*100+'%';},100);}
      drawStrip();show(true);
    },
    progress(text){const p=stage.querySelector('[data-still-progress]');if(p)p.textContent=text;},
    add(item){clearInterval(progressTimer);history.unshift({...item,label:`${item.seconds.toFixed(2)} s · ${clock(new Date())}`,detail:item.after?'after: '+item.after:'no edits since the last still'});history.length=Math.min(history.length,12);pinned=0;compare=null;draw();show(true);},
    error(message){clearInterval(progressTimer);stage.innerHTML=`<div class="still-busy"><span class="director-kicker">RENDER STILL</span><p class="error" role="alert">The still could not be rendered: ${escape(message)}</p></div>`;show(true);},
    close(){clearInterval(progressTimer);show(false);},
    step(d){if(!history.length)return;pinned=(pinned+d+history.length)%history.length;compare=null;draw();show(true);},
    // Hold \ : the live view (or the film look) under the pinned still; release brings the still back.
    peek(on){if(!history.length)return;if(on&&!peeking){peeking=true;if(view.hidden){draw();show(true);peeking='shown';}else view.classList.add('peek');}else if(!on&&peeking){if(peeking==='shown')show(false);view.classList.remove('peek');peeking=false;}},
    count:()=>history.length,
  };
}
