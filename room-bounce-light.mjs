import * as THREE from 'three';
import { ROOM_FINISHES } from './room-polish.mjs?v=humboldt-commons-20261015';

// One diffuse bounce from twelve large architectural patches. This is an
// unoccluded radiosity approximation, not path tracing. Patch illumination is
// evaluated on the CPU; receivers use bounded Lambertian view factors. There
// are no extra Three lights, shadow maps or full-screen rendering passes.
export const ROOM_BOUNCE_FRAGMENT = `
uniform vec3 efBouncePosition[12];
uniform vec3 efBounceNormal[12];
uniform vec3 efBounceRadiance[12];
uniform float efBounceArea[12];
uniform float efBounceGain;
vec3 efRoomBounce(vec3 albedo) {
    if(efBounceGain<=0.0)return vec3(0.0);
    vec3 light=vec3(0.0),n=normalize(efRoomNormal);
    for(int i=0;i<12;i++) {
        vec3 ray=efBouncePosition[i]-efRoomPosition;
        float d2=dot(ray,ray);
        vec3 direction=ray*inversesqrt(max(d2,0.000001));
        float receiving=max(0.0,dot(n,direction));
        float emitting=max(0.0,dot(efBounceNormal[i],-direction));
        float viewFactor=efBounceArea[i]/max(0.000001,efBounceArea[i]+3.141593*d2);
        light+=efBounceRadiance[i]*receiving*emitting*viewFactor;
    }
    return light*albedo*efBounceGain;
}
`;

