import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A room-owned chair family in actual millimetres. Each instance reuses four
// geometry/material batches and retains its original editable placement root.
export function humboldtStudyChairs(room, layout, canvasMap) {
    const grain = canvasMap((c,w,h)=>{
        c.fillStyle='#b4946f';c.fillRect(0,0,w,h);
        for(let i=0;i<150;i++){const x=i*w/150;c.strokeStyle=i%3?'#6f4b2b28':'#e5c59344';c.lineWidth=.6+i%3*.3;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+Math.sin(i)*7,h/3,x-Math.cos(i)*5,h*.7,x,h);c.stroke();}
    },256,512);
    const weave=canvasMap((c,w,h)=>{
        c.fillStyle='#e8e6df';c.fillRect(0,0,w,h);
        for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=4){c.fillStyle=(x+y)%8?'#b8b9b2':'#fffdf3';c.fillRect(x,y,3,1);c.fillRect(x,y+1,1,3);}
    },128,128);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(4,4);
    const make=(name,color,roughness,extra={})=>{const m=new THREE.MeshStandardMaterial({name,color,roughness,...extra});m.userData.roomPaletteLocked=true;m.userData.roomFinishLocked=true;return m;};
    const oak=make('Oiled natural oak','#ffffff',.5,{map:grain}),glides=make('Graphite felt glides','#363a36',.92);
    const palettes={forest:'#3d5e51',lichen:'#838975',oat:'#b9b09b',clay:'#9a7a67'};
    const textiles=Object.fromEntries(Object.entries(palettes).map(([k,c])=>[k,make('Woven wool · '+k,c,.92,{map:weave,bumpMap:weave,bumpScale:.16*room.root.scale.x})]));
    const piping=Object.fromEntries(Object.entries(palettes).map(([k,c])=>[k,make('Upholstery welt · '+k,new THREE.Color(c).multiplyScalar(.77),.9)]));
    oak.bumpMap=grain.clone();oak.bumpMap.colorSpace=THREE.NoColorSpace;oak.bumpScale=.08*room.root.scale.x;
    for(const m of Object.values(textiles)){m.bumpMap=weave.clone();m.bumpMap.colorSpace=THREE.NoColorSpace;}
    oak.userData.roomSurface='wood';Object.values(textiles).forEach(m=>m.userData.roomSurface='fabric');
    const parts={oak:[],fabric:[],welt:[],glides:[]};
    const add=(kind,g,at=[0,0,0],rot=[0,0,0])=>{const n=g.index?g.toNonIndexed():g; if(n!==g)g.dispose();n.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1)));parts[kind].push(n);};
    const rounded=(kind,size,at,r)=>add(kind,new RoundedBoxGeometry(...size,3,r),at);
    const rail=(a,b,top,bottom=top,kind='oak')=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(top,bottom,v.length(),12);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));add(kind,g,new THREE.Vector3(...a).addScaledVector(v,.5).toArray());};
    for(const x of [-1,1])for(const z of [-1,1]){
        rail([x*242,9,z*228],[x*205,409,z*184],25,18);
        add('glides',new THREE.CylinderGeometry(18.5,18.5,9,12),[x*242,4.5,z*228]);
    }
    for(const x of [-1,1])add('oak',new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x*205,392,-184),new THREE.Vector3(x*212,640,-181),new THREE.Vector3(x*217,753,-196)]),12,20,10,false));
    rounded('oak',[506,24,480],[0,405,8],12);
    rounded('fabric',[486,56,458],[0,442,12],27);
    // Bowed back with a softly rounded timber edge and an inset upholstered pad.
    for(const [kind,size,center,r]of [['oak',[510,272,26],[0,657,-227],61],['fabric',[461,231,36],[0,654,-204],53]]){
        const [w,h,d]=size,shape=new THREE.Shape();shape.moveTo(r,0);shape.lineTo(w-r,0);shape.quadraticCurveTo(w,0,w,r);shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(r,h);shape.quadraticCurveTo(0,h,0,h-r);shape.lineTo(0,r);shape.quadraticCurveTo(0,0,r,0);
        const g=new THREE.ExtrudeGeometry(shape,{depth:d-6,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:3,bevelThickness:3,curveSegments:10});g.translate(-w/2,-h/2,-d/2+3);const p=g.attributes.position;
        for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+(x/255)**2*63-y*.15);}
        g.computeVertexNormals();add(kind,g,center);
    }
    const x=237,z=221,r=26,y=443;
    const pts=[];for(const [cx,cz,a]of [[x-r,z-r,0],[-x+r,z-r,Math.PI/2],[-x+r,-z+r,Math.PI],[x-r,-z+r,Math.PI*1.5]])for(let i=0;i<=7;i++){const t=a+i*Math.PI/14;pts.push(new THREE.Vector3(cx+Math.cos(t)*r,y,cz+Math.sin(t)*r+12));}
    // A closed, interpolated welt follows the cushion perimeter.
    add('welt',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),64,1.7,5,true));
    const geometries=Object.fromEntries(Object.entries(parts).map(([k,a])=>{const g=mergeGeometries(a);a.forEach(o=>o.dispose());return[k,g];}));
    return (object,placement)=>{
        const nearest=layout.cafe.reduce((best,p,i)=>Math.hypot(p[0]-placement.at[0],p[1]-placement.at[2])<best.distance?{index:i,distance:Math.hypot(p[0]-placement.at[0],p[1]-placement.at[2])}:best,{index:0,distance:Infinity}),cafe=nearest.distance<1000,table=nearest.index;
        const color=placement.finish==='group-forest'?'forest':cafe?['oat','lichen','oat','clay'][table%4]:placement.at[0]<500?'lichen':'forest';
        object.clear();const model=new THREE.Group();model.name='Humboldt oak study chair';model.scale.setScalar(1/object.scale.x);object.add(model);
        for(const [part,g]of Object.entries(geometries)){const m=new THREE.Mesh(g,part==='oak'?oak:part==='glides'?glides:part==='welt'?piping[color]:textiles[color]);m.castShadow=m.receiveShadow=true;model.add(m);}
        object.name='Oak study chair · '+color;object.userData.sceneAssetName=object.name;
        object.userData.humboldtChair={finish:color,seatHeight:470,width:510,height:807};object.userData.decorUpgrade='humboldt-oak-study-chair';
    };
}

