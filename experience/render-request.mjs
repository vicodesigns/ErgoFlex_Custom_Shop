// Render tab: "Render preview" — ask the render PC for an MP4 of this chapter or the whole film.
// Send first exports the chapter exactly like Export cut when it has unexported edits (so the render matches the stage),
// then downloads Render-request-<chapter|film>-<res>-<timestamp>.json to the same Downloads folder. A watcher on the desk
// turns that file into a queue job (tools/experience/render-request.sh, protocol in tools/experience/RENDER-QUEUE.md).
export const RESOLUTIONS=['480p','720p','1080p','4K'];
// Frame rate and video format of the render (23 Nov 2026): the render PC encodes the film as an 8-bit H.264 MP4 (plays anywhere), a 10-bit
// HEVC MP4 (smooth gradients, smaller file, newer players) or both. The request carries `fps` (30 | 60: render-cut.cjs --fps, a distinct
// chapter cache) and `format` ('both' | 'hevc' | 'h264'); the render PC reads them from the job (tools/experience/RENDER-QUEUE.md).
export const FPS_OPTIONS=[30,60];
export const FORMATS=[['both','HEVC 10-bit + H.264'],['hevc','HEVC 10-bit only'],['h264','H.264 8-bit only']];
export const FORMAT_SHORT={both:'HEVC + H.264',hevc:'HEVC 10-bit',h264:'H.264'};
export const DEFAULTS={resolution:'720p',fps:60,format:'both'};   // (60 fps and both files: what a render request has always produced)
const SETTINGS_KEY='ergoflex.renderSettings.v1';
// What the page remembers between visits: the quality choices only (never the scope, the note or "re-render every chapter":
// a whole-film 4K request should never be one stale click away).
export function cleanSettings(v){
  const o=v&&typeof v==='object'?v:{};
  return {resolution:RESOLUTIONS.includes(o.resolution)?o.resolution:DEFAULTS.resolution,fps:FPS_OPTIONS.includes(Number(o.fps))?Number(o.fps):DEFAULTS.fps,format:FORMATS.some(f=>f[0]===o.format)?o.format:DEFAULTS.format};
}
export function loadSettings(storage){try{return cleanSettings(JSON.parse(storage.getItem(SETTINGS_KEY)));}catch{return cleanSettings(null);}}
export function saveSettings(storage,v){try{storage.setItem(SETTINGS_KEY,JSON.stringify(cleanSettings(v)));return true;}catch{return false;}}
const next=(list,cur)=>list[(list.indexOf(cur)+1)%list.length];
export const FILM_720_MINUTES=40,FILM_SECONDS=252;                 // whole film at 720p ~40 min (the film is ~252 s)
const COST={'480p':.6,'720p':1,'1080p':1.6,'4K':3};                // render time vs 720p: it is GPU/frame bound, not pixel bound
const BASE_FPS=60;                                                  // (the estimates below are the film's 60 fps ones; 30 fps has half the frames)
const KEY='ergoflex.renderRequests.v1',KEEP=8;
const pad=n=>String(n).padStart(2,'0');

