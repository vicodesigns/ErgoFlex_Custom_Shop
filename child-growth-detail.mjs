import * as THREE from 'three';

export const CHILD_GROWTH_PALETTES = {
    early: { name: 'Pale oak · sage · dusty blue', wood:'#c9aa7d', floor:'#dbc5a4', quilt:'#97aa91', cloth:'#86a0ab', accent:'#b88567', paper:'#f1e6cf', ink:'#405e58', rug:'#e7dfcc' },
    primary: { name: 'Oak · lagoon · golden ochre', wood:'#c5a577', floor:'#d9c6a9', quilt:'#7caaa0', cloth:'#d0b575', accent:'#b78655', paper:'#f0e8d5', ink:'#365f62', rug:'#e4ddca' },
    preteen: { name: 'Natural oak · denim · clay', wood:'#bc9d79', floor:'#d5c3a9', quilt:'#7d92a5', cloth:'#b68e7c', accent:'#6e8b7c', paper:'#ece4d5', ink:'#3e5865', rug:'#d9d8ce' },
    teen: { name: 'Smoked oak · slate · olive', wood:'#a98a67', floor:'#d1c1aa', quilt:'#727f8c', cloth:'#9ba489', accent:'#bd9a6b', paper:'#ece5d7', ink:'#344850', rug:'#d2d2c7' },
    college: { name: 'Walnut · petrol · warm linen', wood:'#937353', floor:'#cebea5', quilt:'#577c80', cloth:'#b4a18a', accent:'#b58e63', paper:'#ebe2d1', ink:'#32494d', rug:'#d5cdbd' }
};
const ageName={primary:'Elementary',preteen:'Preteen',teen:'High school',college:'College'};

