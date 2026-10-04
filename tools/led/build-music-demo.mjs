import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=root+'assets/led/music/';
mkdirSync(output,{recursive:true});
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',root+'assets/led/game/neon-flight.mp4','-vn','-af','volume=9dB','-c:a','libmp3lame','-b:a','128k',output+'neon-flight-demo.mp3'],{encoding:'utf8'});
if(result.status!==0)throw new Error(result.error?.message||result.stderr||'Demo audio generation failed');
console.log('Original Neon Flight audio-only Music Mode demo generated with +9 dB source gain. Game Mode video unchanged.');
