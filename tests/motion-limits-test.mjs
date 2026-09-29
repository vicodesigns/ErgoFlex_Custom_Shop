import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TILT_MIN, TILT_MAX, maximumTiltForHeight, minimumHeightForTilt, rigDegreesForTilt } from '../motion-limits.mjs';

test('clearance endpoints and inverse agree for both desktop sizes', () => {
    assert.equal(TILT_MIN, -5);
    assert.equal(TILT_MAX, 65);
    assert.equal(rigDegreesForTilt(-5), 0);
    assert.equal(rigDegreesForTilt(0), -5);
    assert.equal(rigDegreesForTilt(65), -70);
    for (const [size, fullHeight] of [['48x30', 40.5], ['60x30', 42.5]]) {
        assert.equal(maximumTiltForHeight(28, size), 39);
        assert.equal(maximumTiltForHeight(fullHeight, size), 65);
        assert.equal(minimumHeightForTilt(39, size), 28);
        assert.equal(minimumHeightForTilt(65, size), fullHeight);
        const halfwayHeight = (28 + fullHeight) / 2;
        assert.equal(maximumTiltForHeight(halfwayHeight, size), 52);
        assert.equal(minimumHeightForTilt(52, size), halfwayHeight);
        assert.equal(minimumHeightForTilt(-5, size), 28);
        assert.equal(maximumTiltForHeight(52.5, size), 65);
    }
});
