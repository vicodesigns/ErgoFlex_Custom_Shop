import { evaluate } from './solve-pull.mjs';
const p = JSON.parse(process.argv[2]); const d = evaluate(p, process.env.POSTURE || 'people-maya-sit-type', true); delete d.deltas; console.log(JSON.stringify(d));
