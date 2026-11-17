// Writes docs/director-shortcuts.md from the Director's action table (experience/director-actions.mjs).
// tests/director-actions-test.mjs fails when the file is stale. Usage: node tools/experience/director-shortcuts-doc.mjs
import {writeFileSync} from 'node:fs';
import {markdown} from '../../experience/director-actions.mjs';
const out = new URL('../../docs/director-shortcuts.md', import.meta.url);
writeFileSync(out, markdown());
console.log('wrote', out.pathname);
