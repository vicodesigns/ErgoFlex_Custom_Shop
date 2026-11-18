// A name used before its own declaration in the same function (17 Nov 2026: a new helper M() in scene-prop-editor.mjs
// was shadowed in plan() by a local `const M`, so the call threw "Cannot access 'M' before initialization" and the
// whole Props panel stopped; node --check and the node tests passed). ESLint's no-use-before-define with
// variables:false reports exactly that, and nothing about names used inside closures before they are defined.
// ESLint is not a project dependency and this test installs nothing: it uses a pinned copy in $ERGOFLEX_LINT_DIR
// (default ~/.cache/ergoflex-lint) and says SKIP when there is none. To set one up once:
//   npm install --prefix ~/.cache/ergoflex-lint eslint@9.39.5
//   node tests/scope-lint-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const VERSION='9.39.5',root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=process.env.ERGOFLEX_LINT_DIR||path.join(os.homedir(),'.cache','ergoflex-lint'),pkg=path.join(dir,'node_modules','eslint','package.json');
let version=null;try{version=JSON.parse(fs.readFileSync(pkg,'utf8')).version;}catch{}
if(version!==VERSION){console.log(`scope-lint-test: SKIP (no ESLint ${VERSION} in ${dir}${version?`, found ${version}`:''}; set one up with: npm install --prefix ${dir} eslint@${VERSION})`);process.exit(0);}
const {ESLint}=await import(pathToFileURL(path.join(dir,'node_modules','eslint','lib','api.js')).href);
const eslint=new ESLint({cwd:root,overrideConfigFile:true,errorOnUnmatchedPattern:false,overrideConfig:[{languageOptions:{ecmaVersion:2024,sourceType:'module'},
  rules:{'no-use-before-define':['error',{functions:false,classes:false,variables:false,allowNamedExports:true}]}}]});
// the rule still catches the bug it is here for
const probe=await eslint.lintText("const M=()=>1;export function plan(list){return list.map(e=>{const a=M();const M=2;return a+M+e;});}\n",{filePath:path.join(root,'experience','probe.mjs')});
if(!probe[0].messages.some(m=>m.ruleId==='no-use-before-define'&&/'M'/.test(m.message))){console.error('scope-lint-test: the rule did not report the known case');process.exit(1);}
const results=await eslint.lintFiles(['experience/*.mjs','*.mjs','tools/experience/*.mjs','tools/studio-server.mjs','tools/studio-state/*.mjs']);
const bad=results.flatMap(r=>r.messages.filter(m=>m.ruleId==='no-use-before-define'||m.fatal).map(m=>`${path.relative(root,r.filePath)}:${m.line}:${m.column} ${m.message}`));
if(bad.length){console.error('scope-lint-test: FAIL\n'+bad.join('\n'));process.exit(1);}
console.log(`scope-lint-test: ok (${results.length} modules, no name used before its declaration in the same function)`);
