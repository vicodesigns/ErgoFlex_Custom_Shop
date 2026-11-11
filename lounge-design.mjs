// A restrained material story for each measured lounge. Catalog desk finishes
// stay constant through daily lighting changes; custom owner finishes survive.
const desk=(woodFinish,baseFinish,trimColor)=>({woodFinish,baseFinish,trimColor,sheen:'satin'});
export const LOUNGE_DESIGNS={
 apartment:{name:'Soft modern · ivory & copper',wall:'#e4ddd2',feature:'#b7b0a2',wood:'#8d715c',metal:'#ad7c61',dark:'#303a3d',cloth:'#d1c5ad',rug:'#d9d3c6',accent:'#987862',sofa:'cognac-compact',floor:['#ba9c7e','#b29679','#c0a58a','#b69c82'],desk:desk('Warm Ivory','Black','#85888c')},
 house:{name:'Listening lounge · olive & nickel',wall:'#e0e0d4',feature:'#8a998a',wood:'#77604c',metal:'#9da7a6',dark:'#334442',cloth:'#c2c3ad',rug:'#d5d7c9',accent:'#778c81',sofa:'moss',floor:['#ac9175','#b39a80','#a88e74','#b99d81'],desk:desk('Brushed Silver Wrap','Black','#1c1c1e')},
 spacious:{name:'Cinema lounge · ink & walnut',wall:'#d9d9d2',feature:'#626f78',wood:'#765d4e',metal:'#9eaaa8',dark:'#2d3d48',cloth:'#c0c8ca',rug:'#c8ced0',accent:'#627a87',sofa:'graphite',floor:['#a58c79','#b29a85','#a78e7a','#b7a08b'],desk:desk('Modern Grey','Black','#85888c')},
 premium:{name:'Social lounge · clay & copper',wall:'#e6dcd1',feature:'#ae9383',wood:'#856651',metal:'#ae7c61',dark:'#394747',cloth:'#d2beaf',rug:'#dfd4c7',accent:'#a27f69',sofa:'alabaster',floor:['#b79b7f','#bda58d','#b29880','#c1a88e'],desk:desk('Warm Ivory','Space Gray','#b68261')},
 executive:{name:'Private club · petrol & bronze',wall:'#dadbd4',feature:'#52706e',wood:'#6e594a',metal:'#a68c6d',dark:'#293d41',cloth:'#b6c6bd',rug:'#c3ccc5',accent:'#637f78',sofa:'teal',floor:['#9c8570','#a89079','#a08973','#ae9780'],desk:desk('Brushed Silver Wrap','Black','#1c1c1e')}
};
const CONTEMPORARY_PALETTES={
 apartment:{name:'cognac & petrol',wall:'#c7baaa',feature:'#31565a',accent:'#c78a49',rug:'#435b60',seat:'#335f60'},
 house:{name:'saddle leather & olive',wall:'#c7bba8',feature:'#465449',accent:'#d59c58',rug:'#586254',seat:'#60715b'},
 spacious:{name:'cognac & midnight',wall:'#b9b5ac',feature:'#303f56',accent:'#cc8653',rug:'#3f5364',seat:'#435f78'},
 premium:{name:'cognac, walnut & petrol',wall:'#c4b6a4',feature:'#28565a',accent:'#d28a50',rug:'#3f5a60',seat:'#3b7371'},
 executive:{name:'saddle leather & oxblood',wall:'#b8aea2',feature:'#51353d',accent:'#c59157',rug:'#4c4957',seat:'#6c4650'}
};
for(const [id,p] of Object.entries(LOUNGE_DESIGNS)){
 const warm=CONTEMPORARY_PALETTES[id];
 LOUNGE_DESIGNS[id+'contemporary']={...p,...warm,name:'Ultra-contemporary · '+warm.name,wood:'#77503a',metal:'#b18b58',dark:'#252e30',cloth:'#657674',stone:'#b09b80',sofa:'cognac',floor:['#806046','#77563e','#89674a','#70513c'],desk:desk(id==='executive'?'Brushed Silver Wrap':'Pearl White','Black','#85888c')};
}
export const loungeDesign=layout=>LOUNGE_DESIGNS[typeof layout==='string'?layout:layout?.id]||LOUNGE_DESIGNS.apartment;
export const loungeDeskTheme=layout=>({name:loungeDesign(layout).name,...loungeDesign(layout).desk});
const same=(a,b)=>a&&['woodFinish','baseFinish','trimColor'].every(k=>a[k]?.toLowerCase()===b[k]?.toLowerCase());
export function upgradeLoungeDesk(state,layout){
 if(state.loungeDesignRevision===2)return false;
 // Move only the untouched former work-bay anchor away from the hearth.
 if(state.pose&&[1100,1250].some(inset=>Math.abs(state.pose.x-(-layout.width/2+inset))<.1)&&Math.abs(state.pose.z-(layout.back+900))<.1&&Math.abs(state.pose.yaw)<.0001){state.pose.x=layout.desk[0];state.pose.z=layout.desk[1];}
 const legacy={woodFinish:'Walnut',baseFinish:'Sand',trimColor:'#f19c00'};
 const authored=!state.style||same(state.style,legacy)||Object.values(LOUNGE_DESIGNS).some(p=>same(state.style,p.desk));
 if(authored)state.style={...loungeDesign(layout).desk};
 state.loungeDesignRevision=2;return authored;
}
