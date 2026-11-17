// One-off parity dump (not a test): every person's and chair's place and bones on every chapter with people of the
// cuts given, at the harness times plus every half second. Run before and after a change; the two must be equal.
//   node tests/people-motion-parity.mjs exports/cinematic-intro-cut-cine/review-cut.json … > out.json
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RoomPeople} from '../room-people.mjs';
import {stage,snapshot} from './people-postures-harness.mjs';
globalThis.__ERGO_PRESENTATION__=true;
const out={};
for(const file of process.argv.slice(2)){
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const shot of (d.shots||[d]).filter(s=>s.people&&typeof s.people==='object'&&Array.isArray(s.people.cast))){
    let people;try{
      const s=await stage(RoomPeople,shot);people=s.people;const rows=[];
      for(let t=0;t<=shot.seconds;t+=.5){people.update(s.state(t));await people.settled();people.update(s.state(t));
        const chairs=people.people.map(o=>o.userData.personChair).filter(Boolean).map(c=>[c.visible,c.position.toArray().map(v=>Math.round(v*1000)/1000),Math.round(c.rotation.y*1e5)/1e5]);
        rows.push(createHash('sha256').update(JSON.stringify({snap:snapshot(people),chairs,spot:people.chairSpot?.toArray()})).digest('hex').slice(0,16));}
      out[file+'#'+shot.id]=rows;
    }catch(e){out[file+'#'+shot.id]='error '+e.message;}finally{people?.dispose();}
  }
}
console.log(JSON.stringify(out,null,1));
