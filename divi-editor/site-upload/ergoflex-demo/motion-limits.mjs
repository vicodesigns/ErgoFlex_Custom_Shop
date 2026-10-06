// Preview clearance envelope supplied for the Standard and Extended desktops.
// Between the measured endpoints, use linear interpolation so lift and tilt
// controls meet at the same boundary from either direction.
// Preview rates retuned from the owner's real-desk comparison (not measured calibration).
// Tilt is degrees/second; glide is metres/second, with rotation derived from wheel geometry.
export const TILT_SPEEDS = Object.freeze({ auto: 3.5, slow: 1.75, medium: 3.5, fast: 7 });
export const GLIDE_SPEEDS = Object.freeze({ crawl: .0085, ninja: .034, slow: .0765, medium: .153, fast: .306 });
export const TILT_MIN = -5;
export const TILT_MAX = 65;
export const LOW_HEIGHT_MAX_TILT = 39;
export const LOW_HEIGHT = 28;
export const FULL_TILT_MIN_HEIGHT = Object.freeze({ '48x30': 40.5, '60x30': 42.5 });

// The Rhino rest pose is the physical -5° position. Increasing the displayed
// tilt turns this model around its Z pivot in the negative direction.
export function rigDegreesForTilt(displayDegrees) {
    return TILT_MIN - displayDegrees;
}

function fullTiltHeight(size) {
    return FULL_TILT_MIN_HEIGHT[size] ?? FULL_TILT_MIN_HEIGHT['48x30'];
}

export function maximumTiltForHeight(height, size) {
    const rise = fullTiltHeight(size) - LOW_HEIGHT;
    const fraction = Math.max(0, Math.min(1, (height - LOW_HEIGHT) / rise));
    return LOW_HEIGHT_MAX_TILT + fraction * (TILT_MAX - LOW_HEIGHT_MAX_TILT);
}

export function minimumHeightForTilt(tilt, size) {
    const fraction = Math.max(0, Math.min(1,
        (tilt - LOW_HEIGHT_MAX_TILT) / (TILT_MAX - LOW_HEIGHT_MAX_TILT)));
    return LOW_HEIGHT + fraction * (fullTiltHeight(size) - LOW_HEIGHT);
}
