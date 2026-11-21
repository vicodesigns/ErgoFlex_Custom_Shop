import fs from 'node:fs';
const C = (p, t, f) => ({ position: p, target: t, fov: f });
const se = { C: C([1.185, 2.01, -0.29], [0.345, 1.74, 0.25], 40), R: C([0.278, 1.965, -0.413], [0.33, 1.78, 0.12], 32), L: C([1.002, 1.985, 0.344], [0.40, 1.78, 0.28], 34) };
const up = v => ({ ...v, position: [v.position[0], v.position[1] + 0.36, v.position[2]], target: [v.target[0], v.target[1] + 0.36, v.target[2]] });
const st = { C: up(se.C), R: up(se.R), L: up(se.L) };
fs.writeFileSync('ck_se.json', JSON.stringify([{ at: 13.1, ...se.C }, { at: 13.7, ...se.R }, { at: 14.55, ...se.R }, { at: 15.1, ...se.L }, { at: 17.25, ...se.L }, { at: 17.9, ...se.C }]));
fs.writeFileSync('ck_st.json', JSON.stringify([{ at: 10.0, ...st.C }, { at: 10.4, ...st.R }, { at: 10.85, ...st.R }, { at: 11.3, ...st.L }, { at: 13.6, ...st.L }, { at: 14.3, ...st.C }]));
