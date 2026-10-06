import * as THREE from 'three';

const fragment = `
uniform vec3 efRoomStart[8];
uniform vec3 efRoomEnd[8];
uniform float efRoomRange[8];
uniform float efRoomGain;
uniform float efRoomPixels;
uniform vec3 efRoomColour;
uniform sampler2D efRoomTexture;
uniform float efRoomWidth;
uniform float efRoomCounts[8];
varying vec3 efRoomPosition;
varying vec3 efRoomNormal;
vec3 efRoomLinear(vec3 c) {
    return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));
}
vec3 efRoomSample(float t, int row) {
    float count=efRoomCounts[row],pixel=clamp(t*count-0.5,0.0,count-1.0);
    vec3 a=texture2D(efRoomTexture,vec2((floor(pixel)+0.5)/efRoomWidth,(float(row)+0.5)/8.0)).rgb;
    vec3 b=texture2D(efRoomTexture,vec2((min(count-1.0,floor(pixel)+1.0)+0.5)/efRoomWidth,(float(row)+0.5)/8.0)).rgb;
    return mix(efRoomLinear(a),efRoomLinear(b),fract(pixel));
}
vec3 efRoomLight(vec3 albedo) {
    vec3 light=vec3(0.0),n=normalize(efRoomNormal);
    for(int row=0;row<8;row++) {
        vec3 segment=efRoomEnd[row]-efRoomStart[row];
        float t=clamp(dot(efRoomPosition-efRoomStart[row],segment)/max(dot(segment,segment),0.000001),0.0,1.0);
        vec3 ray=efRoomStart[row]+t*segment-efRoomPosition;
        float distance=length(ray),falloff=max(0.0,1.0-distance/max(0.0001,efRoomRange[row]));
        float facing=max(0.0,dot(n,ray/max(distance,0.00001)));
        vec3 colour=efRoomColour;
        if(efRoomPixels>0.5)colour=efRoomSample(t,row);
        // Broad, soft reflected pools. Material colour still controls response:
        // dark acoustic fabric absorbs more than a pale or polished floor.
        light+=colour*falloff*falloff*facing*(row==7?1.2:0.38);
    }
    return light*efRoomGain*(vec3(0.08)+sqrt(max(albedo,vec3(0.0)))*0.92);
}
`;
const visible = obj => {for(let p=obj;p;p=p.parent)if(!p.visible)return false;return true;};

// Local line-light spill uses the same display atlas as the desk reflections.
// No extra shadow maps or room-wide point lights: eight bounded source fields.
export class RoomLedSpill {
    constructor() {
        this.root=null;this.bindings=[];this.materials=new Map();
        this.uniforms={efRoomStart:{value:Array.from({length:8},()=>new THREE.Vector3())},efRoomEnd:{value:Array.from({length:8},()=>new THREE.Vector3())},
            efRoomRange:{value:Array(8).fill(0)},efRoomGain:{value:0},efRoomPixels:{value:0},efRoomColour:{value:new THREE.Color()},
            efRoomTexture:{value:null},efRoomWidth:{value:15},efRoomCounts:{value:Array(8).fill(14)}};
    }
    bind(room) {
        this.dispose();this.root=room?.root;if(!this.root)return;
        this.root.traverse(obj=>{
            if(!obj.isMesh)return;
            const patch=source=>{
                if(!source?.isMeshStandardMaterial||source.transparent||source.emissive?.getHex()!==0)return source;
                if(this.materials.has(source))return this.materials.get(source);
                const mat=source.clone(),priorCompile=source.onBeforeCompile,priorKey=source.customProgramCacheKey();
                mat.onBeforeCompile=(shader,renderer)=>{
                    priorCompile.call(mat,shader,renderer);Object.assign(shader.uniforms,this.uniforms);
                    shader.vertexShader='varying vec3 efRoomPosition; varying vec3 efRoomNormal;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
                        vec4 efRoomVertex=vec4(transformed,1.0);
                        #ifdef USE_INSTANCING
                            efRoomVertex=instanceMatrix*efRoomVertex;
                        #endif
                        efRoomPosition=(modelMatrix*efRoomVertex).xyz;
                        efRoomNormal=normalize(mat3(modelMatrix)*objectNormal);`);
                    shader.fragmentShader=fragment+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=efRoomLight(diffuseColor.rgb);\n#include <opaque_fragment>`);
                };
                mat.customProgramCacheKey=()=>priorKey+'|room-led-spill-v1';mat.needsUpdate=true;
                this.materials.set(source,mat);return mat;
            };
            const original=obj.material;obj.material=Array.isArray(original)?original.map(patch):patch(original);
            if(obj.material!==original)this.bindings.push({obj,original});
        });
    }
    update(room,pixels,{enabled,colour,gain}) {
        if(room?.root!==this.root)this.bind(room);
        this.uniforms.efRoomGain.value=enabled?gain:0;
        if(!this.root||!pixels)return;
        const u=this.uniforms;u.efRoomPixels.value=pixels.active?1:0;u.efRoomColour.value.copy(colour);
        u.efRoomTexture.value=pixels.texture;u.efRoomWidth.value=pixels.width;u.efRoomCounts.value=pixels.uniforms.efPixelCounts.value;
        const scale=this.root.scale.x;
        for(let row=0;row<8;row++){
            // Extended desktop bindings follow the visible 60-inch strips.
            const source=pixels.bindings.filter(b=>b.stripId===row&&visible(b.mesh)).at(-1);
            if(!source){u.efRoomRange.value[row]=0;continue;}
            const b=source.mesh.geometry.boundingBox,center=b.getCenter(new THREE.Vector3());
            source.mesh.updateWorldMatrix(true,false);
            const a=center.clone(),z=center.clone();a[source.axis]=source.min;z[source.axis]=source.max;
            u.efRoomStart.value[row].copy(a).applyMatrix4(source.mesh.matrixWorld);
            u.efRoomEnd.value[row].copy(z).applyMatrix4(source.mesh.matrixWorld);
            u.efRoomRange.value[row]=scale*(row===7?1700:2100);
        }
        this.root.userData.ledSpill={receivers:this.bindings.length,active:enabled,gain:u.efRoomGain.value,sources:8};
    }
    dispose() {
        for(const {obj,original} of this.bindings)obj.material=original;
        for(const mat of this.materials.values())mat.dispose();
        this.bindings=[];this.materials.clear();this.root=null;
    }
}
