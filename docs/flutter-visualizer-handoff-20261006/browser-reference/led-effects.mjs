// Software preview parameters, independent of any physical LED protocol.
import { DECORATIVE_EFFECTS } from './led-showcase-effects.mjs?v=desktop-tilt-reach-20261006';
export const LED_EFFECTS = Object.freeze([
    { id: 'solid', label: 'Solid' },
    { id: 'breathe', label: 'Breathe' },
    { id: 'spectrum', label: 'Color cycle' },
    ...DECORATIVE_EFFECTS
]);

export function normalizeLedEffect(value = {}) {
    return {
        mode: LED_EFFECTS.some(effect => effect.id === value?.mode) ? value.mode : 'solid',
        period: Number.isFinite(Number(value?.period))
            ? Math.min(30, Math.max(4, Number(value.period))) : 8
    };
}

// Elapsed seconds make the result independent of display refresh rate.
// Reduced motion retains the selected base color and brightness.
export function sampleLedEffect(effect, elapsed, enabled = true, reducedMotion = false) {
    if (!enabled) return { gain: 0, hue: null };
    if (reducedMotion || effect.mode === 'solid' || effect.mode.startsWith('fx-')) return { gain: 1, hue: null };
    const phase = ((Math.max(0, elapsed) / effect.period) % 1);
    if (effect.mode === 'breathe')
        return { gain: 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2)), hue: null };
    // Begin at red and travel continuously through the full color wheel.
    return { gain: 1, hue: phase };
}
