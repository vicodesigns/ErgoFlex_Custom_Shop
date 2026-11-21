import fs from 'node:fs';
const [a,b]=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const diffs=[];
function walk(x,y,p){ if(JSON.stringify(x)===JSON.stringify(y))return;
 if(x&&y&&typeof x==='object'&&typeof y==='object'&&Array.isArray(x)===Array.isArray(y)){const ks=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of ks)walk(x[k],y[k],p+'/'+k);}
 else diffs.push(p+': '+JSON.stringify(x)?.slice(0,60)+' -> '+JSON.stringify(y)?.slice(0,60));}
walk(a,b,'');console.log(diffs.length+' diffs');console.log(diffs.slice(0,40).join('\n'));
