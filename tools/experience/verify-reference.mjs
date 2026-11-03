import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const manifest=JSON.parse(readFileSync(resolve(root,'app-reference/source-manifest.json')));
const localPatches=new Set(['index.html','assets/desk_viewer/wellness-embed.html']);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let count=0;
for(const [name,expected]of Object.entries(manifest.files)){
  if(hash(resolve(manifest.source,name))!==expected)throw new Error('Reference source changed: '+name);
  if(!localPatches.has(name)&&hash(resolve(root,'app-reference',name))!==expected)throw new Error('Unexpected copied file change: '+name);
  count++;
}
console.log(`${count} reference files verified unchanged; local app copies match except the two documented integration patches.`);
