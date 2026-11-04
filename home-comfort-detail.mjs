import * as THREE from 'three';
import { interiorCraftFinishes } from './interior-craft-detail.mjs?v=natural-finishes-20261104';

// Local details share the existing furniture roots and physical footprints.
// Phase changes only switch the contents inside an editable tabletop setting.
export function homeComfortDetails(room, h) {
    const { material, mesh, box, rod, markSceneAsset } = h;
    const texture = (paint, size = 256) => {
        const c = document.createElement('canvas'); c.width = c.height = size;
        paint(c.getContext('2d'), size);
        const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping; return map;
    };
    const weave = texture((c, s) => {
        c.fillStyle = '#e9e5d9'; c.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 4) for (let x = 0; x < s; x += 4) {
            c.fillStyle = (x + y) % 8 ? '#bdb9aa' : '#fff9eb';
            c.fillRect(x, y, 3, 1); c.fillRect(x, y + 1, 1, 3);
        }
    });
    weave.repeat.set(3, 3);
    const stoneMap = texture((c, s) => {
        c.fillStyle = '#ddd4bf'; c.fillRect(0, 0, s, s);
        for (let i = 0; i < 650; i++) {
            const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * s;
            const y = (Math.sin(i * 7.233) * 21942.37 % 1 + 1) % 1 * s;
            c.fillStyle = i % 4 ? '#ad9e8020' : '#fff6df55';
            c.beginPath(); c.ellipse(x, y, .4 + i % 4 * .3, .4 + i % 3 * .2, .2, 0, 7); c.fill();
        }
        for (let y = 0; y < s; y += 9) { c.fillStyle = '#ae9d7a0b'; c.fillRect(0, y, s, 2); }
    });
    const stone = material('#ffffff', { map: stoneMap, roughness: .76 }); stone.userData.roomSurface = 'stone';
    const fabric = material('#b48869', { map: weave, roughness: .95 }); fabric.userData.roomSurface = 'fabric';
    const linen = material('#eadfc9', { map: weave, roughness: .93, side: THREE.DoubleSide, emissive: '#ffcb8a', emissiveIntensity: 0 });
    const bronze = material('#75634d', { roughness: .36, metalness: .78 }); bronze.userData.roomSurface = 'metal';
    const ceramic = material('#e7decc', { roughness: .29 }), tea = material('#63432e', { roughness: .2 });
    const paper = material('#eee8d8', { roughness: .94 }), sage = material('#718376', { roughness: .9 }), clay = material('#b57a57', { roughness: .85 });
    const lens = material('#fff1d4', { emissive: '#ffd59e', emissiveIntensity: 0, roughness: .8 });
    const phaseGroups = [];

    function decorate(object, placement) {
        if (placement.id === 'armchair-poppi') {
            const pillow = box(object, [.42, .27, .13], [0, .5, -.16], fabric, .05);
            pillow.rotation.x = -.28; pillow.name = 'Woven linen lumbar cushion';
        }
        if (placement.id === 'sofa-fabric') object.traverse(o => {
            if (!o.isMesh) return;
            const update = m => {
                if (m.name !== 'Fabric_Sofa') return m;
                const owned = m.clone(); owned.color.set('#7d8981'); owned.roughness = .94;
                owned.metalness = 0; owned.normalScale.multiplyScalar(.3); owned.userData.sharedTextures = true;
                owned.userData.roomPaletteLocked = true;
                o.ownedMaterials ||= []; o.ownedMaterials.push(owned); return owned;
            };
            o.material = Array.isArray(o.material) ? o.material.map(update) : update(o.material);
        });
        if (placement.id !== 'kenney-furniture-lamp-round-floor') return;
        object.clear(); const lamp = new THREE.Group(); lamp.scale.setScalar(1 / object.scale.x); object.add(lamp);
        lamp.name = 'Linen reading light'; object.name = 'Bronze & linen reading lamp';
        object.userData.sceneAssetName = object.name; object.userData.homeReadingLamp = true;
        mesh(lamp, new THREE.CylinderGeometry(143, 149, 20, 40), bronze, [0, 10, 0]);
        mesh(lamp, new THREE.CylinderGeometry(10, 13, 1420, 20), bronze, [0, 730, 0]);
        mesh(lamp, new THREE.CylinderGeometry(137, 148, 280, 48, 1, true), linen, [0, 1570, 0]);
        for (const y of [1430, 1710]) { const ring = mesh(lamp, new THREE.TorusGeometry(y === 1430 ? 148 : 137, 3, 6, 48), bronze, [0, y, 0]); ring.rotation.x = Math.PI / 2; }
        const diffuser = mesh(lamp, new THREE.CylinderGeometry(141, 141, 3, 40), lens, [0, 1434, 0]); diffuser.castShadow = false;
        rod(lamp, [12, 1450, 0], [18, 1330, 0], 1.4, bronze);
        mesh(lamp, new THREE.SphereGeometry(5, 8, 6), bronze, [18, 1327, 0]);
    }

    function lounge(table, x, y, z, layoutId) {
        const setting = new THREE.Group(); setting.name = 'Lounge daily setting'; setting.position.set(x, y, z); table.add(setting);
        markSceneAsset(setting, { key: `home:${layoutId}:fixture:lounge-setting` });
        const coverMap = texture((c, s) => {
            c.fillStyle = '#d9ccb3'; c.fillRect(0, 0, s, s);
            c.fillStyle = '#61796b'; c.fillRect(16, 18, s - 32, 115);
            c.fillStyle = '#c3ad84'; c.beginPath(); c.arc(124, 88, 55, 0, 7); c.fill();
            c.fillStyle = '#344c40'; c.font = '600 24px serif'; c.fillText('SLOW LIVING', 18, 175);
            c.font = '12px sans-serif'; c.fillText('SPACE / CRAFT / EVERYDAY', 18, 204);
            c.fillRect(18, 224, 65, 2);
        }); coverMap.wrapS = coverMap.wrapT = THREE.ClampToEdgeWrapping;
        const cover = material('#ffffff', { map: coverMap, roughness: .9 });
        const pagesMap = texture((c, s) => {
            c.fillStyle='#eee8d8';c.fillRect(0,0,s,s);c.fillStyle='#485f51';
            c.font='20px Georgia';c.fillText('The reading hour',20,40);
            c.font='10px sans-serif';c.fillStyle='#85745b';c.fillText('SMALL RITUALS / AT HOME',20,62);
            c.fillStyle='#4b524a';c.font='12px Georgia';
            const lines=['A quiet corner and a little daylight.','A favourite book within easy reach.','Leave room for a cup, a thought,','and a pause between the pages.','','Natural textures soften the room.','Timber, linen and familiar objects','make space for the everyday.'];
            lines.forEach((line,i)=>c.fillText(line,20,102+i*24,210));
            c.fillStyle='#c8b89b';c.fillRect(277,26,211,270);c.fillStyle='#788e7d';c.fillRect(297,46,171,165);
            c.fillStyle='#eee4ce';c.beginPath();c.arc(381,166,64,Math.PI,0);c.lineTo(445,211);c.lineTo(317,211);c.fill();
            c.fillStyle='#a47e5d';c.fillRect(316,211,130,12);c.fillRect(324,223,8,58);c.fillRect(430,223,8,58);
            c.fillStyle='#485f51';c.font='18px Georgia';c.fillText('A place to pause',284,334);
            c.font='11px sans-serif';c.fillText('Warm light. Simple materials.',284,358);c.fillText('Room for one more chapter.',284,379);
            c.fillStyle='#a99a80';c.font='10px sans-serif';c.fillText('24',20,482);c.fillText('25',474,482);
        },512);pagesMap.wrapS=pagesMap.wrapT=THREE.ClampToEdgeWrapping;
        const pages=material('#ffffff',{map:pagesMap,roughness:.95}),orange=material('#d49138',{roughness:.86}),stem=material('#657345',{roughness:.85});
        const bowlGeo = new THREE.LatheGeometry([[0,0],[45,0],[58,8],[82,43],[84,48],[79,49],[75,43],[53,12],[0,12]].map(p => new THREE.Vector2(...p)), 32);
        const cupGeo = new THREE.LatheGeometry([[0,0],[25,0],[29,5],[34,64],[32,67],[29,66],[25,8],[0,8]].map(p => new THREE.Vector2(...p)), 28);
        const mug = (g, x, z, filled) => {
            mesh(g, new THREE.CylinderGeometry(46,46,3,28), sage, [x,1.5,z]);
            const cup = mesh(g,cupGeo,ceramic,[x,3,z]);
            mesh(g,new THREE.TorusGeometry(17,4,6,20),ceramic,[x+36,37,z]);
            if(filled)mesh(g,new THREE.CylinderGeometry(29,29,1,28),tea,[x,61,z]);
            return cup;
        };
        const magazine = (g, open) => {
            const book = new THREE.Group(); book.position.set(245,0,35); book.rotation.y=-.1;g.add(book);
            box(book,[210,15,154],[0,7.5,0],paper,2);
            for(const height of [3,6,9,12])box(book,[209,.5,.6],[0,height,77],sage);
            if(open){box(book,[205,1,149],[0,15.5,0],paper,1);const spread=mesh(book,new THREE.PlaneGeometry(205,149),pages,[0,16.1,0]);spread.rotation.x=-Math.PI/2;spread.castShadow=false;box(book,[4,2,151],[0,17,0],clay,1);box(book,[7,1,90],[55,17,39],clay,1);}
            else {const face=mesh(book,new THREE.PlaneGeometry(210,154),cover,[0,15.2,0]);face.rotation.x=-Math.PI/2;face.castShadow=false;}
        };
        const fruit=(g,x,y,z,r)=>{mesh(g,new THREE.SphereGeometry(r,16,12),orange,[x,y,z]);mesh(g,new THREE.CylinderGeometry(3,2,2,8),stem,[x,y+r,z]);};
        for (const phase of ['morning','afternoon','evening','night','party']) {
            const g=new THREE.Group();g.name='Lounge · '+phase;g.userData.homeLoungePhase=phase;setting.add(g);phaseGroups.push(g);
            magazine(g,phase==='evening');
            if(phase==='morning'){mug(g,-200,-45,true);box(g,[125,2,88],[-175,1,90],paper,1);rod(g,[-220,4,80],[-132,4,100],2,bronze);}
            if(phase==='afternoon'){mesh(g,bowlGeo,ceramic,[-180,0,0]);for(let i=0;i<3;i++)fruit(g,-200+(i%2)*35,40+i*9,-10+(i===2?25:0),25);}
            if(phase==='evening'){mug(g,-200,0,true);box(g,[60,27,44],[-68,13.5,10],sage,12);}
            if(phase==='night'){box(g,[185,9,124],[-180,4.5,0],sage,5);for(let i=0;i<3;i++)mesh(g,new THREE.CylinderGeometry(43,43,3,24),ceramic,[-180,10.5+i*3,0]);}
            if(phase==='party'){
                mug(g,-265,82,true);mug(g,-78,-65,true);
                mesh(g,new THREE.LatheGeometry([[0,0],[34,0],[43,10],[42,100],[24,120],[22,145],[17,145],[17,121],[35,98],[35,12],[0,12]].map(p=>new THREE.Vector2(...p)),28),ceramic,[-260,0,-76]);
                mesh(g,bowlGeo,ceramic,[55,0,45]);for(let i=0;i<4;i++)fruit(g,32+i%2*32,38+(i>1?14:0),30+Math.floor(i/2)*30,22);
            }
        }
    }
    interiorCraftFinishes(room,{ceramic:[ceramic],linen:[fabric,linen],metal:[bronze]});
    return {
        stone, decorate, lounge,
        update(phase) {
            const power = {morning:.04,afternoon:.08,evening:.65,night:.28,party:.42}[phase] ?? .08;
            linen.emissiveIntensity = power * .24; lens.emissiveIntensity = power;
            phaseGroups.forEach(g => g.visible = g.userData.homeLoungePhase === phase);
            room.root.userData.homeComfort = {phase,readingLight:power,lounge:phaseGroups.length > 0};
        }
    };
}
