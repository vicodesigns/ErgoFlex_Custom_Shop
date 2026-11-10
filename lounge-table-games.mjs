import * as THREE from 'three';

// A recognizable, mid-game chess setting gives the social table an activity.
// All dimensions are millimetres and every piece starts on the board surface.
export function buildLoungeChess(parent,{box,mesh,sphere},materials){
    const {wood,ivory,dark,felt}=materials;
    mesh(parent,new THREE.CylinderGeometry(650,650,6,64),felt,[0,755,0]);
    const board=new THREE.Group();board.name='Chess board · mid-game';board.position.y=758;parent.add(board);
    box(board,[510,15,510],[0,7.5,0],wood,6);
    const squares=[];
    for(let x=0;x<8;x++)for(let z=0;z<8;z++)squares.push({x:(x-3.5)*60,z:(z-3.5)*60,dark:(x+z)%2===0});
    for(const shade of [false,true]){
        const cells=squares.filter(s=>s.dark===shade),tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(60,2,60),shade?dark:ivory,cells.length),matrix=new THREE.Matrix4();
        cells.forEach((cell,i)=>{matrix.makeTranslation(cell.x,16,cell.z);tiles.setMatrixAt(i,matrix);});
        tiles.receiveShadow=true;board.add(tiles);
    }
    const position=(file,rank)=>[(file-3.5)*60,17,(rank-3.5)*60];
    const arrangement=[
        ['king',6,0,0],['queen',3,3,0],['rook',0,0,0],['bishop',2,3,0],['pawn',0,1,0],['pawn',1,2,0],['pawn',4,3,0],['pawn',5,1,0],['pawn',6,1,0],
        ['king',6,7,1],['queen',3,7,1],['rook',7,7,1],['bishop',5,7,1],['pawn',0,6,1],['pawn',1,5,1],['pawn',2,6,1],['pawn',4,4,1],['pawn',6,6,1]
    ];
    for(const [type,file,rank,side] of arrangement){
        const piece=new THREE.Group();piece.name=`${side?'Black':'Ivory'} ${type}`;piece.position.set(...position(file,rank));board.add(piece);
        const material=side?dark:ivory,height=type==='pawn'?34:type==='king'?63:51;
        const profile=[[0,0],[17,0],[19,3],[19,7],[13,10],[9,height-9],[14,height-7],[14,height],[0,height]].map(([x,y])=>new THREE.Vector2(x,y));
        mesh(piece,new THREE.LatheGeometry(profile,20),material);
        if(type==='rook'){
            mesh(piece,new THREE.CylinderGeometry(17,15,12,20),material,[0,height+6,0]);
            for(const x of [-11,11])for(const z of [-11,11])box(piece,[8,7,8],[x,height+15.5,z],material,1);
        }else{
            sphere(piece,[type==='pawn'?11:13,type==='bishop'?16:11,type==='pawn'?11:13],[0,height+10,0],material);
            if(type==='king'){box(piece,[7,22,7],[0,height+28,0],material,1);box(piece,[21,6,7],[0,height+30,0],material,1);}
            if(type==='queen')for(let i=0;i<6;i++)sphere(piece,[3,4,3],[Math.sin(i*Math.PI/3)*10,height+22,Math.cos(i*Math.PI/3)*10],material);
        }
    }
    parent.userData.leisureSetting='3d-chess';
}