// This layer changes surfaces and supported personal objects. The main room
// builder remains responsible for the bed/chair and floor-plan evolution.
export function enhanceChildGrowth({room,root,layout,helpers,materials,groups}) {
    const stage=CHILD_GROWTH_PALETTES[layout.ageStage]?layout.ageStage:'early';
    const palette=CHILD_GROWTH_PALETTES[stage];
    if(stage==='early'){root.userData.childGrowth={stage,palette:palette.name};return{update(){}};}
    const {box,mesh,rod,sphere,material,markSceneAsset}=helpers;
    const {bed,nook,rack,cubby,rug,left,floor}=groups;
    const own=t=>{(root.ownedTextures||=[]).push(t);return t;};
    const maps=new Map();
    const canvasMap=(key,draw,w=512,h=512)=>{
        if(maps.has(key))return maps.get(key);
        const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
        const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;own(t);maps.set(key,t);return t;
    };
    const clone=(source,color,roughness)=>{const m=source.clone();m.color.set(color);if(roughness!==undefined)m.roughness=roughness;m.userData.roomFinishLocked=true;m.needsUpdate=true;return m;};
    const remember=(obj,next)=>{if(obj.material){obj.replacedMaterials||=[];obj.replacedMaterials.push(...[].concat(obj.material));}obj.material=next;};
    const fixture=(parent,id,name,at=[0,0,0],turn=0,wall=false)=>{
        const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);
        g.userData.propId=id;g.userData.sceneAssetName=name;g.userData.childGrowthStage=stage;
        if(wall){g.userData.wallDecoration=true;g.userData.dropSurface=false;}
        markSceneAsset(g,{key:`childroom:${layout.id}:fixture:${id}`});return g;
    };
    const find=id=>{let match;root.traverse(o=>{if(o.userData.propId===id)match=o;});return match;};
    const geometrySize=obj=>{if(!obj.geometry)return new THREE.Vector3();obj.geometry.computeBoundingBox();return obj.geometry.boundingBox.getSize(new THREE.Vector3());};
    const printMat=map=>{const m=material('#ffffff',{map,roughness:.97,metalness:0});m.userData.roomFinishLocked=true;return m;};
    const paper=clone(materials.paper,palette.paper,.97),ink=clone(materials.ink,palette.ink,.76);
    const dark=material('#2f383b',{roughness:.58,metalness:0}),steel=material('#aeb7b7',{roughness:.35,metalness:.9});
    dark.userData.roomFinishLocked=steel.userData.roomFinishLocked=true;
    const covers=[palette.accent,palette.cloth,palette.ink,palette.quilt,'#bcad8f'];
    const coverMats=covers.map(c=>clone(materials.cream,c,.72));
    materials.oak.color.set(palette.wood);materials.oak.roughness=stage==='college'?.59:.56;
    floor?.traverse(o=>{if(o.isMesh&&o.material?.isMeshStandardMaterial){o.material.color.set(palette.floor);o.material.roughness=.67;}});
    const isFabric=m=>m?.userData.roomCraftFinish==='woven linen'||m?.userData.roomSurface==='fabric';
    nook?.traverse(o=>{if(o.isMesh&&isFabric(o.material))remember(o,clone(o.material,palette.cloth,.96));});
    // Cloth keeps the detailed padding from the common interior layer.
    bed?.traverse(o=>{
        if(!o.isMesh||!isFabric(o.material))return;
        const isQuilt=Math.abs(o.position.y-361)<.1;
        const isPillow=Math.abs(o.position.z+760)<.1;
        remember(o,clone(o.material,isQuilt?palette.quilt:isPillow?palette.paper:'#d7d1bf',.96));
    });
    // Early-only teaching props and pictorial motifs do not linger in a
    // teenager's bedroom, even if a prototype layout contained their groups.
    for(const id of ['sleeping-arch','felt-choice-board','growth-chart','wall-pocket','cloth-rabbit']){const o=find(id);if(o)o.visible=false;}
    rug?.traverse(o=>{if(o.name==='Woven story river · flat rug print')o.visible=false;});
    const rugBody=rug?.children.find(o=>o.isMesh&&Math.abs(geometrySize(o).y-8)<.01);
    if(rugBody)remember(rugBody,clone(rugBody.material,palette.rug,.98));
    const rugInk=canvasMap('rug', (c,w,h)=>{
        c.clearRect(0,0,w,h);c.strokeStyle=stage==='primary'?'rgba(74,127,128,.20)':'rgba(72,87,91,.14)';c.lineWidth=2;
        c.strokeRect(22,22,w-44,h-44);c.strokeRect(36,36,w-72,h-72);
        if(stage==='primary')for(let n=0;n<5;n++){c.beginPath();c.arc(w*(.16+n*.17),h*.5,15+n%2*8,0,Math.PI*2);c.stroke();}
        else{for(const x of [60,w-60])for(let y=50;y<h-40;y+=20){c.beginPath();c.moveTo(x-10,y);c.lineTo(x+10,y);c.stroke();}}
    },1024,768);
    const rugMat=material('#ffffff',{map:rugInk,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const rw=layout.tier?2200:1750,rd=layout.tier?1700:1300;
    const rugPrint=mesh(rug,new THREE.PlaneGeometry(rw-180,rd-180),rugMat,[0,9.1,0]);rugPrint.rotation.x=-Math.PI/2;rugPrint.castShadow=false;rugPrint.userData.presentationOnly=true;rugPrint.userData.dropSurface=false;

    function artwork(kind) {return canvasMap('art-'+kind,(c,w,h)=>{
        c.fillStyle=palette.paper;c.fillRect(0,0,w,h);
        const stroke=(col,width=5)=>{c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';};
        if(stage==='primary'){
            if(kind===0){c.fillStyle='#d1ad59';c.beginPath();c.arc(w*.48,h*.46,w*.16,0,Math.PI*2);c.fill();stroke('#5e8d91',4);for(let i=0;i<3;i++){c.beginPath();c.ellipse(w*.48,h*.46,w*(.23+i*.075),h*(.14+i*.055),-.38,0,Math.PI*2);c.stroke();}for(const [x,y,col]of [[.17,.4,'#a9785b'],[.73,.68,'#7e9a75'],[.77,.28,'#7796b1']]){c.fillStyle=col;c.beginPath();c.arc(w*x,h*y,13,0,Math.PI*2);c.fill();}}
            else{stroke('#5b8277',7);c.beginPath();c.moveTo(w*.5,h*.87);c.bezierCurveTo(w*.55,h*.59,w*.34,h*.43,w*.51,h*.15);c.stroke();for(let i=0;i<5;i++){c.fillStyle=i%2?'#88a38c':'#b7bc91';c.beginPath();c.ellipse(w*(.5+(i%2?-.09:.08)),h*(.25+i*.11),w*.13,h*.045,i%2?-.5:.5,0,Math.PI*2);c.fill();}}
        }else if(stage==='preteen'){
            if(kind===0){for(let i=0;i<4;i++){c.fillStyle=['#c6b4a0','#9caeb3','#778e9f','#5a737b'][i];c.beginPath();c.moveTo(0,h);c.lineTo(w*(.16+i*.05),h*(.49+i*.09));c.lineTo(w*(.43+i*.06),h*(.24+i*.13));c.lineTo(w,h*(.58+i*.04));c.lineTo(w,h);c.fill();}c.fillStyle='#caab74';c.beginPath();c.arc(w*.77,h*.23,w*.09,0,Math.PI*2);c.fill();}
            else{stroke('#7a92a2',3);for(let j=0;j<10;j++){c.beginPath();for(let x=0;x<=w;x+=8){const y=h*.2+j*h*.065+Math.sin(x/w*Math.PI*2+j*.35)*h*.06;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}c.fillStyle='#b18d7a';c.fillRect(w*.18,h*.68,w*.64,5);}
        }else if(stage==='teen'){
            if(kind===0){for(let i=0;i<4;i++){const x=w*(.14+(i%2)*.39),y=h*(.13+Math.floor(i/2)*.39);c.fillStyle=['#73868c','#b6ae93','#969d83','#8a8f9c'][i];c.fillRect(x,y,w*.32,h*.29);c.fillStyle='rgba(240,233,215,.6)';c.beginPath();c.moveTo(x,y+h*.29);c.lineTo(x+w*.18,y+h*.09);c.lineTo(x+w*.32,y+h*.29);c.fill();}}
            else{stroke('#6d7d80',5);for(let i=0;i<7;i++){c.beginPath();c.moveTo(w*.15,h*(.2+i*.085));c.bezierCurveTo(w*.4,h*(.08+i*.085),w*.62,h*(.42+i*.06),w*.86,h*(.2+i*.085));c.stroke();}c.fillStyle='#bca678';c.beginPath();c.arc(w*.73,h*.2,w*.07,0,Math.PI*2);c.fill();}
        }else{
            if(kind===0){stroke('#617c7c',4);for(let i=0;i<4;i++){const x=w*(.18+i*.16);c.beginPath();c.moveTo(x,h*.79);c.lineTo(x,h*.28+i*h*.025);c.lineTo(x+w*.13,h*.18+i*h*.025);c.lineTo(x+w*.13,h*.69);c.stroke();}stroke('#b39468',3);c.beginPath();c.moveTo(w*.14,h*.84);c.lineTo(w*.86,h*.84);c.stroke();}
            else{stroke('#688276',5);c.beginPath();c.moveTo(w*.46,h*.84);c.lineTo(w*.51,h*.18);c.stroke();for(let i=0;i<6;i++){c.fillStyle=i%2?'#8da18e':'#b3b99e';c.beginPath();c.ellipse(w*(i%2?.43:.57),h*(.23+i*.09),w*.12,h*.035,i%2?-.55:.55,0,Math.PI*2);c.fill();}}
        }
    });}
    for(const [index,id] of ['rainbow-print','forest-print'].entries()){
        const frame=find(id);if(!frame)continue;
        for(const o of frame.children)if(o.isMesh&&o.material?.map&&geometrySize(o).z<8)remember(o,printMat(artwork(index)));
        frame.name=`${ageName[stage]} · ${index?'personal print':'study print'}`;frame.userData.sceneAssetName=frame.name;
    }
    const personalGallery=find('drawing-gallery');
    if(personalGallery){personalGallery.name=ageName[stage]+' · personal work gallery';personalGallery.userData.sceneAssetName=personalGallery.name;let image=0;personalGallery.traverse(o=>{if(o.isMesh&&o.material?.map&&geometrySize(o).z<3)remember(o,printMat(artwork(image++%2)));});}
    const labels={primary:['Nature journal','Space explorer','Creative ideas','Reading club','Field notes'],preteen:['Sketchbook','Photo studies','Music notes','Reading list','Field journal'],teen:['Visual portfolio','Project notes','Sound & image','Revision guide','Personal journal'],college:['Course reader','Studio research','Design studies','Seminar notes','Field journal']}[stage];
    function book(parent,id,x,base,z,width,height,depth,index=0,flat=false){
        const g=new THREE.Group();g.name=labels[index%labels.length];g.position.set(x,base,z);parent.add(g);
        const cover=coverMats[index%coverMats.length];
        if(flat){box(g,[width,2,depth],[0,1,0],cover,1);box(g,[width-4,height-4,depth-4],[0,height/2,0],paper,1);box(g,[width,2,depth],[0,height-1,0],cover,1);return g;}
        box(g,[width-4,height-8,depth-8],[0,height/2,-4],paper,1);
        for(const side of [-1,1])box(g,[2,height,depth],[side*(width/2-1),height/2,0],cover,1);
        box(g,[width,height,8],[0,height/2,depth/2-4],cover,1);
        const label=canvasMap('spine-'+index,(c,w,h)=>{c.fillStyle=covers[index%covers.length];c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.rotate(-Math.PI/2);c.fillStyle='#eee8dc';c.textAlign='center';c.font='24px sans-serif';c.fillText(labels[index%labels.length],0,8);c.restore();},96,512);
        const spine=mesh(g,new THREE.PlaneGeometry(width-2,height-8),printMat(label),[0,height/2,depth/2+.15]);spine.castShadow=false;spine.userData.presentationOnly=true;return g;
    }
    if(rack){rack.name=ageName[stage]+' reading & reference library';rack.userData.sceneAssetName=rack.name;}
    if(cubby){cubby.name=ageName[stage]+' books & personal storage';cubby.userData.sceneAssetName=cubby.name;}
    let rackIndex=0;
    rack?.traverse(o=>{
        if(!o.isMesh||!o.material?.map||geometrySize(o).z>3)return;
        const index=rackIndex++%labels.length;
        const coverMap=canvasMap('rack-cover-'+index,(c,w,h)=>{
            c.fillStyle=palette.paper;c.fillRect(0,0,w,h);c.fillStyle=covers[index%covers.length];c.fillRect(0,h*.43,w,h*.57);
            c.strokeStyle=palette.ink;c.lineWidth=3;for(let i=0;i<5;i++){c.beginPath();c.moveTo(w*.13,h*(.51+i*.06));c.bezierCurveTo(w*.4,h*(.43+i*.06),w*.65,h*(.63+i*.04),w*.88,h*(.49+i*.07));c.stroke();}
            c.fillStyle=palette.ink;c.font='bold 19px sans-serif';c.textAlign='left';
            const words=labels[index].split(' ');words.forEach((word,i)=>c.fillText(word.toUpperCase(),w*.1,h*.18+i*24));
        },256,320);remember(o,printMat(coverMap));
    });
    const shelf=fixture(cubby,'growth-shelf-'+stage,`${ageName[stage]} books and hobbies`);
    for(let i=0;i<6;i++)book(shelf,'course-'+i,-585+i*48,322,-30,30+i%3*5,175+i%3*21,180,i);
    const tray=box(shelf,[430,12,300],[330,328,0],clone(materials.oak,palette.wood,.65),5);tray.name='Hobby tray · supported on upper shelf';
    if(stage==='primary'){
        const ring=mesh(shelf,new THREE.TorusGeometry(36,5,8,32),ink,[320,339,-25]);ring.rotation.x=Math.PI/2;
        box(shelf,[15,10,85],[320,339,53],ink,4);
        const glass=material('#c5dce1',{transparent:true,opacity:.28,depthWrite:false,roughness:.15});
        const lens=mesh(shelf,new THREE.CircleGeometry(31,32),glass,[320,339.2,-25]);lens.rotation.x=-Math.PI/2;lens.castShadow=false;
        sphere(shelf,[35,2,16],[210,336,-55],coverMats[2]);sphere(shelf,[31,2,19],[430,336,40],coverMats[1]);
    }else if(stage==='preteen'){
        book(shelf,'sketchbook',325,334,-10,260,20,200,0,true);
        box(shelf,[128,80,48],[325,394,-20],dark,7);box(shelf,[70,15,45],[300,441,-20],dark,3);
        const ring=mesh(shelf,new THREE.CylinderGeometry(33,33,26,28),steel,[335,396,17]);ring.rotation.x=Math.PI/2;
        const lens=mesh(shelf,new THREE.CylinderGeometry(27,27,3,28),material('#244048',{roughness:.15,metalness:.15}),[335,396,31.5]);lens.rotation.x=Math.PI/2;
    }else if(stage==='teen'){
        box(shelf,[300,35,170],[330,351.5,0],dark,6);
        for(let i=0;i<11;i++)box(shelf,[21,5,100],[218+i*22.5,371.5,12],paper,1);
        for(const i of [0,1,3,4,5,7,8,10])box(shelf,[12,8,56],[229+i*22.5,378,-10],dark,1);
        for(let i=0;i<3;i++)mesh(shelf,new THREE.CylinderGeometry(9,9,8,16),steel,[250+i*70,373,-62]);
    }else{
        book(shelf,'coursework',330,334,-10,280,24,210,0,true);
        book(shelf,'research',342,358,-6,252,20,195,2,true);
        box(shelf,[155,12,95],[330,384,0],dark,12);
        box(shelf,[90,2,6],[330,391,0],coverMats[1],1);
    }
    const top=fixture(cubby,'growth-cabinet-top-'+stage,`${ageName[stage]} personal shelf`);
    let stackY=616;for(let i=0;i<3;i++){const h=22+i%2*4;book(top,'stack-'+i,-390+i*8,stackY,-20,210-i*12,h,250-i*8,i,true);stackY+=h;}
    if(stage==='primary'){
        mesh(top,new THREE.CylinderGeometry(68,68,18,24),materials.oak,[440,625,40]);rod(top,[440,634,40],[440,744,40],9,steel);
        const globeMap=canvasMap('globe',(c,w,h)=>{c.fillStyle='#91b4bc';c.fillRect(0,0,w,h);c.fillStyle='#b1bb8c';for(const [x,y,sx,sy,a]of [[.2,.32,.12,.2,.3],[.57,.55,.1,.23,-.4],[.83,.27,.14,.14,.25]]){c.beginPath();c.ellipse(w*x,h*y,w*sx,h*sy,a,0,Math.PI*2);c.fill();}},512,256);
        mesh(top,new THREE.SphereGeometry(70,28,18),material('#ffffff',{map:globeMap,roughness:.65}),[440,814,40]);
    }else if(stage==='preteen'||stage==='teen'){
        box(top,[230,180,22],[440,706,80],materials.oak,4);box(top,[210,160,2],[440,706,92],printMat(artwork(stage==='teen'?0:1)));
        box(top,[190,18,95],[440,625,70],materials.oak,4);
    }else{
        const glaze=material('#aab3a4',{roughness:.36,metalness:0});glaze.userData.roomFinishLocked=true;
        mesh(top,new THREE.LatheGeometry([[0,0],[40,0],[50,105],[44,105],[37,38],[0,38]].map(([r,y])=>new THREE.Vector2(r,y)),24),glaze,[450,616,60]);
        mesh(top,new THREE.CylinderGeometry(43,43,4,20),material('#665644',{roughness:1}),[450,715,60]);
        const leaves=material('#748b73',{roughness:.9,metalness:0});
        for(let i=0;i<6;i++){const a=i*2.4,tip=[450+Math.cos(a)*68,780+i*14,60+Math.sin(a)*46];rod(top,[450,716,60],tip,3,leaves);const leaf=sphere(top,[27,48,8],tip,leaves);leaf.rotation.set(.25,a,.65);}
    }
    // A project board replaces the early picture-choice board. It is mounted
    // flush to the same clear left-wall bay, outside the furniture footprint.
    const board=fixture(left,'growth-project-board-'+stage,`${ageName[stage]} personal project board`,[-layout.width/2+10,stage==='primary'?1150:1390,880],Math.PI/2,true);
    box(board,[340,550,20],[0,0,0],materials.oak,6);
    const backing=clone(materials.linen,stage==='teen'?'#c9cec6':stage==='college'?'#bca183':'#d3d3be',.98);box(board,[310,520,2],[0,0,11],backing,4);
    const boardMap=canvasMap('project-board',(c,w,h)=>{
        c.fillStyle=stage==='teen'?'#c9cec6':stage==='college'?'#bca183':'#d3d3be';c.fillRect(0,0,w,h);
        c.fillStyle=palette.ink;c.font='bold 32px sans-serif';c.textAlign='center';c.fillText({primary:'Things to discover',preteen:'Ideas & interests',teen:'This week',college:'Research & ideas'}[stage],w/2,47);
        const notes={primary:['READ','OBSERVE','MAKE','SHARE'],preteen:['PHOTO STUDY','NEW MUSIC','SKETCH IDEAS','READ NEXT'],teen:['PROJECT','REVISION','CREATE','RESET'],college:['SEMINAR','STUDIO','READING','NEXT STEPS']}[stage];
        for(let i=0;i<4;i++){const x=30+(i%2)*228,y=85+Math.floor(i/2)*330;c.fillStyle=i%2?'#eee6d3':'#e3e6d9';c.fillRect(x,y,210,285);c.fillStyle=palette.ink;c.font='bold 19px sans-serif';c.textAlign='left';c.fillText(notes[i],x+14,y+31);c.strokeStyle='rgba(63,83,79,.35)';c.lineWidth=2;for(let j=0;j<5;j++){c.beginPath();c.moveTo(x+15,y+70+j*27);c.lineTo(x+165-(j%2)*35,y+70+j*27);c.stroke();}c.fillStyle=covers[i%covers.length];c.fillRect(x+15,y+223,165,34);}
    },512,900);
    const boardFace=mesh(board,new THREE.PlaneGeometry(300,508),printMat(boardMap),[0,0,12.2]);boardFace.castShadow=false;boardFace.userData.presentationOnly=true;
    const marker=mesh(board,new THREE.CircleGeometry(5,16),coverMats[0],[142,225,12.3]);marker.castShadow=false;
    root.userData.childGrowth={stage,palette:palette.name,books:labels,projects:true,hobby:{primary:'nature magnifier and globe',preteen:'camera and sketchbook',teen:'music keyboard and portfolio',college:'coursework and plant'}[stage]};
    return {update(mode){marker.visible=mode!=='night';}};
}
