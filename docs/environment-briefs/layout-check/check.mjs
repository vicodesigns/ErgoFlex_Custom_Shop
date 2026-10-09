// Layout checker: envelopes, overlaps, <900mm gaps. Units mm, room coords.
export const DIMS = { security:[5800,6800], police:[6200,7200], government:[5800,6800], kindergarten:[6000,7200], elementary:[6400,7600], middleschool:[7200,8800], highschool:[8200,9800], college:[9200,10800], university:[10200,11800], laboratory:[6600,8000], hospital:[6200,7600], mobileit:[5800,7200] };
export const EDU = { kindergarten:0, elementary:1, middleschool:1, highschool:1, college:1, university:1 };
export function L(id, i) { const [W,D]=DIMS[id]; const w=W+i*1800, d=D+i*2200, bz=-d/3; return { id, i, w, d, h:3100+i*150, bz, front:bz+d, desk:[-w/2+1250, bz+1900] }; }
const r = n => Math.round(n);
// Desk envelope: top (W x 762) plus chair zone (seated, chair centre 1050) or stand zone (600).
export function deskEnv(size, x, z, turn, stand) {
  const W = size === 60 ? 1524 : size === 48 ? 1219 : size, back = 381, fwd = stand ? 381 + 600 : 1390;
  const t = ((turn % 360) + 360) % 360;
  // local: x in [-W/2, W/2], z in [-back, fwd]; chair at +z when turn 0
  let x0, x1, z0, z1;
  if (t === 0) { x0=x-W/2; x1=x+W/2; z0=z-back; z1=z+fwd; }
  else if (t === 180) { x0=x-W/2; x1=x+W/2; z0=z-fwd; z1=z+back; }
  else if (t === 90) { x0=x-back; x1=x+fwd; z0=z-W/2; z1=z+W/2; }   // chair at +x, user faces -x
  else if (t === 270) { x0=x-fwd; x1=x+back; z0=z-W/2; z1=z+W/2; }  // chair at -x, user faces +x
  return [x0,z0,x1,z1];
}
export function check(l, items) {
  const out = [], warn = [];
  const all = [];
  // shell door clear zone
  all.push({ id:'door-zone', rect:[l.w/2-1100, l.front-2200, l.w/2, l.front-1000], zone:true });
  for (const it of items) {
    let rect;
    if (it.desk) rect = deskEnv(it.size, it.x, it.z, it.turn||0, it.stand);
    else rect = [it.x-it.sx/2, it.z-it.sz/2, it.x+it.sx/2, it.z+it.sz/2];
    all.push({ ...it, rect });
  }
  for (const a of all) {
    const [x0,z0,x1,z1]=a.rect;
    if (x0 < -l.w/2-1 || x1 > l.w/2+1 || z0 < l.bz-1 || z1 > l.front+1) warn.push(`OUT ${a.id} ${a.rect.map(r)}`);
  }
  for (let i=0;i<all.length;i++) for (let j=i+1;j<all.length;j++) {
    const a=all[i], b=all[j]; if (a.flat||b.flat) continue;
    const dx = Math.max(b.rect[0]-a.rect[2], a.rect[0]-b.rect[2], 0), dz = Math.max(b.rect[1]-a.rect[3], a.rect[1]-b.rect[3], 0);
    const overlap = b.rect[0] < a.rect[2] && a.rect[0] < b.rect[2] && b.rect[1] < a.rect[3] && a.rect[1] < b.rect[3];
    if (overlap) { warn.push(`OVERLAP ${a.id} x ${b.id}`); continue; }
    if (a.zone||b.zone) continue;
    if (a.group && a.group===b.group) continue;
    const g = Math.hypot(dx,dz);
    const lim = (a.wall||b.wall) ? 800 : 900; if (g < lim && !(a.wall&&b.wall)) warn.push(`GAP ${r(g)} ${a.id} / ${b.id}`);
  }
  return { all, warn };
}
export function report(name, l, items) {
  const { all, warn } = check(l, items);
  console.log(`\n## ${name} i${l.i} ${l.w}x${l.d} bz ${r(l.bz)} front ${r(l.front)} h ${l.h}`);
  for (const a of all) if (!a.zone) console.log(`  ${a.id.padEnd(22)} ${a.desk?('D'+a.size+' t'+(a.turn||0)+(a.stand?' S':' s')):'box'} at [${r(a.x)}, ${r(a.z)}] env x ${r(a.rect[0])}..${r(a.rect[2])} z ${r(a.rect[1])}..${r(a.rect[3])}`);
  console.log(warn.length ? '  !! ' + warn.join('\n  !! ') : '  OK');
}
