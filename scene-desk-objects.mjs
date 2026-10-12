import * as THREE from 'three';
import { notebookTransform } from './notebook-transform.mjs';

export const DESK_SURFACES={desktop:'Desktop',shelf:'Top shelf','lower-shelf':'Lower shelf','base-shelf':'Base shelf'};
const phases=['morning','afternoon','evening','night','party'];
const plain=o=>({p:{x:o.position.x,y:o.position.y,z:o.position.z},q:{x:o.quaternion.x,y:o.quaternion.y,z:o.quaternion.z,w:o.quaternion.w},s:{x:o.scale.x,y:o.scale.y,z:o.scale.z}});
const apply=(o,t)=>{o.position.set(t.p.x,t.p.y,t.p.z);o.quaternion.set(t.q.x,t.q.y,t.q.z,t.q.w);if(Math.abs(o.quaternion.lengthSq()-1)>1e-9)o.quaternion.normalize();o.scale.set(t.s.x,t.s.y,t.s.z);o.updateMatrixWorld(true);};
const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};

// Local transforms belong to a desk surface, never to the room or live CAD.
// Authored IDs use their stable mount order; added IDs survive project imports.
export class SceneDeskObjects {
    constructor(manager){this.manager=manager;this.editing=false;this.selected=null;this.role='desktop';this.loading=false;this.drag=null;this.ready=Promise.resolve();this.library=[];}
    get current(){return this.manager.active?.objects?.get(this.selected);}
    capture(r){for(const [id,item] of r.objects||[])if(!item.saved.removed){item.saved.transform=plain(item.obj);r.state.objects[id]=item.saved;}}
    bind(r){
        if(r.objects)return;
        r.objects=new Map();r.state.objects||={};
        for(const [role,mount] of Object.entries(r.rig.mounts))for(const [i,obj] of [...mount.children].entries()){
            const id='default-'+role+'-'+i;
            const saved=r.state.objects[id]||{role,added:false,removed:false,label:this.manager.ctx.objectName?.(obj)||obj.name||'Desk object',transform:plain(obj)};
            this.register(r,id,obj,saved,obj.scale.clone());
        }
        const pending=Object.entries(r.state.objects).filter(([,s])=>s.added&&!s.removed).map(async([id,saved])=>{
            try{const obj=await this.manager.ctx.loadProp(saved.propId);if(this.manager.records.get(r.id)!==r||!r.rig){this.manager.ctx.disposeObject?.(obj);return;}
                this.register(r,id,obj,saved,new THREE.Vector3(1000,1000,1000));this.manager.sync();
            }catch(error){this.manager.ctx.status('Could not restore '+saved.label+'.');console.error('[Desk objects]',error);}
        });
        this.ready=Promise.all([this.ready,...pending]);
        this.phase(r);
    }
    // Purchased accessories retain their cart/export mounts. Only edited
    // transforms override the catalog layout, so normal sizing still adapts.
    syncAccessories(){
        const r=this.manager.active;if(!r?.product)return;
        const objects=this.manager.ctx.productAccessories(),live=new Set(objects);
        for(const [id,item] of r.objects)if(item.obj.userData.accessoryId&&!live.has(item.obj)){
            r.objects.delete(id);delete r.state.objects[id];if(this.selected===id)this.selected=null;
        }
        for(const obj of objects){
            const id='accessory-'+obj.userData.accessoryId;
            const item=r.objects.get(id);
            const previous=item?.saved||r.state.objects[id];
            if(obj.userData.accessoryId==='task-light'&&previous&&previous.clampMount!=='rear-edge-v1'){
                // Upgrade a saved freestanding lamp onto the rear edge once.
                // Keep its chosen side; subsequent clamp edits stay untouched.
                previous.transform.p.x=Math.max(-(r.state.size==='60x30'?762:610)+35,Math.min((r.state.size==='60x30'?762:610)-35,previous.transform.p.x));
                previous.transform.p.y=0;previous.transform.p.z=obj.position.z;
                previous.transform.q={x:0,y:0,z:0,w:1};
                previous.clampMount='rear-edge-v1';
            }
            if(item){if(item.saved.custom){this.purchaseMount(item.saved.role)?.add(obj);apply(obj,item.saved.transform);}continue;}
            const role=this.manager.ctx.accessoryRole(obj),saved=r.state.objects[id]||{role,added:false,removed:false,label:this.manager.ctx.objectName(obj),transform:plain(obj)};
            if(obj.userData.accessoryId==='task-light')saved.clampMount='rear-edge-v1';
            if(!saved.custom)saved.transform=plain(obj);
            this.register(r,id,obj,saved,new THREE.Vector3(1,1,1));
        }
        this.manager.sync();
    }
    purchaseMount(role){return this.manager.ctx.purchaseMount?.(role);}
    register(r,id,obj,saved,baseScale){
        const mount=r.rig.mounts[saved.role];if(!mount)return;
        // Keep the original object hidden when removed, so defaults never return
        // after switching desks or changing the active daypart.
        saved.transform=notebookTransform(obj,saved.transform);
        (r.product&&obj.userData.accessoryId?this.purchaseMount(saved.role):mount)?.add(obj);apply(obj,saved.transform);
        this.manager.ctx.unregisterProp?.(obj);
        obj.userData.deskObject={desk:r.id,id};obj.userData.sceneAsset=false;delete obj.userData.editorId;
        r.state.objects[id]=saved;r.objects.set(id,{id,obj,saved,baseScale});
        this.phase(r);
    }
    phase(r){
        const mode=this.manager.ctx.phase(),index=phases.indexOf(mode);
        for(const item of r.objects?.values()||[]){const o=item.obj;
            o.visible=!item.saved.removed&&(!o.userData.dressPhases||o.userData.dressPhases.includes(mode))&&(!o.userData.dailyInput||![2,4].includes(index));
            if(o.userData.dayKit)o.children.forEach((c,i)=>c.visible=i===index);
        }
    }
    select(id){this.selected=this.manager.active?.objects?.has(id)?id:null;this.manager.sync();}
    setEditing(on){this.editing=!!on;if(!on)this.endDrag();this.manager.sync();}
    async add(propId,role=this.role){
        const m=this.manager,r=m.active;if(!r||!r.rig.mounts[role]||this.loading||m.playing||m.recording)return false;
        if(Object.keys(r.state.objects||{}).length>=200){m.ctx.status('This desk has reached its 200 object limit.');return false;}
        this.loading=true;m.sync();const before=m.serialize();
        try{
            const obj=await m.ctx.loadProp(propId);
            if(m.records.get(r.id)!==r||!r.rig){m.ctx.disposeObject?.(obj);return false;}
            const id='object-'+crypto.randomUUID(),entry=m.ctx.propEntry(propId),max=Math.max(...(entry?.size||[100]));
            // Large library models start at a usable tabletop size. The editor
            // can restore 100% or choose any other scale.
            const scale=Math.min(1,400/max);obj.scale.multiplyScalar(scale);obj.position.set(0,-(entry?.min?.[1]||0)*scale,0);
            const saved={role,added:true,removed:false,propId,label:entry?.name||propId,transform:plain(obj)};
            this.register(r,id,obj,saved,new THREE.Vector3(1000,1000,1000));
            this.selected=id;this.role=role;this.editing=true;m.persist();m.ctx.edit?.(before,m.serialize());m.ctx.status(saved.label+' added to '+r.state.name+' · '+DESK_SURFACES[role]+'.');return id;
        }catch(error){m.ctx.status('Could not load this library object.');console.error('[Desk objects]',error);return false;}
        finally{this.loading=false;m.sync();}
    }
    change(values){
        const m=this.manager,item=this.current,r=m.active;if(!item||m.playing||m.recording)return false;
        const before=m.serialize(),o=item.obj;
        if(r.product&&o.userData.accessoryId)item.saved.custom=true;
        if(values.role&&r.rig.mounts[values.role]){(r.product&&o.userData.accessoryId?this.purchaseMount(values.role):r.rig.mounts[values.role]).add(o);item.saved.role=values.role;this.role=values.role;o.position.y=0;}
        for(const [field,axis] of [['x','x'],['y','y'],['z','z']])if(Number.isFinite(values[field]))o.position[axis]=Math.max(axis==='y'&&!o.userData.accessoryId?0:-5000,Math.min(5000,values[field]));
        if(Number.isFinite(values.rotation))o.rotation.y=THREE.MathUtils.degToRad(values.rotation);
        if(Number.isFinite(values.tilt))o.rotation.x=THREE.MathUtils.degToRad(values.tilt);
        if(Number.isFinite(values.roll))o.rotation.z=THREE.MathUtils.degToRad(values.roll);
        if(Number.isFinite(values.scale))o.scale.copy(item.baseScale).multiplyScalar(Math.max(1,Math.min(500,values.scale))/100);
        o.updateMatrixWorld(true);m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
    }
    remove(){
        const m=this.manager,r=m.active,item=this.current;if(!item||m.playing||m.recording)return false;
        const before=m.serialize();
        if(r.product&&item.obj.userData.accessoryId){
            m.ctx.removeAccessory(item.obj.userData.accessoryId);this.selected=null;m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
        }
        item.saved.removed=true;item.obj.visible=false;this.selected=null;
        if(item.saved.added){r.objects.delete(item.id);delete r.state.objects[item.id];m.ctx.disposeObject?.(item.obj);}
        m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
    }
    pick(e){
        const m=this.manager,rect=m.ctx.canvas.getBoundingClientRect();m.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);m.ray.setFromCamera(m.pointer,m.ctx.camera);
        const hit=m.ray.intersectObjects([m.ctx.room()?.root,m.ctx.liveObject(),...(m.active?.product?Object.values(m.active.rig.mounts):[]),...(m.active?.product?m.ctx.productAccessories():[])].filter(Boolean),true).find(h=>shown(h.object)&&!h.object.material?.isShaderMaterial);
        for(let o=hit?.object;o;o=o.parent)if(o.userData.deskObject)return{...o.userData.deskObject,hit};
        return null;
    }
    click(e){if(!this.editing)return false;if(this.suppressClick){this.suppressClick=false;return true;}const picked=this.pick(e);if(!picked)return false;this.manager.select(picked.desk);this.select(picked.id);return true;}
    down(e){
        const m=this.manager;if(!this.editing||e.target!==m.ctx.canvas||e.button!==0||m.playing||m.recording)return false;
        this.suppressClick=false;
        const picked=this.pick(e);if(!picked)return false;m.select(picked.desk);this.select(picked.id);m.ctx.halt();
        const item=this.current,parent=item.obj.parent;parent.updateWorldMatrix(true,false);
        const normal=new THREE.Vector3(0,1,0).transformDirection(parent.matrixWorld),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,picked.hit.point),point=new THREE.Vector3();
        if(!m.ray.ray.intersectPlane(plane,point))return false;
        this.drag={pointer:e.pointerId,plane,parent,last:parent.worldToLocal(point),controls:m.ctx.controls.enabled,before:m.serialize(),changed:false};
        m.ctx.controls.enabled=false;m.ctx.canvas.setPointerCapture(e.pointerId);m.ctx.canvas.style.cursor='grabbing';e.preventDefault();e.stopImmediatePropagation();return true;
    }
    moveDrag(e){
        const d=this.drag,m=this.manager;if(!d||d.pointer!==e.pointerId)return false;
        const rect=m.ctx.canvas.getBoundingClientRect();m.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);m.ray.setFromCamera(m.pointer,m.ctx.camera);const point=new THREE.Vector3();
        if(m.ray.ray.intersectPlane(d.plane,point)){d.parent.worldToLocal(point);const delta=point.clone().sub(d.last),o=this.current?.obj;if(o){if(m.active.product&&o.userData.accessoryId)this.current.saved.custom=true;o.position.x+=delta.x;o.position.z+=delta.z;o.updateMatrixWorld(true);d.changed||=delta.length()>.001;}d.last.copy(point);}
        e.preventDefault();e.stopImmediatePropagation();return true;
    }
    endDrag(e){const d=this.drag,m=this.manager;if(!d||(e&&d.pointer!==e.pointerId))return false;this.drag=null;this.suppressClick=d.changed;if(m.ctx.canvas.hasPointerCapture(d.pointer))m.ctx.canvas.releasePointerCapture(d.pointer);m.ctx.controls.enabled=d.controls;m.ctx.canvas.style.cursor='';m.persist();if(d.changed)m.ctx.edit?.(d.before,m.serialize());m.sync();if(e){e.preventDefault();e.stopImmediatePropagation();}return true;}
}
