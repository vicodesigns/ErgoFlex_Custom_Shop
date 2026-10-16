// Reading, meeting and dining chairs share one supplied model. Task and lounge
// chair selections keep their own models. Root transforms remain compatible
// with saved furniture edits, including the Library's historical .82 scale.
export function conferenceSceneChair(scene,layout,placement,index){
 if(placement.id!=='kenney-furniture-chair-modern-cushion')return null;
 let family;
 if(scene==='library'){
  const table=layout?.reading?.findIndex(at=>Math.abs(at[1]-placement.at[2])<=1050&&Math.abs(at[0]-placement.at[0])<1100)??-1;
  family=(layout?.index??0)<2?'forest':['sage','slate','clay','sage'][Math.max(0,table)%4];
 }else family={office:'graphite',coworking:'teal',kitchen:layout?.tier%2?'ivory':'terracotta'}[scene];
 if(!family)return null;const id='atelier-sidechair-'+family,entry=index.props.find(p=>p.id===id);if(!entry?.size)return null;
 const capacity=[620,820,700];if(entry.size.some((n,i)=>n>capacity[i]))return null;
 return {id,entry,fit:1,rootScale:scene==='library'?.82:1,conference:true};
}
