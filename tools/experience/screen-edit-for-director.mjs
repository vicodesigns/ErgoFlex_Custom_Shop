#!/usr/bin/env node
// The Director's Render still with the movie's edit list composed (21 Nov 2026, org: Render still in the Director must
// show the real dissolve / dip; docs/screen-edit-list/CONTRACT.md). tools/studio-server.mjs POST /api/screen-edit runs
// this as a child (one at a time, at a lower priority: ffmpeg inherits it), so the composer's blocking ffmpeg never
// holds the server. In: a JSON file {id, seconds, screens} and the edl dir; out (stdout): {screens, tracks, report}.
// A shot without an edit list comes back unchanged (nothing composed). Log lines go to stderr. Paths (the sources, the
// edl dir) are the working directory's: the server's root.
//   node tools/experience/screen-edit-for-director.mjs <shot.json> <exports/<cut>/screens/edl>
import fs from 'node:fs';
import {applyScreenEdits} from './compose-screen-edit.mjs';
const [file,outDir]=process.argv.slice(2);
if(!file||!outDir){console.error('usage: screen-edit-for-director.mjs <shot.json> <edl dir>');process.exit(2);}
const shot=JSON.parse(fs.readFileSync(file,'utf8')),report=[];
try{
  const next=await applyScreenEdits(shot,{root:process.cwd(),outDir,log:m=>{report.push(String(m));console.error(m);}});
  process.stdout.write(JSON.stringify({screens:next.screens,tracks:next.__screenEdits||[],report}));
}catch(error){process.stdout.write(JSON.stringify({error:String(error.message||error),report}));process.exit(1);}
