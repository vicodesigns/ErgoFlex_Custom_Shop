// Every room type's prop placements, as the rooms build them (ids, positions, turns, order = the saved keys' indexes),
// with the Layers marker `station` left out. tests/studio-layers-seats-test.mjs compares them with the snapshot written
// before the featured desk's chair got its marker: the marker must change nothing else (no position, no index).
//   node tests/room-placements-proof.mjs --write    (only to refresh the snapshot, with the code BEFORE a marker change)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HOME_LAYOUTS} from '../home-office.mjs';
import {GAMING_LAYOUTS} from '../gaming-room.mjs';
import {MUSIC_LAYOUTS} from '../music-room.mjs';
import {ARTIST_LAYOUTS} from '../artist-room.mjs';
import {STUDY_LAYOUTS} from '../study-room.mjs';
import {OFFICE_LAYOUTS} from '../office-room.mjs';
import {LOUNGE_LAYOUTS} from '../lounge-room.mjs';
import {BEDROOM_LAYOUTS} from '../bedroom-room.mjs';
import {GALLERY_LAYOUTS} from '../gallery-room.mjs';
import {SCIFI_LAYOUTS} from '../scifi-room.mjs';
import {COWORKING_LAYOUTS} from '../coworking-room.mjs';
import {LIBRARY_LAYOUTS} from '../library-room.mjs';
import {WORKSHOP_LAYOUTS} from '../workshop-room.mjs';
import {INSTITUTIONAL_ROOMS} from '../institutional-scenes.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const SNAPSHOT=path.join(ROOT,'tests','fixtures','room-placements-before-main-chair.json');
export const ROOMS={home:HOME_LAYOUTS,gaming:GAMING_LAYOUTS,music:MUSIC_LAYOUTS,creative:ARTIST_LAYOUTS,study:STUDY_LAYOUTS,office:OFFICE_LAYOUTS,lounge:LOUNGE_LAYOUTS,
  bedroom:BEDROOM_LAYOUTS,gallery:GALLERY_LAYOUTS,scifi:SCIFI_LAYOUTS,coworking:COWORKING_LAYOUTS,library:LIBRARY_LAYOUTS,workshop:WORKSHOP_LAYOUTS,
  ...Object.fromEntries(Object.entries(INSTITUTIONAL_ROOMS).map(([id,r])=>[id,r.layouts]))};
const strip=p=>{const {station,...rest}=p;return JSON.parse(JSON.stringify(rest));};
export function placements(){
  const out={};
  for(const [room,layouts] of Object.entries(ROOMS))for(const [id,l] of Object.entries(layouts||{}))out[`${room}/${id}`]=(l.props||[]).map(strip);
  return out;
}
if(process.argv.includes('--write')){fs.mkdirSync(path.dirname(SNAPSHOT),{recursive:true});fs.writeFileSync(SNAPSHOT,JSON.stringify(placements())+'\n');console.log('wrote',SNAPSHOT);}
