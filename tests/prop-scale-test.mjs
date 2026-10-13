import assert from 'node:assert/strict';
import { propUnitCorrection } from '../prop-scale.mjs';

const expected = [300, 30, 200];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
close(propUnitCorrection([.3, .03, .2], expected), 1);
close(propUnitCorrection([300, 30, 200], expected), .001);
close(propUnitCorrection([300/25.4, 30/25.4, 200/25.4], expected), .0254);
close(propUnitCorrection([.3*25.4, .03*25.4, .2*25.4], expected), 1/25.4);
close(propUnitCorrection([.30002, .02998, .19999], expected), 1);
// Bounds that differ in one axis are a shape/metadata change, not mixed units.
close(propUnitCorrection([.6, .03, .2], expected), 1);
close(propUnitCorrection([.6, 0, .4], [300, 0, 200]), .5);
close(propUnitCorrection([0, 0, 0], expected), 1);
console.log('Prop unit correction: metres, millimetres, inches, rounding and shape changes passed.');
