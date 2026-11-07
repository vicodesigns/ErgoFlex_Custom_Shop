import {bakeArchive} from './bake-archive.mjs';
import {bakeCutQueue} from './bake-queue.mjs';
import {loopPreviewTime,resumePreviewTime} from './preview-transport.mjs';
import {BakeCache,bakeKey,bakeDefinition,sourceSnapshot,renderBake,BAKE_PROFILE} from './bake.mjs';
import {score,safeReturn} from './score.mjs';
import {ShotClock} from './timing.mjs';
import {cleanCut,decodeCut} from './cuts.mjs';
import {filmLink,loadFilmChapters,loadFilmShot,liveFilmShot} from './film-chapters.mjs';
import {effectiveDeskEdits} from './desk-edits.mjs';
import {latestFilmCut,withCut,filmFresh} from './film-fresh.mjs';
import {exportLighting} from './film-lighting.mjs';
import {filmCamera} from './film-render.mjs';
import {deskVersions,versionAt,versionShot,loadFilmSubshots,loadStorageSeed} from './desk-versions.mjs';
const $=id=>document.getElementById(id), frame=$('stage'), query=new URLSearchParams(location.search), linkQuery=new URLSearchParams(location.hash.slice(1));
let cut=query.get('cut')==='social'?'social':'full',shots=score(cut),index=-1,playing=true,busy=true,finished=false,generation=0,sound=false,app=null,preparation=Promise.resolve(),hasFrame=false,lastUI=0;
const clock=new ShotClock(),cover=$('transition-frame');
let director=null,directorOpen=false,previewOnly=false,clientCut=null,preparedShot=null,previewRange=null,loopPreview=false;
try{const linked=linkQuery.get('cut');if(linked){clientCut=decodeCut(linked);cut='client';shots=clientCut.shots;}}
catch(error){$('cut-error').hidden=false;$('cut-error').textContent=error.message;}
// A film chapter tab reloaded after an import takes the film's newer cut, not the one its hash was opened with
// (film-fresh.mjs); the hash is rewritten so later reloads stay current. A stage 'ready' that arrives during the
// check is replayed once the message listener below exists.
let earlyReady=null;const holdReady=e=>{if(e.data?.ergoPresentation==='ready')earlyReady=e;};
if(clientCut&&filmLink(location.hash)?.director)try{
  addEventListener('message',holdReady);
  const latest=await Promise.race([latestFilmCut(filmLink(location.hash).film,location.hash),new Promise((_,reject)=>setTimeout(()=>reject(Error('timed out')),15000))]);
  if(latest){filmFresh.state=latest;if(latest.newer){history.replaceState(history.state,'',withCut(location.hash,latest.enc));clientCut=decodeCut(latest.enc);shots=clientCut.shots;}}
}catch(error){console.warn('[film fresh]',error.message);}
finally{removeEventListener('message',holdReady);}
// Film chapter links: the chapter list's "shot" (the full built film shot) dresses the live
// stage with the film's own setup (props, hidden objects, desk finish, screens, room light).
const filmShots=new Map(),film=filmLink(location.hash);
// Chapters the film renders as sub-shots (the finale): their sub-shots file (desk-versions.mjs). The stage shows the
// desk of the sub-shot the Director picked (deskVersion), else the one at the chapter's start.
const filmSubshots=new Map(),deskVersion=new Map();
const subshotsOf=(id,url,s)=>s?.subshots?loadFilmSubshots(url,id).then(list=>filmSubshots.set(id,list)).catch(error=>{console.warn('[desk versions]',error.message);filmSubshots.set(id,null);}):null;
const filmReady=film&&clientCut?loadFilmChapters(film.film).then(list=>Promise.all(list.filter(c=>c.shot&&clientCut.shots.some(s=>s.id===c.id)).map(c=>loadFilmShot(c.shot,c.id).then(s=>{filmShots.set(c.id,s);return subshotsOf(c.id,c.shot,s);})))).catch(error=>console.warn('[film setup]',error.message)):Promise.resolve();
function activeVersion(id){if(deskVersion.has(id))return deskVersion.get(id);const list=deskVersions(filmShots.get(id),filmSubshots.get(id));return list.length?versionAt(list,0):null;}
const filmSetup=id=>{const v=activeVersion(id);return v?.setup||filmShots.get(id);};
// The finale renders with a storage seed (its saved builds are the presets' desks): the stage's memory-only storage
// takes the seed's keys while a desk version is on and gets its own values back after.
const seeds=new Map();let seededKeys=null,fxError=null;
function storageSeed(id){const url=filmSubshots.get(id)?.storage;if(!url)return null;if(!seeds.has(url))seeds.set(url,loadStorageSeed(url).then(values=>({url,values}),error=>{seeds.delete(url);console.warn('[desk versions] seed',error.message);return null;}));return seeds.get(url);}
const seedNow=id=>{const url=filmSubshots.get(id)?.storage,p=url&&seeds.get(url);return p?.done||null;};
function seedStage(seed){
  const win=frame.contentWindow;if(!win?.__ERGO_PRESENTATION__)return;const ls=win.localStorage;
  if(seededKeys){for(const [k,v] of seededKeys)if(v===null)ls.removeItem(k);else ls.setItem(k,v);seededKeys=null;}
  if(!seed)return;seededKeys=new Map();for(const [k,v] of Object.entries(seed.values)){seededKeys.set(k,ls.getItem(k));ls.setItem(k,v);}
}
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const track=new Audio('../assets/led/music/neon-flight-demo.mp3');track.loop=true;track.volume=.32;
if(clientCut)track.volume=clientCut.volume;
const bakeCache=new BakeCache(),bakedVideo=$('baked-stage');
let activeBake=null,bakedURL=null,bakeController=null,bakeQueue=null,bakeStatus={state:'none',available:false,progress:0},preferBaked=true,bakeCheck=0,bakeRefreshTimer=null;
function cacheSource(){try{return sourceSnapshot(localStorage);}catch{return 'storage-unavailable';}}
async function cachedBake(shot){const key=await bakeKey(shot,cacheSource());return {key,record:await bakeCache.get(key)};}
function clearBaked(){bakedVideo.pause();bakedVideo.hidden=true;bakedVideo.removeAttribute('src');bakedVideo.load();if(bakedURL)URL.revokeObjectURL(bakedURL);bakedURL=null;activeBake=null;document.body.classList.remove('baked-playback');}
async function showBaked(record,position){
  clearBaked();bakedURL=URL.createObjectURL(record.blob);bakedVideo.src=bakedURL;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('The baked video could not load.'));},15000),cleanup=()=>{clearTimeout(timer);bakedVideo.removeEventListener('loadeddata',done);bakedVideo.removeEventListener('error',fail);},done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('The baked video could not decode.'));};bakedVideo.addEventListener('loadeddata',done,{once:true});bakedVideo.addEventListener('error',fail,{once:true});bakedVideo.load();});
  if(position)bakedVideo.currentTime=position*record.seconds;
  activeBake=record;bakedVideo.hidden=false;document.body.classList.add('baked-playback');stage().edit(false);stage().pause(true);
}
function captureOutgoing(){
  if(activeBake&&bakedVideo.readyState>=2){cover.width=bakedVideo.videoWidth;cover.height=bakedVideo.videoHeight;cover.getContext('2d',{alpha:false}).drawImage(bakedVideo,0,0);}
  else stage().capture(cover);
}
async function refreshBakeStatus(){
  if(bakeController||bakeQueue||index<0)return;const token=++bakeCheck,shot=shots[index];
  try{const {record}=await cachedBake(shot);if(token!==bakeCheck||shots[index]!==shot||bakeController)return;
    const stale=bakeStatus.chapterId===shot.id&&(bakeStatus.available||bakeStatus.state==='stale');bakeStatus={chapterId:shot.id,state:record?'ready':stale?'stale':'none',available:!!record,progress:0,persisted:record?.persisted,bytes:record?.blob.size||0};director?.transportChanged();
  }catch{if(token===bakeCheck){bakeStatus={state:'none',available:false,progress:0};director?.transportChanged();}}
}
async function liveAt(position){playing=false;await playShot(index,{position,forceLive:true});}
let synth;
function chime(final=false){
  if(!sound)return;
  try{synth ||= new AudioContext();synth.resume();const now=synth.currentTime;
    for(const [i,hz]of (final?[130.81,196,261.63,392]:[261.63,523.25]).entries()){
      const oscillator=synth.createOscillator(),gain=synth.createGain();oscillator.type='sine';oscillator.frequency.value=hz;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.025,now+.04+i*.03);gain.gain.exponentialRampToValueAtTime(.0001,now+(final?2.4:.8));
      oscillator.connect(gain);gain.connect(synth.destination);oscillator.start(now);oscillator.stop(now+3);
    }
  }catch{}
}
const stage=()=>frame.contentWindow.ErgoPresentation;
// ?perf=1: where the time goes while editing (Director seeks, film-fx frames), summed every 2 s in the console.
const perf=query.get('perf')==='1',perfSum={seek:0,n:0,fx:0,fxn:0};let perfAt=performance.now(),perfBusy=false;
function perfNote(kind,ms){if(kind==='seek'){perfSum.seek+=ms;perfSum.n++;}else{perfSum.fx+=ms;perfSum.fxn++;}
  if(performance.now()-perfAt>2000){const parts=Object.entries(perfSum).filter(([k])=>k.startsWith('fx:')).map(([k,v])=>`${k.slice(3)} ${(v/Math.max(1,perfSum.fxn)).toFixed(1)}`).join(', ');console.log(`[perf] ${perfSum.n} seeks ${(perfSum.seek/Math.max(1,perfSum.n)).toFixed(1)} ms each · ${perfSum.fxn} film-fx frames ${(perfSum.fx/Math.max(1,perfSum.fxn)).toFixed(1)} ms each (${parts})`);perfAt=performance.now();for(const k of Object.keys(perfSum))perfSum[k]=0;}}