const byteLinear = value => { const c=value/255; return c<=.04045?c/12.92:((c+.055)/1.055)**2.4; };
function reflectance(mat) {
    const colour=mat.color.clone(),image=mat.map?.image;
    if(image && !image.data && typeof document!=='undefined'){
        try{
            const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,16,16);
            const data=ctx.getImageData(0,0,16,16).data,average=new THREE.Color(0);
            for(let i=0;i<data.length;i+=4){average.r+=byteLinear(data[i]);average.g+=byteLinear(data[i+1]);average.b+=byteLinear(data[i+2]);}
            colour.multiply(average.multiplyScalar(1/256));
        }catch{/* A cross-origin texture keeps its material colour. */}
    }
    // Keep plausible diffuse reflectance even for pure-white material bases.
    return colour.setRGB(Math.min(.85,colour.r),Math.min(.85,colour.g),Math.min(.85,colour.b));
}
export class RoomBounceLight {
    constructor(room) {
        this.room=room;this.enabled=false;this.patches=[];
        this.uniforms={efBouncePosition:{value:[]},efBounceNormal:{value:[]},efBounceRadiance:{value:[]},efBounceArea:{value:[]},efBounceGain:{value:0}};
        const {width:w,depth:d,height:h,back}=room.roomLayout;
        room.root.updateWorldMatrix(true,true);
        let floor=new THREE.Color((room.roomLayout?.finish||ROOM_FINISHES[room.id])?.ground||'#827565');
        // Use the floor's actual texture/colour, not the darker ground tint
        // used by the hemisphere light. This differentiates oak, carpet,
        // clinical vinyl and black rubber without room-specific guesses.
        for(const obj of room.root.children){
            if(!obj.isMesh || !obj.material?.isMeshStandardMaterial)continue;
            obj.geometry.computeBoundingBox();const bounds=obj.geometry.boundingBox.clone().applyMatrix4(obj.matrix),size=bounds.getSize(new THREE.Vector3());
            if(bounds.max.y<30 && size.x>=w*.9 && size.z>=d*.9){floor=reflectance(obj.material);break;}
        }
        const ceiling=room.ceilingSurface.children[0].material.color.clone();
        // Acoustic studios and dark hulls absorb more than painted plaster.
        let wall=new THREE.Color(['music','gaming','scifi'].includes(room.id)?'#565c61':'#d5cdbd');
        room.walls[0]?.obj.traverse(obj=>{
            if(!obj.isMesh || !obj.material?.isMeshStandardMaterial)return;
            obj.geometry.computeBoundingBox();const size=obj.geometry.boundingBox.getSize(new THREE.Vector3());
            if(size.y>=h*.8 && Math.max(size.x,size.z)>=Math.min(w,d)*.8)wall=reflectance(obj.material);
        });
        const patch=(at,normal,area,albedo,role)=>this.patches.push({at:new THREE.Vector3(...at),normal:new THREE.Vector3(...normal),area,albedo,role,base:new THREE.Color(0),radiance:new THREE.Vector3()});
        for(const x of [-w/4,w/4])for(const t of [.25,.75])patch([x,h-2,back+d*t],[0,-1,0],w*d/4,ceiling,'ceiling');
        for(const x of [-w/4,w/4])for(const t of [.25,.75])patch([x,2,back+d*t],[0,1,0],w*d/4,floor,'floor');
        patch([-w/2+2,h/2,back+d/2],[1,0,0],d*h,wall,'wall');
        patch([w/2-2,h/2,back+d/2],[-1,0,0],d*h,wall,'wall');
        patch([0,h/2,back+2],[0,0,1],w*h,wall,'wall');
        // The viewer's open front is a real aperture, not a reflecting wall.
        patch([0,h/2,back+d-2],[0,0,-1],0,wall,'aperture');
        this.refreshGeometry();
        this.uniforms.efBounceRadiance.value=this.patches.map(p=>p.radiance);
    }
    refreshGeometry() {
        const root=this.room.root;root.updateWorldMatrix(true,false);
        const normals=new THREE.Matrix3().getNormalMatrix(root.matrixWorld),scale=root.getWorldScale(new THREE.Vector3()).x;
        for(const p of this.patches){p.world=root.localToWorld(p.at.clone());p.facing=p.normal.clone().applyMatrix3(normals).normalize();p.worldArea=p.area*scale*scale;}
        this.uniforms.efBouncePosition.value=this.patches.map(p=>p.world);
        this.uniforms.efBounceNormal.value=this.patches.map(p=>p.facing);
        this.uniforms.efBounceArea.value=this.patches.map(p=>p.worldArea);
    }
    configure(lights,{enabled=false,mode='afternoon',ledStudio=false}={}) {
        this.enabled=enabled;this.uniforms.efBounceGain.value=enabled?1:0;
        this.refreshGeometry();
        const direct=Object.values(lights);this.room.root.traverse(o=>{if(o.isLight)direct.push(o);});
        const ray=new THREE.Vector3(),colour=new THREE.Color(),irradiance=new THREE.Color();
        for(const p of this.patches){
            irradiance.setRGB(0,0,0);
            for(const light of direct){
                let weight=0;
                if(light.isDirectionalLight){ray.copy(light.getWorldPosition(ray)).sub(light.target.getWorldPosition(new THREE.Vector3())).normalize();weight=Math.max(0,p.facing.dot(ray))*light.intensity;colour.copy(light.color);}
                else if(light.isPointLight){ray.copy(light.getWorldPosition(ray)).sub(p.world);const distance=ray.length();ray.normalize();const cutoff=light.distance>0?Math.max(0,1-(distance/light.distance)**4)**2:1;weight=Math.max(0,p.facing.dot(ray))*light.intensity*cutoff/Math.max(.25,distance**light.decay);colour.copy(light.color);}
                else if(light.isHemisphereLight){const sky=.5+.5*p.facing.y;colour.copy(light.groundColor).lerp(light.color,sky);weight=light.intensity*.3;}
                irradiance.add(colour.clone().multiplyScalar(weight));
            }
            // Energy is absorbed according to the architectural finish; a
            // low, capped bounce preserves pools, blacks and late-night mood.
            const gain=(ledStudio ? .36 : mode==='night'||mode==='party' ? .45 : .65)/Math.PI;
            p.base.copy(irradiance).multiply(p.albedo).multiplyScalar(gain);
            p.base.setRGB(Math.min(p.base.r,.7),Math.min(p.base.g,.7),Math.min(p.base.b,.7));
            p.radiance.set(p.base.r,p.base.g,p.base.b);
        }
        this.publish();
    }
    updateLeds(pixels,u) {
        if(!this.enabled)return;
        const rowColours=Array.from({length:8},()=>new THREE.Color(0));
        for(let row=0;row<8;row++){
            const c=rowColours[row];
            if(!pixels?.active)c.copy(u.efRoomColour.value);
            else{const count=u.efRoomCounts.value[row];for(let i=0;i<count;i++){const at=(row*pixels.width+i)*4;c.r+=byteLinear(pixels.data[at]);c.g+=byteLinear(pixels.data[at+1]);c.b+=byteLinear(pixels.data[at+2]);}c.multiplyScalar(1/count);}
        }
        const ray=new THREE.Vector3(),light=new THREE.Color(),source=new THREE.Vector3();
        for(const p of this.patches){
            light.setRGB(0,0,0);
            for(let row=0;row<8;row++){
                source.copy(u.efRoomStart.value[row]).lerp(u.efRoomEnd.value[row],.5);
                ray.copy(source).sub(p.world);const distance=ray.length(),range=u.efRoomRange.value[row]*2.5;
                const attenuation=Math.max(0,1-distance/Math.max(.0001,range))**2;
                const facing=Math.max(0,p.facing.dot(ray.divideScalar(Math.max(.0001,distance))));
                light.add(rowColours[row].clone().multiplyScalar(attenuation*facing*u.efRoomGain.value*.11));
            }
            light.multiply(p.albedo);p.radiance.set(p.base.r+light.r,p.base.g+light.g,p.base.b+light.b);
        }
        this.publish();
    }
    publish(){this.room.root.userData.bouncedLighting={enabled:this.enabled,patches:12,method:'single diffuse architectural bounce',energy:this.patches.reduce((sum,p)=>sum+p.radiance.length(),0)};}
}
