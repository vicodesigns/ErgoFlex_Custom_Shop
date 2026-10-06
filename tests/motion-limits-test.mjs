import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TILT_SPEEDS, GLIDE_SPEEDS, TILT_MIN, TILT_MAX, maximumTiltForHeight, minimumHeightForTilt, rigDegreesForTilt } from '../motion-limits.mjs';

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

test('motion tiers use slower real-desk comparison rates',()=>{
    assert.equal(TILT_SPEEDS.fast,7);assert.equal(GLIDE_SPEEDS.fast,.306);
    assert.equal(TILT_SPEEDS.slow,TILT_SPEEDS.fast/4);
    assert.equal(GLIDE_SPEEDS.slow,GLIDE_SPEEDS.fast/4);
    assert.equal(TILT_SPEEDS.auto,TILT_SPEEDS.medium);
    assert.ok(GLIDE_SPEEDS.crawl<GLIDE_SPEEDS.ninja&&GLIDE_SPEEDS.ninja<GLIDE_SPEEDS.slow&&GLIDE_SPEEDS.slow<GLIDE_SPEEDS.medium&&GLIDE_SPEEDS.medium<GLIDE_SPEEDS.fast);
});
