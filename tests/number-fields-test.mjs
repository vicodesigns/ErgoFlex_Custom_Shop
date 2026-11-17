// P5: scrubbing a number field by its label (number-fields.mjs scrubValue): 4 px a step, Shift ×10, Ctrl ×0.1,
// rounded to the step, clamped to min / max.
import assert from 'node:assert/strict';
import {scrubValue} from '../experience/number-fields.mjs';
assert.equal(scrubValue({start:10,dx:40,step:1}),20);
assert.equal(scrubValue({start:10,dx:-40,step:1,min:5}),5,'clamped');
assert.equal(scrubValue({start:10,dx:8,step:1,shift:true}),30,'Shift ×10');
assert.equal(scrubValue({start:1,dx:12,step:.1}),1.3);
assert.equal(scrubValue({start:1,dx:12,step:.1,ctrl:true}),1.03,'Ctrl ×0.1');
assert.equal(scrubValue({start:37.2,dx:4,step:.5}),37.5,'lands on the step');
assert.equal(scrubValue({start:0,dx:4000,step:5,max:100}),100);
assert.equal(scrubValue({start:2,dx:4,step:0}),3,'no step: 1');
console.log('number-fields-test: ok');
