// Saved poses use room-local millimetres and radians, not camera/world space.
export const GROOVE_PRESETS_KEY = 'ergoflex.groovePositionsV1';
export const groovePresetKey = (scene, layout, size, phase) => [scene, layout, size, phase].join('/');
export function normalizeGroovePresets(input) {
    const result = {};
    for (const [key, value] of Object.entries(input || {})) {
        if (!/^[a-z]+\/[a-z]+\/(48x30|60x30)\/[a-z]+$/.test(key) || !value?.pose) continue;
        const { x, z, yaw } = value.pose, { height, tilt } = value;
        if (![x, z, yaw, height, tilt].every(Number.isFinite) || Math.abs(x) > 100000 || Math.abs(z) > 100000 || Math.abs(yaw) > 10000 || height < 28 || height > 52.5 || tilt < -5 || tilt > 90) continue;
        try {
            const lights = JSON.stringify(value.lights || {});
            if (lights.length > 60000) continue;
            result[key] = { pose: { x, z, yaw }, height, tilt, lights: JSON.parse(lights) };
        } catch {}
    }
    return result;
}
