// Saved poses: a fine-tuned pose kept under a name, to start from again on anyone. A saved pose is the posture it was
// made on plus the joints' turns from it (people-edits.mjs cleanPose), so applying one puts the person in that posture
// and turns the joints. They live in the browser under ergoflex.peoplePoses.v1, which the studio server shares with
// every browser and keeps in studio-state.json. Saving never replaces one: a taken name gets a number.
import {cleanPose} from './people-edits.mjs';
export const POSES_KEY='ergoflex.peoplePoses.v1';
const text=(v,max)=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,max):'';
export function cleanSavedPose(v){
  if(!v||typeof v!=='object')return null;
  const name=text(v.name,48),posture=text(v.posture,40),joints=cleanPose(v.joints);
  if(!name||!/^[a-z][a-z0-9-]{1,39}$/.test(posture)||!joints)return null;
  return {id:/^[A-Za-z0-9-]{6,60}$/.test(v.id||'')?v.id:globalThis.crypto.randomUUID(),name,posture,joints,...(text(v.from,40)?{from:text(v.from,40)}:{}),...(text(v.made,30)?{made:text(v.made,30)}:{})};
}
export function loadSavedPoses(storage){
  try{const v=JSON.parse(storage.getItem(POSES_KEY)||'null');return v?.v===1&&Array.isArray(v.poses)?v.poses.slice(0,200).map(cleanSavedPose).filter(Boolean):[];}catch{return [];}
}
export function storeSavedPoses(storage,poses){storage.setItem(POSES_KEY,JSON.stringify({v:1,poses:poses.slice(0,200)}));}
// A name nobody has: the one asked for, numbered when it is taken.
export function freeName(poses,want){
  const base=text(want,44)||'Pose',taken=new Set(poses.map(p=>p.name.toLowerCase()));let name=base,n=2;
  while(taken.has(name.toLowerCase()))name=`${base} ${n++}`;
  return name;
}
// The list with one more pose (never replacing one); returns {poses, saved}.
export function addSavedPose(poses,{name,posture,joints,from}){
  const saved=cleanSavedPose({name:freeName(poses,name),posture,joints,from,made:new Date().toISOString().slice(0,10)});
  if(!saved)throw Error('There is nothing to save yet: adjust a joint first.');
  return {poses:[...poses,saved],saved};
}