// Minutes the render PC needs once it starts (chapter 720p ~3 min for an 18 s chapter, film 720p ~40 min, film 4K ~2 h).
export function estimateMinutes({scope,resolution,seconds,filmSeconds=FILM_SECONDS,fps=BASE_FPS}){
  const film=FILM_720_MINUTES*(COST[resolution]??1)*((Number(fps)||BASE_FPS)/BASE_FPS);
  if(scope==='film')return film;
  const share=Math.max(0,Number(seconds)||0)/Math.max(1,Number(filmSeconds)||FILM_SECONDS);
  return Math.max(1,film*share);
}
export function waitText(minutes){
  if(minutes<1.5)return 'about 1 min';
  if(minutes<10)return `about ${Math.round(minutes)} min`;
  if(minutes<90)return `about ${Math.round(minutes/5)*5} min`;
  const h=Math.round(minutes/30)/2;return `about ${h} h`;
}
export const stamp=(d=new Date())=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
export const requestFileName=({scope,chapter,resolution,date})=>`Render-request-${scope==='film'?'film':String(chapter).replace(/[^a-z0-9-]+/gi,'-')}-${resolution}-${stamp(date)}.json`;
export async function sha256Hex(text){
  const bytes=new TextEncoder().encode(text);
  if(globalThis.crypto?.subtle){const d=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  let h=0x811c9dc5;for(const b of bytes){h^=b;h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0').repeat(8);   // no SubtleCrypto (plain http off localhost)
}
// v:1 request. `signature` identifies the exact cut the page showed; `exportSha` is the sha256 of the Export cut file sent with it (null when nothing was unexported).
export const makeRequest=({scope,chapter,resolution,fps=DEFAULTS.fps,format=DEFAULTS.format,note,created,signature,exportSha,estimate,force,cut})=>({v:1,scope,chapter,resolution,fps:FPS_OPTIONS.includes(Number(fps))?Number(fps):DEFAULTS.fps,format:FORMATS.some(f=>f[0]===format)?format:DEFAULTS.format,...(cut?{cut}:{}),note:String(note||'').trim().slice(0,300),created:created.toISOString(),signature,exportSha:exportSha||null,estimateMinutes:Math.round(estimate*10)/10,...(force&&scope==='film'?{force:true}:{})});   // force: re-render every chapter instead of reusing the render PC's cache

export function createRenderRequest({panel,chapters,shot,signature,unexported,exportNow,status,escape,storage,now=()=>new Date(),download,settle=900,cut=()=>null,changed=()=>{}}){
  const form={scope:'chapter',...loadSettings(storage),note:'',force:false};let busy=false,result='',recent=[];
  try{recent=JSON.parse(storage.getItem(KEY))||[];if(!Array.isArray(recent))recent=[];}catch{recent=[];}
  const filmSeconds=()=>chapters()?.reduce((n,c)=>n+(Number(c.seconds)||0),0)||FILM_SECONDS;
  const estimate=()=>estimateMinutes({scope:form.scope,resolution:form.resolution,seconds:shot().seconds,filmSeconds:filmSeconds(),fps:form.fps});
  const clock=iso=>new Date(iso).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const remember=r=>{recent=[r,...recent].slice(0,KEEP);try{storage.setItem(KEY,JSON.stringify(recent));}catch{}};
  const summary=()=>`${form.resolution} · ${form.fps} fps · ${FORMAT_SHORT[form.format]}`;
  // One place changes a quality choice (the Render tab's selects and the Render menu's quick items): it is kept for the next visit.
  function setQuality(patch,{announce=false}={}){
    const now=cleanSettings({...form,...patch});form.resolution=now.resolution;form.fps=now.fps;form.format=now.format;
    const kept=saveSettings(storage,now);
    for(const [name,v] of [['render-res',form.resolution],['render-fps',String(form.fps)],['render-format',form.format]]){const el=panel.querySelector(`[name="${name}"]`);if(el&&el.value!==v)el.value=v;}
    refresh();changed();
    if(announce)status(`Final render: ${summary()}.${kept?'':' (This browser would not keep the choice.)'}`);
  }
  const cycle=kind=>setQuality(kind==='fps'?{fps:next(FPS_OPTIONS,form.fps)}:kind==='format'?{format:next(FORMATS.map(f=>f[0]),form.format)}:{resolution:next(RESOLUTIONS,form.resolution)},{announce:true});
  const estimateText=()=>{const e=estimate(),dirty=unexported();return `Render time ${waitText(e)} once the render PC starts it (it checks for requests every minute).${dirty?' Your unexported edits are exported first.':''}`;};
  const recentHTML=()=>recent.length?`<h4>Recent requests</h4><ul class="render-recent">${recent.map(r=>`<li><b>${escape(r.scope==='film'?'Whole film':'Chapter '+r.chapter)}</b> · ${escape(r.resolution)}${r.fps?` · ${escape(r.fps)} fps`:''}${r.format?` · ${escape(FORMAT_SHORT[r.format]||r.format)}`:''} · ${escape(clock(r.created))}${r.note?` <span>${escape(r.note)}</span>`:''}</li>`).join('')}</ul>`:'';
  function refresh(){
    const e=panel.querySelector('[data-render-estimate]');if(e)e.textContent=estimateText();
    const fr=panel.querySelector('[data-render-force-row]');if(fr)fr.hidden=form.scope!=='film';
    const b=panel.querySelector('[data-render-send]');if(b){b.disabled=busy;b.textContent=busy?'Sending…':'Send to render PC';}
    const r=panel.querySelector('[data-render-result]');if(r)r.innerHTML=result;
    const l=panel.querySelector('[data-render-recent]');if(l)l.innerHTML=recentHTML();
  }
  async function send(override=null){
    if(busy)return;busy=true;result='';refresh();
    try{
      const s=shot(),scope=override?.scope==='film'?'film':override?.scope==='chapter'?'chapter':form.scope;
      let exportSha=null,did=false;
      if(unexported()){
        const text=await exportNow();
        if(text==null){status('This tab is older than the film. Settle the Export cut question first, then press Send to render PC again.',true);return;}
        exportSha=await sha256Hex(text);did=true;
        await new Promise(r=>setTimeout(r,settle));   // let the Export cut download leave before the request's
      }
      const created=now(),est=estimateMinutes({scope,resolution:form.resolution,seconds:s.seconds,filmSeconds:filmSeconds(),fps:form.fps}),req=makeRequest({cut:cut(),scope,chapter:s.id,resolution:form.resolution,fps:form.fps,format:form.format,note:form.note,created,signature:(await sha256Hex(signature())).slice(0,16),exportSha,estimate:est,force:scope==='film'&&form.force});
      download(requestFileName({scope,chapter:s.id,resolution:form.resolution,date:created}),JSON.stringify(req,null,2));
      remember({scope:req.scope,chapter:req.chapter,resolution:req.resolution,fps:req.fps,format:req.format,note:req.note,created:req.created,estimate:req.estimateMinutes});
      result=`<b>Queued for the render PC</b> · ${escape(clock(req.created))} · ${escape(waitText(est))} once it starts${did?' · cut exported first':''}`;
      status(`Render request sent: ${scope==='film'?'whole film':'chapter '+s.id}, ${summary()}. Render time ${waitText(est)} once the render PC picks it up.`);
    }catch(error){status(error.message,true);}
    finally{busy=false;refresh();}
  }
  panel.addEventListener('input',e=>{const n=e.target.name;if(n==='render-note')form.note=e.target.value;});
  panel.addEventListener('change',e=>{const n=e.target.name;if(n==='render-scope'){form.scope=e.target.value==='film'?'film':'chapter';refresh();}else if(n==='render-res'){setQuality({resolution:e.target.value});}else if(n==='render-fps'){setQuality({fps:Number(e.target.value)});}else if(n==='render-format'){setQuality({format:e.target.value});}else if(n==='render-force'){form.force=!!e.target.checked;refresh();}else if(n==='render-note')form.note=e.target.value;});
  panel.addEventListener('click',e=>{if(e.target.closest('[data-render-send]'))send();});
  return {
    send,form,recent:()=>recent,cycle,setQuality,summary,settings:()=>({resolution:form.resolution,fps:form.fps,format:form.format,summary:summary()}),
    panel(){
      const s=shot(),opt=(v,label,cur)=>`<option value="${v}" ${v===cur?'selected':''}>${escape(label)}</option>`;
      return `<div data-inspector-page="render"><h3>Render preview</h3>
      <p class="director-hint">Asks the render PC for an MP4 of what you see here. Unexported edits are exported first, so the render matches the stage.</p>
      <fieldset class="chapter-pacing render-box" data-render-box><legend>Render request</legend>
      <div class="director-grid"><label>What to render<select name="render-scope">${opt('chapter',`This chapter (${escape(s.id)})`,form.scope)}${opt('film','Whole film',form.scope)}</select></label><label>Resolution<select name="render-res">${RESOLUTIONS.map(r=>opt(r,r,form.resolution)).join('')}</select></label></div>
      <div class="director-grid"><label>Frame rate<select name="render-fps" title="30 fps renders in about half the time; 60 fps is smoother motion">${FPS_OPTIONS.map(f=>opt(String(f),`${f} fps`,String(form.fps))).join('')}</select></label><label>Video format<select name="render-format" title="H.264 plays everywhere. HEVC 10-bit has smoother gradients and a smaller file, and needs a newer player">${FORMATS.map(([v,l])=>opt(v,l,form.format)).join('')}</select></label></div>
      <p class="director-hint render-quality-note">Your frame rate, format and resolution are remembered on this computer.</p>
      <label class="render-force" data-render-force-row ${form.scope==='film'?'':'hidden'}><input type="checkbox" name="render-force" ${form.force?'checked':''}> Re-render every chapter (otherwise chapters you have not changed reuse their earlier render)</label>
      <label>Note for the render PC<textarea name="render-note" rows="2" maxlength="300" placeholder="e.g. check the new lift move at 6 s">${escape(form.note)}</textarea></label>
      <p class="director-hint render-estimate" data-render-estimate>${escape(estimateText())}</p>
      <div class="director-actions"><button data-render-send class="primary" ${busy?'disabled':''}>${busy?'Sending…':'Send to render PC'}</button></div>
      <p class="render-result" data-render-result role="status">${result}</p>
      <div data-render-recent>${recentHTML()}</div></fieldset></div>`;
    },
    refresh,
  };
}
