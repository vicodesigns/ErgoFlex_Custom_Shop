import * as THREE from 'three';

export const GAMING_SESSIONS = {
    morning: { title:'RESET & RECHARGE', sign:'OFFLINE', accent:'#a4c6c3', sub:'A fresh start / a clear setup', rows:['Charge the handheld','Choose the next world','Coffee / notes / reset'] },
    afternoon: { title:'PRACTICE & STREAM', sign:'ON AIR', accent:'#e5a39b', sub:'Practice arena / stream ready', rows:['Session plan ready','Microphone / levels / scene','Save a highlight'] },
    evening: { title:'CO-OP ADVENTURE', sign:'CO-OP', accent:'#88c7d1', sub:'Two controllers / one adventure', rows:['Pick up where we left off','Make room on the sofa','Shared play / shared snacks'] },
    night: { title:'SOLO EXPLORATION', sign:'QUIET', accent:'#b2b2d8', sub:'Low light / headphones / one more chapter', rows:['Quiet audio setup','Handheld on charge','Save / settle / unwind'] },
    party: { title:'LOCAL GAME NIGHT', sign:'GAME NIGHT', accent:'#deb383', sub:'Local lobby / everyone gets a turn', rows:['Four colours / four players','Choose teams / swap seats','Keep the scores / pass the pads'] }
};

// Existing wall artwork and light box get reusable canvases, not new textures
// on each activity change. The sign describes the scene, not a real broadcast.
export function gamingSessionMaps() {
    const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const m=new THREE.CanvasTexture(c);m.colorSpace=THREE.SRGBColorSpace;return m;};
    const poster=make(768,768),sign=make(512,160);
    const update=phase=>{
        const s=GAMING_SESSIONS[phase]||GAMING_SESSIONS.evening,c=poster.image.getContext('2d');
        c.fillStyle='#182430';c.fillRect(0,0,768,768);
        c.fillStyle=s.accent;c.font='600 22px sans-serif';c.fillText('PLAYER SPACE / DAILY SESSIONS',42,56);
        // A small original isometric game landscape ties the room to play.
        for(let i=0;i<6;i++){c.strokeStyle=['#456779','#608c99',s.accent][i%3];c.lineWidth=4;c.beginPath();c.moveTo(60,170+i*31);c.lineTo(300,285+i*19);c.lineTo(690,150+i*35);c.stroke();}
        c.fillStyle=s.accent;c.beginPath();c.arc(590,142,22,0,7);c.fill();
        c.fillStyle='#ecede6';c.font='bold 43px sans-serif';c.fillText(s.title,42,460,690);
        c.fillStyle='#a9bec6';c.font='23px sans-serif';c.fillText(s.sub,43,501,680);
        c.fillStyle=s.accent;c.fillRect(42,531,684,2);
        s.rows.forEach((row,i)=>{c.fillStyle=i?'#b6c6cb':'#e5ece4';c.font='27px sans-serif';c.fillText(`${String(i+1).padStart(2,'0')}  ${row}`,43,585+i*55,682);});
        const a=sign.image.getContext('2d');a.fillStyle=phase==='afternoon'?'#28171c':'#17212d';a.fillRect(0,0,512,160);
        a.strokeStyle=s.accent;a.lineWidth=4;a.strokeRect(14,14,484,132);a.fillStyle=s.accent;a.font=`bold ${phase==='party'?52:76}px sans-serif`;a.textAlign='center';a.textBaseline='middle';a.fillText(s.sign,256,84,465);
        poster.needsUpdate=sign.needsUpdate=true;return s;
    };
    update('evening');return {poster,sign,update};
}

// Older procedural keys include their list position. New seating must not
// orphan a user's edit or deletion of a uniquely named existing fixture.
export function migrateGamingSavedAssetKeys(objects,state,layout) {
    const prefix=`scene:gaming:${layout.id}:placement:`;
    const identity=key=>key.startsWith(prefix)?key.slice(prefix.length).match(/^\d+:\d+:(.+)$/)?.[1]:null;
    const oldKeys=[...new Set([...state.transforms.keys(),...state.removed])];
    const currentNames=objects.map(o=>identity('scene:'+o.userData.sceneAssetKey));
    for(const obj of objects){
        const key='scene:'+obj.userData.sceneAssetKey,name=identity(key);
        if(!name||currentNames.filter(n=>n===name).length!==1||state.transforms.has(key)||state.removed.has(key))continue;
        const aliases=oldKeys.filter(old=>old!==key&&identity(old)===name);
        if(aliases.length!==1)continue;
        if(state.transforms.has(aliases[0]))state.transforms.set(key,state.transforms.get(aliases[0]));
        if(state.removed.has(aliases[0]))state.removed.add(key);
    }
}

