// Director prop layers: named groups of the chapter's editable things (room props and desk items), kept in the cut
// shot as shot.propLayers = [{id, name, items:[prop edit keys (prop-edits.mjs propKey)], hidden?, locked?}].
// A layer has no film effect of its own: hiding a layer writes the ordinary per-chapter hide edits (shot.propEdits)
// for its items, so the film matches; "locked" only stops the stage from picking those items; the importer
// (tools/experience/build-round8-director.py) keeps the list in director-camera-<id>.json as 'propLayers'.
const KEY=/^\["[^]{0,300}","[^]{0,200}","[^]{0,400}",(null|\[[-\d.,e]+\])(,"[a-z0-9-]{1,40}")?\]$/;
const id=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,12);
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v)?v:id();
export function cleanPropLayer(l){
  if(!l||typeof l!=='object')return null;
  const name=typeof l.name==='string'?l.name.trim().slice(0,60):'';if(!name)return null;
  const items=[...new Set((Array.isArray(l.items)?l.items:[]).filter(k=>typeof k==='string'&&k.length<=1000&&KEY.test(k)))].slice(0,400);
  const out={id:safeId(l.id),name,items};if(l.hidden===true)out.hidden=true;if(l.locked===true)out.locked=true;return out;
}
export function cleanPropLayers(v={}){
  if(!Array.isArray(v.propLayers))return {};
  const seen=new Set(),list=[];for(const l of v.propLayers.slice(0,60).map(cleanPropLayer)){if(!l)continue;if(seen.has(l.id))l.id=id();seen.add(l.id);list.push(l);}
  return {propLayers:list};
}
export const lockedKeys=layers=>new Set((layers||[]).filter(l=>l.locked).flatMap(l=>l.items));
export const layerOf=(layers,key)=>(layers||[]).filter(l=>l.items.includes(key));
