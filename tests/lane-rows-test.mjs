import assert from 'node:assert/strict';
import {stackRows,rowsStyle,rowVar} from '../experience/lane-rows.mjs';
// No overlap: one row. Touching items share a row.
let r=stackRows([{id:'a',start:0,end:2},{id:'b',start:2,end:4},{id:'c',start:5,end:6}]);
assert.equal(r.count,1);assert.deepEqual([...r.row.values()],[0,0,0]);
// Overlap: the later item goes to a new row; a row is reused once its item ended.
r=stackRows([{id:'a',start:0,end:4},{id:'b',start:1,end:3},{id:'c',start:2,end:6},{id:'d',start:4.5,end:5}]);
assert.equal(r.count,3);assert.equal(r.row.get('a'),0);assert.equal(r.row.get('b'),1);assert.equal(r.row.get('c'),2);assert.equal(r.row.get('d'),0,'a free row is reused');
// Input order does not matter; ids at the same start keep the longer one on top.
const x=stackRows([{id:'b',start:1,end:3},{id:'a',start:0,end:4}]);assert.equal(x.row.get('a'),0);assert.equal(x.row.get('b'),1);
assert.equal(stackRows([]).count,1);
assert.equal(rowsStyle(1),'');assert.equal(rowsStyle(2),' style="--rows:2"');assert.equal(rowVar(r,'c'),'--row:2;');assert.equal(rowVar(stackRows([{id:'q',start:0,end:1}]),'q'),'');
console.log('Lane rows: overlapping items stack into sub-rows, free rows are reused, touching items share one, a lane without overlap stays one row.');