export function migrateGamingSavedFurniture(obj,saved,l) {
    if(!saved?.p||!saved.q||!saved.s)return saved;
    const front=l.back+l.depth,old=[];
    const rug=obj.userData.gamingRug;
    if(rug&&Object.values(saved.s).every(v=>Math.abs(v-1)<.00001)&&Math.abs(saved.q.x)+Math.abs(saved.q.y)+Math.abs(saved.q.z)<.00001){
        const p=rug==='desk'?[l.desk[0],4,l.desk[1]+650]:[-l.width/2+1400,4,l.loungeZ];
        if(['x','y','z'].every((k,i)=>Math.abs(saved.p[k]-p[i])<.1))return {...saved,p:{x:obj.position.x,y:obj.position.y,z:obj.position.z}};
    }
    if(!l.compact&&obj.name==='Abstract gaming artwork'){
        const a=-Math.PI/4,q=saved.q;
        if(Math.abs(saved.p.x-(l.width/2-24))<.1&&Math.abs(saved.p.y-1750)<.1&&Math.abs(saved.p.z-350)<.1&&Object.values(saved.s).every(v=>Math.abs(v-1)<.001)&&Math.abs(q.x)+Math.abs(q.z)<.00001&&Math.abs(Math.abs(q.y*Math.sin(a)+q.w*Math.cos(a))-1)<.00001)return {...saved,p:{...saved.p,y:l.height-400}};
    }
    if(l.compact&&obj.userData.propId==='kenney-furniture-lamp-square-floor')old.push([-l.width/2+160,0,front-280,0]);
    if(l.large&&obj.userData.propId==='ergoflex-game-table')old.push([400,0,front-950,0]);
    if(l.large&&obj.userData.propId==='game-controller')old.push([400,740,front-950,-15]);
    for(const [x,y,z,turn] of old){
        const a=turn*Math.PI/360,q=saved.q;
        if(Math.max(Math.abs(saved.p.x-x),Math.abs(saved.p.y-y),Math.abs(saved.p.z-z))>.1||Object.values(saved.s).some(v=>Math.abs(v-1000)>.001)||Math.abs(q.x)+Math.abs(q.z)>.00001||Math.abs(Math.abs(q.y*Math.sin(a)+q.w*Math.cos(a))-1)>.00001)continue;
        const p=l.props.find(p=>p.id===obj.userData.propId&&(obj.userData.propId!=='game-controller'||p.at[1]===740));
        if(p)return {...saved,p:{x:p.at[0],y:p.at[1],z:p.at[2]}};
    }
    return saved;
}