// Cordless table lamps give the café and reading tables their own evening
// rhythm. They use small emissive lenses and table pools, not extra real lights.
export function humboldtReadingDetails(room, layout, h) {
    const {mesh,material,markSceneAsset}=h,root=room.root,lamps=[];
    const body=material('#716b59',{roughness:.42,metalness:.65}),ceramic=material('#d9d0bb',{roughness:.36}),lens=material('#f2dfbd',{emissive:'#ffd7a1',emissiveIntensity:0,roughness:.5});
    body.userData.roomPaletteLocked=ceramic.userData.roomPaletteLocked=true;body.userData.roomFinishLocked=ceramic.userData.roomFinishLocked=true;
    const shadeGeo=new THREE.LatheGeometry([[0,0],[59,0],[65,5],[61,16],[37,60],[29,65],[0,65]].map(v=>new THREE.Vector2(...v)),32);
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),fade=ctx.createRadialGradient(32,32,0,32,32,32);fade.addColorStop(0,'#ffffff');fade.addColorStop(.3,'#ffffff88');fade.addColorStop(1,'#ffffff00');ctx.fillStyle=fade;ctx.fillRect(0,0,64,64);const poolMap=new THREE.CanvasTexture(c);
    const add=(table,at,index,cafe)=>{
        const g=new THREE.Group();g.name='Commons reading lamp';g.position.set(...at);table.add(g);g.userData.humboldtReadingLamp=true;
        markSceneAsset(g,{key:`library:humboldt:fixture:reading-lamp-${index}`});
        mesh(g,new THREE.CylinderGeometry(49,54,12,32),body,[0,6,0]);mesh(g,new THREE.CylinderGeometry(7,9,170,16),body,[0,95,0]);
        mesh(g,shadeGeo,ceramic,[0,177,0]);const m=lens.clone();mesh(g,new THREE.CylinderGeometry(55,55,2,32),m,[0,176,0]);
        const glow=new THREE.MeshBasicMaterial({color:'#ffd8a9',map:poolMap,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
        const pool=mesh(g,new THREE.PlaneGeometry(300,300),glow,[0,.8,0]);pool.rotation.x=-Math.PI/2;pool.castShadow=pool.receiveShadow=false;pool.userData.presentationOnly=true;pool.userData.lightPool=true;
        lamps.push({g,m,glow,cafe,index});
    };
    layout.tables.forEach((t,i)=>{const table=root.children.find(o=>o.userData.humboldtTable===t.id);const along=t.size[0]>=t.size[1];add(table,along?[t.size[0]/2-140,750,0]:[0,750,t.size[1]/2-140],i,false);});
    layout.cafe.forEach((p,i)=>{if(i%2===0){const table=root.children.find(o=>o.userData.propId===`humboldt-cafe-${i}`);add(table,[0,750,0],7+i,true);}});
    // Small stoneware vases occupy the quiet centre of the other café tables.
    const vaseGeo=new THREE.LatheGeometry([[0,0],[28,0],[34,8],[36,60],[29,95],[19,104],[16,104],[16,95],[29,60],[26,9],[0,9]].map(v=>new THREE.Vector2(...v)),24);
    const stems=[],leaves=[],up=new THREE.Vector3(0,1,0);
    for(let i=0;i<3;i++){
        const a=new THREE.Vector3(0,85,0),b=new THREE.Vector3((i-1)*37,195+i%2*22,(i%2?1:-1)*20),v=b.clone().sub(a),g=new THREE.CylinderGeometry(1,1.6,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,v.clone().normalize()));g.translate(...a.clone().addScaledVector(v,.5).toArray());stems.push(g);
        for(let k=0;k<4;k++){const leaf=new THREE.SphereGeometry(1,8,6);leaf.scale(24,2.5,8);leaf.rotateZ((k%2?1:-1)*.45);leaf.rotateY(i*.8);leaf.translate(...a.clone().addScaledVector(v,.35+k*.17).add(new THREE.Vector3((k%2?1:-1)*16,0,0)).toArray());leaves.push(leaf);}
    }
    const stemGeo=mergeGeometries(stems),leafGeo=mergeGeometries(leaves);[...stems,...leaves].forEach(g=>g.dispose());
    const stemMat=material('#726247',{roughness:.9}),leafMat=material('#58735a',{roughness:.83});
    layout.cafe.forEach((p,i)=>{if(i%2){const table=root.children.find(o=>o.userData.propId===`humboldt-cafe-${i}`),vase=new THREE.Group();vase.name='Stoneware greenery vase';vase.position.y=750;table.add(vase);markSceneAsset(vase,{key:`library:humboldt:fixture:botanical-vase-${i}`});mesh(vase,vaseGeo,ceramic);mesh(vase,stemGeo,stemMat);mesh(vase,leafGeo,leafMat);}});
    return phase=>{
        const power={morning:.08,afternoon:.12,evening:.85,night:.03,party:.65}[phase]??.12;
        for(const l of lamps){l.m.emissiveIntensity=power*(l.cafe?1:.8);l.glow.opacity=phase==='night'?0:power*.13;}
        root.userData.humboldtReadingDetail={phase,lamps:lamps.length,vases:5,power};
    };
}
