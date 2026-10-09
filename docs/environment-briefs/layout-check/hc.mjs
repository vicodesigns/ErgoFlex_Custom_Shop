import { L, report } from './check.mjs';
const main = l => ({ id:'MAIN', desk:true, size:60, x:l.desk[0], z:l.desk[1], turn:0 });
const D = (id, size, x, z, turn, stand, extra={}) => ({ id, desk:true, size, x, z, turn, stand, ...extra });
const B = (id, x, z, sx, sz, extra={}) => ({ id, x, z, sx, sz, ...extra });
const only = process.argv[2];
const tiers = (id, f) => { if (!only || only === id) for (const i of [0,1,2]) { const l = L(id, i); report(id, l, f(l, i)); } };
const bed = (n, x, z, it, rot=false) => { if (!rot) { it.push(B('care-bed-'+n+' (head to back wall)', x, z, 1000, 2100, {group:'bed'+n})); it.push(B('monitor+recliner bay '+n, x+900, z-250, 700, 1500, {group:'bed'+n})); } else { it.push(B('care-bed-'+n+' (head to right wall)', x, z, 2100, 1000, {group:'bed'+n})); it.push(B('monitor+recliner bay '+n, x+300, z+850, 1500, 700, {group:'bed'+n})); } };
tiers('hospital', (l, i) => { const { w, bz, front } = l; const it = [main(l)];
  if (i === 0) {
    bed(0, 900, bz+1150, it);
    it.push(B('supply cabinet right wall', w/2-210, 1300, 420, 1250, {wall:true}));
    it.push(D('medication-station', 48, 1100, 1200, 0, true));
    it.push(D('physician-charting', 60, -1300, 2200, 0, true));
    it.push(B('A handover table', -1300, front-650, 1300, 650));
  } else if (i === 1) {
    bed(0, -500, bz+1150, it); bed(1, 2300, bz+1150, it);
    it.push(B('supply cabinet right wall', w/2-210, 1500, 420, 1250, {wall:true}));
    it.push(D('medication-station', 48, 2100, 1600, 0, true));
    it.push(D('physician-charting', 60, -700, 1600, 0, true));
    it.push(D('charge-nurse', 60, -w/2+1250, front-2700, 0, false));
    it.push(D('telehealth-consult', 48, -300, front-2400, 0, false));
    it.push(B('A handover table', 2300, front-533, 1300, 650));
  } else {
    bed(0, -1450, bz+1150, it); bed(1, 1350, bz+1150, it); bed(2, w/2-1050, 600, it, true);
    it.push(B('supply cabinet (back wall right)', 4225, bz+210, 1250, 420, {wall:true}));
    it.push(D('physician-charting', 60, -1700, 600, 0, true));
    it.push(D('pharmacist-verify', 60, 1000, 600, 0, true));
    it.push(D('medication-station', 48, 1000, 3300, 0, true));
    it.push(D('charge-nurse', 60, -3650, 3300, 0, false));
    it.push(D('telehealth-consult', 48, -1300, 3300, 0, false));
    it.push(D('discharge-planning', 48, -1300, 6000, 0, false));
    it.push(B('A handover table', 2000, 7300, 1300, 650));
  }
  return it; });
tiers('laboratory', (l, i) => { const { w, bz, front } = l; const it = [main(l)];
  it.push(B('fume hood (back wall)', i?600:300, bz+325, 1700, 650, {wall:true}));
  if (i === 0) {
    it.push(B('storage→reagent cabinet', w/2-760, bz+430, 1250, 420, {wall:true}));
    it.push(B('lab-bench-0 + stool zones', 900, bz+3300, 1800, 2250));
    it.push(B('wash/eyewash (right wall)', w/2-300, front-3300, 600, 1250, {wall:true}));
    it.push(D('instrument-control', 60, -2000, bz+4600, 0, false));
    it.push(D('microscopy', 48, 400, 3900, 0, false));
    it.push(B('A', 2600, front-600, 1300, 650));
  } else {
    const xb = 500, pitch = i === 2 ? 3150 : 3300, z0 = i === 2 ? bz+3100 : bz+3300;
    for (let n = 0; n < 1 + i; n++) it.push(B('lab-bench-'+n+' + stool zones', xb, z0+n*pitch, 1800, 2250));
    it.push(B('storage→reagent cabinet', w/2-760, bz+430, 1250, 420, {wall:true}));
    it.push(B('wash/eyewash (right wall)', w/2-300, front-2200-1300+ (i===2?0:0) - 0, 600, 1250, {wall:true}));
    it.push(D('sample-prep', 60, i===2 ? 3400 : 3100, bz+1900, 0, true));
    it.push(D('teaching-demo', 48, i===2 ? 4000 : 3200, i===2 ? 1000 : 1200, 90, true));
    it.push(D('instrument-control', 60, -w/2+1250, bz+4600, 0, false));
    it.push(D('microscopy', 48, -w/2+1250, bz+7300, 0, false));
    if (i === 2) { it.push(D('data-review', 48, -w/2+1250, front-1700, 0, true)); it.push(D('pi-review', 60, 3100, 6300, 0, false)); }
    it.push(B('A', i===2 ? 0 : 1300, i===2 ? 7650 : front-700, 1300, 650));
  }
  return it; });
tiers('mobileit', (l, i) => { const { w, bz, front } = l; const it = [main(l)];
  const nr = 2 + i, rx0 = [200, -700, -1600][i]; it.push(B(`racks x${nr} 600Wx1000D + 1200 cold aisle`, rx0 + nr*300, bz+1100, nr*600, 2200));
  it.push(B('parts shelving (right wall)', w/2-250, bz+1200, 500, 1500, {wall:true}));
  if (i === 0) {
    it.push(D('imaging-deployment', 60, 800, bz+3700, 0, true));
    it.push(D('tech-bar-walkup', 48, 1000, 3800, 270, true));
    it.push(B('A', -1700, front-750, 1300, 650));
  } else if (i === 1) {
    it.push(D('rack-console', 48, 200, bz+2200+900+381, 0, true));
    it.push(D('imaging-deployment', 60, 2500, 600, 0, true));
    it.push(D('repair-bench', 60, -w/2+1250, 2000, 0, false));
    it.push(D('tech-bar-walkup', 48, w/2-1700, front-1100, 270, true));
    it.push(B('A', -2000, front-750, 1300, 650));
  } else {
    it.push(D('rack-console', 48, -400, bz+2200+900+381, 0, true));
    it.push(D('imaging-deployment', 60, 2000, 0, 0, true));
    it.push(D('noc-monitoring', 60, -w/2+1250, 1500, 0, false));
    it.push(D('repair-bench', 60, -w/2+1250, 4500, 0, false));
    it.push(D('asset-intake', 48, 1000, 3500, 0, false));
    it.push(D('tech-bar-walkup', 48, w/2-1700, front-1100, 270, true));
    it.push(B('A', -1500, front-750, 1300, 650));
  }
  return it; });
