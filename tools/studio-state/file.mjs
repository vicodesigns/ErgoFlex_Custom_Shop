// studio-state.json: {format, rev, keys:{key: {rev, ts, by, client, value | deleted, entries?}}}.
// value is the raw localStorage string; entries holds per-entry {rev, ts, by}
// for the records merge.mjs splits (SPECS). Written one key per line so git
// diffs show which keys changed.
import fs from 'node:fs';
export const FORMAT = 'ergoflex-studio-state-v1';
export function load(file) {
  if (!fs.existsSync(file)) return { format: FORMAT, rev: 0, keys: {} };
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (s.format !== FORMAT) throw Error(file + ': not a studio state file');
  return s;
}
export function serialize(s) {
  const keys = Object.keys(s.keys).sort().map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(s.keys[k]));
  return `{\n "format": ${JSON.stringify(s.format)},\n "rev": ${s.rev},\n "keys": {\n${keys.join(',\n')}\n }\n}\n`;
}
export function write(file, s) { fs.writeFileSync(file + '.tmp', serialize(s)); fs.renameSync(file + '.tmp', file); }
// {key: raw} for render-cut --storage and anything else that wants plain localStorage.
export const values = s => Object.fromEntries(Object.entries(s.keys).filter(([, r]) => !r.deleted).map(([k, r]) => [k, r.value]));