export function buildGamingSessionDetail(room,layout,h) {
    const {box,mesh,rod,material,markSceneAsset}=h,root=room.root;
    const variants=[];
    let current='evening';
    // Own materials for furniture that arrives after the procedural room pass.
    const palette=()=>{
        const m={felt:material('#39434e',{roughness:.97}),fabric:material('#8e969a',{roughness:.97}),metal:material('#b2bac1',{roughness:.36,metalness:.85}),shell:material('#232c36',{roughness:.65}),paper:material('#e1d9c8',{roughness:.94})};
        for(const [key,kind]of[['felt','fabric'],['fabric','fabric'],['metal','metal'],['shell','powder']])m[key].userData.roomSurface=kind;
        return m;
    };
    const decorate=(obj,placement)=>{
        if(!['coffee-table','kenney-furniture-lounge-sofa-ottoman'].includes(placement.id))return;
        const compact=placement.id.endsWith('ottoman'),m=palette();
        const kit=new THREE.Group();kit.name='Player valet · activity details';kit.scale.setScalar(.001);
        kit.position.set((compact?230:430)/1000,(compact?460:391.2)/1000,(compact?-200:0)/1000);obj.add(kit);
        markSceneAsset(kit,{key:`gaming:${layout.id}:fixture:player-valet`});
        box(kit,[260,8,220],[0,4,0],m.felt,10);
        for(const x of[-125,125])box(kit,[6,12,208],[x,11,0],m.shell,3);
        for(const z of[-105,105])box(kit,[244,12,6],[0,11,z],m.shell,3);
        const paper=(parent,title,at)=>{
            box(parent,[120,2,154],[at[0],at[1]+1,at[2]],m.paper,2);
            const canvas=document.createElement('canvas');canvas.width=256;canvas.height=320;const c=canvas.getContext('2d');
            c.fillStyle='#e2dccc';c.fillRect(0,0,256,320);c.fillStyle='#344954';c.font='bold 27px sans-serif';c.fillText(title,18,39,220);
            for(let i=0;i<6;i++){c.fillStyle=i%2?'#9fb5b7':'#b8b4a6';c.fillRect(20,70+i*35,190-(i%3)*22,3);}
            const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
            const face=mesh(parent,new THREE.PlaneGeometry(116,150),material('#ffffff',{map,roughness:.94}),[at[0],at[1]+2.2,at[2]]);face.rotation.x=-Math.PI/2;
        };
        const coil=(g,at)=>{const loop=mesh(g,new THREE.TorusGeometry(28,2,7,30),m.shell,at);loop.rotation.x=-Math.PI/2;box(g,[11,5,20],[at[0]+27,at[1],at[2]+28],m.metal,2);};
        for(const [phase,s]of Object.entries(GAMING_SESSIONS)){
            const g=new THREE.Group();g.name=s.title;g.userData.gamingSession=phase;kit.add(g);variants.push(g);
            if(phase==='morning'){
                box(g,[130,14,116],[-40,15,4],m.fabric,7);box(g,[126,10,110],[-38,27,4],m.fabric,6);coil(g,[78,12,-32]);
            }else if(phase==='afternoon'){
                paper(g,'STREAM NOTES',[-40,8,0]);rod(g,[75,12,-65],[75,12,65],4,m.metal);box(g,[30,6,30],[75,12,-65],m.shell,3);
            }else if(phase==='evening'){
                for(const z of[-52,52])mesh(g,new THREE.CylinderGeometry(39,39,4,32),m.fabric,[70,10,z]);paper(g,'CO-OP / SAVE',[-42,8,0]);
            }else if(phase==='night'){
                box(g,[140,10,88],[-25,13,0],m.shell,8);box(g,[70,25,52],[-25,31,0],m.paper,12);coil(g,[78,12,42]);
                const led=material('#a6c9b8',{emissive:'#a6c9b8',emissiveIntensity:.3});box(g,[7,2,2],[-25,32,26],led,1);
            }else{
                paper(g,'PLAYER / SCORE',[-44,8,0]);
                for(let i=0;i<4;i++){const token=material(['#83bdca','#b8a5cd','#d6ad75','#9fb98b'][i],{roughness:.65});for(let n=0;n<=i%2;n++)mesh(g,new THREE.CylinderGeometry(15,15,4,24),token,[76,10+n*4,-64+i*42]);}
            }
        }
        apply(current);
    };
    // Larger lounges have a proper pair of low seats at the game table.
    if(layout.large){
        const m=palette();
        for(const [index,x]of[-650,650].entries()){
            const stool=new THREE.Group();stool.name=`Game table stool ${index+1}`;stool.position.set(layout.gameTable[0]+x,0,layout.gameTable[1]);root.add(stool);
            stool.userData.propId=`gaming-stool-${index}`;markSceneAsset(stool,{key:`gaming:${layout.id}:fixture:game-stool-${index}`});
            for(const a of[-1,1])for(const b of[-1,1]){rod(stool,[a*160,10,b*160],[a*140,430,b*140],14,m.metal);mesh(stool,new THREE.CylinderGeometry(17,18,14,16),m.shell,[a*160,7,b*160]);}
            box(stool,[394,46,394],[0,437,0],m.felt,24);box(stool,[360,6,360],[0,411,0],m.shell,12);
            for(const z of[-145,145])rod(stool,[-150,180,z],[150,180,z],8,m.metal);
        }
    }
    // An original match board is a physical print, separate from screen toggles.
    function apply(phase){current=phase;variants.forEach(g=>{g.visible=g.userData.gamingSession===phase;});root.userData.gamingSession={phase,...GAMING_SESSIONS[phase]};}
    return {apply,decorate};
}