let fxLast=0,fxScreensAt=0,fxScrubbed=false,liveFx=null,fxShot=null,fxAt=-1,fxPending=null,fxLights=null,fxTimer=null;
// Film layers the Director edits in place (film-fx update): lighting and its prop edits.
const lightsKey=s=>{const l=exportLighting(s);return JSON.stringify([l.ledStatus,l.ledNeutral,l.ledColor,l.sceneGlobals,l.lights,l.lightEdits,l.timeOfDay,l.propEdits,l.brandingEdits,l.deskEdits]);};
// film-fx resolves 'three' through the stage page's import map, so it loads inside the stage frame.
async function stageFx(){
  const win=frame.contentWindow;if(win.__filmFx)return win.__filmFx;
  await new Promise((resolve,reject)=>{win.__filmFxDone=resolve;win.__filmFxFail=reject;const s=win.document.createElement('script');s.type='module';s.textContent="import('/tools/experience/film-fx.mjs').then(m=>{window.__filmFx=m;window.__filmFxDone();},e=>window.__filmFxFail(e));";win.document.head.append(s);});
  return win.__filmFx;
}
// Film chapters: the live camera is the film's (film-render.mjs filmCamera, what Render still and the 4K use):
// the Director keys baked through the film shot's cameraPlan. Re-baked only when the keys or the length change.
function filmCameraBake(setup){
  let last=null,out=null;
  return (keys,seconds)=>{const key=JSON.stringify([keys,seconds]);if(key!==last){out=filmCamera(setup,keys,seconds).camera.keys;last=key;}return out;};
}
// The renderer's order around prepare: clear, beforePrepare, prepare, unhookPreset, install.
async function prepareStage(next){
  await filmReady;await fxRefresh;while(fxBusy)await fxRefresh;await fxPending;const version=activeVersion(next.id),setup=filmSetup(next.id),fx=setup?await stageFx().catch(error=>{console.warn('[film fx]',error.message);return null;}):frame.contentWindow.__filmFx;
  liveFx=null;fxShot=null;frame.contentWindow.__directorLightsRestore?.();frame.contentWindow.__directorPropsRestore?.();fx?.clear();
  stage().filmCamera?.(setup?filmCameraBake(setup):null);
  next=versionShot(next,version);
  if(setup&&next.deskEdits===undefined&&setup.sceneDeskEdits?.length)next={...next,deskEdits:effectiveDeskEdits(setup,next)};   // an import's room-desk clips (desk-choreo.mjs)
  const seed=version?await storageSeed(next.id):null;if(seed)seeds.get(seed.url).done=seed;seedStage(seed);
  if(!setup||!fx)return stage().prepare(next);
  const shot=liveFilmShot(setup,next);fx.beforePrepare(shot);
  let result;try{result=await stage().prepare(next);}finally{fx.unhookPreset();}
  fxError=null;try{await fx.install(shot);liveFx=fx;fxShot=next.id;fxAt=-1;fxLights=lightsKey(next);director?.filmApplied?.();}catch(error){console.error('[film fx]',error);fx.clear();fxError=error.message;director?.setStatus('The film setup could not be applied: '+error.message);}
  return result;
}
// Lighting edits re-install the film layers (no re-prepare), so the live strips follow the Director.
// Lighting edits update the film layers in place (film-fx update): no clear(), so props, screens and scene
// edits stay. Slow paths (new daypart modes, a full re-install) hold the last frame until the new setup is in.
// Requests coalesce: one update in flight, the latest cut applied when it finishes.
let fxRefresh=Promise.resolve(),fxBusy=false,fxAgain=false;
function refreshFilmLights(){if(fxBusy){fxAgain=true;return fxRefresh;}fxBusy=true;fxRefresh=(async()=>{try{do{fxAgain=false;await reinstallFilmLights();}while(fxAgain);}finally{fxBusy=false;}})();return fxRefresh;}
async function reinstallFilmLights(){
  // Not under a Director gizmo drag: the dragged light would jump back mid-gesture.
  while(frame.contentWindow.__directorDragging)await new Promise(r=>setTimeout(r,100));
  await fxPending;const s=shots[index],setup=s&&filmSetup(s.id),fx=liveFx;if(!fx||busy||!setup||s.id!==fxShot||activeBake||bakeController)return;
  const shot=liveFilmShot(setup,s);let held=false;const hold=()=>{if(!held){held=true;stage().hold?.(true);}};
  liveFx=null;
  try{
    frame.contentWindow.__directorLightsRestore?.();frame.contentWindow.__directorPropsRestore?.();
    let result='full';try{result=fx.update?await fx.update(shot,{onSlow:hold}):'full';}catch(error){console.error('[film fx] update',error);}
    if(result==='full'){hold();fx.clear();await fx.install(shot);}
    liveFx=fx;fxAt=-1;director?.filmApplied?.();
  }catch(error){console.error('[film fx]',error);}
  finally{if(held)stage().hold(false);}
}
// Time-varying film parts (screens, time of day, keyed lights) follow the chapter clock.
function filmFrame(){
  requestAnimationFrame(filmFrame);
  if(!liveFx||fxPending||busy||index<0||activeBake||bakeController||shots[index]?.id!==fxShot)return;
  const s=shots[index],at=clock.progress(performance.now(),s.seconds)*s.seconds,fx=liveFx,now=performance.now(),scrubbing=director?.scrubbing?.();
  if(scrubbing&&now-fxLast<100)return;if(!scrubbing&&fxScrubbed){fxScrubbed=false;fxAt=-1;}if(scrubbing)fxScrubbed=true;
  if(Math.abs(at-fxAt)<1/30)return;fxLast=now;stage()?.wake?.();
  const drawScreens=!scrubbing&&(!playing||now-fxScreensAt>=250);if(drawScreens)fxScreensAt=now;
  fxAt=at;const fxStart=performance.now(),timing=perf?{}:null;fxPending=fx.frame(at,at,{video:false,screens:drawScreens,timing}).then(()=>{fx.after();if(perf){perfNote('fx',performance.now()-fxStart);for(const [k,v] of Object.entries(timing))perfSum['fx:'+k]=(perfSum['fx:'+k]||0)+v;}}).catch(error=>console.warn('[film fx]',error.message)).finally(()=>{fxPending=null;});
}
requestAnimationFrame(filmFrame);
const seen=()=>{try{localStorage.setItem('ergoflex.cinematicSeen.v1','1');}catch{}};
const returnTo=safeReturn(query.get('return'),location.href);
function exit(){seen();track.pause();location.assign(returnTo);}
function chapters(){
  $('chapters').replaceChildren(...shots.map((s,i)=>{const b=document.createElement('button');b.title=s.title;b.setAttribute('aria-label',`Play ${s.title}`);b.onclick=()=>{previewOnly=directorOpen;playing=true;playShot(i);};return b;}));
  $('cut').textContent=cut==='client'?'Original story':cut==='full'?'30-second reel':'85-second story';$('progress').max=shots.reduce((a,s)=>a+s.seconds,0);
  $('eyebrow').textContent=cut==='client'?`${clientCut.name}${clientCut.client?' · '+clientCut.client:''}`:'ONE DESK. A DAY OF POSSIBILITIES.';
  const total=Number($('progress').max);$('time').textContent=`0:00 / ${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}
function caption(s,t){
  const demo=$('demo');demo.hidden=!['wellness','proximity','music'].includes(s.kind);
  const exercise=$('exercise'), show=s.kind==='wellness'&&t>.48;
  if(exercise.hidden===show){exercise.hidden=!show;if(show)exercise.play().catch(()=>{});else exercise.pause();}
  if(s.kind==='wellness'){
    $('demo-title').textContent=t<.3?'Ready for a movement break?':t<.7?'Let’s stand together.':'Breathe. Relax. Reset.';
    $('demo-detail').textContent=t<.3?'Coach reminder · demonstration':t<.7?'Demo accepted · desk rising to standing height':'A preview from your guided movement library.';
  }
  if(s.kind==='proximity'){
    $('demo-title').textContent=t<.2?'Pylons detected':t<.55?'Scanning the space':t<.8?'Clearance check':'Stopped before contact';
    $('demo-detail').textContent='Simulated scan · no physical desk connected';
  }
  if(s.kind==='music'){$('demo-title').textContent=sound?'Audio-reactive LEDs':'Colour in motion';$('demo-detail').textContent=sound?'The bundled track drives the desk lighting.':'Turn sound on for the music-reactive demonstration.';}
}
async function playShot(i,{position=0,forceLive=false,range=null}={}){
  if(bakeController)return false;
  const token=++generation;
  clock.setRunning(false,performance.now());
  // Keep the last fully rendered room on screen while its successor loads.
  // A single bitmap avoids the cost of a second live 3D renderer.
  if(hasFrame&&!busy){
    cover.getAnimations().forEach(a=>a.cancel());
    try{captureOutgoing();cover.hidden=false;cover.style.opacity='1';}catch{cover.hidden=true;}
  }
  index=i;previewRange=range;finished=false;busy=true;bakedVideo.pause();director?.transportChanged();
  $('enter').hidden=true;$('demo').hidden=true;document.body.classList.add('loading');document.body.dataset.transition=hasFrame?'holding':'initial';
  $('loading').firstChild.textContent=`Setting the scene · ${shots[i].room==='product'?'ErgoFlex':shots[i].room}`;
  const slow=setTimeout(()=>{if(token===generation&&busy)document.body.classList.add('loading-slow');},1400);
  if(!hasFrame){$('title').textContent=shots[i].title;$('detail').textContent=shots[i].detail;}
  $('progress').value=shots.slice(0,i).reduce((a,s)=>a+s.seconds,0);
  for(const [j,b] of [...$('chapters').children].entries())b.setAttribute('aria-current',String(i===j));
  try{
    stage().edit(false);
    await nextPaint();
    const next=shots[i];
    let record=null;
    if(preferBaked&&!forceLive&&!reduced.matches){try{record=(await cachedBake(next)).record;}catch{}}
    if(token!==generation)return;
    if(record){try{await showBaked(record,position);}catch{record=null;clearBaked();}}
    if(!record){
      preparation=preparation.catch(()=>{}).then(()=>token===generation?prepareStage(next):null);
      await preparation;if(token!==generation)return;clearBaked();
      stage().reduced(reduced.matches);stage().pause(false);stage().tick(position);stage().pause(!playing||document.hidden);
    }
    if(token!==generation)return;
    preparedShot=JSON.stringify(next);
    clock.reset(performance.now(),playing&&!document.hidden);clock.seek(position*next.seconds,performance.now());
    caption(shots[i],position);if(directorOpen)director?.progress(position);
    $('title').textContent=shots[i].title;$('detail').textContent=shots[i].detail;
    document.body.classList.remove('loading','loading-slow');document.body.classList.add('has-frame');busy=false;hasFrame=true;
    document.querySelector('main').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduced.matches?0:500,easing:'cubic-bezier(.22,1,.36,1)'});
    if(!cover.hidden){
      document.body.dataset.transition='blending';
      const dissolve=cover.animate([{opacity:1},{opacity:0}],{duration:reduced.matches?0:(shots[i].transition??.8)*1000,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      dissolve.finished.then(()=>{if(token===generation){cover.hidden=true;document.body.dataset.transition='idle';dissolve.cancel();}}).catch(()=>{});
    }else document.body.dataset.transition='idle';
    $('pause').textContent=playing?'Pause':'Play';
    if(directorOpen&&!playing&&!activeBake)stage().edit(true);
    frame.inert=!directorOpen||playing;
    syncAudio();refreshBakeStatus();if(playing)chime();
    return true;
  }catch(error){
    console.error('[Cinematic chapter]',error.stack||error.message);
    if(token!==generation)return;
    busy=false;playing=false;document.body.classList.remove('loading','loading-slow');document.body.dataset.transition='error';
    $('title').textContent='Your workspace is ready.';$('detail').textContent=`This scene could not load: ${error.message}. You can skip to the builder or open the app.`;
    $('enter').hidden=false;$('pause').textContent='Retry';director?.transportChanged();
    return false;
  }finally{clearTimeout(slow);}
}
function syncAudio(){
  director?.transportChanged();
  if(activeBake){if(playing&&!busy&&!document.hidden)bakedVideo.play().catch(error=>{bakeStatus={state:'error',available:false,error:error.message};liveAt(clock.progress(performance.now(),shots[index].seconds));});else bakedVideo.pause();}
  if(sound&&playing&&!busy&&!finished&&!document.hidden){track.play().catch(()=>{sound=false;$('sound').textContent='Sound off';});}else track.pause();
  // The gaming chapter uses the viewer's own analyser and music transport.
  if(shots[index]?.kind==='music'&&sound&&!activeBake)track.pause();
  stage()?.sound(sound&&playing&&!busy&&!activeBake).catch(()=>{});
  if(!playing||busy||document.hidden)$('exercise').pause();else if(!$('exercise').hidden)$('exercise').play().catch(()=>{});
}
function end(){clock.setRunning(false,performance.now());finished=true;playing=false;seen();track.pause();stage().sound(false);stage().tick(1);stage().pause(true);bakedVideo.pause();chime(true);$('enter').hidden=false;$('pause').textContent='Play';$('demo').hidden=true;}
function draw(now){
  if(!busy&&playing&&!finished&&!document.hidden){const s=shots[index],elapsed=clock.seconds(now),limit=previewRange?previewRange.end/s.seconds:1,t=Math.min(limit,clock.progress(now,s.seconds));
    // The 3D loop reads this same clock at render time. DOM labels need only
    // ten updates per second and never drive the physical desk pose.
    if(now-lastUI>=100||t>=limit){lastUI=now;caption(s,t);if(directorOpen)director?.progress(t);
      const total=shots.reduce((a,s)=>a+s.seconds,0),value=shots.slice(0,index).reduce((a,s)=>a+s.seconds,0)+Math.min(elapsed,s.seconds);
      $('progress').value=value;const format=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;$('time').textContent=`${format(value)} / ${format(total)}`;
      if(query.has('stats')){const stats=stage().performance();$('performance').hidden=false;$('performance').textContent=`${stats.fps} fps · p95 ${Math.round(stats.p95)} ms`;}
    }
    if(t>=limit){if(previewOnly&&directorOpen&&loopPreview){
      const next=loopPreviewTime(elapsed,previewRange?.start||0,limit*s.seconds);
      clock.seek(next,now);
      if(activeBake){bakedVideo.currentTime=next;bakedVideo.play().catch(()=>{});}else stage().tick(next/s.seconds);
      director?.progress(next/s.seconds);caption(s,next/s.seconds);
    }else if(previewOnly){clock.setRunning(false,now);clock.seek(limit*s.seconds,now);stage().tick(limit);playing=false;stage().pause(true);$('pause').textContent='Play';if(directorOpen){if(!activeBake)stage().edit(true);frame.inert=!!activeBake;director.setStatus(previewRange?previewRange.label+' preview complete.':'Chapter preview complete. You can adjust the camera or poses.');}syncAudio();}else if(index+1<shots.length)playShot(index+1);else end();}
  }
  requestAnimationFrame(draw);
}
$('skip').onclick=exit;
$('sound').onclick=()=>{sound=!sound;if(!sound)synth?.suspend();else chime();$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));syncAudio();};
$('pause').onclick=()=>{if(directorOpen){director.toggleChapter();return;}if($('pause').textContent==='Retry'){playing=true;playShot(index);return;}if(finished){playing=true;playShot(0);}else playing=!playing;clock.setRunning(playing&&!busy&&!document.hidden,performance.now());if(directorOpen)stage()?.edit(!playing);stage()?.pause(!playing);frame.inert=!directorOpen||playing;$('pause').textContent=playing?'Pause':'Play';syncAudio();};
$('replay').onclick=()=>{previewOnly=false;playing=true;playShot(0);};
$('cut').onclick=()=>{director?.close();previewOnly=false;cut=cut==='full'?'social':'full';clientCut=null;shots=score(cut);chapters();playing=true;playShot(0);};
document.addEventListener('visibilitychange',()=>{clock.setRunning(!document.hidden&&playing&&!busy&&!finished,performance.now());stage()?.pause(activeBake||document.hidden||!playing);syncAudio();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.querySelector('dialog[open]'))return;if(directorOpen){e.preventDefault();director.close();return;}if(app){app.remove();app=null;stage().pause(false);}else exit();}if(e.code==='Space'&&e.target===document.body){e.preventDefault();$('pause').click();}});
function openApp(){
  seen();playing=false;track.pause();stage().sound(false);stage().pause(true);
  clock.setRunning(false,performance.now());
  if(app)return;
  app=document.createElement('section');app.className='app-shell';app.setAttribute('aria-label','ErgoFlex interactive app');
  app.innerHTML='<header><span class="brand">ErgoFlex</span><nav><button data-size>Compact app</button><button data-collapse>Collapse</button><button data-builder>Open builder ↗</button></nav></header><iframe title="ErgoFlex polished app and onboarding" src="../app-reference/" allow="autoplay; fullscreen; microphone; display-capture; xr-spatial-tracking"></iframe>';
  document.body.append(app);
  app.querySelector('[data-size]').onclick=()=>{app.classList.toggle('compact');app.classList.remove('collapsed');app.querySelector('[data-size]').textContent=app.classList.contains('compact')?'Expand app':'Compact app';stage().pause(!app.classList.contains('compact'));};
  app.querySelector('[data-collapse]').onclick=()=>{app.classList.add('compact');app.classList.toggle('collapsed');app.querySelector('[data-collapse]').textContent=app.classList.contains('collapsed')?'Open app':'Collapse';stage().pause(false);};
  app.querySelector('[data-builder]').onclick=exit;
}
$('enter').onclick=openApp;
function applyClient(value){
  clientCut=cleanCut(value);shots=clientCut.shots;cut='client';track.volume=clientCut.volume;chapters();
  if(index>=shots.length)index=shots.length-1;
  if(!busy&&shots[index]){$('title').textContent=shots[index].title;$('detail').textContent=shots[index].detail;}
  document.title=clientCut.name+' — ErgoFlex';
}
// Chapter transport shares the rendering clock: pauses retain the exact sample.
async function toggleChapter(value,i){
  if(busy)return;
  const same=index===i&&shots[index]?.id===value.shots[i]?.id,now=performance.now();
  if(same&&playing){
    playing=false;clock.setRunning(false,now);if(activeBake){await liveAt(clock.progress(now,shots[i].seconds));syncAudio();return;}stage().edit(true);stage().pause(true);frame.inert=false;
    $('pause').textContent='Play';director?.progress(clock.progress(now,shots[i].seconds));syncAudio();return;
  }
  previewRange=null;
  let position=same?clock.progress(now,shots[i].seconds):0;if(position>=1)position=0;
  applyClient(value);previewOnly=true;finished=false;playing=true;
  const available=preferBaked&&!reduced.matches?(await cachedBake(shots[i])).record:null;
  if(available||activeBake||!same||preparedShot!==JSON.stringify(shots[i])){await playShot(i,{position});return;}
  if(position===0)clock.seek(0,now);
  clock.setRunning(!document.hidden,now);stage().edit(false);stage().pause(false);stage().tick(position);
  frame.inert=true;$('pause').textContent='Pause';$('enter').hidden=true;director?.progress(position);syncAudio();
}
async function bakeChapter(value,i){
  if(bakeController){bakeController.abort();return;}
  if(busy)throw Error('Wait for the chapter to finish loading.');
  const same=index===i,position=same?clock.progress(performance.now(),shots[index].seconds):0;
  playing=false;clock.setRunning(false,performance.now());applyClient(value);
  if(activeBake||!same||preparedShot!==JSON.stringify(shots[i])){if(!await playShot(i,{position,forceLive:true}))throw Error('The chapter could not be prepared for baking.');}
  bakeController=new AbortController();busy=true;++bakeCheck;const shot=structuredClone(shots[i]);
  const priorBakeStatus={...bakeStatus};bakeStatus={chapterId:shot.id,state:'baking',available:false,progress:0};stage().edit(false);stage().pause(true);syncAudio();
  for(const id of ['director','pause','cut','replay','enter'])$(id).disabled=true;for(const button of $('chapters').children)button.disabled=true;
  try{
    captureOutgoing();cover.hidden=false;cover.style.opacity='1';
    const key=await bakeKey(shot,cacheSource());
    const blob=await renderBake(stage(),shot,{signal:bakeController.signal,progress:value=>{bakeStatus.progress=value;director?.transportChanged();}});
    const record={key,chapterId:shot.id,definition:bakeDefinition(shot),blob,seconds:shot.seconds,...BAKE_PROFILE,created:Date.now()};
    if(bakeQueue)bakeCache.protectedKeys.add(key);
    const persisted=await bakeCache.put(record);bakeStatus={chapterId:shot.id,state:'ready',available:true,persisted,bytes:blob.size,progress:1};
    director?.setStatus(persisted?'Chapter baked and saved in this browser. Play now uses the rendered video.':'Chapter baked for this session. Storage is unavailable; download the video to keep it.');
  }catch(error){bakeStatus=error.name==='AbortError'?priorBakeStatus:{...priorBakeStatus,chapterId:shot.id,state:'error',progress:0,error:error.message};director?.setStatus(error.name==='AbortError'?'Bake cancelled. The chapter remains editable.':'Bake failed: '+error.message);}
  finally{
    bakeController=null;busy=false;cover.hidden=true;stage().edit(true);stage().seek(position);stage().pause(true);frame.inert=false;
    clock.reset(performance.now(),false);clock.seek(position*shot.seconds,performance.now());$('pause').textContent='Play';director?.progress(position);syncAudio();
    for(const id of ['director','pause','cut','replay','enter'])$(id).disabled=false;for(const button of $('chapters').children)button.disabled=false;
  }
}
async function bakeFullIntro(value){
  if(bakeQueue){bakeQueue.cancelled=true;bakeController?.abort();return false;}
  if(busy||bakeController)throw Error('Wait for the current chapter or bake to finish.');
  const cut=structuredClone(value),queue={cancelled:false,index:0,total:cut.shots.length,completed:0};bakeQueue=queue;
  preferBaked=true;clearTimeout(bakeRefreshTimer);director?.transportChanged();
  try{
    const source=cacheSource(),keys=await Promise.all(cut.shots.map(s=>bakeKey(s,source)));bakeCache.protect(keys);
    const result=await bakeCutQueue(cut.shots,{
      cancelled:()=>queue.cancelled,
      progress:p=>{Object.assign(queue,p);bakeStatus={state:'none',available:false,progress:0};director?.setStatus('Baking full intro · chapter '+(p.index+1)+' of '+p.total+' · '+cut.shots[p.index].title);director?.transportChanged();},
      cached:async(s,i)=>!!await bakeCache.get(keys[i]),
      render:async(s,i)=>{
        await bakeChapter(cut,i);
        if(!queue.cancelled&&bakeStatus.state!=='ready')throw Error(bakeStatus.error||'Chapter '+(i+1)+' did not finish baking.');
      }
    });
    if(result.cancelled){director?.setStatus('Full-intro bake cancelled. Completed chapters are kept; Bake full intro resumes the remaining work.');return false;}
    director?.setStatus('Full intro baked at 1080p / 30 fps. Starting playback.');return true;
  }finally{bakeQueue=null;director?.transportChanged();}
}
let mountingDirector=false;
async function openDirector(){
  if(mountingDirector)return;
  if(director){if(director.isOpen())director.close();else director.open();return;}
  mountingDirector=true;
  try{
  const {mountDirector}=await import('./director.mjs');
  director=mountDirector({
    stage,
    ready:()=>!busy,
    filmShot:id=>filmShots.get(id)||null,
    filmSubshots:id=>filmSubshots.get(id)||null,deskVersion:id=>activeVersion(id),deskStorage:id=>activeVersion(id)?seedNow(id):null,
    // A different desk version: re-prepare the stage with that sub-shot's film shot at the same position (the cover
    // holds the last frame meanwhile), playing on if it was playing.
    async setDeskVersion(value,i,version){
      if(bakeController||busy)throw Error('Wait for this chapter to finish loading.');
      const id=value.shots[i]?.id;if(!id)return false;deskVersion.set(id,version||null);
      const position=index===i?Math.min(1,clock.progress(performance.now(),shots[index].seconds)):0;applyClient(value);
      if(!await playShot(i,{position,forceLive:true,range:previewRange}))throw Error('The chapter could not be loaded with this desk.');
      if(fxError)throw Error('the film setup could not be applied: '+fxError);return true;
    },
    playback:()=>({playing,busy,index,range:previewRange,loop:loopPreview}),toggleChapter,
    setPreviewLoop(on){loopPreview=!!on;director?.transportChanged();},
    async previewRange(value,i,range){
      if(busy)throw Error('Wait for this chapter to finish loading.');
      if(playing&&index===i&&previewRange?.id===range.id){await toggleChapter(value,i);return;}
      const seconds=value.shots[i].seconds,start=Math.max(0,Math.min(seconds,range.start)),end=Math.min(seconds,range.end);
      if(end<=start)throw Error('Select a movement with a positive duration.');
      const same=index===i&&preparedShot===JSON.stringify(value.shots[i])&&!activeBake;
      const position=same&&previewRange?.id===range.id?resumePreviewTime(clock.seconds(performance.now()),start,end):start;
      applyClient(value);previewOnly=true;finished=false;playing=true;
      if(same){
        previewRange={...range,start,end};const now=performance.now();clock.seek(position,now);clock.setRunning(!document.hidden,now);
        stage().edit(false);stage().pause(document.hidden);stage().tick(position/seconds);frame.inert=true;
        $('pause').textContent='Pause';director?.progress(position/seconds);director?.transportChanged();syncAudio();
      }else await playShot(i,{position:position/seconds,forceLive:true,range:{...range,start,end}});
    },
    bakeState:()=>({...bakeStatus,batch:bakeQueue?{...bakeQueue}:null,baking:!!bakeController||!!bakeQueue,using:!!activeBake,enabled:preferBaked}),bake:bakeChapter,bakeAll:bakeFullIntro,cancelBake:()=>{if(bakeQueue)bakeQueue.cancelled=true;bakeController?.abort();},
    useBaked(on){preferBaked=on;if(activeBake&&!on)liveAt(clock.progress(performance.now(),shots[index].seconds));director?.transportChanged();},
    async downloadAllBakes(value){
      const cut=structuredClone(value),records=[];
      for(const s of cut.shots){const {record}=await cachedBake(s);if(!record)throw Error('Bake the full intro before exporting; '+s.title+' needs a bake.');records.push(record);}
      const blob=await bakeArchive(cut,records),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ergoflex-intro-bakes.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),120000);
    },
    async downloadBake(){const {record}=await cachedBake(shots[index]);if(!record)throw Error('Bake this chapter first.');const url=URL.createObjectURL(record.blob),a=document.createElement('a');a.href=url;a.download='ergoflex-'+shots[index].id+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},
    editMode(on){if(bakeController)return;directorOpen=on;if(!on)previewOnly=false;playing=false;clock.setRunning(false,performance.now());stage().edit(on);stage().pause(true);frame.inert=!on;$('pause').textContent='Play';$('director').textContent=on?'Close editor':'Director Mode';syncAudio();},
    update(value){stage()?.wake?.();const position=index>=0?clock.progress(performance.now(),shots[index].seconds):0;applyClient(value);
      if(fxShot&&shots[index]?.id===fxShot){const key=lightsKey(shots[index]);if(key!==fxLights){fxLights=key;cancelAnimationFrame(fxTimer);fxTimer=requestAnimationFrame(()=>refreshFilmLights());}}clearTimeout(bakeRefreshTimer);bakeRefreshTimer=setTimeout(refreshBakeStatus,200);if(activeBake){liveAt(position);return;}if(shots[index]){stage().secondsTrack?.(shots[index].seconds,shots[index].id);stage().cameraTrack(shots[index].camera,shots[index].id);stage().motionTrack(shots[index].motion,shots[index].id);stage().deskEditsTrack?.(effectiveDeskEdits(filmSetup(shots[index].id),shots[index]),shots[index].id);}if(directorOpen){playing=false;clock.setRunning(false,performance.now());stage().edit(true);frame.inert=false;$('pause').textContent='Play';syncAudio();}},
    async editShot(value,i){applyClient(value);previewOnly=true;playing=false;if(!await playShot(i,{forceLive:true}))throw Error('The chapter could not be loaded. Choose a different layout or retry.');},
    async preview(value,i){applyClient(value);previewOnly=true;playing=true;stage().edit(false);await playShot(i);},
    play(value){applyClient(value);previewOnly=false;playing=true;stage().edit(false);playShot(0);},
    seek(t){if(busy)return;if(perf&&!perfBusy){perfBusy=true;const a=performance.now();try{this.seek(t);}finally{perfBusy=false;perfNote('seek',performance.now()-a);}return;}previewRange=null;if(activeBake){liveAt(t);return;}playing=false;clock.setRunning(false,performance.now());clock.seek(t*shots[index].seconds,performance.now());stage().seek(t);stage().edit(true);frame.inert=false;$('pause').textContent='Play';caption(shots[index],t);const elapsed=shots.slice(0,index).reduce((n,s)=>n+s.seconds,0)+t*shots[index].seconds,total=shots.reduce((n,s)=>n+s.seconds,0),format=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');$('progress').value=elapsed;$('time').textContent=format(elapsed)+' / '+format(total);syncAudio();},
    pose(value){if(busy)return null;if(activeBake){liveAt(clock.progress(performance.now(),shots[index].seconds));return null;}stage().edit(true);return stage().previewPose(value);}
  },stage().catalog(),clientCut);
  director.open();
  }finally{mountingDirector=false;}
}
$('director').onclick=()=>openDirector().catch(error=>{$('cut-error').hidden=false;$('cut-error').textContent=error.message;});
addEventListener('message',e=>{
  if(e.origin!==location.origin)return;
  if(e.source===frame.contentWindow&&e.data?.ergoPresentation==='ready'){
    $('director').disabled=false;
    stage().clock(()=>busy||index<0?0:Math.min(previewRange?previewRange.end/shots[index].seconds:1,clock.progress(performance.now(),shots[index].seconds)));
    if(clientCut){try{applyClient(cleanCut(clientCut,stage().catalog()));}catch(error){$('cut-error').hidden=false;$('cut-error').textContent=error.message;clientCut=null;cut='full';shots=score();chapters();}}
    // Film chapter links (#cut=…&director=1) open straight into Director Mode.
    if(query.get('director')==='1'||linkQuery.get('director')==='1'){if(!director)openDirector().catch(error=>{$('cut-error').hidden=false;$('cut-error').textContent=error.message;});return;}
    if(query.get('app')==='1'){playing=false;playShot(shots.length-1).then(openApp);}else {
      playing=!reduced.matches&&query.get('paused')!=='1';
      const chapter=shots.findIndex(s=>s.id===query.get('chapter'));playShot(chapter<0?0:chapter);
    }
  }
  if(e.source===frame.contentWindow&&e.data?.ergoPresentation==='error'){$('loading').textContent=e.data.message+' · Use Skip intro to open the builder.';}
  if(app&&e.source===app.querySelector('iframe').contentWindow&&typeof e.data?.ergoMirror==='string'){
    try{if(e.data.ergoMirror.length<10000)stage()?.receive(JSON.parse(e.data.ergoMirror));}catch{}
  }
});
chapters();document.body.classList.add('loading');requestAnimationFrame(draw);
if(earlyReady)dispatchEvent(new MessageEvent('message',{data:earlyReady.data,origin:earlyReady.origin,source:earlyReady.source}));
