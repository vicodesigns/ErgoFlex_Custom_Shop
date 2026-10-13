import { PRODUCT_CONFIG } from './catalog.mjs';

// Catalog finishes, rather than render-only paint names. A physical desk keeps
// its finish through the day; lighting and activity materials change instead.
const style = (name, woodFinish, baseFinish, trimColor, secondary = baseFinish) =>
    ({ name, woodFinish, baseFinish, trimColor, sheen: 'satin', secondary });
export const ROOM_DESK_STYLES = {
    home: style('Warm oak & sage', 'White Oak', 'Sand', '#286344', 'Forest'),
    office: style('Graphite & modern grey', 'Modern Grey', 'Space Gray', '#1c1c1e', 'Black'),
    library: style('Forest reading room', 'Earthy Forest Green', 'Black', '#f19c00', 'Forest'),
    coworking: style('Oak & fresh green', 'White Oak', 'White', '#286344', 'Forest'),
    music: style('Midnight studio', 'Black Birch', 'Black', '#85888c'),
    gaming: style('Carbon & red', 'Carbon Weave Wrap', 'Black', '#dc0909', 'Space Gray'),
    creative: style('Ivory atelier', 'Warm Ivory', 'Sand', '#85888c', 'White'),
    study: style('Walnut & forest', 'Walnut', 'Forest', '#286344', 'Black'),
    lounge: style('Walnut & warm gold', 'Walnut', 'Sand', '#f19c00'),
    kitchen: style('White & garden green', 'White Birch', 'White', '#286344'),
    gym: style('Grey & active green', 'Modern Grey', 'Black', '#286344', 'Space Gray'),
    scifi: style('Brushed silver & graphite', 'Brushed Silver Wrap', 'Space Gray', '#1c1c1e'),
    bedroom: style('Quiet oak & linen', 'White Oak', 'Sand', '#f5f5f2'),
    workshop: style('Maple & graphite', 'Maple', 'Space Gray', '#1c1c1e', 'Black'),
    gallery: style('Ivory & black', 'Warm Ivory', 'Black', '#1c1c1e', 'White'),
    security: style('Navy operations', 'Deep Navy', 'Black', '#85888c', 'Space Gray'),
    police: style('Grey & service navy', 'Modern Grey', 'Navy', '#85888c', 'Space Gray'),
    government: style('Walnut civic workspace', 'Walnut', 'Black', '#f19c00', 'Space Gray'),
    kindergarten: style('Birch & sunshine', 'Natural Birch', 'White', '#f0c52e', 'Sand'),
    elementary: style('Maple & learning green', 'Maple', 'White', '#286344', 'Sand'),
    middleschool: style('Modern grey maker space', 'Modern Grey', 'White', '#286344', 'Space Gray'),
    highschool: style('White & graphite classroom', 'White Birch', 'Space Gray', '#85888c', 'White'),
    college: style('Oak & academic navy', 'White Oak', 'Navy', '#1c1c1e', 'Space Gray'),
    university: style('Forest & gold seminar', 'Earthy Forest Green', 'Black', '#f19c00', 'Forest'),
    hospital: style('Clinical white & teal', 'White Birch', 'White', '#004c46', 'Silver'),
    laboratory: style('Neutral research bench', 'Modern Grey', 'White', '#1c1c1e', 'Silver'),
    mobileit: style('Carbon field workstation', 'Carbon Weave Wrap', 'Space Gray', '#85888c', 'Black'),
    occmedialab: style('OCC Coast navy & orange', 'Coast Navy', 'White', '#f99239', 'Silver')
};
export function cleanDeskStyle(value) {
    if (!value || !PRODUCT_CONFIG.woodFinishes.some(f => f.name === value.woodFinish) ||
        !PRODUCT_CONFIG.baseFinishes.some(f => f.name === value.baseFinish) ||
        !/^#[0-9a-f]{6}$/i.test(value.trimColor || '')) return null;
    return { woodFinish: value.woodFinish, baseFinish: value.baseFinish,
        trimColor: value.trimColor.toLowerCase(), sheen: ['matte', 'satin', 'gloss'].includes(value.sheen) ? value.sheen : 'satin' };
}
export function cleanRoomDeskStyles(value) {
    return Object.fromEntries(Object.entries(value || {}).filter(([id, s]) =>
        (id === 'product' || ROOM_DESK_STYLES[id]) && cleanDeskStyle(s)).map(([id, s]) => [id, cleanDeskStyle(s)]));
}
export function stationDeskStyle(sceneId, station, index = 0) {
    const palette = ROOM_DESK_STYLES[sceneId]; if (!palette) return null;
    // Paired support desks share the room palette without looking like copies.
    // Role IDs and layouts remain the authority for size, position and tools.
    return { ...palette, baseFinish: index % 2 ? palette.secondary : palette.baseFinish,
        trimColor: /repair|research|maker|diagnostic/.test(station.id) ? '#85888c' : palette.trimColor };
}
