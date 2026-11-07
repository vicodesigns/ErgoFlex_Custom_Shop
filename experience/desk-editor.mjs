import {DESK_LANES,POSE_FIELDS,cleanPose,simplifyDeskLane} from './desk-track.mjs';
import {motionForShot,sampledMotionToClips,legacyMotionToClips,cleanClip,putClip,duplicateClip,planClipInsertion,clipEnd,clipTarget,clipDistance,clipSpeedUnit,clipSpeedPresets,clipSpeedSetting,retimeClipBySpeed,clipSummary,sampleClipMotion,validateClipSchedule} from './desk-clips.mjs';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={lift:'Lift',tilt:'Tilt',wheels:'Wheels'};
const fields=[['height','Height',28,52.5,.1],['tilt','Tilt',-5,65,.1],['x','Sideways',-120,120,.5],['z','Forward / back',-120,120,.5],['yaw','Turn',-3600,3600,1]];
const round=n=>Number(n.toFixed(3));
const option=(v,label,current)=>`<option value="${v}" ${v===current?'selected':''}>${escape(label)}</option>`;
export function createDeskEditor({panel,timeline,bridge,shot,time,seek,commit,render,status,preview=()=>Promise.resolve(),focus=()=>{},snap=(value)=>Math.round(value*20)/20,lengthen=null}){
  let selected=null,drag=null,suppress=0,recording=null,jog=null,lastTiming=null,paletteDrag=null,paletteSuppress=0,dirty=false,pointerAction=false;
  const initial=new Map(),automatic=new Map();
  const motion=()=>{
    const s=shot(),saved=automatic.get(s.id);
    if(!s.motion&&saved){if(saved.seconds!==s.seconds){saved.motion=sampledMotionToClips(saved.tracks,s.seconds);saved.seconds=s.seconds;}return saved.motion;}
    return motionForShot(s,initial.get(s.id));
  };
  function captureAutomatic(){
    const s=shot(),tracks=bridge.stage().motionDefaults();
    automatic.set(s.id,{tracks,seconds:s.seconds,motion:sampledMotionToClips(tracks,s.seconds)});
    initial.set(s.id,bridge.stage().capturePose());
  }
  const clip=()=>motion().clips.find(c=>c.id===selected);
  const now=()=>time()*shot().seconds;
  const ready=()=>{if(!bridge.ready())throw Error('Wait for this chapter to finish loading.');};
  const guarded=fn=>{try{fn();}catch(e){dirty=false;lastTiming=null;render();status(e.message,true);}};
  function sync(){
    for(const line of timeline.querySelectorAll('[data-desk-playhead]'))line.style.left=time()*100+'%';
    const output=panel.querySelector('[data-desk-readout]');if(output){const p=recording?.pose||(bridge.ready()?bridge.stage().capturePose():null)||sampleClipMotion(motion(),now());output.textContent=`${p.height.toFixed(1)}″ height · ${p.tilt.toFixed(1)}° tilt · ${p.yaw.toFixed(1)}° heading`+(clip()?.lane==='wheels'?` · X ${p.x.toFixed(1)}″ · Z ${p.z.toFixed(1)}″`:'');}
    const c=clip(),progress=panel.querySelector('[data-movement-progress]');if(c&&progress)progress.textContent=`${round(Math.max(0,Math.min(c.duration,now()-c.start)))} / ${round(c.duration)}s`;
    const play=panel.querySelector('[data-desk-action=preview]');if(play&&c)play.textContent=bridge.playback().playing&&bridge.playback().range?.id==='desk-'+c.id?'❚❚ Pause move':'▶ Play move';
    if(recording)for(const [f] of fields){const el=panel.querySelector(`[name="desk-live-${f}"]`);if(el&&document.activeElement!==el)el.value=round(recording.pose[f]);}
  }
  function save(next,{at=null,message='Movement updated.'}={}){
    ready();lastTiming=null;validateClipSchedule(next.clips,shot().seconds);dirty=false;commit(()=>{shot().motion=next;},{render:true});if(at!==null)seek(at/shot().seconds);status(message);
  }
  function select(id){ready();lastTiming=null;selected=id;focus('groove');const c=clip();if(c)seek(c.start/shot().seconds);render();status('Movement selected. Edit its settings in Groove, or drag its block or trim handles.');}
  function add(lane,preferred=now(),kind=lane==='wheels'?'rotate':lane){
    ready();focus('groove');const m=motion(),space=planClipInsertion(m.clips,lane,preferred,shot().seconds);
    if(!space)throw Error(`The ${names[lane]} lane is full. Shorten a movement or lengthen this chapter.`);
    const {start,duration}=space,longer=space.seconds>shot().seconds+1e-9;
    const from=sampleClipMotion(m,start),c=cleanClip({lane,start,duration,kind,target:lane==='lift'?(from.height<45?52.5:28):(from.tilt<30?35:0),value:kind==='travel'?12:360,direction:kind==='travel'?'forward':'right'});
    selected=c.id;
    if(longer&&lengthen){const next=putClip(m,c,space.seconds);lastTiming=null;dirty=false;lengthen(space.seconds,next,`${names[lane]} added at ${start.toFixed(1)}s`,start);return;}
    save(putClip(m,c,shot().seconds),{at:start,message:`${names[lane]} movement added at ${round(start)}s. Set its duration, speed and direction below.`});
  }
  function applyForm(){
    const c=clip();if(!c)return;const read=(n,fallback)=>panel.querySelector(`[name="desk-clip-${n}"]`)?.value??fallback;
    for(const el of panel.querySelectorAll('.movement-inspector input[type=number]'))if(el.value===''||!Number.isFinite(Number(el.value)))throw Error('Complete the movement’s number fields before applying.');
    let draft={...c,start:Number(read('start',c.start)),duration:Number(read('duration',c.duration)),label:read('label',c.label),easing:read('easing',c.easing)};
    if(c.kind==='lift'||c.kind==='tilt'){
      draft.target=Number(read('target',c.target));
      const from=sampleClipMotion(motion(),draft.start),f=c.kind==='lift'?'height':'tilt',oldDirection=c.target>=from[f]?'up':'down',direction=read('direction',oldDirection);
      if(draft.target===c.target&&direction!==oldDirection)draft.target=cleanPose({...from,[f]:from[f]+(direction==='down'?-1:1)*(Math.abs(c.target-from[f])||(c.kind==='lift'?5:10))})[f];
    }
    if(c.kind==='rotate'||c.kind==='travel'){draft.value=Number(read('value',c.value));draft.direction=read('direction',c.direction);}
    if((c.kind==='lift'&&(draft.target<28||draft.target>52.5))||(c.kind==='tilt'&&(draft.target<-5||draft.target>65)))throw Error(c.kind==='lift'?'Height must be between 28″ and 52.5″.':'Tilt must be between −5° and 65°.');
    if((c.kind==='rotate'||c.kind==='travel')&&(draft.value<0||draft.value>(c.kind==='rotate'?3600:240)))throw Error(c.kind==='rotate'?'Enter a rotation between 0° and 3600°.':'Enter a travel distance between 0″ and 240″.');
    if(c.kind==='pose')draft.target=Object.fromEntries(POSE_FIELDS[c.lane].map(f=>[f,Number(read('path-'+f,c.target[f]))]));
    const operation=read('operation',c.kind);if(c.lane==='wheels'&&operation!==c.kind){draft.kind=operation;draft.value=operation==='rotate'?360:12;draft.direction=operation==='rotate'?'right':'forward';draft.label='';delete draft.target;lastTiming='duration';}
    if(!Number.isFinite(draft.start)||!Number.isFinite(draft.duration)||draft.start<0||draft.duration<=0)throw Error('Enter a valid start time and duration.');
    if(lastTiming==='speed'||lastTiming==='speed-preset'){
      const speed=lastTiming==='speed-preset'?clipSpeedPresets(draft)[read('speed-preset','medium')]:Number(read('speed',0));
      draft=retimeClipBySpeed(motion(),draft,speed,shot().seconds);
    }else if(lastTiming!=='duration'&&draft.kind===c.kind&&read('speed-preset','custom')!=='custom'&&(draft.value!==c.value||JSON.stringify(draft.target)!==JSON.stringify(c.target))){
      draft=retimeClipBySpeed(motion(),draft,clipSpeedPresets(draft)[read('speed-preset')],shot().seconds);
    }
    const next=putClip(motion(),draft,shot().seconds);lastTiming=null;save(next,{at:draft.start});
  }
  function update(changes){const c=clip();if(!c)return;const next=putClip(motion(),{...c,...changes},shot().seconds);save(next,{at:next.clips.find(v=>v.id===c.id).start});}
  function startRecord(){
    ready();const m=motion(),start=now()>=shot().seconds-.001?0:now();
    if(m.clips.some(c=>c.start<=start+.00001&&clipEnd(c)>start+.00001))throw Error('Recording needs an empty gap across all three lanes. Move the playhead past the existing movements.');
    const until=Math.min(shot().seconds,...m.clips.filter(c=>c.start>start).map(c=>c.start));
    if(until-start<.1)throw Error('This gap is too short to record.');
    bridge.useBaked(false);seek(start/shot().seconds);
    recording={id:shot().id,motion:m,start,until,last:performance.now(),origin:performance.now(),pose:bridge.stage().capturePose(),tracks:{lift:[],tilt:[],wheels:[]},lastSample:-1,frame:0};jog=null;
    sampleRecord(start);render();status('Recording into the open gap. Hold −/+ to perform a movement; release to hold.');recording.frame=requestAnimationFrame(recordFrame);
  }
  function sampleRecord(seconds){const r=recording;for(const lane of DESK_LANES)r.tracks[lane].push({id:crypto.randomUUID(),time:seconds/shot().seconds,label:'Recorded movement',easing:'linear',pose:Object.fromEntries(POSE_FIELDS[lane].map(f=>[f,r.pose[f]]))});r.lastSample=seconds;}
  function recordFrame(t){const r=recording;if(!r)return;const dt=Math.min(.1,(t-r.last)/1000);r.last=t;const position=Math.min(r.until,r.start+(t-r.origin)/1000);
    if(jog){const [f,sign]=jog;r.pose=cleanPose({...r.pose,[f]:r.pose[f]+sign*dt*({height:4,tilt:15,x:12,z:12,yaw:60}[f])});}
    seek(position/shot().seconds);r.pose=bridge.pose(r.pose)||r.pose;if(position-r.lastSample>=Math.max(.15,shot().seconds/240)||position>=r.until)sampleRecord(position);sync();if(position>=r.until){stopRecord();return;}r.frame=requestAnimationFrame(recordFrame);
  }
  function stopRecord(){if(!recording)return;const end=now();if(end-recording.lastSample>.00001)sampleRecord(end);const r=recording;recording=null;jog=null;cancelAnimationFrame(r.frame);if(shot().id!==r.id)return;
    const tracks=Object.fromEntries(DESK_LANES.map(l=>[l,simplifyDeskLane(r.tracks[l],l)])),added=legacyMotionToClips({tracks},shot().seconds).clips;selected=added[0]?.id||null;
    save({...r.motion,clips:[...r.motion.clips,...added]},{at:end,message:added.length?'Recording kept as editable movement clips.':'No movement recorded. Existing clips were kept.'});
  }
  function action(name,kind){
    if(name==='revert'){dirty=false;lastTiming=null;render();status('Restored the saved movement settings.');return;}
    if(name==='apply'){flush();return;}
    if(name==='record'){if(recording)stopRecord();else startRecord();return;}
    ready();
    if(name.startsWith('add-')){add(name.slice(4),now(),kind);return;}
    if(name==='preview'){const c=clip();if(c)preview({start:c.start,end:clipEnd(c),id:'desk-'+c.id,label:clipSummary(c)}).catch(e=>status(e.message,true));return;}
    if(name==='in'||name==='out'){const c=clip();if(c)seek((name==='in'?c.start:clipEnd(c))/shot().seconds);return;}
    if(name==='clear'){selected=null;save({...motion(),clips:[]},{at:0,message:'Movement timeline cleared. Undo restores the clips.'});return;}
    if(name==='automatic'){selected=null;commit(()=>delete shot().motion,{render:true});captureAutomatic();seek(time());render();status('Original chapter movements restored. Select their blocks to edit them.');return;}
    if(name==='delete'){const c=clip();if(!c)return;selected=null;save({...motion(),clips:motion().clips.filter(v=>v.id!==c.id)},{at:c.start});return;}
    if(name==='duplicate'){const c=clip();if(!c)return;const next=duplicateClip(motion(),c.id,shot().seconds);selected=next.clips.find(v=>!motion().clips.some(old=>old.id===v.id)).id;save(next,{at:next.clips.find(v=>v.id===selected).start});return;}
  }
  function clearPaletteDrag(){for(const el of timeline.querySelectorAll('.drop-target'))el.classList.remove('drop-target');}
  for(const root of [panel,timeline]){
    root.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-desk-add]');if(!b||e.button!==0)return;guarded(()=>{ready();if(recording)throw Error('Stop recording before adding another movement.');paletteDrag={lane:b.dataset.deskAdd,kind:b.dataset.deskKind,x:e.clientX,y:e.clientY,moved:false};b.setPointerCapture(e.pointerId);e.preventDefault();});});
    root.addEventListener('pointermove',e=>{if(!paletteDrag)return;const d=paletteDrag;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>4)d.moved=true;clearPaletteDrag();if(d.moved){const rail=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-desk-lane]');if(rail?.dataset.deskLane===d.lane)rail.classList.add('drop-target');}});
    root.addEventListener('pointerup',e=>{if(!paletteDrag)return;const d=paletteDrag;paletteDrag=null;clearPaletteDrag();paletteSuppress=performance.now()+300;guarded(()=>{if(!d.moved){add(d.lane,now(),d.kind);return;}const rail=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-desk-lane]');if(rail?.dataset.deskLane!==d.lane)throw Error(`Drop ${names[d.lane]} on the ${names[d.lane]} lane.`);const box=rail.getBoundingClientRect();add(d.lane,snap((e.clientX-box.left)/box.width*shot().seconds,{pixels:box.width,bypass:e.altKey}),d.kind);});});
    root.addEventListener('pointercancel',()=>{paletteDrag=null;clearPaletteDrag();});
    root.addEventListener('click',e=>{const b=e.target.closest('[data-desk-action]');if(b?.dataset.deskAdd&&performance.now()<paletteSuppress)return;if(b)guarded(()=>action(b.dataset.deskAction,b.dataset.deskKind));});
    root.addEventListener('click',e=>{if(recording&&e.target.closest('button')&&!e.target.closest('[data-desk-action=record],[data-desk-jog]'))stopRecord();},true);
    root.addEventListener('input',e=>{if(recording&&e.target.name&&!e.target.name.startsWith('desk-live-'))stopRecord();},true);
    root.addEventListener('pointerdown',e=>{if(recording&&e.target.closest('.camera-track,.desk-lane'))stopRecord();},true);
    root.addEventListener('dragstart',e=>{const b=e.target.closest('[data-desk-add]');if(!b)return;e.dataTransfer.setData('application/x-ergoflex-movement',b.dataset.deskAdd);e.dataTransfer.effectAllowed='copy';});
  }
  function flush(){
    if(!dirty)return true;
    try{applyForm();return true;}catch(error){const errorBox=panel.querySelector('[data-movement-error]');if(errorBox){errorBox.hidden=false;errorBox.querySelector('span').textContent=error.message;}status(error.message,true);return false;}
  }
  // A pointer click must reach its original transport/selection button even
  // when committing the focused field rebuilds that button's timeline DOM.
  document.addEventListener('pointerdown',e=>{pointerAction=dirty&&!!e.target.closest('button,select,.time-ruler,[data-desk-clip]');},true);
  document.addEventListener('click',e=>{if(!pointerAction)return;pointerAction=false;if(e.target.closest('[data-desk-action=revert]'))return;if(!flush()){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('pointercancel',()=>{pointerAction=false;flush();},true);
  panel.addEventListener('input',e=>{if(e.target.name?.startsWith('desk-clip-'))dirty=true;if(e.target.name==='desk-clip-speed')lastTiming='speed';else if(e.target.name==='desk-clip-duration')lastTiming='duration';if(e.target.name?.startsWith('desk-live-')&&recording)guarded(()=>{recording.pose=cleanPose({...recording.pose,[e.target.name.slice(10)]:Number(e.target.value)});bridge.pose(recording.pose);});});
  panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.name?.startsWith('desk-clip-')){e.preventDefault();flush();}});
  panel.addEventListener('change',e=>guarded(()=>{
    const n=e.target.name,v=e.target.value;
    if(n==='desk-selected'){select(v);return;}
    if(n==='desk-clip-speed-preset'){
      if(v==='custom'){lastTiming=null;panel.querySelector('[data-precise-speed]')?.setAttribute('open','');return;}
      lastTiming='speed-preset';dirty=true;flush();return;
    }
    if(n==='desk-clip-operation'){dirty=true;flush();return;}
    if(n?.startsWith('desk-clip-')){dirty=true;if(!pointerAction)flush();return;}
    if(n?.startsWith('desk-initial-')){const m=motion(),p=cleanPose({...m.initial,[n.slice(13)]:Number(v)});save({...m,initial:p},{at:0});}
  }));
  panel.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-desk-jog]');if(!b||!recording)return;e.preventDefault();jog=[b.dataset.deskJog,Number(b.dataset.sign)];b.setPointerCapture(e.pointerId);b.classList.add('held');});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(event,()=>{jog=null;for(const b of panel.querySelectorAll('.held'))b.classList.remove('held');});
  timeline.addEventListener('click',e=>{if(performance.now()<suppress)return;const b=e.target.closest('[data-desk-clip]');if(b){guarded(()=>select(b.dataset.deskClip));return;}const rail=e.target.closest('[data-desk-lane]');if(rail)guarded(()=>{const box=rail.getBoundingClientRect();seek(Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)));sync();});});
  timeline.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-desk-clip]');if(!b||e.button!==0)return;guarded(()=>{ready();const c=motion().clips.find(c=>c.id===b.dataset.deskClip),rail=b.closest('[data-desk-lane]');drag={id:c.id,original:c,marker:b,rail,start:e.clientX,edge:e.target.closest('[data-resize]')?.dataset.resize,moved:false,candidate:c};rail.setPointerCapture(e.pointerId);e.preventDefault();});});
  timeline.addEventListener('pointermove',e=>{if(!drag)return;const d=drag,box=d.rail.getBoundingClientRect();if(Math.abs(e.clientX-d.start)>3)d.moved=true;if(!d.moved)return;const delta=(e.clientX-d.start)/box.width*shot().seconds,c={...d.original},options={pixels:box.width,bypass:e.altKey,excludeClip:c.id};
    if(d.edge==='end')c.duration=Math.max(.05,Math.min(shot().seconds-c.start,snap(clipEnd(d.original)+delta,options)-c.start));
    else if(d.edge==='start'){c.start=Math.max(0,Math.min(clipEnd(d.original)-.05,snap(d.original.start+delta,options)));c.duration=clipEnd(d.original)-c.start;}
    else c.start=Math.max(0,Math.min(shot().seconds-c.duration,snap(d.original.start+delta,options)));
    d.candidate=c;d.marker.style.left=c.start/shot().seconds*100+'%';d.marker.style.width=c.duration/shot().seconds*100+'%';
    try{validateClipSchedule([...motion().clips.filter(v=>v.id!==c.id),c],shot().seconds);d.marker.classList.remove('invalid');}catch{d.marker.classList.add('invalid');}
    const text=d.marker.querySelector('small');if(text)text.textContent=`${round(c.start)}s · ${round(c.duration)}s`;
  });
  timeline.addEventListener('pointerup',()=>{if(!drag)return;const d=drag;drag=null;suppress=performance.now()+250;guarded(()=>{if(!d.moved){select(d.id);return;}selected=d.id;focus('groove');save(putClip(motion(),d.candidate,shot().seconds),{at:d.candidate.start,message:d.edge?'Movement resized; speed updated.':'Movement moved.'});});});
  timeline.addEventListener('pointercancel',()=>{drag=null;render();});
  timeline.addEventListener('keydown',e=>{const b=e.target.closest('[data-desk-clip]');if(!b||!['ArrowLeft','ArrowRight','Delete','Backspace'].includes(e.key))return;e.preventDefault();guarded(()=>{selected=b.dataset.deskClip;if(['Delete','Backspace'].includes(e.key)){action('delete');return;}const c=clip(),start=c.start+(e.shiftKey?1:.1)*(e.key==='ArrowLeft'?-1:1);if(start<0||start+c.duration>shot().seconds+.00001)throw Error('Keep the whole movement inside the chapter.');update({start});timeline.querySelector(`[data-desk-clip="${selected}"]`)?.focus();});});
  timeline.addEventListener('dragover',e=>{const rail=e.target.closest('[data-desk-lane]');if(rail&&[...e.dataTransfer.types].includes('application/x-ergoflex-movement')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  timeline.addEventListener('drop',e=>{const lane=e.dataTransfer.getData('application/x-ergoflex-movement'),rail=e.target.closest('[data-desk-lane]');if(!DESK_LANES.includes(lane)||!rail)return;e.preventDefault();guarded(()=>{if(lane!==rail.dataset.deskLane)throw Error(`Drop ${names[lane]} on the ${names[lane]} lane.`);const box=rail.getBoundingClientRect();add(lane,snap((e.clientX-box.left)/box.width*shot().seconds,{pixels:box.width,bypass:e.altKey}));});});
  addEventListener('blur',()=>{jog=null;if(recording)stopRecord();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&recording)stopRecord();});
  function palette(){return [['lift','lift','Lift'],['tilt','tilt','Tilt'],['wheels','rotate','Turn'],['wheels','travel','Travel'],['wheels','hold','Hold']].map(([lane,kind,label])=>`<button data-desk-action="add-${lane}" data-desk-add="${lane}" data-desk-kind="${kind}" draggable="false" title="Add ${label.toLowerCase()} movement">+ ${label}</button>`).join('');}
  return {
    flush, motion, selectedId:()=>clip()?.id||null, select:id=>guarded(()=>select(id)), duplicate(){if(clip())guarded(()=>action('duplicate'));}, hasSelection:()=>!!clip(), tools:palette, count:()=>motion().clips.length, boundaries:(exclude)=>motion().clips.filter(c=>c.id!==exclude).flatMap(c=>[c.start,clipEnd(c)]), clearSelection(){selected=null;},
    ready(){if(!shot().motion)captureAutomatic();if(!motion().clips.some(c=>c.id===selected))selected=null;},stop:stopRecord,sync,
    panel(){const m=motion(),c=clip(),from=c?sampleClipMotion(m,c.start):m.initial,speed=c?clipDistance(m,c)/c.duration:0,direction=c&&(c.kind==='lift'||c.kind==='tilt')?(c.target>=from[c.kind==='lift'?'height':'tilt']?'up':'down'):c?.direction;
      return `<hr><h3>Desk Groove · chapter movement</h3><p class="director-hint">Select a block to edit it. Changes apply when you leave a field or press Enter. Drag blocks to move them; drag their edges to resize.</p>
      <div class="director-actions movement-palette">${palette()}</div><p class="director-hint">You can also drag these buttons onto their lanes. New chapters start empty.</p>
      ${shot().motion&&!Array.isArray(shot().motion.clips)?'<p class="director-hint">This chapter has movement saved by the earlier editor. It is preserved as clips. Use Clear movements for an empty timeline; Undo restores them.</p>':''}
      ${!shot().motion?`<p class="director-status">${m.clips.length?'Original chapter movements are shown below. Select a block to edit its timing, speed or path. Your first change keeps these movements in a custom timeline.':'This chapter has no built-in desk movement. Add a block to animate it.'}</p>`:''}
      <p data-desk-readout class="director-status"></p>
      <label>Selected movement<select name="desk-selected"><option value="">Choose a movement…</option>${m.clips.map(v=>option(v.id,`${names[v.lane]} · ${clipSummary(v)} · ${round(v.start)}–${round(clipEnd(v))}s`,selected)).join('')}</select></label>
      ${c?`<div class="movement-inspector"><h4>${({rotate:'Turn',travel:'Travel / strafe',hold:'Hold wheels',pose:'Saved path'})[c.kind]||names[c.lane]} movement</h4><div class="selection-preview"><button data-desk-action="preview" class="primary">▶ Play move</button><button data-desk-action="in">In</button><button data-desk-action="out">Out</button><output data-movement-progress></output></div><div class="movement-error" data-movement-error role="alert" hidden><span></span><button data-desk-action="revert">Revert changes</button></div><label>Movement name<input name="desk-clip-label" maxlength="60" placeholder="${escape(clipSummary({...c,label:''}))}" value="${escape(c.label)}"></label>
        <div class="director-grid movement-timing"><label>Start time (seconds)<input name="desk-clip-start" type="number" min="0" max="${round(shot().seconds-c.duration)}" step=".05" value="${round(c.start)}"></label><label>Duration (seconds)<input name="desk-clip-duration" type="number" min=".001" max="${round(shot().seconds-c.start)}" step=".05" value="${round(c.duration)}"></label></div><p class="movement-range">${round(c.start)}s → ${round(clipEnd(c))}s <span>of ${shot().seconds}s chapter</span></p>
        ${c.lane==='wheels'?`<label>Wheel action<select name="desk-clip-operation">${option('rotate','Rotate',c.kind)}${option('travel','Travel / strafe',c.kind)}${option('hold','Hold wheels',c.kind)}${c.kind==='pose'?option('pose','Saved path','pose'):''}</select></label>`:''}
        ${c.kind==='lift'||c.kind==='tilt'?`<label>${c.kind==='lift'?'Target height (inches)':'Target tilt (degrees)'}<input name="desk-clip-target" type="number" min="${c.kind==='lift'?28:-5}" max="${c.kind==='lift'?52.5:65}" step=".1" value="${c.target}"></label><label>Direction<select name="desk-clip-direction">${option('up',c.kind==='lift'?'Up':'Tilt up',direction)}${option('down',c.kind==='lift'?'Down':'Tilt down',direction)}</select></label>`:''}
        ${c.kind==='rotate'||c.kind==='travel'?`<div class="director-grid"><label>${c.kind==='rotate'?'Rotation (degrees)':'Distance (inches)'}<input name="desk-clip-value" type="number" min="0" max="${c.kind==='rotate'?3600:240}" step="${c.kind==='rotate'?1:.1}" value="${c.value}"></label><label>Direction<select name="desk-clip-direction">${(c.kind==='rotate'?['right','left']:['forward','backward','left','right']).map(d=>option(d,d[0].toUpperCase()+d.slice(1),c.direction)).join('')}</select></label></div>`:''}
        ${c.kind==='pose'?`<div class="director-grid">${POSE_FIELDS[c.lane].map(f=>`<label>End ${({x:'sideways (inches)',z:'forward / back (inches)',yaw:'turn (degrees)'})[f]||f}<input name="desk-clip-path-${f}" type="number" step=".1" value="${round(c.target[f])}"></label>`).join('')}</div>`:''}
        ${c.path?'<p class="director-hint">This block keeps the original curved movement. Moving or resizing it preserves the path; changing its end values adjusts where it finishes.</p>':''}
        ${c.kind==='rotate'?`<p class="director-status">${c.value}° = ${round(c.value/360)} full turn${c.value===360?'':'s'} ${c.direction}. This is the total rotation for this block.</p>`:''}
        ${c.kind!=='hold'?`<label>Speed<select name="desk-clip-speed-preset">${Object.entries(clipSpeedPresets(c)).map(([key,rate])=>option(key,`${key[0].toUpperCase()+key.slice(1)} · ${rate} ${clipSpeedUnit(c)}/s`,clipSpeedSetting(m,c))).join('')}${option('custom','Custom',clipSpeedSetting(m,c))}</select></label><details data-precise-speed ${clipSpeedSetting(m,c)==='custom'?'open':''}><summary>Precise speed</summary><label>Custom speed (${clipSpeedUnit(c)} / second)<input name="desk-clip-speed" type="number" min=".001" step=".1" value="${round(speed)}"></label></details><p class="director-hint">${round(speed)} ${clipSpeedUnit(c)}/s · ${round(c.duration)}s. Speed changes duration; the movement amount stays exact. Editing duration sets a custom speed.</p>`:''}
        <label>Acceleration<select name="desk-clip-easing">${option('linear','Constant speed',c.easing)}${option('smooth','Ease in / out',c.easing)}${option('hold','Hold, then change',c.easing)}</select></label><div class="director-actions"><button data-desk-action="apply" class="primary">Apply movement</button><button data-desk-action="duplicate" title="Duplicate selected movement (Ctrl/Cmd+D)">Duplicate movement</button><button data-desk-action="delete">Delete movement</button></div></div>`:'<p class="movement-empty-help">Add <b>Lift</b>, <b>Tilt</b>, <b>Turn</b>, <b>Travel</b> or <b>Hold</b>, then select its block to set the timing and movement.</p>'}
      <details class="desk-start-pose"><summary>Starting wheel position</summary><p class="director-hint">Starting height and tilt: Chapter tab → Starting position.</p><div class="director-grid">${fields.filter(([f])=>!['height','tilt'].includes(f)).map(([f,label,min,max,step])=>`<label>${label} (${['height','x','z'].includes(f)?'inches':'degrees'})<input name="desk-initial-${f}" type="number" min="${min}" max="${max}" step="${step}" value="${round(m.initial[f])}"></label>`).join('')}</div></details>
      <div class="director-actions"><button data-desk-action="clear" ${m.clips.length||!shot().motion?'':'disabled'}>Clear movements</button><button data-desk-action="automatic" ${shot().motion?'':'disabled'}>Use built-in animation</button></div>
      <details class="desk-recorder" ${recording?'open':''}><summary>Record a performance</summary><p class="director-hint">Record into an empty gap across all three lanes. Recording stops before the next movement and keeps existing clips.</p><button data-desk-action="record" class="${recording?'recording':''}">${recording?'■ Stop & keep recording':'● Record movement'}</button>
      ${recording?`<div class="desk-jogs">${fields.map(([f,label,min,max,step])=>`<div><label>${label}<input name="desk-live-${f}" type="number" min="${min}" max="${max}" step="${step}" value="${round(recording.pose[f])}"></label><button data-desk-jog="${f}" data-sign="-1" aria-label="Record decrease ${f}">−</button><button data-desk-jog="${f}" data-sign="1" aria-label="Record increase ${f}">+</button></div>`).join('')}</div>`:''}</details>`;
    },
    timeline(){const m=motion(),count=m.clips.length;return `<div class="desk-track-toolbar"><strong>Desk movements · ${count} clip${count===1?'':'s'}</strong><span>Drag blocks to move · edges to resize</span>${palette()}</div><div class="desk-ruler"><span></span><div>${Array.from({length:6},(_,i)=>`<span style="left:${i*20}%">${round(shot().seconds*i/5)}s</span>`).join('')}</div></div><div class="desk-lanes">${DESK_LANES.map(l=>{const empty=!m.clips.some(c=>c.lane===l);return `<div class="desk-lane-row ${empty?'empty':''}" data-lane-color="${l}"><span class="desk-lane-label">${names[l]}${empty?`<button class="lane-add" data-desk-action="add-${l}" data-desk-add="${l}" data-desk-kind="${l==='wheels'?'rotate':l}" title="Add a ${l==='wheels'?'turn':names[l].toLowerCase()} movement at the playhead">+ ${l==='wheels'?'Turn':names[l]}</button>`:''}</span><div class="desk-lane" data-desk-lane="${l}" role="group" aria-label="${names[l]} movement timeline"><div class="desk-lane-line"></div>${m.clips.filter(c=>c.lane===l).map(c=>`<button class="desk-clip ${selected===c.id?'selected':''}" data-desk-clip="${c.id}" style="left:${c.start/shot().seconds*100}%;width:${c.duration/shot().seconds*100}%" aria-label="${names[l]} movement: ${escape(clipSummary(c))}, ${round(c.start)} to ${round(clipEnd(c))} seconds" aria-pressed="${selected===c.id}" title="${escape(clipSummary(c))} · ${round(c.start)}–${round(clipEnd(c))}s"><span class="clip-resize" data-resize="start" title="Resize start"></span><strong>${escape(clipSummary(c))}</strong><small>${round(c.start)}–${round(clipEnd(c))}s · ${round(c.duration)}s</small><span class="clip-resize" data-resize="end" title="Resize end"></span></button>`).join('')}${m.clips.some(c=>c.lane===l)?'':`<span class="desk-lane-empty">Drop ${names[l]} here · use ${l==='wheels'?'+ Turn / Travel / Hold':'+ '+names[l]}</span>`}<div class="camera-track-playhead" data-desk-playhead style="left:${time()*100}%"></div></div></div>`;}).join('')}</div>`;}
  };
}
