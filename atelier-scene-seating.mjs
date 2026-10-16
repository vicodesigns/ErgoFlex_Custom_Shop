import {conferenceSceneChair} from './conference-scene-seating.mjs?v=conference-chairs-20261015';
// Upgrade lounge seating and the supplied reading/conference side chair.
// Ergonomic task chairs retain their authored models.
// Keep the original placement key so saved moves, sizes and deletions survive.
export const ATELIER_SCENE_CHAIRS={
 lounge:'atelier-molded-ivory',library:'atelier-timber-moss',office:'atelier-cantilever-obsidian',
 coworking:'atelier-cantilever-moss',music:'atelier-molded-cognac',study:'atelier-molded-cognac',
 creative:'atelier-timber-clay',gallery:'atelier-cantilever-ivory',bedroom:'atelier-timber-ivory',gaming:'atelier-cantilever-obsidian',occmedialab:'atelier-cantilever-coast'
};
const loungeChairs=new Set(['armchair-poppi','armchair-leather','kenney-furniture-lounge-chair','luxury-chair','lounge-chair-metal','kenney-furniture-lounge-chair-relax']);
export function atelierSceneChair(scene,placement,index,layout){
 const conference=conferenceSceneChair(scene,layout,placement,index);if(conference)return conference;
 const id=ATELIER_SCENE_CHAIRS[scene];if(!id||!loungeChairs.has(placement.id))return null;
 const old=index.props.find(p=>p.id===placement.id),entry=index.props.find(p=>p.id===id);if(!old?.size||!entry?.size)return null;
 const fit=Math.min(1,old.size[0]/entry.size[0],old.size[2]/entry.size[2]);
 // Skip a replacement if preserving the old footprint would miniaturize it.
 return fit>=.9?{id,entry,fit}:null;
}
