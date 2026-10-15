import * as THREE from 'three';
import { roomDeskActivity, planRoomDeskActivity, obstacleForDesk } from './room-desk-activities.mjs';
import { deskFootprint, deskRoomBounds, deskObstacles } from './scene-desk-routing.mjs';
import { poseIsClear, segmentIsClear, angleDelta } from './room-groove.mjs';
import { minimumHeightForTilt } from './motion-limits.mjs';
import { visibleDeskBounds } from './desk-auto-stow.mjs';

const copy=v=>structuredClone(v);
const setting=r=>({pose:copy(r.state.pose),height:r.state.height,tilt:r.state.tilt,lights:copy(r.state.lights||{})});
const approach=(a,b,step)=>a+Math.sign(b-a)*Math.min(Math.abs(b-a),step);
const workChair=obj=>/chair|stool|steelcase-leap/.test(obj.userData.propId||'');
function routeSteps(move,from,to){
    move.durations||=move.route.slice(1).map((b,i)=>Math.max(Math.hypot(b.x-move.route[i].x,b.z-move.route[i].z)/420,Math.abs(angleDelta(move.route[i].yaw,b.yaw))/.4,.05));
    const points=[];let clock=0;
    for(let i=0;i<move.durations.length;i++){
        const duration=move.durations[i],end=clock+duration;
        if(end>from&&end<=to)points.push(move.route[i+1]);
        else if(to>=clock&&to<end){const a=move.route[i],b=move.route[i+1],u=(to-clock)/duration;points.push({x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,yaw:a.yaw+angleDelta(a.yaw,b.yaw)*u});break;}
        clock=end;
    }
    return points;
}
export function activityDeskFootprint(r){
    const f=deskFootprint(r),g=r.group,inverse=g.matrixWorld.clone().invert();
    const box=new THREE.Box3(new THREE.Vector3(f.offsetX-f.halfWidth,0,f.offsetZ-f.halfDepth),new THREE.Vector3(f.offsetX+f.halfWidth,1,f.offsetZ+f.halfDepth));
    for(const child of g.children)if(child.isGroup&&child.visible)box.union(visibleDeskBounds(child,inverse.clone().multiply(child.matrixWorld)));
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    return {...f,halfWidth:size.x/2,halfDepth:size.z/2,offsetX:center.x,offsetZ:center.z,margin:60};
}
export class SceneDeskActivities {
    constructor(manager){this.manager=manager;this.run=null;this.message='';this.preview=null;this.chairs=new Map();this.resolved=null;}
    get suggestion(){const m=this.manager;return this.resolved?.key===m.key+'/'+m.ctx.phase()?this.resolved:roomDeskActivity(m.ctx.sceneId(),m.ctx.phase(),m.records.size);}
    get hasHome(){const m=this.manager;return [...m.records.values()].some(r=>m.roomData?.activityHome?.[r.id]?.[r.state.size]);}
    clearanceSignature(){
        const m=this.manager,room=m.ctx.room(),excluded=new Set([...m.records.values()].map(r=>r.group.uuid));
        const keys=new Map(room.root.children.map(o=>[o.uuid,o.userData.sceneAssetKey||o.userData.propId||o.name]));
        for(const o of room.root.children)if(workChair(o))excluded.add(o.uuid);
        const values=this.obstacles().filter(o=>!excluded.has(o.id)).map(o=>[keys.get(o.id)||o.name,...['minX','maxX','minZ','maxZ'].map(k=>Math.round(o[k]))]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
        let hash=2166136261;for(const c of JSON.stringify(values)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');
    }
    start(returning=false){
        const m=this.manager,room=m.ctx.room();
        if(!room?.roomLayout||m.recording||this.run||!m.records.size)return false;
        if(!m.ctx.activityCanMove?.())return false;
        m.ctx.halt();m.capture();this.clearPreview();
        const activity=returning?{kind:'work',title:'Return to work layout'}:this.suggestion;
        if(activity.kind==='work'&&!this.hasHome){this.say('The desks are already in their work bays. Choose a partner, group or Storage Mode activity.');return false;}
        const homes=m.roomData.activityHome||={};
        const clearance=this.clearanceSignature();
        for(const r of m.records.values()){
            homes[r.id]||={};homes[r.id][r.state.size]||={...setting(r),clearance};
            // Upgrade return poses created by the first preview of this
            // feature, before furnishing fingerprints were included.
            homes[r.id][r.state.size].clearance||=clearance;
        }
        const selected=[...m.records.values()].filter(r=>activity.kind!=='work'||homes[r.id]?.[r.state.size]);
        this.run={kind:activity.kind,title:activity.title,stage:'lift',desks:selected,index:0,elapsed:0,finished:0,blocked:[],postureBlocked:new Set(),homes:copy(homes)};
        m.playing={activity:true};m.persist();this.say(activity.title+' · lifting safely before folding.');return true;
    }
    say(message){this.message=message;this.manager.sync();}
    apply(r,pose){
        const m=this.manager;
        Object.assign(r.state,pose);m.place(r);
        // The selected desk's separate dress rig must follow the live CAD too.
        if(r.poseAt!==`${r.state.height}:${r.state.tilt}`){r.rig.updatePose(r.state.height,r.state.tilt);r.poseAt=`${r.state.height}:${r.state.tilt}`;}
        if(r.id===m.selected)m.ctx.writeLive(r);
        r.peripherals?.update();m.objects.phase(r);m.objects.stow.update(r);
    }
    stop(){
        if(!this.run)return;
        this.run=null;this.clearPreview();this.message='Room routine stopped. Desks stay here; Return to work layout keeps the original positions.';
    }
    clearPreview(){if(!this.preview)return;this.preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.preview.removeFromParent();this.preview=null;}
    restoreChairs(){
        for(const c of this.chairs.values()){
            c.matrix.decompose(c.obj.position,c.obj.quaternion,c.obj.scale);
            if(c.daily)c.obj.userData.dailyDelta=c.daily;else delete c.obj.userData.dailyDelta;
            c.obj.updateMatrixWorld(true);
        }
        this.chairs.clear();
    }
    obstacles(r){
        const m=this.manager,ids=new Set([...m.records.values()].map(d=>d.group?.uuid));
        const fixed=deskObstacles(m.ctx.room(),r||{group:{uuid:''}}).filter(o=>!ids.has(o.id));
        for(const d of m.records.values())if(d!==r)fixed.push(obstacleForDesk({id:d.group.uuid,pose:d.state.pose,footprint:activityDeskFootprint(d)}));
        return fixed;
    }
    prepareChairs(){
        const m=this.manager,room=m.ctx.room(),run=this.run;
        room.root.updateWorldMatrix(true,true);
        for(const obj of room.root.children){
            if(!obj.userData.sceneAsset||!workChair(obj)||obj.userData.sceneDeskManaged)continue;
            if(!run.desks.some(r=>Math.hypot(obj.position.x-run.homes[r.id][r.state.size].pose.x,obj.position.z-run.homes[r.id][r.state.size].pose.z)<1700))continue;
            if(this.chairs.has(obj.uuid))continue;
            obj.updateMatrix();const yaw=obj.rotation.y,base=new THREE.Matrix4().makeRotationY(yaw).setPosition(obj.position.x,0,obj.position.z);
            const inverse=base.clone().invert().multiply(room.root.matrixWorld.clone().invert()),box=new THREE.Box3();
            obj.traverseVisible(o=>{if(!o.isMesh||!o.geometry||o.material?.isShaderMaterial)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));});
            if(box.isEmpty())continue;
            const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
            if(size.x>1300||size.z>1300)continue;
            const pose={x:obj.position.x,z:obj.position.z,yaw};
            this.chairs.set(obj.uuid,{id:obj.uuid,obj,matrix:obj.matrix.clone(),daily:copy(obj.userData.dailyDelta),pose,home:copy(pose),footprint:{halfWidth:size.x/2,halfDepth:size.z/2,offsetX:center.x,offsetZ:center.z,margin:25}});
        }
        const chairs=[...this.chairs.values()],ids=new Set(chairs.map(c=>c.id));
        if(!chairs.length){this.plan();return;}
        const obstacles=this.obstacles().filter(o=>!ids.has(o.id));
        const plan=planRoomDeskActivity({desks:chairs,bounds:deskRoomBounds(room),obstacles,kind:'storage'});
        run.chairMoves=plan.moves;run.chairIndex=0;run.elapsed=0;run.stage='chairs';
        this.say(run.title+' · parking work chairs in clear wall bays before rolling desks.');
    }
    moveChair(c,p){
        c.pose=p;const {obj}=c;obj.position.x=p.x;obj.position.z=p.z;obj.rotation.y=p.yaw;obj.updateMatrix();
        // Existing project export strips dailyDelta back to the owner's base
        // transform, including chairs that are outside RoomLife's usual set.
        const delta=obj.matrix.clone().multiply(c.matrix.clone().invert());
        if(c.daily)delta.multiply(new THREE.Matrix4().fromArray(c.daily));
        obj.userData.dailyDelta=delta.toArray();obj.updateMatrixWorld(true);
    }
    stepChairs(dt){
        const run=this.run,m=this.manager,move=run.chairMoves[run.chairIndex];
        if(!move){if(run.returningChairs){run.returningChairs=false;run.chairsDone=true;run.stage='travel';}else this.plan();return;}
        const c=this.chairs.get(move.id),steps=routeSteps(move,run.elapsed,run.elapsed+dt);run.elapsed+=dt;
        const room=m.ctx.room(),others=this.obstacles().filter(o=>o.id!==c.obj.uuid);
        for(const p of steps){if(!segmentIsClear(c.pose,p,deskRoomBounds(room),others,c.footprint)){run.chairIndex++;run.elapsed=0;return;}this.moveChair(c,p);}
        if(run.elapsed>=move.durations.reduce((a,b)=>a+b,0)){
            if(run.returningChairs){c.matrix.decompose(c.obj.position,c.obj.quaternion,c.obj.scale);if(c.daily)c.obj.userData.dailyDelta=c.daily;else delete c.obj.userData.dailyDelta;this.chairs.delete(c.id);}
            run.chairIndex++;run.elapsed=0;
        }
    }
    previewRoutes(plan){
        this.clearPreview();const root=new THREE.Group();root.userData.grooveMarker=true;root.name='Mobile desk activity routes';
        const color=plan.kind==='storage'?0xffb454:0x64dbbd;
        for(const move of plan.moves){
            const geometry=new THREE.BufferGeometry().setFromPoints(move.route.map(p=>new THREE.Vector3(p.x,12,p.z)));
            const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color,dashSize:120,gapSize:65,transparent:true,opacity:.65}));line.computeLineDistances();root.add(line);
            const ring=new THREE.Mesh(new THREE.RingGeometry(90,108,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.set(move.pose.x,14,move.pose.z);root.add(ring);
        }
        this.manager.ctx.room().root.add(root);this.preview=root;
    }
    plan(){
        const m=this.manager,room=m.ctx.room(),run=this.run;
        const desks=run.desks.map(r=>{
            const footprint=activityDeskFootprint(r),home=run.homes[r.id]?.[r.state.size];
            const destination=run.kind==='work'?home:r.state.phases[m.ctx.phase()];
            // Measure the final posture as well as the folded travel posture.
            // A broad worktop cannot unfold into an adjacent chair or desk.
            const oldTilt=r.state.tilt,oldHeight=r.state.height;
            const endTilt=destination?.tilt||0,endHeight=destination?.height||40,extents=[];
            // Reserve the entire unfolding envelope, including restored loose
            // items, rather than just the two endpoint postures.
            for(let n=0;n<=5;n++){
                const u=n/5;r.state.tilt=oldTilt+(endTilt-oldTilt)*u;r.state.height=Math.max(oldHeight+(endHeight-oldHeight)*u,minimumHeightForTilt(r.state.tilt,r.state.size));
                r.rig.updatePose(r.state.height,r.state.tilt);m.objects.phase(r);r.peripherals?.update();m.objects.stow.update(r);extents.push(activityDeskFootprint(r));
            }
            const minX=Math.min(...extents.map(f=>f.offsetX-f.halfWidth)),maxX=Math.max(...extents.map(f=>f.offsetX+f.halfWidth)),minZ=Math.min(...extents.map(f=>f.offsetZ-f.halfDepth)),maxZ=Math.max(...extents.map(f=>f.offsetZ+f.halfDepth));
            const targetFootprint={halfWidth:(maxX-minX)/2,halfDepth:(maxZ-minZ)/2,offsetX:(minX+maxX)/2,offsetZ:(minZ+maxZ)/2,margin:60};
            r.state.tilt=oldTilt;r.state.height=oldHeight;r.rig.updatePose(oldHeight,oldTilt);m.objects.phase(r);r.peripherals?.update();m.objects.stow.update(r);
            return {id:r.id,pose:copy(r.state.pose),size:r.state.size,footprint,targetFootprint};
        });
        const ids=new Set(run.desks.map(r=>r.group?.uuid));
        const obstacles=this.obstacles().filter(o=>!ids.has(o.id));
        const homes=Object.fromEntries(run.desks.map(r=>[r.id,run.homes[r.id]?.[r.state.size]]));
        const saved=run.kind==='work'?{}:Object.fromEntries(run.desks.filter(r=>r.state.phases[m.ctx.phase()]).map(r=>[r.id,r.state.phases[m.ctx.phase()]]));
        const clearance=this.clearanceSignature(),authoredReturns=run.kind==='work'?run.desks.filter(r=>homes[r.id]?.clearance===clearance).map(r=>r.id):[];
        const plan=planRoomDeskActivity({desks,bounds:deskRoomBounds(room),obstacles,kind:run.kind,homes,saved,authoredReturns});
        this.lastPlan={desks,bounds:deskRoomBounds(room),obstacles,...plan};
        if(plan.fallback){
            run.kind=plan.kind;run.title=plan.kind==='pairs'?'Partner work · paired desks':'Meeting area · open floor';
            this.resolved={key:m.key+'/'+m.ctx.phase(),kind:plan.kind,title:run.title,description:plan.fallback};
        }
        run.moves=plan.moves;run.blocked=plan.blocked;run.stage='travel';run.elapsed=0;
        this.previewRoutes(plan);this.say(run.title+` · ${plan.moves.length} clear routes${plan.blocked.length?' · '+plan.blocked.length+' desks remain in their bays':''}${plan.fallback?' · '+plan.fallback:''}.`);
    }
    update(dt){
        const run=this.run,m=this.manager;if(!run)return;
        if(!m.ctx.activityValid?.()){m.stop();m.persist();return;}
        if(run.stage==='lift'||run.stage==='fold'){
            let done=true;
            for(const r of run.desks){
                const height=approach(r.state.height,Math.max(43,minimumHeightForTilt(65,r.state.size)),2*dt);
                const tilt=run.stage==='fold'?approach(r.state.tilt,65,7*dt):r.state.tilt;
                this.apply(r,{height,tilt});done&&=run.stage==='lift'?Math.abs(height-43)<.01:Math.abs(tilt-65)<.01;
            }
            if(done){if(run.stage==='lift'){run.stage='fold';this.say(run.title+' · stowing desktop items and folding to 65°.');}else this.prepareChairs();}
            return;
        }
        if(run.stage==='chairs'){this.stepChairs(dt);return;}
        const move=run.moves[run.index];
        if(!move){
            if(run.kind==='work'&&!run.chairsDone&&this.chairs.size){
                const chairs=[...this.chairs.values()],ids=new Set(chairs.map(c=>c.id)),homes=Object.fromEntries(chairs.map(c=>[c.id,{pose:c.home}]));
                const plan=planRoomDeskActivity({desks:chairs,bounds:deskRoomBounds(m.ctx.room()),obstacles:this.obstacles().filter(o=>!ids.has(o.id)),kind:'work',homes});
                run.chairMoves=plan.moves;run.chairIndex=0;run.elapsed=0;run.returningChairs=true;run.stage='chairs';return;
            }
            // Blocked desks stay folded in Storage Mode. For work/grouping,
            // return their posture in place only if the full worktop fits.
            if(run.kind!=='storage'&&run.blocked.length&&run.stage!=='blocked-posture'){
                run.stage='blocked-posture';run.pending=run.blocked.map(id=>m.records.get(id));
            }
            if(run.stage==='blocked-posture'){
                let done=true;
                const clearance=this.clearanceSignature();
                for(const r of run.pending){const home=run.homes[r.id][r.state.size],atHome=Math.hypot(r.state.pose.x-home.pose.x,r.state.pose.z-home.pose.z)<.01&&Math.abs(angleDelta(r.state.pose.yaw,home.pose.yaw))<.0001;if(!this.settle(r,home,dt,atHome&&home.clearance===clearance)){done=false;}}
                if(!done)return;
            }
            const blocked=new Set([...run.blocked,...run.postureBlocked]).size,returned=run.kind==='work';
            this.run=null;m.playing=null;this.clearPreview();
            if(returned&&!blocked&&!this.chairs.size){for(const r of run.desks){delete m.roomData.activityHome[r.id]?.[r.state.size];if(!Object.keys(m.roomData.activityHome[r.id]||{}).length)delete m.roomData.activityHome[r.id];}}
            const inPlace=run.moves.filter(move=>move.inPlace).length;
            m.persist();this.say(`${run.title} · ${run.finished} desks ${returned?'returned':run.kind==='storage'?'in Storage Mode at 65°':'arranged'}${inPlace?` (${inPlace} in existing wall bays)`:''}${blocked?`; ${blocked} remain in a clear bay or folded because furniture limits movement`:''}${returned&&this.chairs.size?`; ${this.chairs.size} chairs remain parked until their original spots are clear`:''}.`);return;
        }
        const r=m.records.get(move.id);
        if(run.stage==='travel'){
            const steps=routeSteps(move,run.elapsed,run.elapsed+dt);run.elapsed+=dt;
            const room=m.ctx.room(),others=this.obstacles(r);
            for(const p of steps){
                const stationary=Math.hypot(r.state.pose.x-p.x,r.state.pose.z-p.z)<.01&&Math.abs(angleDelta(r.state.pose.yaw,p.yaw))<.0001;
                if(!(move.authoredReturn&&stationary)&&!segmentIsClear(r.state.pose,p,deskRoomBounds(room),others,{...move.footprint,margin:15})){
                    this.lastBlock={id:r.id,from:copy(r.state.pose),to:p,footprint:move.footprint,hits:others.filter(o=>!segmentIsClear(r.state.pose,p,deskRoomBounds(room),[o],{...move.footprint,margin:15})),plannedHits:this.lastPlan?.obstacles.filter(o=>!segmentIsClear(r.state.pose,p,deskRoomBounds(room),[o],{...move.footprint,margin:15}))};
                    m.stop();m.persist();this.say(r.state.name+': stopped because the route changed. Move the obstruction, then try again.');return;
                }
                this.apply(r,{pose:p});
            }
            if(run.elapsed>=move.durations.reduce((a,b)=>a+b,0)){run.stage='settle';this.say(run.title+` · ${run.index+1} of ${run.moves.length} · ${r.state.name}`);}
        }else if(run.stage==='settle'){
            const end=move.transit?{height:43,tilt:65}:move.setting||(run.kind==='storage'?{height:43,tilt:65}:{height:40,tilt:0});
            if(this.settle(r,end,dt,move.authoredReturn)){
                if(!move.transit&&!run.postureBlocked.has(r.id)){run.finished++;if(end.lights){r.state.lights=copy(end.lights);m.ctx.lightDesk?.(r);}}
                run.index++;run.elapsed=0;run.stage='travel';
            }
        }
    }
    settle(r,end,dt,authoredReturn=false){
        const tilt=approach(r.state.tilt,end.tilt,7*dt),height=Math.max(approach(r.state.height,end.height,2*dt),minimumHeightForTilt(tilt,r.state.size));
        const oldHeight=r.state.height,oldTilt=r.state.tilt;
        r.rig.updatePose(height,tilt);
        const obstacles=this.obstacles(r);
        const clear=authoredReturn||poseIsClear(r.state.pose,deskRoomBounds(this.manager.ctx.room()),obstacles,activityDeskFootprint(r));
        r.rig.updatePose(oldHeight,oldTilt);
        if(!clear){this.run?.postureBlocked.add(r.id);this.say(r.state.name+': worktop stays folded until nearby furniture is moved.');return true;}
        this.apply(r,{height,tilt});
        return Math.abs(height-end.height)<.01&&Math.abs(tilt-end.tilt)<.01;
    }
}
