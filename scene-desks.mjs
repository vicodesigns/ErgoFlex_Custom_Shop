import * as THREE from 'three';
import { cleanSceneDeskData, cleanDeskRecording, sampleDeskRecording, SCENE_DESKS_KEY } from './scene-desk-data.mjs';
import { SceneDeskObjects } from './scene-desk-objects.mjs?v=notebook-scale-20261011';

const descendant=(o,parent)=>{for(let p=o;p;p=p.parent)if(p===parent)return true;return false;};
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const clone=v=>JSON.parse(JSON.stringify(v));

// The controls operate the live CAD rig. Desks retain stable identities and
// independently animated batched bodies when another desk is selected.
export class SceneDesks {
    constructor(ctx){
        this.ctx=ctx;this.data=cleanSceneDeskData(ctx.readStore?.());this.records=new Map();
        this.selected=null;this.key=null;this.recording=null;this.playing=null;this.drag=null;this.saveElapsed=0;
        this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
        this.highlight=new THREE.Box3Helper(new THREE.Box3(),0x45cfac);this.highlight.visible=false;ctx.scene.add(this.highlight);
        this.objects=new SceneDeskObjects(this);
    }
    get roomData(){return this.data.rooms[this.key];}
    get active(){return this.records.get(this.selected);}
    serialize(){this.capture();return cleanSceneDeskData(this.data);}
    restore(v){this.dispose();this.data=cleanSceneDeskData(v);}
    persist(){this.capture();this.ctx.writeStore?.(SCENE_DESKS_KEY,cleanSceneDeskData(this.data));this.ctx.changed?.();}
    capture(){
        if(!this.key||!this.roomData)return;
        for(const [id,r] of this.records){
            this.objects.capture(r);
            if(id===this.selected)Object.assign(r.state,this.ctx.readLive(r));
            else if(r.group?.parent){r.state.pose={x:r.group.position.x,z:r.group.position.z,yaw:r.group.rotation.y};}
            this.roomData.desks[id]=clone(r.state);
        }
        this.roomData.selected=this.selected;
    }
    dispose(){
        this.stop();this.objects.endDrag();this.objects.selected=null;this.endDrag();this.capture();
        for(const r of this.records.values()){if(r.rig){this.ctx.unregisterBody?.(r.group);this.ctx.disposeDress?.(r);}r.rig?.dispose();}
        this.records.clear();this.selected=null;this.key=null;this.highlight.visible=false;
    }
    bind(room){
        this.dispose();if(!room?.roomLayout){this.ctx.showLive(true,true);this.sync();return;}
        this.key=this.ctx.sceneId()+'/'+room.roomLayout.id;
        this.data.rooms[this.key]||={desks:{},deleted:[],selected:'main'};
        const saved=this.roomData;
        const mainSeed=this.ctx.readLive();
        const mainState=saved.desks.main||{...mainSeed,name:'Main desk',added:false,phases:{}};
        if(!saved.deleted.includes('main'))this.records.set('main',{id:'main',state:mainState,primary:true});
        for(const group of room.assets().filter(o=>o.userData.officeStation)){
            const spec=room.roomLayout.stations.find(s=>s.id===group.userData.officeStation.role);
            if(!spec)continue;
            const id='station-'+spec.id;
            if(saved.deleted.includes(id)){group.removeFromParent();this.ctx.retireBody?.(group);continue;}
            group.userData.sceneDeskId=id;
            const state=saved.desks[id]||{name:spec.name,size:spec.size||'48x30',pose:{x:group.position.x,z:group.position.z,yaw:group.rotation.y},
                height:spec.height,tilt:spec.tilt,lights:clone(mainSeed.lights),style:group.userData.deskStyle,added:false,phases:{}};
            this.records.set(id,{id,state,group,spec});
            if(saved.desks[id])this.ensureRig(this.records.get(id));
            this.place(this.records.get(id));
        }
        for(const [id,state] of Object.entries(saved.desks)){
            if(state.added&&!saved.deleted.includes(id)&&!this.records.has(id)){
                const r={id,state};this.records.set(id,r);this.ensureRig(r);this.place(r);
            }
        }
        // Seed the main anchor with the current model before applying a stored pose.
        if(this.records.has('main')){const r=this.records.get('main');this.ensureRig(r);if(!saved.desks.main)Object.assign(r.state,this.ctx.readLive(r));}
        this.selected=this.records.has(saved.selected)?saved.selected:this.records.keys().next().value||null;
        if(this.active){this.ensureRig(this.active);this.ctx.activate?.(this.active);this.ctx.writeLive(this.active);this.active.rig.setBodyVisible(false);}
        for(const r of this.records.values())if(r.rig)r.rig.setBodyVisible(r.id!==this.selected);
        this.ctx.showLive(!!this.active,this.selected==='main');
        this.sync();
    }
    ensureRig(r){
        if(r.rig)return r.rig;
        const old=r.group,rig=this.ctx.makeRig(r.state,r.spec);
        const group=rig.group;group.name=r.state.name+' · ErgoFlex desk';
        r.metadata||=old?.userData||{};
        group.userData={...r.metadata,sceneDeskId:r.id,sceneDeskManaged:true};
        if(old){
            // Transfer the existing role dressing, with its editor IDs and props.
            for(const role of ['desktop','shelf']){
                const m=old.children.find(o=>o.isGroup&&o.name.endsWith(':'+role));
                if(m&&rig.mounts[role])for(const child of [...m.children])rig.mounts[role].add(child);
            }
            old.removeFromParent();this.ctx.retireBody?.(old);
        }else if(r.primary){
            this.ctx.copyMainDress?.(rig.mounts);
        }
        r.rig=rig;r.renderedStyle=JSON.stringify(r.state.style);r.group=group;this.ctx.room().root.add(group);this.ctx.registerBody?.(group);this.place(r);this.objects.bind(r);return rig;
    }
    place(r){
        if(!r.group)return;
        r.group.position.set(r.state.pose.x,0,r.state.pose.z);r.group.rotation.y=r.state.pose.yaw;
        r.group.updateMatrixWorld(true);
    }
    select(id){
        const next=this.records.get(id);if(!next||id===this.selected)return !!next;
        this.objects.endDrag();this.objects.selected=null;this.stop();this.ctx.halt();this.capture();
        const old=this.active;
        if(old){this.ensureRig(old);this.ctx.restyle?.(old);old.rig.updatePose(old.state.height,old.state.tilt);this.place(old);old.rig.setBodyVisible(true);}
        this.selected=id;this.ensureRig(next);this.ctx.restyle?.(next);this.ctx.activate?.(next);this.ctx.writeLive(next);next.rig.setBodyVisible(false);
        this.ctx.showLive(true,id==='main');this.persist();this.sync();return true;
    }
    pick(event){
        const {canvas,camera}=this.ctx,rect=canvas.getBoundingClientRect();
        this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
        this.ray.setFromCamera(this.pointer,camera);
        const hit=this.ray.intersectObjects([this.ctx.room()?.root,this.ctx.liveObject()].filter(Boolean),true)
            .find(h=>visible(h.object)&&!h.object.material?.isShaderMaterial);
        if(!hit)return null;
        if(descendant(hit.object,this.ctx.liveObject()))return {id:this.selected,hit};
        for(let p=hit.object;p;p=p.parent)if(p.userData.sceneDeskId&&this.records.has(p.userData.sceneDeskId))return {id:p.userData.sceneDeskId,hit};
        return null;
    }
    down(e){
        if(this.objects.down(e))return true;
        if(this.objects.editing)return false;
        if(e.target!==this.ctx.canvas||e.button!==0||!this.ctx.rearrange()||e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return false;
        const picked=this.pick(e);if(!picked)return false;
        this.select(picked.id);this.ctx.halt();
        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),picked.hit.point),point=new THREE.Vector3();
        if(!this.ray.ray.intersectPlane(plane,point))return false;
        this.drag={pointer:e.pointerId,plane,last:point,controls:this.ctx.controls.enabled,changed:false,before:this.serialize()};
        this.ctx.controls.enabled=false;this.ctx.canvas.setPointerCapture(e.pointerId);this.ctx.canvas.style.cursor='grabbing';
        e.preventDefault();e.stopImmediatePropagation();return true;
    }
    moveDrag(e){
        if(this.objects.moveDrag(e))return true;
        const d=this.drag;if(!d||e.pointerId!==d.pointer)return false;
        const rect=this.ctx.canvas.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.ctx.camera);
        const point=new THREE.Vector3();
        if(this.ray.ray.intersectPlane(d.plane,point)){
            const delta=point.clone().sub(d.last);this.ctx.dragLive(delta.x,delta.z);d.last.copy(point);d.changed||=delta.length()>1e-7;
        }
        e.preventDefault();e.stopImmediatePropagation();return true;
    }
    endDrag(e){
        if(e&&this.objects.endDrag(e))return true;
        const d=this.drag;if(!d||(e&&e.pointerId!==d.pointer))return false;
        this.drag=null;if(this.ctx.canvas.hasPointerCapture(d.pointer))this.ctx.canvas.releasePointerCapture(d.pointer);
        this.ctx.controls.enabled=d.controls;this.ctx.canvas.style.cursor='';this.persist();if(d.changed)this.ctx.edit?.(d.before,this.serialize());
        if(e){e.preventDefault();e.stopImmediatePropagation();}return true;
    }
    setSize(size){
        if(!this.active||!['48x30','60x30'].includes(size))return false;
        this.stop();this.ctx.halt();this.capture();
        const before=this.serialize(),r=this.active;r.state.size=size;
        const dressing={};for(const [role,mount] of Object.entries(r.rig?.mounts||{}))dressing[role]=[...mount.children];
        this.ctx.unregisterBody?.(r.group);r.rig?.dispose();r.rig=null;r.group=null;
        this.ensureRig(r);
        for(const [role,children] of Object.entries(dressing))if(r.rig.mounts[role]){
            r.rig.mounts[role].clear();for(const child of children)r.rig.mounts[role].add(child);
        }
        this.ctx.writeLive(r);r.rig.setBodyVisible(false);this.persist();this.ctx.edit?.(before,this.serialize());this.sync();return true;
    }
    add(size='48x30'){
        if(!this.roomData||this.records.size>=24)return false;
        this.stop();this.capture();const before=this.serialize(),state=clone(this.active?.state||this.ctx.readLive());
        const pose=this.ctx.freePosition(size);if(!pose){this.ctx.status('There is no clear space for another desk. Rearrange items first.');return false;}
        const id='added-'+crypto.randomUUID();Object.assign(state,{name:'Desk '+(this.records.size+1),size,pose,added:true,phases:{},objects:{}});
        const r={id,state};this.records.set(id,r);this.ensureRig(r);this.place(r);this.select(id);this.ctx.edit?.(before,this.serialize());return id;
    }
    remove(){
        const r=this.active;if(!r)return false;
        this.stop();this.ctx.halt();this.capture();const before=this.serialize();this.ctx.unregisterBody?.(r.group);this.ctx.disposeDress?.(r);r.rig?.dispose();r.group?.removeFromParent();
        delete this.roomData.desks[r.id];if(!r.state.added)this.roomData.deleted.push(r.id);
        this.records.delete(r.id);this.selected=null;
        const id=this.records.keys().next().value;
        if(id)this.select(id);else{this.ctx.showLive(false,false);this.persist();this.sync();}
        this.ctx.edit?.(before,this.serialize());return true;
    }
    rotate(degrees){
        if(!this.active)return false;this.ctx.halt();const before=this.serialize();
        const desired=clone(this.active.state);desired.pose.yaw+=degrees*Math.PI/180;
        if(!this.ctx.canPlace(this.active,desired))return false;
        this.ctx.writeLive({...this.active,state:desired});this.persist();this.ctx.edit?.(before,this.serialize());return true;
    }
    saveSetting(all=false){
        if(this.playing||this.recording)return false;
        this.ctx.halt();this.capture();const before=this.serialize(),phase=this.ctx.phase();
        for(const r of all?this.records.values():[this.active].filter(Boolean)){
            const recording=r.state.phases[phase]?.recording||[];
            r.state.phases[phase]={pose:clone(r.state.pose),height:r.state.height,tilt:r.state.tilt,lights:clone(r.state.lights),recording};
        }
        this.persist();this.ctx.edit?.(before,this.serialize());this.sync();this.ctx.status(all?'All desk positions and lights saved for this setting.':'Selected desk position and lights saved for this setting.');return true;
    }
    record(){
        if(!this.active||this.recording)return false;
        this.stop();this.ctx.halt();this.capture();this.saveSetting();
        this.recording={id:this.selected,phase:this.ctx.phase(),elapsed:0,at:0,frames:[],before:this.serialize()};this.sampleRecording(0);this.sync();return true;
    }
    sampleRecording(t){
        const r=this.records.get(this.recording.id);if(!r)return;
        const s=this.ctx.readLive(r);this.recording.frames.push({t,...s.pose,height:s.height,tilt:s.tilt});
    }
    stopRecording(){
        const rec=this.recording;if(!rec)return false;
        if(rec.elapsed>rec.at)this.sampleRecording(Math.min(180,rec.elapsed));
        const r=this.records.get(rec.id);this.recording=null;
        if(r){const setting=r.state.phases[rec.phase];setting.recording=cleanDeskRecording(rec.frames);this.persist();this.ctx.edit?.(rec.before,this.serialize());}
        this.sync();return true;
    }
    play(all=false){
        if(this.recording||this.playing)return false;
        this.ctx.halt();this.capture();const phase=this.ctx.phase(),runs=[];
        for(const r of all?this.records.values():[this.active].filter(Boolean)){
            const setting=r.state.phases[phase];if(!setting)continue;
            const frames=setting.recording;
            const first=frames?.length?{pose:{x:frames[0].x,z:frames[0].z,yaw:frames[0].yaw},height:frames[0].height,tilt:frames[0].tilt}:setting;
            const approach=this.ctx.planPath(r,first);if(!approach){this.ctx.status(r.state.name+': route is blocked. Move nearby items first.');return false;}
            this.ensureRig(r);runs.push({r,setting,frames,approach});
        }
        if(!runs.length){this.ctx.status('Save a position or record a Groove for this setting first.');return false;}
        for(const run of runs){run.r.state.lights=clone(run.setting.lights);this.ctx.lightDesk?.(run.r);}this.playing={elapsed:0,runs};this.sync();return true;
    }
    stop(){this.stopRecording();this.playing=null;this.sync();}
    update(dt){
        if(!this.active&&!this.records.size)return;
        dt=Math.max(0,Math.min(.25,dt));
        if(this.playing&&dt>.05){const steps=Math.ceil(dt/.05);for(let n=0;n<steps;n++)this.update(dt/steps);return;}
        if(this.recording){
            const rec=this.recording;rec.elapsed+=dt;
            if(rec.elapsed-rec.at>=.1&&rec.frames.length<1800){rec.at=rec.elapsed;this.sampleRecording(rec.at);}
            if(rec.elapsed>=180)this.stopRecording();
        }
        const playing=this.playing;
        if(playing){
            playing.elapsed+=dt;let finished=true;
            for(const run of playing.runs){
                const s=this.ctx.samplePath(run.approach,playing.elapsed);
                const t=playing.elapsed-run.approach.duration;
                const desired=t<0?s:run.frames?.length?sampleDeskRecording(run.frames,t):run.setting;
                const end=run.approach.duration+(run.frames?.at(-1)?.t||0);finished&&=playing.elapsed>=end;
                if(!this.ctx.canPlace(run.r,desired)){
                    this.stop();this.ctx.status(run.r.state.name+': group Groove stopped because an object is ahead.');this.persist();return;
                }
                Object.assign(run.r.state,desired);this.place(run.r);
                if(run.r.id===this.selected)this.ctx.writeLive(run.r);
                else if(run.r.poseAt!==`${desired.height}:${desired.tilt}`){run.r.rig.updatePose(desired.height,desired.tilt);run.r.poseAt=`${desired.height}:${desired.tilt}`;}
            }
            if(finished){for(const run of playing.runs){run.r.state.lights=clone(run.setting.lights);this.ctx.lightDesk?.(run.r);}this.stop();this.persist();}
        }
        if(this.active){
            Object.assign(this.active.state,this.ctx.readLive(this.active));this.place(this.active);
            const poseAt=`${this.active.state.height}:${this.active.state.tilt}`;
            if(!playing&&this.active.poseAt!==poseAt){this.active.rig?.updatePose(this.active.state.height,this.active.state.tilt);this.active.poseAt=poseAt;}
            this.highlight.box.copy(this.ctx.liveBox());this.highlight.visible=this.ctx.rearrange();
        }
        for(const r of this.records.values())this.objects.phase(r);
        this.ctx.updateLights?.(dt);this.saveElapsed+=dt;if(this.saveElapsed>=1&&!playing){this.saveElapsed=0;this.capture();this.ctx.writeStore?.(SCENE_DESKS_KEY,cleanSceneDeskData(this.data));this.sync();}
    }
    sync(){this.ctx.sync?.(this);}
}
